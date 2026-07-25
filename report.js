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
const fundTypeFilter = document.getElementById("fundTypeFilter") || document.getElementById("typeFilter"); 
const printBtn = document.getElementById("printBtn");

/* ==========
   Global App States
========== */
let rawData = [];
let filteredData = [];

// Static Month dictionary maps
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

    // 1. Process main filtered dataset
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

        if (ok && selectedType !== "both" && selectedType !== "") {
            const itemType = String(item.Type || "").trim();
            if (selectedType === "group" || selectedType === "Group Fund") {
                ok = (itemType === "Group Fund" || itemType === "group" || itemType === "");
            } else if (selectedType === "emergency" || selectedType === "Emergency Fund") {
                ok = (itemType === "Emergency Fund" || itemType === "emergency");
            } else if (selectedType === "expense" || selectedType === "Expenses" || selectedType === "Expense") {
                ok = (itemType === "Expense" || itemType === "expense");
            }
        }

        return ok;
    });

    // 2. Perform Date Ascending Sort (پرانی تاریخ سے نئی تاریخ کی ترتیب)
    filteredData.sort((a, b) => new Date(a.Date) - new Date(b.Date));

    // 3. Perform Calculations & Display Updates
    calculateSummaryAndFilteredResults(rows, filteredData, selectedType);
    renderFilteredTable();
}

/* ==========
   Summary and Live Filter Calculations
========== */
function calculateSummaryAndFilteredResults(allRows, filteredRows, selectedType) {
    
    // ==========================================
    // A. CALCULATE GLOBAL METRICS (Top Row Cards - Unaffected by UI Filters)
    // ==========================================
    let globalGroupFund = 0;
    let globalEmergencyFund = 0;
    let globalExpenseTotal = 0;

    allRows.forEach(item => {
        const amount = Math.max(0, Number(item.Amount || 0));
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
    // B. CALCULATE DYNAMIC FILTER RESULTS
    // ==========================================
    let filterGroup = 0;
    let filterEmergency = 0;
    let filterExpenses = 0;

    filteredRows.forEach(item => {
        const amount = Math.max(0, Number(item.Amount || 0));
        const type = String(item.Type || "").trim();

        if (type === "Emergency Fund" || type === "emergency") {
            filterEmergency += amount;
        } else if (type === "Expense" || type === "expense") {
            filterExpenses += amount;
        } else {
            filterGroup += amount;
        }
    });

    // Node Hiding & Display Customization for Filter Card
    const parentGroup = currGroup ? currGroup.parentElement : null;
    const parentEmergency = currEmergency ? currEmergency.parentElement : null;
    const parentExpenses = currExpenses ? currExpenses.parentElement : null;

    if (parentGroup) parentGroup.style.display = "block";
    if (parentEmergency) parentEmergency.style.display = "block";
    if (parentExpenses) parentExpenses.style.display = "block";

    let finalFilterBalance = 0;

    if (selectedType === "group" || selectedType === "Group Fund") {
        if (parentEmergency) parentEmergency.style.display = "none";
        if (parentExpenses) parentExpenses.style.display = "none";
        finalFilterBalance = filterGroup;
    } else if (selectedType === "emergency" || selectedType === "Emergency Fund") {
        if (parentGroup) parentGroup.style.display = "none";
        if (parentExpenses) parentExpenses.style.display = "none";
        finalFilterBalance = filterEmergency;
    } else if (selectedType === "expense" || selectedType === "Expenses" || selectedType === "Expense") {
        if (parentGroup) parentGroup.style.display = "none";
        if (parentEmergency) parentEmergency.style.display = "none";
        finalFilterBalance = filterExpenses;
    } else {
        // 'both' or 'all'
        finalFilterBalance = (filterGroup + filterEmergency) - filterExpenses;
    }

    if (currGroup) currGroup.innerHTML = money(filterGroup);
    if (currEmergency) currEmergency.innerHTML = money(filterEmergency);
    if (currExpenses) currExpenses.innerHTML = money(filterExpenses);
    
    if (currMonthTotal) {
        currMonthTotal.innerHTML = money(finalFilterBalance);
        if (selectedType === "expense" || selectedType === "Expense") {
            currMonthTotal.style.color = "#c53030"; // اخراجات کے لیے سرخ رنگ
        } else {
            currMonthTotal.style.color = "#2f855a"; // دیگر کے لیے سبز رنگ
        }
    }

    if (lblCurrMonth) {
        let activeLabel = "تمام اندراجات کا نتیجہ";
        if (selectedType === "group" || selectedType === "Group Fund") activeLabel = "صرف گروپ فنڈز کا نتیجہ";
        else if (selectedType === "emergency" || selectedType === "Emergency Fund") activeLabel = "صرف ایمرجنسی فنڈز کا نتیجہ";
        else if (selectedType === "expense" || selectedType === "Expense") activeLabel = "صرف اخراجات کا نتیجہ";

        lblCurrMonth.innerHTML = activeLabel;
    }
}

/* ==========
   Dynamic Filtered Grid Component Builder
========== */
function renderFilteredTable() {
    if (!tableBody) return;
    tableBody.innerHTML = "";
    let sr = 1;

    // Group items by Date while preserving ascending sorted sequence
    const groups = {};
    filteredData.forEach(item => {
        if (!item.Date) return;
        if (!groups[item.Date]) groups[item.Date] = [];
        groups[item.Date].push(item);
    });

    Object.keys(groups).forEach(date => {
        const list = groups[date];

        // Deduct expenses from daily total calculation
        const total = list.reduce((sum, item) => {
            const amt = Math.max(0, Number(item.Amount || 0));
            const type = String(item.Type || "").trim();

            if (type === "Expense" || type === "expense") {
                return sum - amt;
            } else {
                return sum + amt;
            }
        }, 0);

        list.forEach((item, index) => {
            const tr = document.createElement("tr");
            
            let typeUrdu = "گروپ";
            let badgeColor = "#2b6cb0";
            
            if (item.Type === "Emergency Fund" || item.Type === "emergency") {
                typeUrdu = "ایمرجنسی";
                badgeColor = "#b7791f";
            } else if (item.Type === "Expense" || item.Type === "expense") {
                typeUrdu = "اخراجات";
                badgeColor = "#c53030";
            }

            const currentTypeFilter = fundTypeFilter ? fundTypeFilter.value : "both";
            const typeLabel = (currentTypeFilter === "both" || currentTypeFilter === "") ? 
                ` <small style="color:${badgeColor}; font-size:0.8rem; font-weight:bold;">(${typeUrdu})</small>` : '';

            const isExpense = (item.Type === "Expense" || item.Type === "expense");
            const expenseRowStyle = isExpense ? 'style="color: #c53030; font-weight: 600;"' : '';

            let html = `
                <td>${sr++}</td>
                <td style="text-align:right" ${expenseRowStyle}>${item.Name || ""}${typeLabel}</td>
                <td class="amount" ${expenseRowStyle}>${isExpense ? "-" : ""}${money(Math.max(0, item.Amount))}</td>
            `;

            if (index === 0) {
                html += `
                    <td rowspan="${list.length}" class="date">
                        ${formatDate(date)}
                    </td>
                    <td rowspan="${list.length}" class="daily-total" style="font-weight:bold;">
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
