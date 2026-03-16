// Financial Tracker App
const STORAGE_KEYS = {
  transactions: 'finance_tracker_transactions',
  goals: 'finance_tracker_goals',
  recurringExpenses: 'finance_tracker_recurring',
  temki: 'finance_tracker_temki',
  accounts: 'finance_tracker_accounts',
  currentAccountId: 'finance_tracker_current_account',
  apiKey: 'finance_tracker_api_key',
};

const INCOME_CATEGORIES = [
  'Зарплата', 'Фриланс', 'Инвестиции', 'Подарок', 'Возврат', 'Корректировка баланса', 'Прочее'
];

const EXPENSE_CATEGORIES = [
  'Еда', 'Транспорт', 'Жильё', 'Развлечения', 'Здоровье', 'Одежда', 'Образование', 'Внесение на цель', 'Корректировка баланса', 'Прочее'
];

// State
let transactions = [];
let goals = [];
let recurringExpenses = [];
let temki = [];
let accounts = [];
let currentAccountId = null;
let useCloudSync = false;
let isShowingAuth = false;

function getIncomeCategories() {
  const custom = temki.map(t => (typeof t === 'string' ? t : t.name)).filter(Boolean);
  return [...new Set([...INCOME_CATEGORIES, ...custom])];
}

// DOM Elements
const totalBalanceEl = document.getElementById('totalBalance');
const totalIncomeEl = document.getElementById('totalIncome');
const totalExpenseEl = document.getElementById('totalExpense');
const transactionListEl = document.getElementById('transactionList');
const goalsListEl = document.getElementById('goalsList');
const addIncomeBtn = document.getElementById('addIncomeBtn');
const addExpenseBtn = document.getElementById('addExpenseBtn');
const addGoalBtn = document.getElementById('addGoalBtn');
const transactionModal = document.getElementById('transactionModal');
const goalModal = document.getElementById('goalModal');
const closeModal = document.getElementById('closeModal');
const closeGoalModal = document.getElementById('closeGoalModal');
const transactionForm = document.getElementById('transactionForm');
const goalForm = document.getElementById('goalForm');
const modalTitle = document.getElementById('modalTitle');
const transactionTypeInput = document.getElementById('transactionType');
const transactionIdInput = document.getElementById('transactionId');
const authScreen = document.getElementById('authScreen');
const appEl = document.getElementById('app');
const logoutBtn = document.getElementById('logoutBtn');
const localBtn = document.getElementById('localBtn');
const accountSelect = document.getElementById('accountSelect');
const addAccountBtn = document.getElementById('addAccountBtn');
const editAccountBtn = document.getElementById('editAccountBtn');
const accountModal = document.getElementById('accountModal');
const closeAccountModal = document.getElementById('closeAccountModal');
const accountForm = document.getElementById('accountForm');
const accountModalTitle = document.getElementById('accountModalTitle');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
const advisorModal = document.getElementById('advisorModal');
const openAdvisorModalBtn = document.getElementById('openAdvisorModalBtn');
const closeAdvisorModal = document.getElementById('closeAdvisorModal');
const chatMessages = document.getElementById('chatMessages');
const advisorQuestion = document.getElementById('advisorQuestion');
const sendAdvisorBtn = document.getElementById('sendAdvisorBtn');
const apiKeyInput = document.getElementById('apiKey');
const rememberKeyCheckbox = document.getElementById('rememberKey');

// Load data from localStorage
function loadDataFromStorage() {
  function safeParse(key, defaultValue) {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Invalid JSON in localStorage, resetting key:', key, raw);
      localStorage.removeItem(key);
      return defaultValue;
    }
  }

  transactions = safeParse(STORAGE_KEYS.transactions, []);
  goals = safeParse(STORAGE_KEYS.goals, []);
  recurringExpenses = safeParse(STORAGE_KEYS.recurringExpenses, []);
  temki = safeParse(STORAGE_KEYS.temki, []);
  accounts = safeParse(STORAGE_KEYS.accounts, []);
  currentAccountId = localStorage.getItem(STORAGE_KEYS.currentAccountId) || null;

  // Migration: if no accounts, create default
  if (accounts.length === 0) {
    accounts = [{ id: 'default', name: 'Основной счет', initialBalance: 0 }];
    currentAccountId = 'default';
    // Add accountId to existing transactions
    transactions = transactions.map(t => ({ ...t, accountId: 'default' }));
  }
  if (!currentAccountId && accounts.length > 0) {
    currentAccountId = accounts[0].id;
  }
}

// Apply loaded data and refresh UI
function applyData(data) {
  transactions = data.transactions && data.transactions.length > 0 ? data.transactions : transactions;
  goals = data.goals && data.goals.length > 0 ? data.goals : goals;
  recurringExpenses = data.recurringExpenses && data.recurringExpenses.length > 0 ? data.recurringExpenses : recurringExpenses;
  temki = data.temki && data.temki.length > 0 ? data.temki : temki;
  accounts = data.accounts && data.accounts.length > 0 ? data.accounts : accounts;
  currentAccountId = data.currentAccountId ? data.currentAccountId : currentAccountId;

  // Handle API key from cloud
  if (data.apiKey) {
    localStorage.setItem(STORAGE_KEYS.apiKey, data.apiKey);
    if (apiKeyInput) apiKeyInput.value = data.apiKey;
    if (rememberKeyCheckbox) rememberKeyCheckbox.checked = true;
  }

  // Migration: if no accounts, create default
  if (accounts.length === 0) {
    accounts = [{ id: 'default', name: 'Основной счет', initialBalance: 0 }];
    currentAccountId = 'default';
    // Add accountId to existing transactions
    transactions = transactions.map(t => ({ ...t, accountId: 'default' }));
  }
  if (!currentAccountId && accounts.length > 0) {
    currentAccountId = accounts[0].id;
  }

  localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
  localStorage.setItem(STORAGE_KEYS.goals, JSON.stringify(goals));
  localStorage.setItem(STORAGE_KEYS.recurringExpenses, JSON.stringify(recurringExpenses));
  localStorage.setItem(STORAGE_KEYS.temki, JSON.stringify(temki));
  localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts));
  localStorage.setItem(STORAGE_KEYS.currentAccountId, currentAccountId);
  updateBalance();
  renderAccounts();
  renderTransactions();
  renderGoals();
  renderRecurring();
  renderTemki();
  renderAdvisor();
}

