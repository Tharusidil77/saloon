const { app } = require('@azure/functions');

app.http('submitData', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // 1. Read the JSON data sent from your Bootstrap frontend form
        const body = await request.json();

        // 2. This is your backend space! You can run calculations, talk to databases, etc.
        const messageFromServer = `Hello ${body.name || 'User'}, your backend is working perfectly!`;

        // 3. Send the response back to your frontend
        return { 
            status: 200, 
            jsonBody: { message: messageFromServer } 
        };
    }
});