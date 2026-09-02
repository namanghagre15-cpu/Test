/* ============================================================
   stats.js — Charts & Analytics (stats.html)
   Uses Chart.js (loaded via CDN as a global `Chart`)
   ============================================================ */
import { renderNav } from './nav.js';
import {
  getMonthlyIncomeExpense,
  getCategoryBreakdown,
  getNeedsVsWants,
  getWeeklySpend,
  formatINR,
  categoryIcon,
} from './db.js';

renderNav('stats');

const CHARCOAL = '#171e19';
const CRIMSON = '#ca0013';
const SAGE = '#b7c6c2';
const PALETTE = ['#ca0013', '#171e19', '#b7c6c2', '#e8a0a8', '#7c8985', '#e0d9c8'];

Chart.defaults.font.family = "'Nunito', sans-serif";
Chart.defaults.font.weight = '700';
Chart.defaults.color = CHARCOAL;

async function renderMonthSummary() {
  const { income, expense } = await getMonthlyIncomeExpense();
  document.getElementById('month-income').textContent = formatINR(income);
  document.getElementById('month-expense').textContent = formatINR(expense);
}

async function renderWeeklyChart() {
  const buckets = await getWeeklySpend(7);
  const ctx = document.getElementById('weekly-chart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: buckets.map((b) => b.label),
      datasets: [
        {
          data: buckets.map((b) => b.total),
          backgroundColor: CRIMSON,
          borderRadius: 8,
          maxBarThickness: 28,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: 'rgba(183,198,194,0.25)' }, beginAtZero: true },
      },
    },
  });
}

async function renderCategoryChart() {
  const breakdown = await getCategoryBreakdown();
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const canvasWrap = document.getElementById('category-chart').parentElement;
  const emptyEl = document.getElementById('category-empty');
  const legendEl = document.getElementById('category-legend');

  if (entries.length === 0) {
    canvasWrap.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }
  canvasWrap.classList.remove('hidden');
  emptyEl.classList.add('hidden');

  const ctx = document.getElementById('category-chart').getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map((e) => e[0]),
      datasets: [
        {
          data: entries.map((e) => e[1]),
          backgroundColor: entries.map((_, i) => PALETTE[i % PALETTE.length]),
          borderColor: '#ffffff',
          borderWidth: 3,
        },
      ],
    },
    options: {
      cutout: '68%',
      plugins: { legend: { display: false } },
    },
  });

  legendEl.innerHTML = entries
    .map(
      (e, i) => `
      <div class="flex items-center gap-2 text-[12px] font-bold">
        <span class="w-3 h-3 rounded-full shrink-0" style="background:${PALETTE[i % PALETTE.length]}"></span>
        <span class="truncate">${categoryIcon(e[0])} ${e[0]}</span>
        <span class="ml-auto text-sage">${formatINR(e[1])}</span>
      </div>`
    )
    .join('');
}

async function renderNeedsWants() {
  const { need, want } = await getNeedsVsWants();
  document.getElementById('need-amount').textContent = formatINR(need);
  document.getElementById('want-amount').textContent = formatINR(want);

  const ctx = document.getElementById('needs-wants-chart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Needs', 'Wants'],
      datasets: [
        {
          data: [need, want],
          backgroundColor: [CHARCOAL, CRIMSON],
          borderRadius: 10,
          maxBarThickness: 46,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(183,198,194,0.25)' }, beginAtZero: true },
        y: { grid: { display: false } },
      },
    },
  });
}

renderMonthSummary();
renderWeeklyChart();
renderCategoryChart();
renderNeedsWants();
