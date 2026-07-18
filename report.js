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

// Summary Dynamic Card References (کل ریکارڈز - لائف ٹائم ڈیٹا)
const totalGroupFund = document.getElementById("totalGroupFund");
const totalEmergencyFund = document.getElementById("totalEmergencyFund");
const totalCollection = document.getElementById("totalCollection");
const totalExpenses = document.getElementById("totalExpenses"); 
const closingBalance = document.getElementById("closingBalance"); 
const totalEntries = document.getElementById("totalEntries");   

// Target Filtering Elements (فلٹر شدہ رزلٹ کارڈ کے نوڈز)
const lblCurrMonth = document.getElementById("lblCurrMonth");
const currGroup = document.getElementById("currGroup");
const currEmergency = document.getElementById("currEmergency");
const currExpenses = document.getElementById("currExpenses"); 
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

if (reportMonth) {
    reportMonth.innerHTML = sheetName.replace(/([A-Za-z]+)(\d+)/, "$1 $2");
}

/* ==========
   Utility Helpers
========== */
function money(value) {
    if (value === undefined || value === null) return "0";
    return Number(value).toLocaleString("en-US");
}

function showLoading() {
    if (loading) loading.style.display = "flex";
    if (reportContainer) reportContainer.style.display = "none";
}

function hideLoading() {
    if (loading) loading.style.display = "none";
    if (reportContainer) reportContainer.style.display = "block";
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
        if (loading) {
            loading.innerHTML = `<h2>رپورٹ لوڈ نہیں ہو سکی</h2><p>${error.message}</p>`;
        }
    }
}

// Start execution once script loads
loadReport();

/* ==========
   Data Structural Translators
========== */
function getRecords() {
    if (!rawData || rawData.length === 0) return [];
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

    if (yearFilter) {
        yearFilter.innerHTML = `<option value="">سال منتخب کریں (All)</option>`;
        [...years].sort((a, b) => b - a).forEach(year => {
            yearFilter.innerHTML += `<option value="${year}">${year}</option>`;
        });
    }

    if (monthFilter) {
        monthFilter.innerHTML = `<option value="">مہینہ منتخب کریں (All)</option>`;
        [...months].sort().forEach(m => {
            const displayLabel = urduMonthNames[m] || m;
            monthFilter.innerHTML += `<option value="${m}">${displayLabel}</option>`;
        });
    }
}

/* ==========
   Core Filtering & Math Processing Logic
========== */
function applyFilters() {
    const rows = getRecords();

    const keyword = (searchInput && searchInput.value) ? searchInput.value.trim().toLowerCase() : "";
    const selectedYear = (yearFilter && yearFilter.value) ? yearFilter.value : "";
    const selectedMonth = (monthFilter && monthFilter.value) ? monthFilter.value : "";
    const selectedType = (fundTypeFilter && fundTypeFilter.value) ? fundTypeFilter.value : "both";

    // 1. Process main filtered dataset (Filters the table data dynamically)
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

    // 2. Perform Calculations (Pass both raw rows for top cards and filteredData for dynamic updates)
    calculateSummaryAndFilteredResults(rows, filteredData);
    renderFilteredTable();
}

