"use strict";

const STORAGE_KEY = "penny.transactions.v1";
const WELCOME_KEY = "penny.welcomeSeen.v1";

const categories = {
  expense: ["Food & dining", "Transport", "Shopping", "Bills & utilities", "Health", "Entertainment", "Education", "Home", "Other"],
  income: ["Salary", "Freelance", "Business", "Investments", "Gifts", "Other"]
};

const icons = {
  "Food & dining": "⌁",
  Transport: "↗",
  Shopping: "◇",
  "Bills & utilities": "⌂",
  Health: "＋",
  Entertainment: "♫",
  Education: "▤",
  Home: "⌂",
  Salary: "↙",
  Freelance: "✳",
  Business: "▣",
  Investments: "⌁",
  Gifts: "♡",
  Other: "·"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const welcomeScreen = $("#welcome-screen");
const dashboard = $("#dashboard");
const transactionDialog = $("#transaction-dialog");
const confirmDialog = $("#confirm-dialog");
const form = $("#transaction-form");
const categorySelect = $("#category");
const dateInput = $("#date");

let transactions = loadTransactions();
let activeFilter = "all";
let editingId = null;
let deletingId = null;
let selectedType = "expense";
let toastTimer;

function loadTransactions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter(isValidTransaction) : [];
  } catch {
    return [];
  }
}

function isValidTransaction(item) {
  return item &&
    typeof item.id === "string" &&
    ["income", "expense"].includes(item.type) &&
    Number.isFinite(Number(item.amount)) &&
    Number(item.amount) > 0 &&
    typeof item.category === "string" &&
    typeof item.description === "string" &&
    !Number.isNaN(Date.parse(item.date));
}

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return true;
  } catch {
    showToast("Could not save data in this browser.");
    return false;
  }
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function updateDateAndGreeting() {
  const now = new Date();

  $("#today-label").textContent = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(now);

  const hour = now.getHours();
  $("#greeting").textContent =
    hour < 12 ? "Good morning." : hour < 17 ? "Good afternoon." : "Good evening.";
}

function showDashboard() {
  welcomeScreen.classList.add("hidden");
  dashboard.classList.remove("hidden");
  updateDateAndGreeting();
  render();
}

