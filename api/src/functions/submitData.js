const { app } = require('@azure/functions');
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'flexibleserverdb',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    ssl: { rejectUnauthorized: false }
});

async function initializeTables() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) NOT NULL UNIQUE,
            email VARCHAR(255) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT DEFAULT 1,
            type ENUM('income', 'expense') NOT NULL,
            category VARCHAR(100),
            amount DECIMAL(10, 2) NOT NULL,
            description TEXT,
            date DATE NOT NULL
        );
    `);
}

app.http('manageFinance', {
    methods: ['POST', 'GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            await initializeTables();

            // ================= GET REQUESTS (READ DATA) =================
            if (request.method === 'GET') {
                const url = new URL(request.url);
                const targetDate = url.searchParams.get('date');

                // If a date filter is appended, serve specific diagnostic logs
                if (targetDate) {
                    const [rows] = await pool.query('SELECT * FROM transactions WHERE date = ? ORDER BY id DESC', [targetDate]);
                    return { status: 200, jsonBody: rows };
                }

                // Default return: fetch everything
                const [allRows] = await pool.query('SELECT * FROM transactions ORDER BY date DESC, id DESC');
                return { status: 200, jsonBody: allRows };
            }

            // ================= POST REQUESTS (WRITE DATA) =================
            const body = await request.json();
            const { action } = body;

            if (action === 'addTransaction') {
                const { type, category, amount, description, date } = body;
                const recordDate = date || new Date().toISOString().split('T')[0];

                await pool.query(
                    'INSERT INTO transactions (user_id, type, category, amount, description, date) VALUES (1, ?, ?, ?, ?, ?)',
                    [type, category, amount, description, recordDate]
                );
                return { status: 201, jsonBody: { success: true, message: `${type} captured successfully! 💰` } };
            }

            if (action === 'deleteTransaction') {
                await pool.query('DELETE FROM transactions WHERE id = ?', [body.id]);
                return { status: 200, jsonBody: { success: true, message: "Record removed." } };
            }

            return { status: 400, jsonBody: { success: false, message: "Action invalid." } };
        } catch (error) {
            return { status: 500, jsonBody: { success: false, error: error.message } };
        }
    }
});