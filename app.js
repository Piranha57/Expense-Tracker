const STORAGE_KEY = "expense-tracker-expenses-v1";
const USERS_STORAGE_KEY = "expense-tracker-users-v1";

const categories = [
  { name: "Bills", icon: "ϟ", color: "#f1c94f" },
  { name: "Shopping", icon: "▣", color: "#f26eaa" },
  { name: "Food", icon: "♨", color: "#55b5f2" },
  { name: "Entertainment", icon: "▣", color: "#fa8c57" },
  { name: "Transport", icon: "↗", color: "#43d19a" },
  { name: "Health", icon: "+", color: "#ff7089" },
  { name: "Other", icon: "✳", color: "#b494f5" },
];

const elements = {
  total: document.querySelector("#total-amount"),
  totalCaption: document.querySelector("#total-caption"),
  topCategory: document.querySelector("#top-category"),
  topCategoryAmount: document.querySelector("#top-category-amount"),
  topCategoryShare: document.querySelector("#top-category-share"),
  topCategoryDot: document.querySelector("#top-category-dot"),
  monthAmount: document.querySelector("#month-amount"),
  monthCaption: document.querySelector("#month-caption"),
  distribution: document.querySelector("#distribution-list"),
  categoryCount: document.querySelector("#category-count"),
  expenseList: document.querySelector("#expense-list"),
  listCount: document.querySelector("#list-count"),
  search: document.querySelector("#expense-search"),
  categoryFilter: document.querySelector("#category-filter"),
  dialog: document.querySelector("#expense-dialog"),
  form: document.querySelector("#expense-form"),
  dialogTitle: document.querySelector("#dialog-title"),
  amountInput: document.querySelector("#expense-amount"),
  descriptionInput: document.querySelector("#expense-description"),
  categoryInput: document.querySelector("#expense-category"),
  dateInput: document.querySelector("#expense-date"),
  toast: document.querySelector("#toast"),
};

let activePeriod = "all";
let editingId = null;
let toastTimer;

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

function createSeedExpenses() {
  return [
    { id: "seed-1", description: "Monthly electricity", amount: 150, category: "Bills", date: shiftDate(-4) },
    { id: "seed-2", description: "Grocery shopping", amount: 89.99, category: "Shopping", date: shiftDate(-1) },
    { id: "seed-3", description: "Dinner with friends", amount: 45.99, category: "Food", date: shiftDate(-2) },
    { id: "seed-4", description: "Movie night", amount: 35, category: "Entertainment", date: shiftDate(-3) },
    { id: "seed-5", description: "Bus ticket", amount: 12.5, category: "Transport", date: shiftDate(0) },
  ];
}

function loadExpenses() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return createSeedExpenses();
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return createSeedExpenses();
    return parsed.filter((expense) =>
      expense && typeof expense.id === "string" &&
      typeof expense.description === "string" && expense.description.trim() &&
      Number.isFinite(Number(expense.amount)) && Number(expense.amount) > 0 &&
      categories.some((category) => category.name === expense.category) &&
      /^\d{4}-\d{2}-\d{2}$/.test(expense.date),
    );
  } catch {
    return createSeedExpenses();
  }
}

let expenses = loadExpenses();

function saveExpenses() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    return true;
  } catch {
    showToast("Could not save changes in this browser.");
    return false;
  }
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function categoryFor(name) {
  return categories.find((category) => category.name === name) || categories.at(-1);
}

function addCategoryOptions() {
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category.name;
    option.textContent = category.name;
    elements.categoryInput.append(option);
  }
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category.name;
    option.textContent = category.name;
    elements.categoryFilter.append(option);
  }
}

function isCurrentMonth(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
}

function readableDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dateString === localDateString(today)) return "Today";
  if (dateString === localDateString(yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function dateMatchesPeriod(dateString) {
  if (activePeriod === "all") return true;
  if (activePeriod === "month") return isCurrentMonth(dateString);
  const date = new Date(`${dateString}T00:00:00`);
  const today = new Date();
  if (activePeriod === "today") return dateString === localDateString(today);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);
  return date >= startOfWeek && date <= endOfToday;
}

function makeCategoryIcon(category, extraClass = "") {
  const icon = document.createElement("span");
  icon.className = `category-icon ${extraClass}`.trim();
  icon.textContent = category.icon;
  icon.style.background = `${category.color}35`;
  icon.style.color = category.color;
  icon.style.borderColor = `${category.color}75`;
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function renderSummary() {
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const monthlyExpenses = expenses.filter((expense) => isCurrentMonth(expense.date));
  const monthlyTotal = monthlyExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const categoryTotals = new Map();
  for (const expense of expenses) {
    categoryTotals.set(expense.category, (categoryTotals.get(expense.category) || 0) + Number(expense.amount));
  }
  const topEntry = [...categoryTotals.entries()].sort((left, right) => right[1] - left[1])[0];

  elements.total.textContent = formatMoney(total);
  elements.totalCaption.textContent = `${expenses.length} ${expenses.length === 1 ? "expense" : "expenses"} recorded`;
  elements.monthAmount.textContent = formatMoney(monthlyTotal);
  elements.monthCaption.textContent = `${monthlyExpenses.length} ${monthlyExpenses.length === 1 ? "transaction" : "transactions"}`;

  if (topEntry) {
    const [name, amount] = topEntry;
    const category = categoryFor(name);
    elements.topCategory.textContent = name;
    elements.topCategoryAmount.textContent = formatMoney(amount);
    elements.topCategoryShare.textContent = `${Math.round((amount / total) * 100)}% of total expenses`;
    elements.topCategoryDot.style.background = category.color;
    elements.topCategoryDot.style.color = category.color;
  } else {
    elements.topCategory.textContent = "No expenses yet";
    elements.topCategoryAmount.textContent = formatMoney(0);
    elements.topCategoryShare.textContent = "Add an expense to get started";
    elements.topCategoryDot.style.background = "rgba(255,255,255,.35)";
  }
}

function renderDistribution() {
  const categoryTotals = new Map();
  for (const expense of expenses) {
    categoryTotals.set(expense.category, (categoryTotals.get(expense.category) || 0) + Number(expense.amount));
  }
  const total = [...categoryTotals.values()].reduce((sum, amount) => sum + amount, 0);
  const sorted = [...categoryTotals.entries()].sort((left, right) => right[1] - left[1]);
  elements.categoryCount.textContent = `${sorted.length} ${sorted.length === 1 ? "category" : "categories"}`;
  elements.distribution.replaceChildren();

  if (sorted.length === 0) {
    const empty = document.createElement("p");
    empty.className = "distribution-empty";
    empty.textContent = "Your category breakdown will appear here.";
    elements.distribution.append(empty);
    return;
  }

  for (const [name, amount] of sorted) {
    const category = categoryFor(name);
    const item = document.createElement("article");
    item.className = "distribution-item";
    const text = document.createElement("div");
    const label = document.createElement("div");
    label.className = "distribution-name";
    label.textContent = name;
    const value = document.createElement("span");
    value.className = "distribution-amount";
    value.textContent = formatMoney(amount);
    text.append(label, value);
    const percent = document.createElement("span");
    percent.className = "distribution-percent";
    percent.textContent = `${Math.round((amount / total) * 100)}%`;
    item.append(makeCategoryIcon(category), text, percent);
    elements.distribution.append(item);
  }
}

function renderExpenses() {
  const query = elements.search.value.trim().toLocaleLowerCase();
  const selectedCategory = elements.categoryFilter.value;
  const filtered = expenses
    .filter((expense) => dateMatchesPeriod(expense.date))
    .filter((expense) => selectedCategory === "all" || expense.category === selectedCategory)
    .filter((expense) => `${expense.description} ${expense.category}`.toLocaleLowerCase().includes(query))
    .sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id));

  elements.expenseList.replaceChildren();
  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const title = document.createElement("strong");
    title.textContent = expenses.length === 0 ? "Nothing here just yet" : "No matching expenses";
    const message = document.createElement("span");
    message.textContent = expenses.length === 0 ? "Add your first expense to see your spending take shape." : "Try another search or filter.";
    empty.append(title, message);
    elements.expenseList.append(empty);
  } else {
    for (const expense of filtered) elements.expenseList.append(createExpenseRow(expense));
  }
  elements.listCount.textContent = `${filtered.length} ${filtered.length === 1 ? "expense" : "expenses"}${filtered.length !== expenses.length ? ` shown of ${expenses.length}` : ""}`;
}

function createExpenseRow(expense) {
  const category = categoryFor(expense.category);
  const row = document.createElement("article");
  row.className = "expense-row";
  row.append(makeCategoryIcon(category));

  const main = document.createElement("div");
  main.className = "expense-main";
  const description = document.createElement("p");
  description.className = "expense-description";
  description.textContent = expense.description;
  const details = document.createElement("p");
  details.className = "expense-details";
  const categoryLabel = document.createElement("span");
  categoryLabel.className = "expense-category";
  categoryLabel.textContent = expense.category;
  const separator = document.createElement("span");
  separator.className = "detail-separator";
  separator.textContent = "·";
  const date = document.createElement("span");
  date.textContent = readableDate(expense.date);
  details.append(categoryLabel, separator, date);
  main.append(description, details);

  const amount = document.createElement("strong");
  amount.className = "expense-amount";
  amount.textContent = formatMoney(Number(expense.amount));

  const actions = document.createElement("div");
  actions.className = "row-actions";
  const edit = document.createElement("button");
  edit.className = "row-action";
  edit.type = "button";
  edit.textContent = "✎";
  edit.title = `Edit ${expense.description}`;
  edit.setAttribute("aria-label", `Edit ${expense.description}`);
  edit.addEventListener("click", () => openDialog(expense));
  const remove = document.createElement("button");
  remove.className = "row-action delete";
  remove.type = "button";
  remove.textContent = "×";
  remove.title = `Delete ${expense.description}`;
  remove.setAttribute("aria-label", `Delete ${expense.description}`);
  remove.addEventListener("click", () => deleteExpense(expense.id));
  actions.append(edit, remove);

  row.append(main, amount, actions);
  return row;
}