// Save data (localStorage + cloud if enabled)
async function saveData() {
  localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
  localStorage.setItem(STORAGE_KEYS.goals, JSON.stringify(goals));
  localStorage.setItem(STORAGE_KEYS.recurringExpenses, JSON.stringify(recurringExpenses));
  localStorage.setItem(STORAGE_KEYS.temki, JSON.stringify(temki));
  localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts));
  localStorage.setItem(STORAGE_KEYS.currentAccountId, currentAccountId);
  if (useCloudSync && typeof FirebaseService !== 'undefined') {
    try {
      const apiKey = localStorage.getItem(STORAGE_KEYS.apiKey);
      await FirebaseService.saveToCloud(transactions, goals, recurringExpenses, temki, accounts, currentAccountId, apiKey);
    } catch (e) {
      console.warn('Cloud save failed:', e);
    }
  }
}

// Format currency
function formatMoney(amount) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' ₽';
}

// Calculate totals
function getTotals() {
  const account = accounts.find(a => a.id === currentAccountId);
  const initialBalance = account ? account.initialBalance : 0;
  let income = initialBalance;
  let expense = 0;
  transactions.filter(t => t.accountId === currentAccountId).forEach(t => {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  });
  return {
    income,
    expense,
    balance: income - expense,
  };
}

// Update balance display
function updateBalance() {
  const { income, expense, balance } = getTotals();
  totalIncomeEl.textContent = formatMoney(income);
  totalExpenseEl.textContent = formatMoney(expense);
  totalBalanceEl.textContent = formatMoney(balance);
  totalBalanceEl.style.color = balance >= 0 ? 'var(--accent-blue)' : 'var(--accent-red)';
}

// Render transactions
function renderTransactions() {
  const filtered = transactions.filter(t => t.accountId === currentAccountId);
  const sorted = [...filtered].sort((a, b) => parseInt(b.id) - parseInt(a.id));
  
  if (sorted.length === 0) {
    transactionListEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">📋</div>
        <p>Нет операций. Добавьте доход или расход</p>
      </div>
    `;
    return;
  }

  transactionListEl.innerHTML = sorted.map(t => `
    <div class="transaction-item ${t.type}" data-id="${t.id}">
      <div class="info">
        <div class="category">${t.category}</div>
        <div class="description">${t.description || '—'}</div>
      </div>
      <div class="meta">
        <span class="amount">${t.type === 'income' ? '+' : '-'}${formatMoney(t.amount)}</span>
        <span class="date">${formatDate(t.date)}</span>
        <button class="delete-btn" data-id="${t.id}" title="Удалить">&times;</button>
      </div>
    </div>
  `).join('');

  // Event listeners for delete
  transactionListEl.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTransaction(btn.dataset.id));
  });
}

// Recurring expenses: monthly total
function getRecurringMonthlyTotal() {
  return recurringExpenses.reduce((sum, r) => sum + (r.amount || 0), 0);
}

// Render recurring expenses
function renderRecurring() {
  const listEl = document.getElementById('recurringList');
  if (!listEl) return;
  if (recurringExpenses.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">📌</div>
        <p>Нет постоянных расходов. Добавьте аренду, подписки, продукты</p>
      </div>
    `;
    return;
  }
  listEl.innerHTML = recurringExpenses.map(r => `
    <div class="recurring-item" data-id="${r.id}">
      <div class="info">
        <span class="name">${escapeHtml(r.name)}</span>
        <span class="amount">−${formatMoney(r.amount || 0)}/мес</span>
      </div>
      <button class="delete-btn recurring-delete" data-id="${r.id}" title="Удалить">&times;</button>
    </div>
  `).join('');
  listEl.querySelectorAll('.recurring-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteRecurring(btn.dataset.id));
  });
}

function openRecurringModal(id = null) {
  document.getElementById('recurringModalTitle').textContent = id ? 'Редактировать' : 'Постоянный расход';
  document.getElementById('recurringId').value = id || '';
  if (id) {
    const r = recurringExpenses.find(x => x.id === id);
    if (r) {
      document.getElementById('recurringName').value = r.name;
      document.getElementById('recurringAmount').value = r.amount;
    }
  } else {
    document.getElementById('recurringForm').reset();
  }
  document.getElementById('recurringModal').classList.add('active');
}

function saveRecurring(e) {
  e.preventDefault();
  const id = document.getElementById('recurringId').value;
  const name = document.getElementById('recurringName').value.trim();
  const amount = parseFloat(document.getElementById('recurringAmount').value);
  if (!name || isNaN(amount) || amount < 0) {
    alert('Заполните название и сумму');
    return;
  }
  if (id) {
    const idx = recurringExpenses.findIndex(r => r.id === id);
    if (idx >= 0) recurringExpenses[idx] = { ...recurringExpenses[idx], name, amount };
  } else {
    recurringExpenses.push({ id: Date.now().toString(), name, amount });
  }
  saveData().then(() => {}).catch(() => {});
  renderRecurring();
  renderAdvisor();
  document.getElementById('recurringModal').classList.remove('active');
}

function deleteRecurring(id) {
  if (confirm('Удалить этот постоянный расход?')) {
    recurringExpenses = recurringExpenses.filter(r => r.id !== id);
    saveData().then(() => {}).catch(() => {});
    renderRecurring();
    renderAdvisor();
  }
}

