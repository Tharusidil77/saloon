// ================= BASE URL =================
// Crucial: In Azure Static Web Apps, we use relative paths so it works both locally and live in the cloud!
const API = "/api/manageFinance";

// Global data array to hold records in memory for current UI rendering
let data = [];
let table = document.getElementById("table");

// ================= SAFE FETCH =================
async function safeFetch(url, options = {}) {
    try {
        let res = await fetch(url, options);
        if (!res.ok) throw new Error("API error status code: " + res.status);
        let resData = await res.json();
        return resData;
    } catch (err) {
        console.error("Fetch Exception Error:", err);
        return null;
    }
}

// ================= FETCH ALL TRANSACTIONS (EXPENSES/INCOME) FROM AZURE MYSQL =================
async function fetchExpenses() {
    try {
        // We use GET to securely poll your records through your backend function
        let response = await safeFetch(`${API}?type=all`);
        
        // Handle array mapping gracefully depending on what Azure responds with
        let rawItems = (response && response.items) ? response.items : (Array.isArray(response) ? response : []);
        
        data = rawItems.map(item => ({
            id: item.id || "", 
            category: item.category || "General",
            type: item.type || "expense", 
            amount: Number(item.amount || 0),
            date: item.date ? item.date.split("T")[0] : new Date().toISOString().split("T")[0]
        }));
        render();
    } catch (err) {
        console.error("Error updating local UI array state:", err);
    }
}

// ================= REGISTER =================
async function register() {
    const emailEl = document.getElementById("email");
    const passwordEl = document.getElementById("password");

    const response = await safeFetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "createUser",
            username: emailEl.value.split('@')[0], // Generate a fallback screen username 
            email: emailEl.value
        })
    });

    if (response && response.success) {
        alert(response.message || "Registered Successfully! 👤");
        location.href = "login.html";
    } else {
        alert("Registration Failed: " + (response?.error || "Check backend engine values."));
    }
}

// ================= LOGIN =================
async function login() {
    const emailEl = document.getElementById("email");
    const passwordEl = document.getElementById("password");

    // Static Web Apps use localized mock or production logins. This handles the localStorage verification flag:
    if(emailEl.value && passwordEl.value) {
        localStorage.setItem("loggedUser", emailEl.value);
        localStorage.setItem("loggedUserId", "1"); // Fallback mock ID tied to user context matching table initialization
        location.href = "dashboard.html";
    } else {
        alert("Please enter a valid Email and Password format.");
    }
}

// ================= LOGOUT =================
function logout() {
    localStorage.removeItem("loggedUser");
    localStorage.removeItem("loggedUserId");
    location.href = "login.html";
}

// ================= ADD INCOME =================
async function addIncome() {
    const serviceEl = document.getElementById("service");
    const amountEl = document.getElementById("amount");
    const dateEl = document.getElementById("date") || { value: new Date().toISOString().split("T")[0] };
    const currentUserId = localStorage.getItem("loggedUserId") || 1;

    const response = await safeFetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "addTransaction",
            userId: parseInt(currentUserId),
            type: "income",
            category: "Service Income",
            amount: Number(amountEl.value),
            description: serviceEl ? serviceEl.value : "Saloon Walk-in Client Service"
        })
    });

    if (response && response.success) {
        alert("Income Added Successfully! 💰");
        location.href = "dashboard.html";
    } else {
        alert("Failed to add income: " + (response?.error || "Network response broken"));
    }
}

// ================= ADD EXPENSE =================
async function addExpense() {
    // Basic structural fallback logic if variable fields aren't explicitly assigned dynamically
    const cat = typeof selectedCategory !== 'undefined' ? selectedCategory : "Saloon Maintenance";
    const serv = typeof selectedService !== 'undefined' ? selectedService : "Inventory Order";
    const currentUserId = localStorage.getItem("loggedUserId") || 1;

    let amountInput = document.getElementById("amount").value;
    let amount = Number(amountInput);

    if (!amount || amount <= 0) {
        alert("Please enter a valid running balance amount.");
        return;
    }

    const response = await safeFetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "addTransaction",
            userId: parseInt(currentUserId),
            type: "expense",
            category: cat,
            amount: amount,
            description: serv
        })
    });

    if (response && response.success) {
        alert("Expense Recorded Successfully! 📉");
        document.getElementById("amount").value = "";
        fetchExpenses(); // Refresh items table values right away
    } else {
        alert("Failed to register expense payload parameters.");
    }
}

// ================= RENDER TABLE RECORDS =================
function render() {
    if (!table) return; 
    table.innerHTML = "";

    data.forEach((i, index) => {
        // Style highlights contextually depending on data classification rows
        const badgeColor = i.type === "income" ? "badge bg-success" : "badge bg-danger";
        table.innerHTML += `
        <tr>
        <td>${i.category}</td>
        <td><span class="${badgeColor}">${i.type.toUpperCase()}</span></td>
        <td>Rs. ${i.amount.toFixed(2)}</td>
        <td>${i.date}</td>
        <td>
            <button class="btn btn-danger btn-sm" onclick="deleteLocalRecord(${index})">Delete</button>
        </td>
        </tr>`;
    });

    if (typeof updateChart === "function") {
        updateChart();
    }
}

// ================= DASHBOARD METRICS CALCULATION =================
async function updateDashboard() {
    try {
        let today = new Date().toISOString().split("T")[0];
        let month = today.slice(0, 7);

        // Fetch metrics data securely via our direct backend payload handler function
        let response = await safeFetch(`${API}?type=all`);
        let rawItems = (response && response.items) ? response.items : (Array.isArray(response) ? response : []);

        // ================= CALCULATIONS =================
        let todayIncome = rawItems.filter(i => i.type === "income" && i.date?.startsWith(today)).reduce((s, i) => s + Number(i.amount || 0), 0);
        let todayExpense = rawItems.filter(i => i.type === "expense" && i.date?.startsWith(today)).reduce((s, i) => s + Number(i.amount || 0), 0);

        let monthIncome = rawItems.filter(i => i.type === "income" && i.date?.startsWith(month)).reduce((s, i) => s + Number(i.amount || 0), 0);
        let monthExpense = rawItems.filter(i => i.type === "expense" && i.date?.startsWith(month)).reduce((s, i) => s + Number(i.amount || 0), 0);

        // ================= UPDATE BOOTSTRAP GRAPH INTERFACE UI =================
        if (document.getElementById("todayIncome")) {
            document.getElementById("todayIncome").innerText = "Rs. " + todayIncome.toFixed(2);
            document.getElementById("todayExpense").innerText = "Rs. " + todayExpense.toFixed(2);
            document.getElementById("todayProfit").innerText = "Rs. " + (todayIncome - todayExpense).toFixed(2);
        }

        if (document.getElementById("monthIncome")) {
            document.getElementById("monthIncome").innerText = "Rs. " + monthIncome.toFixed(2);
            document.getElementById("monthExpense").innerText = "Rs. " + monthExpense.toFixed(2);
            document.getElementById("monthProfit").innerText = "Rs. " + (monthIncome - monthExpense).toFixed(2);
        }
    } catch (err) {
        console.log("Dashboard rendering exception caught:", err);
    }
}

// ================= INITIAL LOADING HOOKS =================
window.addEventListener("load", () => {
    if (table) {
        fetchExpenses();
    }
    setTimeout(updateDashboard, 400);
});