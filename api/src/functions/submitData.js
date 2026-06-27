const { app } = require('@azure/functions');
const mysql = require('mysql2/promise');

// Secure Connection Pool configuration utilizing explicit environment contexts
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

// Structural schema stabilizer
async function initializeTables() {
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

            // ================= GET REQ (READ RECORDS) =================
            if (request.method === 'GET') {
                const [allRows] = await pool.query('SELECT * FROM transactions ORDER BY date DESC, id DESC');
                
                return { 
                    status: 200, 
                    headers: { 'Content-Type': 'application/json' },
                    jsonBody: allRows 
                };
            }

            // ================= POST REQ (WRITE/DELETE RECORDS) =================
            // CRITICAL FIX: Only parse body if method is POST to prevent crashing on GET requests
            const body = await request.json();
            const { action } = body;

            if (action === 'addTransaction') {
                const { type, category, amount, description, date } = body;
                const recordDate = date || new Date().toISOString().split('T')[0];

                await pool.query(
                    'INSERT INTO transactions (user_id, type, category, amount, description, date) VALUES (1, ?, ?, ?, ?, ?)',
                    [type, category, amount, description, recordDate]
                );
                return { status: 201, jsonBody: { success: true, message: "Record inserted!" } };
            }

            if (action === 'deleteTransaction') {
                await pool.query('DELETE FROM transactions WHERE id = ?', [body.id]);
                return { status: 200, jsonBody: { success: true, message: "Record deleted!" } };
            }

            return { status: 400, jsonBody: { success: false, message: "Invalid backend routing action rule option." } };

        } catch (error) {
            // Diagnostic bypass: This catches and prints out database connection config issues cleanly
            return { 
                status: 200, // Kept at 200 so you can read the error explicitly on your frontend screen
                headers: { 'Content-Type': 'application/json' },
                jsonBody: { 
                    success: false, 
                    errorMessage: error.message,
                    errorStack: error.stack,
                    tip: "If you see ETIMEDOUT here, check your MySQL server networking/firewall settings in the Azure Portal."
                } 
            };
        }
    }
});