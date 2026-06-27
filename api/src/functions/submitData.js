const { app } = require('@azure/functions');
const sql = require('mssql');

// Azure Microsoft SQL Server configuration config context profile mapper
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_HOST, 
    database: process.env.DB_NAME,
    port: 1433,
    options: {
        encrypt: true, // Crucial requirement for Azure SQL connections
        trustServerCertificate: false
    }
};

// Structural MSSQL schema stabilizer 
async function initializeTables() {
    let pool = await sql.connect(config);
    await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[transactions]') AND type in (N'U'))
        BEGIN
            CREATE TABLE [dbo].[transactions] (
                [id] INT IDENTITY(1,1) PRIMARY KEY,
                [user_id] INT DEFAULT 1,
                [type] VARCHAR(20) NOT NULL CHECK ([type] IN ('income', 'expense')),
                [category] VARCHAR(100),
                [amount] DECIMAL(10, 2) NOT NULL,
                [description] VARCHAR(MAX),
                [date] DATE NOT NULL
            );
        END
    `);
}

app.http('manageFinance', {
    methods: ['POST', 'GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            await initializeTables();
            let pool = await sql.connect(config);

            // ================= GET REQ (READ RECORDS) =================
            if (request.method === 'GET') {
                const result = await pool.request().query('SELECT * FROM [dbo].[transactions] ORDER BY [date] DESC, [id] DESC');
                
                return { 
                    status: 200, 
                    headers: { 'Content-Type': 'application/json' },
                    jsonBody: result.recordset // Returns a clean JavaScript Array structure directly
                };
            }

            // ================= POST REQ (WRITE/DELETE RECORDS) =================
            const body = await request.json();
            const { action } = body;

            if (action === 'addTransaction') {
                const { type, category, amount, description, date } = body;
                const recordDate = date || new Date().toISOString().split('T')[0];

                await pool.request()
                    .input('type', sql.VarChar, type)
                    .input('category', sql.VarChar, category)
                    .input('amount', sql.Decimal(10, 2), amount)
                    .input('description', sql.VarChar, description)
                    .input('date', sql.Date, recordDate)
                    .query(`
                        INSERT INTO [dbo].[transactions] ([user_id], [type], [category], [amount], [description], [date]) 
                        VALUES (1, @type, @category, @amount, @description, @date)
                    `);

                return { status: 201, jsonBody: { success: true, message: "Record inserted!" } };
            }

            if (action === 'deleteTransaction') {
                await pool.request()
                    .input('id', sql.Int, body.id)
                    .query('DELETE FROM [dbo].[transactions] WHERE [id] = @id');

                return { status: 200, jsonBody: { success: true, message: "Record deleted!" } };
            }

            return { status: 400, jsonBody: { success: false, message: "Invalid action routing rule option." } };

        } catch (error) {
            // Keep status 200 so you can read exact authentication mistakes easily in your browser console if they happen
            return { 
                status: 200, 
                headers: { 'Content-Type': 'application/json' },
                jsonBody: { 
                    success: false, 
                    errorMessage: error.message,
                    errorStack: error.stack
                } 
            };
        }
    }
});