/* ==========
   Summary and Live Filter Calculations
========== */
function calculateSummaryAndFilteredResults(allRows, filteredRows) {
    
    // ==========================================
    // A. CALCULATE GLOBAL METRICS (Top Row Cards - Unaffected by UI Filters)
    // ==========================================
    let globalGroupFund = 0;
    let globalEmergencyFund = 0;
    let globalExpenseTotal = 0;

    allRows.forEach(item => {
        const amount = Math.max(0, Number(item.Amount || 0)); // رقم نیگیٹو نہ ہو
        const type = String(item.Type || "").trim();
        const deductFrom = String(item.Deduct_From || "").trim();

        if (type === "Emergency Fund") {
            globalEmergencyFund += amount;
        } else if (type === "Expense") {
            globalExpenseTotal += amount;
            if (deductFrom === "Emergency Fund") {
                globalEmergencyFund -= amount;
            } else {
                globalGroupFund -= amount;
            }
        } else {
            globalGroupFund += amount;
        }
    });

    // فنڈز کی فائنل ویلیو کو زیرو (0) سے نیچے جانے سے روکنا
    globalGroupFund = Math.max(0, globalGroupFund);
    globalEmergencyFund = Math.max(0, globalEmergencyFund);

    const netClosingBalance = globalGroupFund + globalEmergencyFund;
    const totalIncomeIncludingExpenses = globalGroupFund + globalEmergencyFund + globalExpenseTotal;

    if (totalGroupFund) totalGroupFund.innerHTML = money(globalGroupFund);
    if (totalEmergencyFund) totalEmergencyFund.innerHTML = money(globalEmergencyFund);
    if (totalCollection) totalCollection.innerHTML = money(totalIncomeIncludingExpenses); 
    if (totalExpenses) totalExpenses.innerHTML = money(globalExpenseTotal);
    if (closingBalance) closingBalance.innerHTML = money(netClosingBalance);
    if (totalEntries) totalEntries.innerHTML = filteredRows.length;

    // ==========================================
    // B. CALCULATE DYNAMIC FILTER RESULTS (Only on UI Applied Filters)
    // ==========================================
    let filterGroup = 0;
    let filterEmergency = 0;
    let filterExpenses = 0;

    filteredRows.forEach(item => {
        const amount = Math.max(0, Number(item.Amount || 0)); // رقم نیگیٹو نہ ہو
        const type = String(item.Type || "").trim();
        const deductFrom = String(item.Deduct_From || "").trim();

        if (type === "Emergency Fund") {
            filterEmergency += amount;
        } else if (type === "Expense") {
            filterExpenses += amount;
            if (deductFrom === "Emergency Fund") filterEmergency -= amount;
            else filterGroup -= amount;
        } else {
            filterGroup += amount;
        }
    });

    // فلٹر شدہ فنڈز کی فائنل ویلیو کو بھی زیرو (0) سے نیچے جانے سے روکنا
    filterGroup = Math.max(0, filterGroup);
    filterEmergency = Math.max(0, filterEmergency);

    // Update the Filter Result UI Card with live changes
    if (currGroup) currGroup.innerHTML = money(filterGroup);
    if (currEmergency) currEmergency.innerHTML = money(filterEmergency);
    if (currExpenses) currExpenses.innerHTML = money(filterExpenses);
    
    // Net result of applied filters (Group + Emergency)
    if (currMonthTotal) currMonthTotal.innerHTML = money(filterGroup + filterEmergency);

    // Dynamic Label text modification to give active hint to user
    if (lblCurrMonth) {
        const activeSearch = searchInput && searchInput.value ? 'سرچ شدہ' : 'منتخب';
        lblCurrMonth.innerHTML = `موجودہ ${activeSearch} فلٹر کا لائیو رزلٹ`;
    }
}

/* ==========
   Dynamic Filtered Grid Component Builder
========== */
function renderFilteredTable() {
    if (!tableBody) return;
    tableBody.innerHTML = "";
    let sr = 1;

    const groups = {};
    filteredData.forEach(item => {
        if (!item.Date) return;
        if (!groups[item.Date]) groups[item.Date] = [];
        groups[item.Date].push(item);
    });

    Object.keys(groups).forEach(date => {
        const list = groups[date];
        // ٹیبل ڈیلی ٹوٹل میں بھی ویلیو نیگیٹو نہ ہو
        const total = list.reduce((sum, item) => sum + Math.max(0, Number(item.Amount || 0)), 0);

        list.forEach((item, index) => {
            const tr = document.createElement("tr");
            
            let typeUrdu = "گروپ";
            let badgeColor = "#718096";
            
            if (item.Type === "Emergency Fund") {
                typeUrdu = "ایمرجنسی";
                badgeColor = "#b7791f";
            } else if (item.Type === "Expense") {
                typeUrdu = "اخراجات";
                badgeColor = "#c53030";
            }

            const currentTypeFilter = fundTypeFilter ? fundTypeFilter.value : "both";
            const typeLabel = currentTypeFilter === "both" ? 
                ` <small style="color:${badgeColor}; font-size:0.75rem;">(${typeUrdu})</small>` : '';

            const expenseRowStyle = item.Type === "Expense" ? 'style="color: #c53030; font-weight: 500;"' : '';

            let html = `
                <td>${sr++}</td>
                <td style="text-align:right" ${expenseRowStyle}>${item.Name || ""}${typeLabel}</td>
                <td class="amount" ${expenseRowStyle}>${money(Math.max(0, item.Amount))}</td>
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

/* ==========
   Safe Event Listener Framework Bindings
========== */
if (searchInput && typeof searchInput.addEventListener === "function") {
    searchInput.addEventListener("input", applyFilters); 
}
if (yearFilter && typeof yearFilter.addEventListener === "function") {
    yearFilter.addEventListener("change", applyFilters);
}
if (monthFilter && typeof monthFilter.addEventListener === "function") {
    monthFilter.addEventListener("change", applyFilters);
}
if (fundTypeFilter && typeof fundTypeFilter.addEventListener === "function") {
    fundTypeFilter.addEventListener("change", applyFilters);
}
if (printBtn && typeof printBtn.addEventListener === "function") {
    printBtn.addEventListener("click", function() {
        window.print();
    });
}
