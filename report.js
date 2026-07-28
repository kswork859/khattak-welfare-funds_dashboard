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
const dateRangeText = document.getElementById("dateRangeText"); // Date Range Dynamic Line

const rowPrevBalance = document.getElementById("rowPrevBalance");
const currPrevBalance = document.getElementById("currPrevBalance");

// Target Filtering Inputs
const searchInput = document.getElementById("searchInput");
const startDateInput = document.getElementById("startDate");
const endDateInput = document.getElementById("endDate");
const printBtn = document.getElementById("printBtn");

/* ==========
   Global App States
========== */
let rawData = [];
let filteredData = [];
let previousBalance = 0; // Selected Start Date se pehle ka total balance

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
   Core Filtering & Math Processing Logic
========== */
function applyFilters() {
    const rows = getRecords();

    const keyword = (searchInput && searchInput.value) ? searchInput.value.trim().toLowerCase() : "";
    
    // Parse input dates in Local Time to avoid UTC timezone offset issues
    const startDateVal = (startDateInput && startDateInput.value) ? new Date(startDateInput.value + "T00:00:00") : null;
    const endDateVal = (endDateInput && endDateInput.value) ? new Date(endDateInput.value + "T23:59:59.999") : null;

    // Re-initialize previous balance
    previousBalance = 0;

    // 1. Process main filtered dataset & compute Previous Balance
    filteredData = rows.filter(item => {
        let ok = true;

        if (keyword) {
            ok = String(item.Name || "").toLowerCase().includes(keyword);
        }

        // Parse item date
        let itemDate = null;
        if (item.Date) {
            const rawDateStr = String(item.Date).replace(/\//g, '-').trim();
            itemDate = new Date(rawDateStr.includes("T") ? rawDateStr : rawDateStr + "T00:00:00");
        }

        // Calculate Previous Balance (if item date is strictly before startDateVal)
        if (startDateVal && itemDate && !isNaN(itemDate.getTime())) {
            if (itemDate < startDateVal) {
                const amt = Math.max(0, Number(item.Amount || 0));
                const itemType = String(item.Type || "").trim();

                if (itemType === "Expense" || itemType === "expense") {
                    previousBalance -= amt;
                } else {
                    previousBalance += amt;
                }
            }
        }

        // Main Date Range Filter Logic
        if (ok && (startDateVal || endDateVal)) {
            if (itemDate && !isNaN(itemDate.getTime())) {
                if (startDateVal && itemDate < startDateVal) ok = false;
                if (ok && endDateVal && itemDate > endDateVal) ok = false;
            } else {
                ok = false;
            }
        }

        return ok;
    });

    // 2. Perform Date Ascending Sort
    filteredData.sort((a, b) => new Date(a.Date) - new Date(b.Date));

    // 3. Perform Calculations & Display Updates
    calculateSummaryAndFilteredResults(rows, filteredData);
    renderFilteredTable();
}

/* ==========
   Summary and Live Filter Calculations
========== */
function calculateSummaryAndFilteredResults(allRows, filteredRows) {
    
    // A. CALCULATE GLOBAL METRICS
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

    // B. CALCULATE DYNAMIC FILTER RESULTS
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

    // Handle Date Range Indicator Line
    if (dateRangeText) {
        const sDate = startDateInput ? startDateInput.value : "";
        const eDate = endDateInput ? endDateInput.value : "";

        if (sDate && eDate) {
            dateRangeText.innerHTML = `یہ رپورٹ <strong>${formatDate(sDate)}</strong> سے <strong>${formatDate(eDate)}</strong> تک کی ہے۔`;
            dateRangeText.style.display = "block";
        } else if (sDate) {
            dateRangeText.innerHTML = `یہ رپورٹ <strong>${formatDate(sDate)}</strong> کے بعد کی ہے۔`;
            dateRangeText.style.display = "block";
        } else if (eDate) {
            dateRangeText.innerHTML = `یہ رپورٹ <strong>${formatDate(eDate)}</strong> تک کی ہے۔`;
            dateRangeText.style.display = "block";
        } else {
            dateRangeText.style.display = "none";
        }
    }

    // Handle UI Previous Balance Display
    if (startDateInput && startDateInput.value && previousBalance !== 0) {
        if (rowPrevBalance) rowPrevBalance.style.display = "flex";
        if (currPrevBalance) currPrevBalance.innerHTML = money(previousBalance);
    } else {
        if (rowPrevBalance) rowPrevBalance.style.display = "none";
    }

    const parentGroup = currGroup ? currGroup.parentElement : null;
    const parentEmergency = currEmergency ? currEmergency.parentElement : null;
    const parentExpenses = currExpenses ? currExpenses.parentElement : null;

    if (parentGroup) parentGroup.style.display = "flex";
    if (parentEmergency) parentEmergency.style.display = "flex";
    if (parentExpenses) parentExpenses.style.display = "flex";

    const currentPeriodTotal = (filterGroup + filterEmergency) - filterExpenses;
    const grandTotal = previousBalance + currentPeriodTotal;

    if (currGroup) currGroup.innerHTML = money(filterGroup);
    if (currEmergency) currEmergency.innerHTML = money(filterEmergency);
    if (currExpenses) currExpenses.innerHTML = money(filterExpenses);
    
    if (currMonthTotal) {
        currMonthTotal.innerHTML = money(grandTotal);
        currMonthTotal.style.color = (grandTotal < 0) ? "#c53030" : "#2f855a";
    }

    if (lblCurrMonth) {
        lblCurrMonth.innerHTML = "موجودہ منتخب فلٹر کا رزلٹ";
    }
}

/* ==========
   Dynamic Filtered Grid Component Builder
========== */
function renderFilteredTable() {
    if (!tableBody) return;
    tableBody.innerHTML = "";
    let sr = 1;

    // 1. Add Previous Balance Row if Filtered
    if (startDateInput && startDateInput.value && previousBalance !== 0) {
        const prevTr = document.createElement("tr");
        prevTr.style.backgroundColor = "#edf2f7";
        prevTr.style.fontWeight = "bold";
        prevTr.innerHTML = `
            <td>-</td>
            <td style="text-align:right;">سابقہ رقم</td>
            <td class="amount">${money(previousBalance)}</td>
            <td class="date">${formatDate(startDateInput.value)}</td>
            <td class="daily-total">${money(previousBalance)}</td>
        `;
        tableBody.appendChild(prevTr);
    }

    // 2. Group items by Date
    const groups = {};
    filteredData.forEach(item => {
        if (!item.Date) return;
        if (!groups[item.Date]) groups[item.Date] = [];
        groups[item.Date].push(item);
    });

    Object.keys(groups).forEach(date => {
        const list = groups[date];

        const total = list.reduce((sum, item) => {
            const amt = Math.max(0, Number(item.Amount || 0));
            const type = String(item.Type || "").trim();

            if (type === "Expense" || type === "expense") {
                return sum - amt;
            } else {
                return sum + amt;
            }
        }, 0);

        list.forEach((item, itemIndex) => {
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

            const typeLabel = ` <small style="color:${badgeColor}; font-size:8px; font-weight:normal;">(${typeUrdu})</small>`;

            const isExpense = (item.Type === "Expense" || item.Type === "expense");
            const expenseRowStyle = isExpense ? 'style="color: #c53030; font-weight: 600;"' : '';

            let html = `
                <td>${sr++}</td>
                <td style="text-align:right" ${expenseRowStyle}>${item.Name || ""}${typeLabel}</td>
                <td class="amount" ${expenseRowStyle}>${isExpense ? "-" : ""}${money(Math.max(0, item.Amount))}</td>
            `;

            if (itemIndex === 0) {
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
   Event Listeners
========== */
if (searchInput) searchInput.addEventListener("input", applyFilters); 
if (startDateInput) startDateInput.addEventListener("change", applyFilters);
if (endDateInput) endDateInput.addEventListener("change", applyFilters);
if (printBtn) {
    printBtn.addEventListener("click", function() {
        window.print();
    });
}