function render() {
  renderSummary();
  renderDistribution();
  renderExpenses();
}

function openDialog(expense = null) {
  editingId = expense?.id ?? null;
  elements.dialogTitle.textContent = editingId ? "Edit expense" : "Add expense";
  elements.amountInput.value = expense ? Number(expense.amount).toFixed(2) : "";
  elements.descriptionInput.value = expense?.description ?? "";
  elements.categoryInput.value = expense?.category ?? "Bills";
  elements.dateInput.value = expense?.date ?? localDateString(new Date());
  elements.dialog.showModal();
  requestAnimationFrame(() => (expense ? elements.descriptionInput : elements.amountInput).focus());
}

function closeDialog() {
  elements.dialog.close();
  elements.form.reset();
  editingId = null;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2300);
}

function deleteExpense(id) {
  const deleted = expenses.find((expense) => expense.id === id);
  expenses = expenses.filter((expense) => expense.id !== id);
  if (saveExpenses()) {
    render();
    showToast(`Deleted ${deleted?.description ?? "expense"}.`);
  }
}

const now = new Date();

async function hashPassword(password) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getStoredUsers() {
  const saved = localStorage.getItem(USERS_STORAGE_KEY);
  if (saved === null) return [];
  const users = JSON.parse(saved);
  if (!Array.isArray(users) || users.some((user) =>
    !user || typeof user.email !== "string" || typeof user.passwordHash !== "string",
  )) {
    throw new Error("Saved account data is invalid. Clear this app's local storage and try again.");
  }
  return users;
}

function showAuthMessage(message, isError = true) {
  const messageElement = document.querySelector("#auth-message");
  messageElement.textContent = message;
  messageElement.classList.toggle("is-error", isError);
  messageElement.classList.toggle("is-success", !isError);
}

function setupAuthPage() {
  const loginForm = document.querySelector("#login-form");
  const registerForm = document.querySelector("#register-form");
  if (!loginForm && !registerForm) return;

  const form = loginForm || registerForm;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const email = form.elements.email.value.trim().toLocaleLowerCase();
    const password = form.elements.password.value;
    try {
      const users = getStoredUsers();
      if (registerForm) {
        if (password !== form.elements.confirmPassword.value) {
          showAuthMessage("Your passwords do not match.");
          form.elements.confirmPassword.focus();
          return;
        }
        if (users.some((user) => user.email === email)) {
          showAuthMessage("An account with this email already exists. Please log in instead.");
          return;
        }
        users.push({ email, passwordHash: await hashPassword(password) });
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      } else {
        const user = users.find((account) => account.email === email);
        if (!user || user.passwordHash !== await hashPassword(password)) {
          showAuthMessage("Email or password is incorrect.");
          return;
        }
      }

      window.location.assign("index.html");
    } catch (error) {
      showAuthMessage(error instanceof Error
        ? `Could not complete your request: ${error.message}`
        : "Could not complete your request. Please try again.");
    }
  });
  form.elements.email.focus();
}

setupAuthPage();

if (elements.form) {
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!elements.form.reportValidity()) return;
    const expense = {
      id: editingId ?? (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
      description: elements.descriptionInput.value.trim(),
      amount: Math.round(Number(elements.amountInput.value) * 100) / 100,
      category: elements.categoryInput.value,
      date: elements.dateInput.value,
    };
    if (!expense.description || !Number.isFinite(expense.amount) || expense.amount <= 0 || !expense.date) return;

    if (editingId) {
      expenses = expenses.map((item) => item.id === editingId ? expense : item);
    } else {
      expenses.push(expense);
    }
    if (saveExpenses()) {
      closeDialog();
      render();
      showToast(editingId ? "Expense updated." : "Expense added.");
    }
  });

  document.querySelector("#add-expense").addEventListener("click", () => openDialog());
  document.querySelector("#focus-search").addEventListener("click", () => {
    elements.search.focus();
    elements.search.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeDialog));
  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) closeDialog();
  });
  elements.search.addEventListener("input", renderExpenses);
  elements.categoryFilter.addEventListener("change", renderExpenses);
  document.querySelectorAll(".filter-tab").forEach((button) => {
    button.addEventListener("click", () => {
      activePeriod = button.dataset.period;
      document.querySelectorAll(".filter-tab").forEach((tab) => {
        const isActive = tab === button;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-pressed", String(isActive));
      });
      renderExpenses();
    });
  });

  document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(now);
  document.querySelector("#month-label").textContent = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(now);
  addCategoryOptions();
  if (localStorage.getItem(STORAGE_KEY) === null) saveExpenses();
  render();
}
