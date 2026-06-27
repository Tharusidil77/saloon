const { app } = require('@azure/functions');
const mysql = require('mysql2/promise');

// 1. Initialize MySQL Connection Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
});

// Helper to initialize tables automatically if they don't exist
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
            user_id INT,
            type ENUM('income', 'expense') NOT NULL,
            category VARCHAR(100),
            amount DECIMAL(10, 2) NOT NULL,
            description TEXT,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    `);
}

app.http('manageFinance', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            await initializeTables(); // Ensure your MySQL database architecture is ready
            const body = await request.json();
            const { action } = body; // 'createUser', 'addIncome', or 'addExpense'

            // --- ROUTE 1: CREATE A NEW USER ---
            if (action === 'createUser') {
                const [result] = await pool.query(
                    'INSERT INTO users (username, email) VALUES (?, ?)',
                    [body.username, body.email]
                );
                return { status: 201, jsonBody: { success: true, userId: result.insertId, message: "User registered! 👤" } };
            }

            // --- ROUTE 2: ADD INCOME OR EXPENSE ---
            if (action === 'addTransaction') {
                const { userId, type, category, amount, description } = body; // type is 'income' or 'expense'
                await pool.query(
                    'INSERT INTO transactions (user_id, type, category, amount, description) VALUES (?, ?, ?, ?, ?)',
                    [userId, type, category, amount, description]
                );
                return { status: 201, jsonBody: { success: true, message: `${type} recorded successfully! 💰` } };
            }

            return { status: 400, jsonBody: { success: false, message: "Invalid action type." } };

        } catch (error) {
            return { status: 500, jsonBody: { success: false, error: error.message } };
        }
    }
});