function setView(view) {
  const isOverview = view === "overview";

  $("#breadcrumb-title").textContent = isOverview ? "Overview" : "Transactions";
  $$(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  $("#view-all").innerHTML = isOverview ? 'View all <span>→</span>' : 'Overview <span>↑</span>';
  activeFilter = "all";
  $$(".filter-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === activeFilter);
  });

  render();
  $("#section-heading").scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateCategoryOptions(type, selected = "") {
  categorySelect.replaceChildren(...categories[type].map((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    option.selected = category === selected;
    return option;
  }));
}

function openForm(transaction = null) {
  editingId = transaction?.id || null;
  selectedType = transaction?.type || "expense";

  $("#dialog-title").textContent = editingId ? "Edit transaction" : "Add transaction";
  $("#save-transaction").innerHTML = editingId
    ? "Save changes <span>→</span>"
    : "Save transaction <span>→</span>";

  $$(".type-option").forEach((button) => {
    button.classList.toggle("selected", button.dataset.type === selectedType);
  });

  updateCategoryOptions(selectedType, transaction?.category || "");
  $("#amount").value = transaction?.amount ?? "";
  dateInput.value = transaction?.date || localDateString();
  $("#description").value = transaction?.description || "";
  $("#form-error").classList.add("hidden");

  transactionDialog.showModal();
  setTimeout(() => $("#amount").focus(), 50);
}

function renderCategoryFilter() {
  const filter = $("#category-filter");
  const current = filter.value || "all";
  const usedCategories = [...new Set(transactions.map((item) => item.category))]
    .sort((a, b) => a.localeCompare(b));

  filter.replaceChildren(new Option("All categories", "all"));
  for (const category of usedCategories) {
    filter.add(new Option(category, category));
  }

  filter.value = usedCategories.includes(current) ? current : "all";
}

function render() {
  const income = transactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const expenses = transactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  $("#balance-value").textContent = formatCurrency(income - expenses);
  $("#income-value").textContent = formatCurrency(income);
  $("#expense-value").textContent = formatCurrency(expenses);
  $("#welcome-balance").textContent = formatCurrency(income - expenses).replace(/[^\d.,-]/g, "");
  $("#nav-count").textContent = transactions.length;

  renderCategoryFilter();

  const categoryFilter = $("#category-filter").value;
  const filtered = transactions
    .filter((item) => activeFilter === "all" || item.type === activeFilter)
    .filter((item) => categoryFilter === "all" || item.category === categoryFilter)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  const list = $("#transaction-list");
  list.replaceChildren();

  const empty = filtered.length === 0;
  $("#empty-state").classList.toggle("hidden", !empty);
  list.classList.toggle("hidden", empty);

  for (const item of filtered) {
    const row = document.createElement("article");
    row.className = "transaction-row";
    row.dataset.type = item.type;

    const sign = item.type === "income" ? "+" : "−";
    const amountClass = item.type === "income" ? "income-amount" : "expense-amount";

    row.innerHTML = `
      <div class="transaction-symbol" aria-hidden="true">${icons[item.category] || "·"}</div>
      <div>
        <div class="transaction-title">${escapeHTML(item.description)}</div>
        <div class="transaction-category">${escapeHTML(item.category)}</div>
      </div>
      <div class="transaction-category-col">${escapeHTML(item.category)}</div>
      <div class="transaction-date">${formatDate(item.date)}</div>
      <div class="transaction-amount ${amountClass}">${sign}${formatCurrency(item.amount)}</div>
      <div class="transaction-actions">
        <button class="row-action edit" type="button" aria-label="Edit ${escapeHTML(item.description)}" title="Edit">✎</button>
        <button class="row-action delete" type="button" aria-label="Delete ${escapeHTML(item.description)}" title="Delete">×</button>
      </div>`;

    row.querySelector(".edit").addEventListener("click", () => openForm(item));
    row.querySelector(".delete").addEventListener("click", () => {
      deletingId = item.id;
      confirmDialog.showModal();
    });

    list.append(row);
  }

  $("#list-footer").textContent = empty
    ? ""
    : `SHOWING ${filtered.length} OF ${transactions.length} TRANSACTION${transactions.length === 1 ? "" : "S"}`;
}

$("#get-started").addEventListener("click", () => {
  localStorage.setItem(WELCOME_KEY, "true");
  showDashboard();
});

$("#add-transaction").addEventListener("click", () => openForm());
$("#empty-add").addEventListener("click", () => openForm());
$("#close-dialog").addEventListener("click", () => transactionDialog.close());
$("#cancel-dialog").addEventListener("click", () => transactionDialog.close());

$("#view-all").addEventListener("click", () => {
  const viewingAll = $("#breadcrumb-title").textContent !== "Transactions";
  setView(viewingAll ? "transactions" : "overview");
});

$("#help-button").addEventListener("click", () => {
  showToast("OptMoney saves your transactions in this browser.");
});

$$(".nav-item").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

$$(".filter-tab").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    $$(".filter-tab").forEach((tab) => {
      tab.classList.toggle("active", tab === button);
    });
    render();
  });
});

$("#category-filter").addEventListener("change", render);

$$(".type-option").forEach((button) => {
  button.addEventListener("click", () => {
    selectedType = button.dataset.type;
    $$(".type-option").forEach((option) => {
      option.classList.toggle("selected", option === button);
    });
    updateCategoryOptions(selectedType);
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const amount = Number($("#amount").value);
  const description = $("#description").value.trim();
  const date = dateInput.value;

  if (!Number.isFinite(amount) || amount <= 0) {
    $("#form-error").textContent = "Enter an amount greater than zero.";
    $("#form-error").classList.remove("hidden");
    return;
  }

  if (!description || !date) {
    $("#form-error").textContent = "Add a description and date.";
    $("#form-error").classList.remove("hidden");
    return;
  }

  const previous = transactions.find((item) => item.id === editingId);
  const transaction = {
    id: editingId || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    type: selectedType,
    amount: Math.round(amount * 100) / 100,
    category: categorySelect.value,
    date,
    description,
    createdAt: previous?.createdAt || Date.now()
  };

  if (editingId) {
    transactions = transactions.map((item) => item.id === editingId ? transaction : item);
  } else {
    transactions.push(transaction);
  }

  if (saveTransactions()) {
    transactionDialog.close();
    render();
    showToast(editingId ? "Transaction updated." : "Transaction added.");
  }
});

$("#keep-transaction").addEventListener("click", () => confirmDialog.close());

$("#confirm-delete").addEventListener("click", () => {
  transactions = transactions.filter((item) => item.id !== deletingId);

  if (saveTransactions()) {
    confirmDialog.close();
    deletingId = null;
    render();
    showToast("Transaction deleted.");
  }
});

updateCategoryOptions("expense");
updateDateAndGreeting();
render();

if (localStorage.getItem(WELCOME_KEY) === "true") {
  showDashboard();
}