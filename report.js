/* ===========================================
   Khattak Welfare Report
   report.js
=========================================== */

/* ==========
   API URL
========== */
const API_URL = "https://script.google.com/macros/s/AKfycbzw0Xu6D1J2PZ_M84Ux2gC2iicqnAeaC-wX0ZgmApVfF4MVvFf6uhjB6EWZoCrdMeDI/exec";

/* ==========
   DOM Elements
========== */
const loading = document.getElementById("loading");
const reportContainer = document.getElementById("reportContainer");
const tableBody = document.getElementById("fundTableBody");
const reportMonth = document.getElementById("reportMonth");

// Summary Dynamic Card References
const totalGroupFund = document.getElementById("totalGroupFund");
const totalEmergencyFund = document.getElementById("totalEmergencyFund");
const totalCollection = document.getElementById("totalCollection");
const totalExpenses = document.getElementById("totalExpenses");
const closingBalance = document.getElementById("closingBalance");
const totalEntries = document.getElementById("totalEntries");

// Comparative Target Nodes (Updated with Expense References)
const lblPrevMonth = document.getElementById("lblPrevMonth");
const lblCurrMonth = document.getElementById("lblCurrMonth");
const prevGroup = document.getElementById("prevGroup");
const prevEmergency = document.getElementById("prevEmergency");
const prevExpenses = document.getElementById("prevExpenses"); // New reference
const prevMonthTotal = document.getElementById("prevMonthTotal");

const currGroup = document.getElementById("currGroup");
const currEmergency = document.getElementById("currEmergency");
const currExpenses = document.getElementById("currExpenses"); // New reference
const currMonthTotal = document.getElementById("currMonthTotal");

// Target Filtering Elements
const searchInput = document.getElementById("searchInput");
const yearFilter = document.getElementById("yearFilter");
const monthFilter = document.getElementById("monthFilter");
const fundTypeFilter = document.getElementById("fundTypeFilter"); 
const printBtn = document.getElementById("printBtn");

/* ==========
   Global App States
========== */
let rawData = [];
let filteredData = [];

// Static Month dictionary maps for comparative visual indicators
const urduMonthNames = {
    "01": "جنوری", "02": "فروری", "03": "مارچ", "04": "اپریل",
    "05": "مئی", "06": "جون", "07": "جولائی", "08": "اگست",
    "09": "ستمبر", "10": "اکتوبر", "11": "نومبر", "12": "دسمبر"
};

/* ==========
   URL Parameter Mapping & Initialization
========== */
const params = new URLSearchParams(window.location.search);
const sheetName = params.get("sheet") || "July2026";

reportMonth.innerHTML = sheetName.replace(/([A-Za-z]+)(\d+)/, "$1 $2");

/* ==========
   Utility Helpers
========== */
function money(value) {
    if (value === undefined || value === null) return "0";
    return Number(value).toLocaleString("en-US");
}

function showLoading() {
    loading.style.display = "flex";
    reportContainer.style.display = "none";
}

function hideLoading() {
    loading.style.display = "none";
    reportContainer.style.display = "block";
}

/* ==========
   Fetch Data Pipelines
========== */
async function loadReport() {
    showLoading();
    try {
        const response = await fetch(API_URL + "?sheet=" + encodeURIComponent(sheetName));
        if (!response.ok) throw new Error("Network Error");

        rawData = await response.json();

        populateDropdownFilters();
        applyFilters(); 
        hideLoading();
    } catch (error) {
        console.error(error);
        loading.innerHTML = `<h2>رپورٹ لوڈ نہیں ہو سکی</h2><p>${error.message}</p>`;
    }
}

loadReport();

/* ==========
   Data Structural Translators
========== */
function getRecords() {
    if (rawData.length === 0) return [];
    const headers = rawData[0];
    return rawData.slice(1).map(row => {
        let obj = {};
        headers.forEach((head, index) => {
            obj[head] = row[index];
        });
        return obj;
    });
}

