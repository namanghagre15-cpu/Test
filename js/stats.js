/* ============================================================
   stats.js — Charts & Analytics with selectable periods (stats.html)
   ============================================================ */
import { renderNav } from './nav.js';
import {
  getCategoryBreakdown,
  getNeedsVsWants,
  getCashVsOnline,
  getDailySpendBuckets,
  getBiggestExpense,
  getAverageDailySpend,
  getAllTransactions,
  formatINR,
} from './db.js';

renderNav('stats');
window.__mfAppRendered = true;

const CHARCOAL = '#171e19';
const CRIMSON = '#ca0013';
const SAGE = '#b7c6c2';
const PALETTE = ['#ca0013', '#171e19', '#b7c6c2', '#e8a0a8', '#7c8985', '#e0d9c8', '#a45d5d', '#5d6b67'];

Chart.defaults.font.family = "'Nunito', sans-serif";
Chart.defaults.font.weight = '700';

function inkColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--color-ink').trim() || CHARCOAL;
}
Chart.defaults.color = inkColor();

let currentPeriod = '7'; // '7' | '30' | '90' | 'all'
let charts = {};

function getRange() {
  const end = new Date();
  let start;
  if (currentPeriod === 'all') {
    start = new Date(0);
  } else {
    start = new Date();
    start.setDate(end.getDate() - (Number(currentPeriod) - 1));
    start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}

function destroyChart(key) {
  if (charts[key]) {
    charts[key].destroy();
    delete charts[key];
  }
}

async function renderPeriodSummary() {
  const { start, end } = getRange();
  let income = 0;
  let expense = 0;

  if (currentPeriod === 'all') {
    const all = await getAllTransactions();
    all.forEach((t) => {
      if (t.isPending) return;
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') expense += t.amount;
    });
  } else {
    const all = await getAllTransactions();
    all.forEach((t) => {
      if (t.isPending) return;
      const d = new Date(t.date);
      if (d < start || d > end) return;
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') expense += t.amount;
    });
  }

  document.getElementById('period-income').textContent = formatINR(income);
  document.getElementById('period-expense').textContent = formatINR(expense);

  const biggest = await getBiggestExpense(start, end);
  if (biggest) {
    document.getElementById('biggest-expense').textContent = formatINR(biggest.amount);
    document.getElementById('biggest-expense-cat').textContent = biggest.category;
  } else {
    document.getElementById('biggest-expense').textContent = '₹0';
    document.getElementById('biggest-expense-cat').textContent = '—';
  }

  const avgDaily = await getAverageDailySpend(start, end);
  document.getElementById('avg-daily').textContent = formatINR(avgDaily);
}

async function renderTrendChart() {
  const days = currentPeriod === 'all' ? 90 : Math.min(90, Number(currentPeriod));
  const buckets = await getDailySpendBuckets(days);
  destroyChart('weekly');
  const ctx = document.getElementById('weekly-chart').getContext('2d');
  charts.weekly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: buckets.map((b) => b.label),
      datasets: [{ data: buckets.map((b) => b.total), backgroundColor: CRIMSON, borderRadius: 8, maxBarThickness: 22 }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: inkColor(), maxRotation: 0, autoSkip: true } },
        y: { grid: { color: 'rgba(183,198,194,0.25)' }, beginAtZero: true, ticks: { color: inkColor() } },
      },
    },
  });
}

async function renderCategoryChart() {
  const { start, end } = getRange();
  const breakdown = await getCategoryBreakdown(start, end);
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const canvasWrap = document.getElementById('category-chart').parentElement;
  const emptyEl = document.getElementById('category-empty');
  const legendEl = document.getElementById('category-legend');

  destroyChart('category');

  if (entries.length === 0) {
    canvasWrap.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    legendEl.innerHTML = '';
    return;
  }
  canvasWrap.classList.remove('hidden');
  emptyEl.classList.add('hidden');

  const ctx = document.getElementById('category-chart').getContext('2d');
  charts.category = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map((e) => e[0]),
      datasets: [{ data: entries.map((e) => e[1]), backgroundColor: entries.map((_, i) => PALETTE[i % PALETTE.length]), borderColor: '#ffffff', borderWidth: 3 }],
    },
    options: { cutout: '68%', plugins: { legend: { display: false } } },
  });

  legendEl.innerHTML = entries
    .map(
      (e, i) => `
      <div class="flex items-center gap-2 text-[12px] font-bold">
        <span class="w-3 h-3 rounded-full shrink-0" style="background:${PALETTE[i % PALETTE.length]}"></span>
        <span class="truncate">${e[0]}</span>
        <span class="ml-auto text-sage">${formatINR(e[1])}</span>
      </div>`
    )
    .join('');
}

async function renderNeedsWants() {
  const { start, end } = getRange();
  const { need, want } = await getNeedsVsWants(start, end);
  document.getElementById('need-amount').textContent = formatINR(need);
  document.getElementById('want-amount').textContent = formatINR(want);

  destroyChart('needsWants');
  const ctx = document.getElementById('needs-wants-chart').getContext('2d');
  charts.needsWants = new Chart(ctx, {
    type: 'bar',
    data: { labels: ['Needs', 'Wants'], datasets: [{ data: [need, want], backgroundColor: [CHARCOAL, CRIMSON], borderRadius: 10, maxBarThickness: 46 }] },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(183,198,194,0.25)' }, beginAtZero: true, ticks: { color: inkColor() } },
        y: { grid: { display: false }, ticks: { color: inkColor() } },
      },
    },
  });
}

async function renderCashOnline() {
  const { start, end } = getRange();
  const { cash, online } = await getCashVsOnline(start, end);

  destroyChart('cashOnline');
  const ctx = document.getElementById('cash-online-chart').getContext('2d');
  charts.cashOnline = new Chart(ctx, {
    type: 'bar',
    data: { labels: ['Cash', 'Online'], datasets: [{ data: [cash, online], backgroundColor: [SAGE, CRIMSON], borderRadius: 10, maxBarThickness: 46 }] },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(183,198,194,0.25)' }, beginAtZero: true, ticks: { color: inkColor() } },
        y: { grid: { display: false }, ticks: { color: inkColor() } },
      },
    },
  });
}

async function renderAll() {
  await renderPeriodSummary();
  await renderTrendChart();
  await renderCategoryChart();
  await renderNeedsWants();
  await renderCashOnline();
}

document.querySelectorAll('.period-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = btn.dataset.period;
    renderAll();
  });
});

renderAll();
