// ================= BASE URL =================
const API = "http://localhost:5000";

// Global data array to hold records in memory for current UI rendering
let data = [];
let table = document.getElementById("table");

// ================= SAFE FETCH =================
async function safeFetch(url){
    try{
        let res = await fetch(url);
        if(!res.ok) throw new Error("API error: " + url);
        let data = await res.json();
        return Array.isArray(data) ? data : [];
    }catch(err){
        console.log(err);
        return [];
    }
}

// ================= FETCH ALL EXPENSES FROM SERVER =================
async function fetchExpenses() {
    try {
        let expenses = await safeFetch(`${API}/expense`);
        // Map database object properties if needed, ensuring data numbers remain pristine
        data = expenses.map(item => ({
            id: item.id || item.RowKey || "", // Fallback structural indicators
            category: item.category,
            type: item.type || item.service || "Other", // Aligns database structure with dynamic type string
            amount: Number(item.amount),
            date: item.date ? item.date.split("T")[0] : new Date().toISOString().split("T")[0]
        }));
        render();
    } catch(err) {
        console.error("Error updating local UI array state:", err);
    }
}

// ================= REGISTER =================
function register(){
    const emailEl = document.getElementById("email");
    const passwordEl = document.getElementById("password");

    fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: emailEl.value,
            password: passwordEl.value
        })
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            alert(data.message || "Registered Successfully");
            location.href = "login.html";
        } else {
            alert("Registration Failed: " + (data.error || "Unknown Error"));
        }
    })
    .catch(err => {
        console.log(err);
        alert("Registration Failed");
    });
}

// ================= LOGIN =================
function login(){
    const emailEl = document.getElementById("email");
    const passwordEl = document.getElementById("password");

    fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: emailEl.value,
            password: passwordEl.value
        })
    })
    .then(res => res.json())
    .then(data => {
        if(data.success){
            localStorage.setItem("loggedUser", emailEl.value);
            location.href = "dashboard.html";
        } else {
            alert("Invalid Email or Password");
        }
    })
    .catch(err => {
        console.log(err);
        alert("Login Error");
    });
}

// ================= LOGOUT =================
function logout(){
    localStorage.removeItem("loggedUser");
    location.href = "login.html";
}

// ================= ADD INCOME =================
function addIncome(){
    const serviceEl = document.getElementById("service");
    const amountEl = document.getElementById("amount");
    const dateEl = document.getElementById("date") || { value: new Date().toISOString().split("T")[0] };

    fetch(`${API}/income`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            service: serviceEl ? serviceEl.value : selectedService,
            amount: Number(amountEl.value),
            date: dateEl.value
        })
    })
    .then(res => res.json())
    .then((data) => {
        if(data.error) throw new Error(data.error);
        alert("Income Added Successfully");
        location.href = "dashboard.html";
    })
    .catch(err => {
        console.log(err);
        alert("Failed to add income: " + err.message);
    });
}

// ================= ADD EXPENSE =================
function addExpense(){
    if(!selectedCategory || !selectedService){
        alert("Select category and service");
        return;
    }

    let amountInput = document.getElementById("amount").value;
    let amount = Number(amountInput);

    if(!amount || amount <= 0){
        alert("Enter valid amount");
        return;
    }

    let date = new Date().toISOString().split("T")[0];

    // Packages payload fields to seamlessly match backend destination expectations
    fetch(`${API}/expense`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            category: selectedCategory,
            type: selectedService, 
            amount: amount,
            date: date
        })
    })
    .then(res => res.json())
    .then((resData) => {
        if(resData.error) throw new Error(resData.error);
        
        // Clean the UI input box
        document.getElementById("amount").value = "";
        
        // Re-fetch clean list from backend SQL to sync table instantly
        fetchExpenses();
    })
    .catch(err => {
        console.log(err);
        alert("Failed to add expense");
    });
}

// ================= RENDER =================
function render(){
    if (!table) return; // Guard clause if elements don't live on current page
    table.innerHTML = "";

    data.forEach((i, index)=>{
        table.innerHTML += `
        <tr>
        <td>${i.category}</td>
        <td>${i.type}</td>
        <td>${i.amount}</td>
        <td>${i.date}</td>
        <td>
            <button class="btn btn-warning btn-sm" onclick="edit(${index})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="del(${index})">Delete</button>
        </td>
        </tr>`;
    });

    updateChart();
}

// ================= DAILY REPORT =================
async function getReport(date){
    let income = await safeFetch(`${API}/income`);
    let expense = await safeFetch(`${API}/expense`);

    let totalIncome = income
        .filter(i => i.date === date)
        .reduce((sum,i) => sum + Number(i.amount || 0), 0);

    let totalExpense = expense
        .filter(e => e.date === date)
        .reduce((sum,e) => sum + Number(e.amount || 0), 0);

    return {
        income: totalIncome,
        expense: totalExpense,
        profit: totalIncome - totalExpense
    };
}

// ================= DASHBOARD UPDATE =================
async function updateDashboard(){
    try{
        let today = new Date().toISOString().split("T")[0];
        let month = today.slice(0,7);

        let income = await safeFetch(`${API}/income`);
        let expense = await safeFetch(`${API}/expense`);

        // ================= TODAY =================
        let todayIncome = income
            .filter(i => i.date === today)
            .reduce((s,i)=> s + Number(i.amount || 0),0);

        let todayExpense = expense
            .filter(e => e.date === today)
            .reduce((s,e)=> s + Number(e.amount || 0),0);

        // ================= MONTH =================
        let monthIncome = income
            .filter(i => i.date?.startsWith(month))
            .reduce((s,i)=> s + Number(i.amount || 0),0);

        let monthExpense = expense
            .filter(e => e.date?.startsWith(month))
            .reduce((s,e)=> s + Number(e.amount || 0),0);

        // ================= UPDATE UI =================
        if(document.getElementById("todayIncome")){
            document.getElementById("todayIncome").innerText = "Rs. " + todayIncome;
            document.getElementById("todayExpense").innerText = "Rs. " + todayExpense;
            document.getElementById("todayProfit").innerText = "Rs. " + (todayIncome - todayExpense);
        }

        if(document.getElementById("monthIncome")){
            document.getElementById("monthIncome").innerText = "Rs. " + monthIncome;
            document.getElementById("monthExpense").innerText = "Rs. " + monthExpense;
            document.getElementById("monthProfit").innerText = "Rs. " + (monthIncome - monthExpense);
        }

    }catch(err){
        console.log("Dashboard error:", err);
    }
}

// ================= AUTO LOAD =================
window.addEventListener("load", () => {
    // If table element is present, fetch expenses array directly on load
    if(table) {
        fetchExpenses();
    }
    setTimeout(updateDashboard, 300);
});

// Example function: call this when your Bootstrap button or form is submitted
async function sendDataToBackend() {
    const userData = { name: "Alex" }; // Example payload

    try {
        // Simply point to '/api/FunctionName'
        const response = await fetch('/api/submitData', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        const result = await response.json();
        
        // Alert the message returned from your Azure backend!
        alert(result.message); 
    } catch (error) {
        console.error("Could not reach backend:", error);
    }
}