/* ==========
   Dynamic Filter Selectors Population
========== */
function populateDropdownFilters() {
    const rows = getRecords();
    const years = new Set();
    const months = new Set();

    rows.forEach(x => {
        if (x.Date) {
            const cleanDate = String(x.Date).replace(/\//g, '-');
            const parts = cleanDate.split('-');
            if (parts.length >= 2) {
                years.add(parts[0]);
                months.add(parts[1]);
            }
        }
    });

    yearFilter.innerHTML = `<option value="">سال منتخب کریں (All)</option>`;
    [...years].sort((a, b) => b - a).forEach(year => {
        yearFilter.innerHTML += `<option value="${year}">${year}</option>`;
    });

    monthFilter.innerHTML = `<option value="">مہینہ منتخب کریں (All)</option>`;
    [...months].sort().forEach(m => {
        const displayLabel = urduMonthNames[m] || m;
        monthFilter.innerHTML += `<option value="${m}">${displayLabel}</option>`;
    });
}

/* ==========
   Core Filtering & Math Processing Logic
========== */
function applyFilters() {
    const rows = getRecords();

    const keyword = searchInput.value.trim().toLowerCase();
    const selectedYear = yearFilter.value;
    const selectedMonth = monthFilter.value;
    const selectedType = fundTypeFilter.value;

    // 1. Process main filtered table dataset
    filteredData = rows.filter(item => {
        let ok = true;

        if (keyword) {
            ok = String(item.Name || "").toLowerCase().includes(keyword);
        }

        if (ok && (selectedYear || selectedMonth)) {
            const cleanDate = String(item.Date || "").replace(/\//g, '-');
            const parts = cleanDate.split('-');
            if (selectedYear && parts[0] !== selectedYear) ok = false;
            if (ok && selectedMonth && parts[1] !== selectedMonth) ok = false;
        }

        if (ok && selectedType !== "both") {
            ok = String(item.Type || "").trim() === selectedType;
        }

        return ok;
    });

    // 2. Perform Calculations
    calculateSummaryAndComparisons(rows);
    renderFilteredTable();
}

/* ==========
   Summary and Multi-Month Comparison Calculations
========== */
function calculateSummaryAndComparisons(allRows) {
    // A. Calculations for the current active filters
    let groupTotal = 0;
    let emergencyTotal = 0;
    let expenseTotal = 0;

    filteredData.forEach(item => {
        const amount = Number(item.Amount || 0);
        const type = String(item.Type || "").trim();

        if (type === "Emergency Fund") {
            emergencyTotal += amount;
        } else if (type === "Expense") {
            expenseTotal += amount;
        } else {
            // Defaulting structural matches to Group Fund
            groupTotal += amount;
        }
    });

    const combinedIncome = groupTotal + emergencyTotal;
    const netClosingBalance = combinedIncome - expenseTotal;

    totalGroupFund.innerHTML = money(groupTotal);
    totalEmergencyFund.innerHTML = money(emergencyTotal);
    totalCollection.innerHTML = money(combinedIncome);
    totalExpenses.innerHTML = money(expenseTotal);
    closingBalance.innerHTML = money(netClosingBalance);
    totalEntries.innerHTML = filteredData.length;

    // B. Contextual Time Comparative Calculations (July 2026 vs June 2026 context)
    const targetYear = 2026;
    const targetMonthNum = 7; // July
    
    // Set text display labels explicitly
    lblCurrMonth.innerHTML = `${urduMonthNames["07"]} ${targetYear} (موجودہ)`;
    lblPrevMonth.innerHTML = `${urduMonthNames["06"]} ${targetYear} (گزشتہ)`;

    let currentMonthGroup = 0;
    let currentMonthEmergency = 0;
    let currentMonthExpenses = 0;

    let prevMonthGroup = 0;
    let prevMonthEmergency = 0;
    let prevMonthExpenses = 0;

    allRows.forEach(item => {
        if (!item.Date) return;

        const cleanDate = String(item.Date).replace(/\//g, '-');
        const parts = cleanDate.split('-'); // [YYYY, MM, DD]
        if (parts.length < 2) return;

        const itemYear = parseInt(parts[0], 10);
        const itemMonth = parseInt(parts[1], 10);
        const amount = Number(item.Amount || 0);
        const type = String(item.Type || "").trim();

        // Evaluate Current target period (July 2026)
        if (itemYear === targetYear && itemMonth === targetMonthNum) {
            if (type === "Emergency Fund") currentMonthEmergency += amount;
            else if (type === "Expense") currentMonthExpenses += amount;
            else currentMonthGroup += amount;
        }
        
        // Evaluate Previous target period (June 2026)
        if (itemYear === targetYear && itemMonth === (targetMonthNum - 1)) {
            if (type === "Emergency Fund") prevMonthEmergency += amount;
            else if (type === "Expense") prevMonthExpenses += amount;
            else prevMonthGroup += amount;
        }
    });

    // Populate current month comparison card DOM structural targets
    currGroup.innerHTML = money(currentMonthGroup);
    currEmergency.innerHTML = money(currentMonthEmergency);
    currExpenses.innerHTML = money(currentMonthExpenses);
    currMonthTotal.innerHTML = money((currentMonthGroup + currentMonthEmergency) - currentMonthExpenses);

    // Populate previous month comparison card DOM structural targets
    prevGroup.innerHTML = money(prevMonthGroup);
    prevEmergency.innerHTML = money(prevMonthEmergency);
    prevExpenses.innerHTML = money(prevMonthExpenses);
    prevMonthTotal.innerHTML = money((prevMonthGroup + prevMonthEmergency) - prevMonthExpenses);
}

/* ==========
   Dynamic Filtered Grid Component Builder
========== */
function renderFilteredTable() {
    tableBody.innerHTML = "";
    let sr = 1;

    const groups = {};
    filteredData.forEach(item => {
        if (!groups[item.Date]) groups[item.Date] = [];
        groups[item.Date].push(item);
    });

    Object.keys(groups).forEach(date => {
        const list = groups[date];
        const total = list.reduce((sum, item) => sum + Number(item.Amount || 0), 0);

        list.forEach((item, index) => {
            const tr = document.createElement("tr");
            
            // Generate minor indicator badges in the table row
            let typeUrdu = "گروپ";
            let badgeColor = "#718096";
            
            if (item.Type === "Emergency Fund") {
                typeUrdu = "ایمرجنسی";
                badgeColor = "#b7791f";
            } else if (item.Type === "Expense") {
                typeUrdu = "اخراجات";
                badgeColor = "#c53030";
            }

            const typeLabel = fundTypeFilter.value === "both" ? 
                ` <small style="color:${badgeColor}; font-size:0.75rem;">(${typeUrdu})</small>` : '';

            // Apply distinct red shading or styling if the entry is an Expense row
            const expenseRowStyle = item.Type === "Expense" ? 'style="color: #c53030; font-weight: 500;"' : '';

            let html = `
                <td>${sr++}</td>
                <td style="text-align:right" ${expenseRowStyle}>${item.Name}${typeLabel}</td>
                <td class="amount" ${expenseRowStyle}>${money(item.Amount)}</td>
            `;

            if (index === 0) {
                html += `
                    <td rowspan="${list.length}" class="date">
                        ${formatDate(date)}
                    </td>
                    <td rowspan="${list.length}" class="daily-total">
                        ${money(total)}
                    </td>
                `;
            }

            tr.innerHTML = html;
            tableBody.appendChild(tr);
        });
    });
}

/* ==========
   Event Listener Framework Bindings
========== */
searchInput.addEventListener("keyup", applyFilters);
yearFilter.addEventListener("change", applyFilters);
monthFilter.addEventListener("change", applyFilters);
fundTypeFilter.addEventListener("change", applyFilters);

printBtn.addEventListener("click", function() {
    window.print();
});

/* ==========
   Date Formatter (To DD/MM/YYYY)
========== */
function formatDate(dateString) {
    if (!dateString) return "";
    
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
        return dateString; 
    }
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); 
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
}