// Temki - custom income types
function renderTemki() {
  const listEl = document.getElementById('temkiList');
  if (!listEl) return;
  if (temki.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">📌</div>
        <p>Нет видов дохода. Добавьте сдачу квартиры, фриланс, дивиденды и др.</p>
      </div>
    `;
    return;
  }
  listEl.innerHTML = temki.map(t => {
    const badges = [];
    if (t.isFixedIncome && t.fixedIncomeAmount > 0) badges.push(`Фикс. ${formatMoney(t.fixedIncomeAmount)}`);
    if (t.expenseAmount != null && t.expenseAmount > 0) badges.push(`Расх. ${formatMoney(t.expenseAmount)}`);
    
    const incomeSum = transactions.filter(tr => tr.type === 'income' && tr.category === t.name).reduce((sum, tr) => sum + tr.amount, 0);
    const expenseSum = transactions.filter(tr => tr.type === 'expense' && tr.category === t.name).reduce((sum, tr) => sum + tr.amount, 0);
    const expensePercent = incomeSum > 0 ? ((expenseSum / incomeSum) * 100).toFixed(1) : '0.0';
    
    const stats = [];
    if (incomeSum > 0) stats.push(`Доход: ${formatMoney(incomeSum)}`);
    if (expenseSum > 0) stats.push(`Расход: ${formatMoney(expenseSum)} (${expensePercent}%)`);
    
    return `
    <div class="temka-item temka-clickable" data-id="${t.id}">
      <div class="temka-item-info">
        <span class="temka-name">${escapeHtml(t.name)}</span>
        ${stats.length > 0 ? `<span class="temka-stats">${stats.join(' · ')}</span>` : ''}
        ${badges.length > 0 ? `<span class="temka-badges">${badges.join(' · ')}</span>` : ''}
      </div>
      <div class="temka-item-actions">
        <button type="button" class="delete-btn temka-delete" data-id="${t.id}" title="Удалить">&times;</button>
      </div>
    </div>
  `;
  }).join('');
  listEl.querySelectorAll('.temka-clickable').forEach(el => {
    el.addEventListener('click', (e) => {
      if (!e.target.classList.contains('temka-delete')) openTemkaDetailModal(el.dataset.id);
    });
  });
  listEl.querySelectorAll('.temka-delete').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); deleteTemka(btn.dataset.id); });
  });
}

function getTemkaTransactions(temkaId) {
  const temka = temki.find(t => t.id === temkaId);
  if (!temka) return { income: [], expense: [] };
  const income = transactions.filter(t => t.type === 'income' && (t.temkaId === temkaId || t.category === temka.name));
  const expense = transactions.filter(t => t.type === 'expense' && t.temkaId === temkaId);
  return { income, expense };
}

function openTemkaDetailModal(temkaId) {
  const temka = temki.find(t => t.id === temkaId);
  if (!temka) return;
  const { income, expense } = getTemkaTransactions(temkaId);
  const incomeTotal = income.reduce((s, t) => s + t.amount, 0);
  const expenseTotal = expense.reduce((s, t) => s + t.amount, 0);
  const hasExpenses = expense.length > 0;

  document.getElementById('temkaDetailTitle').textContent = temka.name;
  const fixedInfo = temka.isFixedIncome && temka.fixedIncomeAmount > 0 ? `
    <div class="temka-stat-row">
      <span>Фикс. доход:</span>
      <strong>${formatMoney(temka.fixedIncomeAmount)}</strong>
    </div>
  ` : '';
  const expenseInfo = temka.expenseAmount != null && temka.expenseAmount > 0 ? `
    <div class="temka-stat-row">
      <span>Плановый расход:</span>
      <strong>${formatMoney(temka.expenseAmount)}</strong>
    </div>
  ` : '';
  document.getElementById('temkaDetailStats').innerHTML = `
    ${fixedInfo}
    ${expenseInfo}
    <div class="temka-stat-row">
      <span>Доходы (факт):</span>
      <strong style="color: var(--accent-green)">${formatMoney(incomeTotal)}</strong>
    </div>
    <div class="temka-stat-row">
      <span>Расходы (факт):</span>
      <strong style="color: var(--accent-red)">${formatMoney(expenseTotal)}</strong>
    </div>
    ${hasExpenses && incomeTotal > 0 ? `
    <div class="temka-stat-row temka-percent">
      <span>Расходы от доходов:</span>
      <strong>${((expenseTotal / incomeTotal) * 100).toFixed(1)}%</strong>
    </div>
    ` : ''}
  `;

  const sortedIncome = [...income].sort((a, b) => new Date(b.date) - new Date(a.date));
  const sortedExpense = [...expense].sort((a, b) => new Date(b.date) - new Date(a.date));

  document.getElementById('temkaDetailIncome').innerHTML = sortedIncome.length > 0
    ? sortedIncome.map(t => `
        <div class="temka-tx income">
          <span>${formatMoney(t.amount)}</span>
          <span>${formatDate(t.date)}</span>
          <span>${escapeHtml(t.description || '—')}</span>
          <button type="button" class="tx-edit-btn" data-id="${t.id}">✎</button>
        </div>
      `).join('')
    : '<p class="empty-hint">Нет доходов</p>';

  document.getElementById('temkaDetailExpense').innerHTML = sortedExpense.length > 0
    ? sortedExpense.map(t => `
        <div class="temka-tx expense">
          <span>−${formatMoney(t.amount)}</span>
          <span>${formatDate(t.date)}</span>
          <span>${escapeHtml(t.description || t.category || '—')}</span>
          <button type="button" class="tx-edit-btn" data-id="${t.id}">✎</button>
        </div>
      `).join('')
    : '<p class="empty-hint">Нет связанных расходов</p>';

  document.getElementById('temkaDetailEditBtn').onclick = () => {
    document.getElementById('temkaDetailModal').classList.remove('active');
    openTemkaModal(temkaId);
  };

  document.getElementById('temkaDetailAddIncomeBtn').onclick = () => {
    document.getElementById('temkaDetailModal').classList.remove('active');
    const amount = (temka.isFixedIncome && temka.fixedIncomeAmount > 0) ? temka.fixedIncomeAmount : null;
    openTransactionModal('income', null, { temkaId, amount });
  };

  document.getElementById('temkaDetailModal').classList.add('active');

  document.querySelectorAll('#temkaDetailContent .tx-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('temkaDetailModal').classList.remove('active');
      openTransactionModal(transactions.find(t => t.id === btn.dataset.id)?.type || 'income', btn.dataset.id);
    });
  });
}

function openTemkaModal(id = null) {
  document.getElementById('temkaModalTitle').textContent = id ? 'Редактировать' : 'Новый вид дохода';
  document.getElementById('temkaId').value = id || '';
  const fixedGroup = document.getElementById('temkaFixedAmountGroup');
  const isFixedCheck = document.getElementById('temkaIsFixed');
  const toggleFixed = () => {
    fixedGroup.style.display = isFixedCheck.checked ? 'block' : 'none';
  };
  isFixedCheck.onchange = toggleFixed;

  if (id) {
    const t = temki.find(x => x.id === id);
    if (t) {
      document.getElementById('temkaName').value = t.name;
      document.getElementById('temkaExpenseAmount').value = (t.expenseAmount != null && t.expenseAmount > 0) ? t.expenseAmount : '';
      document.getElementById('temkaIsFixed').checked = !!t.isFixedIncome;
      document.getElementById('temkaFixedAmount').value = (t.fixedIncomeAmount != null && t.fixedIncomeAmount > 0) ? t.fixedIncomeAmount : '';
    }
    toggleFixed();
  } else {
    document.getElementById('temkaForm').reset();
    document.getElementById('temkaId').value = '';
    fixedGroup.style.display = 'none';
  }
  document.getElementById('temkaModal').classList.add('active');
}

function openAccountModal(id = null) {
  accountModalTitle.textContent = id ? 'Редактировать счет' : 'Новый счет';
  document.getElementById('accountId').value = id || '';
  deleteAccountBtn.style.display = id ? 'block' : 'none';
  if (id) {
    const a = accounts.find(x => x.id === id);
    if (a) {
      document.getElementById('accountName').value = a.name;
      document.getElementById('accountInitialBalance').value = a.initialBalance;
    }
  } else {
    accountForm.reset();
    document.getElementById('accountId').value = '';
  }
  accountModal.classList.add('active');
}

function saveTemka(e) {
  e.preventDefault();
  const id = document.getElementById('temkaId').value;
  const name = document.getElementById('temkaName').value.trim();
  const expenseAmountRaw = document.getElementById('temkaExpenseAmount').value.trim();
  const expenseAmount = expenseAmountRaw ? parseFloat(expenseAmountRaw) : null;
  const isFixedIncome = document.getElementById('temkaIsFixed').checked;
  const fixedAmountRaw = document.getElementById('temkaFixedAmount').value.trim();
  const fixedIncomeAmount = isFixedIncome && fixedAmountRaw ? parseFloat(fixedAmountRaw) : null;

  if (!name) return;

  const data = {
    name,
    expenseAmount: expenseAmount != null && !isNaN(expenseAmount) ? expenseAmount : null,
    isFixedIncome: !!isFixedIncome,
    fixedIncomeAmount: fixedIncomeAmount != null && !isNaN(fixedIncomeAmount) ? fixedIncomeAmount : null,
  };

  if (id) {
    const idx = temki.findIndex(t => t.id === id);
    if (idx >= 0) temki[idx] = { ...temki[idx], ...data };
  } else {
    temki.push({ id: Date.now().toString(), ...data });
  }
  saveData().then(() => {}).catch(() => {});
  renderTemki();
  document.getElementById('temkaModal').classList.remove('active');
}

function deleteTemka(id) {
  if (confirm('Удалить этот вид дохода?')) {
    temki = temki.filter(t => t.id !== id);
    saveData().then(() => {}).catch(() => {});
    renderTemki();
  }
}

// Adjust balance
function applyBalanceAdjustment(e) {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('adjustAmount').value);
  const description = document.getElementById('adjustDescription').value.trim() || 'Корректировка баланса';
  if (isNaN(amount)) {
    alert('Введите корректную сумму');
    return;
  }
  const type = amount >= 0 ? 'income' : 'expense';
  transactions.push({
    id: Date.now().toString(),
    type,
    amount: Math.abs(amount),
    category: 'Корректировка баланса',
    description,
    date: new Date().toISOString().slice(0, 10),
  });
  saveData().then(() => {}).catch(() => {});
  updateBalance();
  renderTransactions();
  document.getElementById('adjustBalanceModal').classList.remove('active');
}

// Advisor: savings suggestion + investment tips
function renderAdvisor() {
  const savingsEl = document.getElementById('advisorSavings');
  const tipsEl = document.getElementById('advisorTips');
  if (!savingsEl) return;

  const { balance } = getTotals();
  const fixedMonthly = getRecurringMonthlyTotal();
  const freeMoney = balance - fixedMonthly;
  const activeGoals = goals.filter(g => (g.target || 0) > (g.current || 0));
  const totalRemaining = activeGoals.reduce((s, g) => s + Math.max(0, (g.target || 0) - (g.current || 0)), 0);

  let advice = '';
  if (fixedMonthly === 0 && activeGoals.length === 0) {
    advice = `<p>Добавьте постоянные расходы и цели, чтобы получить персональные рекомендации по накоплениям.</p>`;
  } else {
    const suggestPct = 0.2; // советуем откладывать до 20% свободных
    const suggestAmount = Math.max(0, Math.floor(freeMoney * suggestPct));
    if (freeMoney < 0) {
      advice = `
        <p class="advisor-warning">Постоянные расходы превышают баланс. Уменьшите расходы или добавьте доходы.</p>
        <p><strong>Постоянные расходы:</strong> ${formatMoney(fixedMonthly)}/мес</p>
        <p><strong>Баланс:</strong> ${formatMoney(balance)}</p>
      `;
    } else {
      advice = `
        <p><strong>Баланс:</strong> ${formatMoney(balance)}</p>
        <p><strong>Постоянные расходы в месяц:</strong> ${formatMoney(fixedMonthly)}</p>
        <p><strong>Свободные средства:</strong> ${formatMoney(freeMoney)}</p>
        <p class="advisor-suggestion">Рекомендуем отложить на цели: <strong>${formatMoney(suggestAmount)}</strong>${totalRemaining > 0 ? ` — это приблизит вас к ${formatMoney(totalRemaining)} на все цели` : ''}.</p>
      `;
    }
  }
  savingsEl.innerHTML = advice;

  const tips = [
    'Создайте резервный фонд на 3–6 месяцев расходов перед агрессивными инвестициями.',
    'Диверсификация: не храните всё в одной валюте или одном инструменте.',
    'Начните с облигаций ОФЗ и гособлигаций — низкий риск, доход выше вкладов.',
    'Индексные фонды (ETF) — простой способ диверсифицировать риски без глубоких знаний.',
    'Долгосрочное инвестирование (5+ лет) снижает волатильность акций.',
    'Реинвестируйте дивиденды — это ускоряет рост капитала.',
  ];
  if (tipsEl) {
    tipsEl.innerHTML = tips.map((t, i) => `<div class="tip-item"><span class="tip-num">${i + 1}</span>${t}</div>`).join('');
  }
}

// Render goals
function renderGoals() {
  if (goals.length === 0) {
    goalsListEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">🎯</div>
        <p>Нет целей. Создайте первую!</p>
      </div>
    `;
    return;
  }

  goalsListEl.innerHTML = goals.map(g => {
    const current = g.current || 0;
    const target = g.target || 0;
    const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0;
    const remaining = Math.max(0, target - current);
    const isComplete = progress >= 100;
    return `
      <div class="goal-item ${isComplete ? 'goal-complete' : ''}" data-id="${g.id}">
        <div class="goal-header">
          <span class="goal-name">${escapeHtml(g.name)}</span>
          <span class="goal-target">Цель: ${formatMoney(target)}</span>
        </div>
        <div class="goal-progress-block">
          <div class="goal-percent">${progress.toFixed(0)}%</div>
          <div class="goal-amounts">
            <span class="goal-saved">Накоплено: ${formatMoney(current)}</span>
            ${!isComplete ? `<span class="goal-remaining">Осталось: ${formatMoney(remaining)}</span>` : '<span class="goal-done">✓ Цель достигнута</span>'}
          </div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
        <div class="goal-footer">
          <span class="progress-text">${formatMoney(current)} из ${formatMoney(target)}</span>
          <div class="goal-actions">
            <button class="goal-btn add-money-btn" data-id="${g.id}">+ Внести</button>
            <button class="goal-btn edit-btn" data-id="${g.id}">✎</button>
            <button class="goal-btn delete-goal-btn" data-id="${g.id}">✕</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  goalsListEl.querySelectorAll('.add-money-btn').forEach(btn => {
    btn.addEventListener('click', () => addMoneyToGoal(btn.dataset.id));
  });
  goalsListEl.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openGoalModal(btn.dataset.id));
  });
  goalsListEl.querySelectorAll('.delete-goal-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteGoal(btn.dataset.id));
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Add money to goal (создаёт расход — вычитается из баланса)
function addMoneyToGoal(goalId) {
  const goal = goals.find(g => g.id === goalId);
  if (!goal) return;
  const amount = prompt('Сколько внести? (₽)', '0');
  if (amount === null) return;
  const num = parseFloat(amount);
  if (isNaN(num) || num < 0) {
    alert('Введите корректную сумму');
    return;
  }
  goal.current = (goal.current || 0) + num;
  transactions.push({
    id: Date.now().toString(),
    type: 'expense',
    amount: num,
    category: 'Внесение на цель',
    description: goal.name,
    date: new Date().toISOString().slice(0, 10),
    goalId,
  });
  saveData().then(() => {}).catch(() => {});
  renderGoals();
  updateBalance();
  renderTransactions();
}

// Open transaction modal (prefill: { temkaId, amount } для подстановки при добавлении дохода из темки)
function openTransactionModal(type, id = null, prefill = null) {
  transactionTypeInput.value = type;
  transactionIdInput.value = id || '';
  modalTitle.textContent = id ? 'Редактировать операцию' : (type === 'income' ? 'Добавить доход' : 'Добавить расход');
  
  const categorySelect = document.getElementById('transactionCategory');
  const categories = type === 'income' ? getIncomeCategories() : EXPENSE_CATEGORIES;
  categorySelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');

  const quickSelectEl = document.getElementById('recurringQuickSelect');
  const chipsEl = document.getElementById('recurringChips');
  const temkiQuickEl = document.getElementById('temkiQuickSelect');
  const temkiChipsEl = document.getElementById('temkiChips');
  const temkaLinkEl = document.getElementById('transactionTemkaLink');
  const temkaLinkSelect = document.getElementById('transactionTemkaId');

  if (type === 'expense' && !id && recurringExpenses.length > 0 && quickSelectEl && chipsEl) {
    quickSelectEl.style.display = 'block';
    chipsEl.innerHTML = recurringExpenses.map((r, i) => 
      `<button type="button" class="recurring-chip" data-idx="${i}">${escapeHtml(r.name)} — ${formatMoney(r.amount || 0)}</button>`
    ).join('');
    chipsEl.querySelectorAll('.recurring-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const r = recurringExpenses[parseInt(btn.dataset.idx, 10)];
        if (r) {
          document.getElementById('transactionAmount').value = r.amount || 0;
          document.getElementById('transactionDescription').value = r.name;
          document.getElementById('transactionCategory').value = 'Прочее';
        }
      });
    });
  } else if (quickSelectEl) {
    quickSelectEl.style.display = 'none';
  }

  if (type === 'income' && !id && temki.length > 0 && temkiQuickEl && temkiChipsEl) {
    temkiQuickEl.style.display = 'block';
    temkiChipsEl.innerHTML = temki.map((t, i) => 
      `<button type="button" class="recurring-chip temki-chip" data-idx="${i}">${escapeHtml(t.name)}</button>`
    ).join('');
    temkiChipsEl.querySelectorAll('.temki-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = temki[parseInt(btn.dataset.idx, 10)];
        if (t) {
          document.getElementById('transactionCategory').value = t.name;
          const tid = document.getElementById('transactionTemkaId');
          if (tid) tid.value = t.id;
          if (t.isFixedIncome && t.fixedIncomeAmount > 0) {
            document.getElementById('transactionAmount').value = t.fixedIncomeAmount;
          }
        }
      });
    });
  } else if (temkiQuickEl) {
    temkiQuickEl.style.display = 'none';
  }

  if (type === 'expense' && temkaLinkEl && temkaLinkSelect) {
    temkaLinkEl.style.display = temki.length > 0 ? 'block' : 'none';
    temkaLinkSelect.innerHTML = '<option value="">— Не связывать</option>' + temki.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  } else if (temkaLinkEl) {
    temkaLinkEl.style.display = 'none';
  }
  if (type === 'income' && temkaLinkSelect) temkaLinkSelect.value = '';

  if (id) {
    const t = transactions.find(tr => tr.id === id);
    if (t) {
      document.getElementById('transactionAmount').value = t.amount;
      document.getElementById('transactionCategory').value = t.category;
      document.getElementById('transactionDescription').value = t.description || '';
      document.getElementById('transactionDate').value = t.date;
      const temkaSel = document.getElementById('transactionTemkaId');
      if (temkaSel) temkaSel.value = t.temkaId || '';
    }
  } else {
    transactionForm.reset();
    transactionTypeInput.value = type;
    transactionIdInput.value = '';
    document.getElementById('transactionDate').value = new Date().toISOString().slice(0, 10);
    const tsel = document.getElementById('transactionTemkaId');
    if (tsel) tsel.value = '';
    if (prefill && type === 'income') {
      if (prefill.temkaId) {
        const temka = temki.find(t => t.id === prefill.temkaId);
        if (temka) {
          document.getElementById('transactionCategory').value = temka.name;
          if (tsel) tsel.value = temka.id;
          if (prefill.amount != null || (temka.isFixedIncome && temka.fixedIncomeAmount > 0)) {
            document.getElementById('transactionAmount').value = prefill.amount != null ? prefill.amount : temka.fixedIncomeAmount;
          }
        }
      }
    }
  }
  transactionModal.classList.add('active');
}

// Open goal modal
function openGoalModal(id = null) {
  document.getElementById('goalModalTitle').textContent = id ? 'Редактировать цель' : 'Новая цель';
  document.getElementById('goalId').value = id || '';
  if (id) {
    const g = goals.find(goal => goal.id === id);
    if (g) {
      document.getElementById('goalName').value = g.name;
      document.getElementById('goalTarget').value = g.target;
      document.getElementById('goalCurrent').value = g.current || 0;
      document.getElementById('goalDeadline').value = g.deadline || '';
    }
  } else {
    goalForm.reset();
    document.getElementById('goalCurrent').value = 0;
  }
  goalModal.classList.add('active');
}

// Save transaction
function saveTransaction(e) {
  e.preventDefault();
  const id = transactionIdInput.value;
  const type = transactionTypeInput.value;
  const amount = parseFloat(document.getElementById('transactionAmount').value);
  const category = document.getElementById('transactionCategory').value;
  const description = document.getElementById('transactionDescription').value.trim();
  const date = document.getElementById('transactionDate').value;
  let temkaId = (document.getElementById('transactionTemkaId')?.value || '').trim() || null;

  if (isNaN(amount) || amount <= 0) {
    alert('Введите корректную сумму');
    return;
  }

  const payload = { amount, category, description, date, temkaId, accountId: currentAccountId };
  if (type === 'income') {
    const temka = temki.find(t => t.name === category);
    payload.temkaId = temka ? temka.id : temkaId;
  }

  if (id) {
    const idx = transactions.findIndex(t => t.id === id);
    if (idx >= 0) {
      transactions[idx] = { ...transactions[idx], ...payload };
    }
  } else {
    transactions.push({
      id: Date.now().toString(),
      type,
      ...payload,
    });
  }
  saveData().then(() => {}).catch(() => {});
  renderTransactions();
  updateBalance();
  renderTemki();
  transactionModal.classList.remove('active');
}

// Save goal
function saveGoal(e) {
  e.preventDefault();
  const id = document.getElementById('goalId').value;
  const name = document.getElementById('goalName').value.trim();
  const target = parseFloat(document.getElementById('goalTarget').value);
  const current = parseFloat(document.getElementById('goalCurrent').value) || 0;
  const deadline = document.getElementById('goalDeadline').value || '';

  if (!name) {
    alert('Введите название цели');
    return;
  }
  if (isNaN(target) || target <= 0) {
    alert('Введите корректную целевую сумму');
    return;
  }

  if (id) {
    const idx = goals.findIndex(g => g.id === id);
    if (idx >= 0) {
      goals[idx] = { ...goals[idx], name, target, current, deadline };
    }
  } else {
    goals.push({
      id: Date.now().toString(),
      name,
      target,
      current,
      deadline,
    });
  }
  saveData().then(() => {}).catch(() => {});
  renderGoals();
  goalModal.classList.remove('active');
}

// Delete transaction
function deleteTransaction(id) {
  if (confirm('Удалить эту операцию?')) {
    transactions = transactions.filter(t => t.id !== id);
    saveData().then(() => {}).catch(() => {});
    renderTransactions();
    updateBalance();
    renderTemki();
  }
}

// Delete goal
function deleteGoal(id) {
  if (confirm('Удалить эту цель?')) {
    goals = goals.filter(g => g.id !== id);
    saveData().then(() => {}).catch(() => {});
    renderGoals();
  }
}

// Format date
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Stats
function renderStats() {
  const periodSelect = document.getElementById('periodSelect');
  const period = periodSelect?.value || 'month';
  
  const now = new Date();
  let startDate;
  if (period === 'week') {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === 'year') {
    startDate = new Date(now.getFullYear(), 0, 1);
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const filtered = transactions.filter(t => new Date(t.date) >= startDate);
  
  const expenseByCat = {};
  filtered.filter(t => t.type === 'expense').forEach(t => {
    expenseByCat[t.category] = (expenseByCat[t.category] || 0) + t.amount;
  });

  const totalExp = Object.values(expenseByCat).reduce((a, b) => a + b, 0);
  const catColors = ['#ff6b6b', '#4dabf7', '#00d9a5', '#ffd43b', '#ff922b', '#ae3ec9', '#20c997', '#868e96'];

  const expenseByCategoryEl = document.getElementById('expenseByCategory');
  if (expenseByCategoryEl) {
    const entries = Object.entries(expenseByCat).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      expenseByCategoryEl.innerHTML = '<p class="empty-state">Нет расходов за период</p>';
    } else {
      expenseByCategoryEl.innerHTML = entries.map(([cat, amount], i) => {
        const pct = totalExp > 0 ? (amount / totalExp) * 100 : 0;
        return `
          <div class="category-bar">
            <span class="cat-name">${cat}</span>
            <div class="bar-container">
              <div class="bar-fill" style="width: ${pct}%; background: ${catColors[i % catColors.length]}"></div>
            </div>
            <span class="cat-amount">${formatMoney(amount)}</span>
          </div>
        `;
      }).join('');
    }
  }

  const periodStatsEl = document.getElementById('periodStats');
  if (periodStatsEl) {
    const periodIncome = filtered.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
    const periodExpense = filtered.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
    periodStatsEl.innerHTML = `
      <div class="stat-row"><span>Доходы</span><span style="color: var(--accent-green)">${formatMoney(periodIncome)}</span></div>
      <div class="stat-row"><span>Расходы</span><span style="color: var(--accent-red)">${formatMoney(periodExpense)}</span></div>
      <div class="stat-row"><span>Итого</span><span style="color: var(--accent-blue)">${formatMoney(periodIncome - periodExpense)}</span></div>
    `;
  }
}

// Tab switching
function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      if (!tabId) return;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(tabId);
      if (target) target.classList.add('active');
      if (tabId === 'stats') renderStats();
      if (tabId === 'advisor') renderAdvisor();
      if (tabId === 'temki') renderTemki();
    });
  });
}

// UI init (bind events)
function initUI() {
  renderAccounts();
  // Load saved API key
  const savedKey = localStorage.getItem(STORAGE_KEYS.apiKey);
  if (savedKey) {
    apiKeyInput.value = savedKey;
    rememberKeyCheckbox.checked = true;
  }
  initTabs();
  addIncomeBtn.addEventListener('click', () => openTransactionModal('income'));
  addExpenseBtn.addEventListener('click', () => openTransactionModal('expense'));
  addGoalBtn.addEventListener('click', () => openGoalModal());
  const addRecurringBtn = document.getElementById('addRecurringBtn');
  if (addRecurringBtn) addRecurringBtn.addEventListener('click', (e) => { e.preventDefault(); openRecurringModal(); });
  closeModal.addEventListener('click', () => transactionModal.classList.remove('active'));
  closeGoalModal.addEventListener('click', () => goalModal.classList.remove('active'));
  document.getElementById('closeRecurringModal')?.addEventListener('click', () => document.getElementById('recurringModal').classList.remove('active'));
  transactionModal.addEventListener('click', (e) => {
    if (e.target === transactionModal) transactionModal.classList.remove('active');
  });
  goalModal.addEventListener('click', (e) => {
    if (e.target === goalModal) goalModal.classList.remove('active');
  });
  document.getElementById('recurringModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'recurringModal') e.target.classList.remove('active');
  });
  transactionForm.addEventListener('submit', saveTransaction);
  document.getElementById('transactionCategory')?.addEventListener('change', function() {
    if (transactionTypeInput.value !== 'income') return;
    const temka = temki.find(t => t.name === this.value);
    if (temka && temka.isFixedIncome && temka.fixedIncomeAmount > 0) {
      const amtEl = document.getElementById('transactionAmount');
      if (amtEl && (!amtEl.value || amtEl.value === '0')) amtEl.value = temka.fixedIncomeAmount;
    }
  });
  goalForm.addEventListener('submit', saveGoal);
  document.getElementById('recurringForm')?.addEventListener('submit', saveRecurring);
  document.getElementById('adjustBalanceBtn')?.addEventListener('click', () => {
    document.getElementById('adjustAmount').value = '';
    document.getElementById('adjustDescription').value = '';
    document.getElementById('adjustBalanceModal').classList.add('active');
  });
  document.getElementById('closeAdjustBalanceModal')?.addEventListener('click', () => document.getElementById('adjustBalanceModal').classList.remove('active'));
  document.getElementById('adjustBalanceForm')?.addEventListener('submit', applyBalanceAdjustment);
  document.getElementById('adjustBalanceModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'adjustBalanceModal') e.target.classList.remove('active');
  });
  document.getElementById('addTemkaBtn')?.addEventListener('click', () => openTemkaModal());
  document.getElementById('closeTemkaModal')?.addEventListener('click', () => document.getElementById('temkaModal').classList.remove('active'));
  document.getElementById('temkaForm')?.addEventListener('submit', saveTemka);
  document.getElementById('temkaModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'temkaModal') e.target.classList.remove('active');
  });
  document.getElementById('closeTemkaDetailModal')?.addEventListener('click', () => document.getElementById('temkaDetailModal').classList.remove('active'));
  document.getElementById('temkaDetailModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'temkaDetailModal') e.target.classList.remove('active');
  });

  addAccountBtn.addEventListener('click', () => openAccountModal());
  editAccountBtn.addEventListener('click', () => openAccountModal(currentAccountId));
  closeAccountModal.addEventListener('click', () => accountModal.classList.remove('active'));
  accountForm.addEventListener('submit', saveAccount);
  deleteAccountBtn.addEventListener('click', deleteAccount);
  accountModal.addEventListener('click', (e) => {
    if (e.target === accountModal) accountModal.classList.remove('active');
  });
  accountSelect.addEventListener('change', switchAccount);
  document.getElementById('periodSelect')?.addEventListener('change', renderStats);
  openAdvisorModalBtn.addEventListener('click', () => advisorModal.classList.add('active'));
  closeAdvisorModal.addEventListener('click', () => advisorModal.classList.remove('active'));
  advisorModal.addEventListener('click', (e) => {
    if (e.target === advisorModal) advisorModal.classList.remove('active');
  });
  sendAdvisorBtn.addEventListener('click', sendAdvisorQuestion);
}

// AI Advisor functions
async function sendAdvisorQuestion() {
  const question = advisorQuestion.value.trim();
  if (!question) return;

  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    alert('Пожалуйста, введите API ключ Groq.');
    return;
  }

  // Add user message to chat
  addMessageToChat('user', question);
  advisorQuestion.value = '';
  sendAdvisorBtn.disabled = true;
  sendAdvisorBtn.textContent = 'Отправка...';

  try {
    const advice = await getAIAdvice(question, apiKey);
    addMessageToChat('ai', advice);
  } catch (error) {
    console.error('AI Advisor error:', error);
    addMessageToChat('ai', `Извините, произошла ошибка: ${error.message}. Проверьте API ключ и попробуйте снова.`);
  } finally {
    sendAdvisorBtn.disabled = false;
    sendAdvisorBtn.textContent = 'Отправить';
  }

  // Save or remove API key based on checkbox
  if (rememberKeyCheckbox.checked) {
    localStorage.setItem(STORAGE_KEYS.apiKey, apiKey);
    // Sync to cloud if enabled
    if (useCloudSync && typeof FirebaseService !== 'undefined') {
      FirebaseService.saveToCloud(transactions, goals, recurringExpenses, temki, accounts, currentAccountId, apiKey);
    }
  } else {
    localStorage.removeItem(STORAGE_KEYS.apiKey);
    // Remove from cloud
    if (useCloudSync && typeof FirebaseService !== 'undefined') {
      FirebaseService.saveToCloud(transactions, goals, recurringExpenses, temki, accounts, currentAccountId, null);
    }
  }
}

function addMessageToChat(type, text) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  messageDiv.innerHTML = `<strong>${type === 'user' ? 'Вы:' : 'AI:'}</strong> ${text}`;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function getAIAdvice(question, apiKey) {
  // Gather financial data
  const totals = getTotals();
  const accountTransactions = transactions.filter(t => t.accountId === currentAccountId);
  const accountGoals = goals.filter(g => g.accountId === currentAccountId);

  const dataSummary = {
    totalIncome: totals.income,
    totalExpenses: totals.expenses,
    balance: totals.balance,
    goals: accountGoals.map(g => ({ name: g.name, target: g.targetAmount, current: g.currentAmount })),
    recentTransactions: accountTransactions.slice(-5).map(t => ({
      type: t.type,
      amount: t.amount,
      category: t.category,
      description: t.description,
      date: t.date
    }))
  };

  const prompt = `
Вы финансовый консультант. Пользователь спросил: "${question}"

Данные пользователя:
- Общий доход: ${dataSummary.totalIncome} ₽
- Общие расходы: ${dataSummary.totalExpenses} ₽
- Баланс: ${dataSummary.balance} ₽
- Цели: ${dataSummary.goals.map(g => `${g.name}: ${g.current}/${g.target} ₽`).join(', ')}
- Последние транзакции: ${dataSummary.recentTransactions.map(t => `${t.type === 'income' ? 'Доход' : 'Расход'}: ${t.amount} ₽ (${t.category}) - ${t.description}`).join('; ')}

Дайте полезный совет на русском языке, основанный на этих данных. Будьте кратки и конкретны.
  `;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: 'You are a helpful financial advisor. Provide concise advice in Russian.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.7,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('API Error:', response.status, errorText);
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Auth: show app, load data, subscribe to sync
async function showApp() {
  isShowingAuth = false;
  console.log('Showing app, useCloudSync:', useCloudSync);
  authScreen.style.display = 'none';
  appEl.style.display = 'block';
  if (logoutBtn) {
    logoutBtn.style.display = 'block';
    if (useCloudSync) {
      logoutBtn.disabled = false;
      logoutBtn.title = 'Выйти';
    } else {
      logoutBtn.disabled = true;
      logoutBtn.title = 'Синхронизация отключена';
    }
  }
  loadDataFromStorage();
  if (useCloudSync && typeof FirebaseService !== 'undefined') {
    const data = await FirebaseService.loadFromCloud();
    applyData(data);
    FirebaseService.subscribeToSync(applyData);
  } else {
    applyData({ transactions, goals, recurringExpenses, temki, accounts, currentAccountId });
  }
  initUI();
}

// Auth: show login screen
function showAuth() {
  isShowingAuth = true;
  console.log('Showing auth screen, useCloudSync:', useCloudSync);
  authScreen.style.display = 'flex';
  appEl.style.display = 'none';
  if (logoutBtn) {
    logoutBtn.style.display = 'block';
    logoutBtn.disabled = true;
    logoutBtn.title = 'Синхронизация отключена';
  }
}

// Auth form
let isSignUp = false;
function initAuth() {
  const form = document.getElementById('authForm');
  const submitBtn = document.getElementById('authSubmit');
  const switchBtn = document.getElementById('authSwitchBtn');
  const switchText = document.getElementById('authSwitchText');
  const errorEl = document.getElementById('authError');

  form.onsubmit = async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    try {
      if (isSignUp) {
        await FirebaseService.signUp(email, password);
      } else {
        await FirebaseService.signIn(email, password);
      }
      // showApp() will be called by onAuthStateChanged
    } catch (err) {
      errorEl.textContent = err.code === 'auth/email-already-in-use' ? 'Email уже используется' :
        err.code === 'auth/weak-password' ? 'Пароль минимум 6 символов' :
        err.code === 'auth/invalid-credential' ? 'Неверный email или пароль' :
        err.message || 'Ошибка входа';
    }
  };

  switchBtn.onclick = () => {
    isSignUp = !isSignUp;
    switchBtn.textContent = isSignUp ? 'Войти' : 'Регистрация';
    switchText.textContent = isSignUp ? 'Уже есть аккаунт?' : 'Нет аккаунта?';
    submitBtn.textContent = isSignUp ? 'Зарегистрироваться' : 'Войти';
    errorEl.textContent = '';
  };
}

// Init
async function init() {
  if (typeof FirebaseService !== 'undefined' && FirebaseService.isConfigured()) {
    const ok = await FirebaseService.init();
    if (ok) {
      useCloudSync = localStorage.getItem('useCloudSync') === 'true';
      initAuth();
      logoutBtn.onclick = async () => {
        if (!useCloudSync) {
          alert('Синхронизация отключена, выйти некуда. Вы можете использовать локально без синхронизации.');
          return;
        }
        await FirebaseService.signOut();
        showAuth();
      };
      localBtn.onclick = () => {
        useCloudSync = false;
        localStorage.setItem('useCloudSync', 'false');
        showApp();
      };
      FirebaseService.onAuthStateChanged((user) => {
        if (user) {
          useCloudSync = true;
          localStorage.setItem('useCloudSync', 'true');
          if (!isShowingAuth) showApp();
        } else {
          showAuth();
        }
      });
      return;
    }
  }
  // No Firebase, always local
  useCloudSync = false;
  initAuth();
  showApp();
}

// Force reload data from storage and re-render, but keep existing state if corrupted
function refreshData() {
  loadDataFromStorage();
  applyData({ transactions, goals, recurringExpenses, temki, accounts, currentAccountId });
}

// Run refresh on startup to recover from any corrupt localStorage
refreshData();

// Render accounts
function renderAccounts() {
  accountSelect.innerHTML = accounts.map(a => `<option value="${a.id}" ${a.id === currentAccountId ? 'selected' : ''}>${a.name}</option>`).join('');
}

// Save account
function saveAccount(e) {
  e.preventDefault();
  const id = document.getElementById('accountId').value;
  const name = document.getElementById('accountName').value.trim();
  const initialBalance = parseFloat(document.getElementById('accountInitialBalance').value) || 0;

  if (!name) {
    alert('Введите название счета');
    return;
  }

  if (id) {
    const idx = accounts.findIndex(a => a.id === id);
    if (idx >= 0) {
      accounts[idx] = { ...accounts[idx], name, initialBalance };
    }
  } else {
    accounts.push({
      id: Date.now().toString(),
      name,
      initialBalance,
    });
    currentAccountId = accounts[accounts.length - 1].id;
  }
  saveData().then(() => {
    renderAccounts();
    updateBalance();
    renderTransactions();
    accountModal.classList.remove('active');
  });
}

// Delete account
function deleteAccount() {
  const id = document.getElementById('accountId').value;
  if (!id) return;
  if (accounts.length <= 1) {
    alert('Нельзя удалить последний счет');
    return;
  }
  if (!confirm('Удалить счет и все связанные транзакции?')) return;
  accounts = accounts.filter(a => a.id !== id);
  transactions = transactions.filter(t => t.accountId !== id);
  if (currentAccountId === id) {
    currentAccountId = accounts[0].id;
  }
  saveData().then(() => {
    renderAccounts();
    updateBalance();
    renderTransactions();
    accountModal.classList.remove('active');
  });
}

// Switch account
function switchAccount() {
  currentAccountId = accountSelect.value;
  localStorage.setItem(STORAGE_KEYS.currentAccountId, currentAccountId);
  updateBalance();
  renderTransactions();
  renderGoals();
  renderRecurring();
  renderTemki();
  renderAdvisor();
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  if ('serviceWorker' in navigator) {
    // Disable any existing service worker caching (caused issues with stale JS/CSS)
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    }).catch((e) => {
      console.warn('SW unregister failed:', e);
    });
  }
});
