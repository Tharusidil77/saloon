const { app } = require('@azure/functions');
const mysql = require('mysql2/promise');
// 1. Initialize MySQL Connection Pool with Azure SSL requirements
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 3306, // Hardcode this to 3306 directly to eliminate port parsing bugs!
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
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
    methods: ['POST', 'GET'], 
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            // Force database tables generation on execution call
            await initializeTables();

            // ================= GET METHOD: FETCH DATA FROM DB =================
            if (request.method === 'GET') {
                // Query both tables to pull your data records
                const [transactions] = await pool.query('SELECT * FROM transactions ORDER BY date DESC');
                
                // Return the real live database rows straight to the frontend!
                return { 
                    status: 200, 
                    jsonBody: transactions // This passes the array directly to safeFetch()
                };
            }

            // ================= POST METHOD: SAVE DATA TO DB =================
            const body = await request.json();
            const { action } = body; 

            // --- ROUTE 1: CREATE A NEW USER ---
            if (action === 'createUser') {
                // Insert only if user does not exist to avoid crashing on unique constraints
                const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [body.email]);
                if (existing.length > 0) {
                    return { status: 200, jsonBody: { success: true, userId: existing[0].id, message: "Welcome back! 👤" } };
                }

                const [result] = await pool.query(
                    'INSERT INTO users (username, email) VALUES (?, ?)',
                    [body.username, body.email]
                );
                return { status: 201, jsonBody: { success: true, userId: result.insertId, message: "User registered! 👤" } };
            }

            // --- ROUTE 2: ADD INCOME OR EXPENSE ---
            if (action === 'addTransaction') {
                const { userId, type, category, amount, description } = body; 
                
                // Fallback mechanism to ensure a default user ID exists if registration was skipped
                let targetUserId = userId || 1;
                const [userCheck] = await pool.query('SELECT id FROM users WHERE id = ?', [targetUserId]);
                if (userCheck.length === 0) {
                    // Create default tenant container record if missing
                    await pool.query('INSERT IGNORE INTO users (id, username, email) VALUES (1, "admin", "admin@saloon.com")');
                    targetUserId = 1;
                }

                await pool.query(
                    'INSERT INTO transactions (user_id, type, category, amount, description) VALUES (?, ?, ?, ?, ?)',
                    [targetUserId, type, category, amount, description]
                );
                return { status: 201, jsonBody: { success: true, message: `${type} recorded successfully! 💰` } };
            }

            return { status: 400, jsonBody: { success: false, message: "Invalid action type." } };

        } catch (error) {
            return { status: 500, jsonBody: { success: false, error: error.message } };
        }
    }
});