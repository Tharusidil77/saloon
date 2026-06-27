const { app } = require('@azure/functions');
const mysql = require('mysql2/promise');

// 1. Initialize MySQL Connection Pool with Azure SSL requirements
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '3306'),
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    // CRITICAL: Azure MySQL Flexible Server requires SSL to prevent connection dropping
    ssl: {
        rejectUnauthorized: false
    }
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

// Register the Azure Function endpoint
app.http('manageFinance', {
    methods: ['POST', 'GET'], // Enabled GET so you can test it directly via a URL link
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            // Force database tables generation on execution call
            await initializeTables();

            // Handle browser manual initialization check (GET request)
            if (request.method === 'GET') {
                return { 
                    status: 200, 
                    jsonBody: { success: true, message: "Azure MySQL Database tables initialized successfully! 🎉" } 
                };
            }

            // Handle functional app logic entries (POST request)
            const body = await request.json();
            const { action } = body; 

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
                const { userId, type, category, amount, description } = body; 
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