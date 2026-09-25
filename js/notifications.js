/* ============================================================
   notifications.js — Local notification system (10 types).

   IMPORTANT, HONEST LIMITATION: Money follow is a static PWA with
   no backend server. There is no infrastructure here to "push" a
   notification to a phone that hasn't opened the app in days —
   that requires a real push server (VAPID + a backend to trigger
   it), which this app does not have. What this module DOES do:
   every time any page loads (and the app is open/foreground, or
   was very recently backgrounded), it checks each enabled
   condition and fires a real Android notification via the Service
   Worker if something needs your attention — same underlying
   Notification you'd see from any app, just triggered locally
   instead of from a remote server.
   ============================================================ */
import {
  getAvailableToSpend,
  getLowBalanceThreshold,
  getMonthlyIncomeExpense,
  getMonthlyBudget,
  getCategoryBudgetStatus,
  getRecurringList,
  detectRecurringCandidates,
  getVaultGoals,
  getCurrentNoSpendStreak,
  getLedgerEntries,
  formatINR,
  getLocal,
  setLocal,
} from './db.js';

export const NOTIFICATION_TYPES = [
  { id: 'low_balance', label: 'Low Balance Alert', description: 'When your Available to Spend drops below your alert threshold.', default: true },
  { id: 'budget_crossed', label: 'Monthly Budget Crossed', description: 'When you go over your total monthly budget.', default: true },
  { id: 'category_budget', label: 'Category Budget Warning', description: 'When a category budget hits 100%.', default: true },
  { id: 'recurring_due', label: 'Recurring Expense Due', description: 'When a recurring expense is due today.', default: false },
  { id: 'recurring_suggestion', label: 'Recurring Suggestion', description: 'When a spending pattern looks like it should be Recurring.', default: false },
  { id: 'vault_goal_reached', label: 'Vault Goal Reached', description: 'When a savings goal hits its target.', default: true },
  { id: 'vault_deadline', label: 'Vault Deadline Approaching', description: 'When a goal deadline is within 3 days and not yet reached.', default: false },
  { id: 'streak_milestone', label: 'No-Spend Streak Milestone', description: 'On your 7-day and 30-day no-spend streaks.', default: false },
  { id: 'khata_reminder', label: 'Khata Reminder', description: 'When someone has owed you money for over a week.', default: false },
  { id: 'weekly_summary', label: 'Weekly Summary', description: 'A once-a-week digest of what you spent.', default: false },
];

export function getNotificationPrefs() {
  const stored = getLocal('notification_prefs', null);
  if (stored) return stored;
  const defaults = {};
  NOTIFICATION_TYPES.forEach((t) => (defaults[t.id] = t.default));
  return defaults;
}
export function setNotificationPref(typeId, enabled) {
  const prefs = getNotificationPrefs();
  prefs[typeId] = enabled;
  setLocal('notification_prefs', prefs);
}

export function getNotificationPermissionState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}

async function fireNotification(tag, title, body) {
  if (Notification.permission !== 'granted') return;
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        tag,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
      });
    } else {
      new Notification(title, { body, tag, icon: 'icons/icon-192.png' });
    }
  } catch (e) {
    /* notifications are a nice-to-have — never break the app if this fails */
  }
}

// Dedupe helper: only fire once per "key" (e.g. once per day, or once ever
// for a milestone) — prevents the same alert firing on every page load.
function alreadyFiredToday(dedupeKey) {
  const log = getLocal('notification_log', {});
  const todayStr = new Date().toISOString().slice(0, 10);
  return log[dedupeKey] === todayStr;
}
function markFiredToday(dedupeKey) {
  const log = getLocal('notification_log', {});
  log[dedupeKey] = new Date().toISOString().slice(0, 10);
  setLocal('notification_log', log);
}
function alreadyFiredEver(dedupeKey) {
  const log = getLocal('notification_log', {});
  return !!log[dedupeKey];
}
function markFiredEver(dedupeKey) {
  const log = getLocal('notification_log', {});
  log[dedupeKey] = true;
  setLocal('notification_log', log);
}

/**
 * Call this once per page load (wired into nav.js). Cheap no-op if
 * permission isn't granted or nothing is enabled.
 */
export async function checkAndFireNotifications() {
  if (getNotificationPermissionState() !== 'granted') return;
  const prefs = getNotificationPrefs();

  try {
    if (prefs.low_balance) {
      const [available, threshold] = await Promise.all([getAvailableToSpend(), getLowBalanceThreshold()]);
      if (available < threshold && !alreadyFiredToday('low_balance')) {
        await fireNotification('low_balance', 'Low balance', `Available to spend is ${formatINR(available)} — under your alert threshold.`);
        markFiredToday('low_balance');
      }
    }

    if (prefs.budget_crossed) {
      const [{ expense }, budget] = await Promise.all([getMonthlyIncomeExpense(), getMonthlyBudget()]);
      if (budget > 0 && expense > budget && !alreadyFiredToday('budget_crossed')) {
        await fireNotification('budget_crossed', 'Monthly budget crossed', `You've spent ${formatINR(expense)} of your ${formatINR(budget)} budget this month.`);
        markFiredToday('budget_crossed');
      }
    }

    if (prefs.category_budget) {
      const status = await getCategoryBudgetStatus();
      for (const s of status) {
        if (s.pct >= 100 && !alreadyFiredToday(`catbudget_${s.category}`)) {
          await fireNotification(`catbudget_${s.category}`, `${s.category} budget crossed`, `${formatINR(s.spent)} of ${formatINR(s.limit)} this month.`);
          markFiredToday(`catbudget_${s.category}`);
        }
      }
    }

    if (prefs.recurring_due) {
      const recurring = await getRecurringList();
      const todayStr = new Date().toISOString().slice(0, 10);
      recurring
        .filter((r) => r.active && r.nextDueDate && r.nextDueDate.slice(0, 10) <= todayStr)
        .forEach((r) => {
          if (!alreadyFiredToday(`recurring_${r.id}`)) {
            fireNotification(`recurring_${r.id}`, `${r.title} is due`, `${formatINR(r.amount)} — recurring ${r.frequency} expense.`);
            markFiredToday(`recurring_${r.id}`);
          }
        });
    }

    if (prefs.recurring_suggestion) {
      const candidates = await detectRecurringCandidates();
      if (candidates.length > 0 && !alreadyFiredToday('recurring_suggestion')) {
        const c = candidates[0];
        await fireNotification('recurring_suggestion', 'Looks like a recurring expense', `${formatINR(c.amount)} on ${c.category}, ${c.count} times — add it as Recurring?`);
        markFiredToday('recurring_suggestion');
      }
    }

    if (prefs.vault_goal_reached) {
      const goals = await getVaultGoals();
      goals
        .filter((g) => g.targetAmount > 0 && g.savedAmount >= g.targetAmount)
        .forEach((g) => {
          const key = `goal_reached_${g.id}`;
          if (!alreadyFiredEver(key)) {
            fireNotification(key, 'Goal reached!', `"${g.title}" hit its target of ${formatINR(g.targetAmount)}.`);
            markFiredEver(key);
          }
        });
    }

    if (prefs.vault_deadline) {
      const goals = await getVaultGoals();
      const now = new Date();
      goals
        .filter((g) => g.deadline && g.savedAmount < g.targetAmount)
        .forEach((g) => {
          const daysLeft = Math.ceil((new Date(g.deadline) - now) / 86400000);
          if (daysLeft >= 0 && daysLeft <= 3 && !alreadyFiredToday(`deadline_${g.id}`)) {
            fireNotification(`deadline_${g.id}`, `"${g.title}" deadline approaching`, `${daysLeft} day${daysLeft === 1 ? '' : 's'} left — ${formatINR(g.targetAmount - g.savedAmount)} to go.`);
            markFiredToday(`deadline_${g.id}`);
          }
        });
    }

    if (prefs.streak_milestone) {
      const streak = getCurrentNoSpendStreak();
      if ((streak === 7 || streak === 30) && !alreadyFiredToday(`streak_${streak}`)) {
        await fireNotification(`streak_${streak}`, `${streak}-day no-spend streak!`, `You've gone ${streak} days without spending. Keep going.`);
        markFiredToday(`streak_${streak}`);
      }
    }

    if (prefs.khata_reminder) {
      const entries = await getLedgerEntries();
      const now = new Date();
      entries
        .filter((e) => !e.settled && e.direction === 'owe_me' && (now - new Date(e.date)) / 86400000 >= 7)
        .forEach((e) => {
          const key = `khata_${e.id}`;
          if (!alreadyFiredToday(key)) {
            fireNotification(key, `Reminder: ${e.personName} owes you`, `${formatINR(e.amount)} pending for over a week.`);
            markFiredToday(key);
          }
        });
    }

    if (prefs.weekly_summary) {
      const lastSummary = getLocal('last_weekly_summary_at', 0);
      if (Date.now() - lastSummary >= 7 * 86400000) {
        const { expense } = await getMonthlyIncomeExpense();
        await fireNotification('weekly_summary', 'Your week in Money follow', `You've spent ${formatINR(expense)} so far this month.`);
        setLocal('last_weekly_summary_at', Date.now());
      }
    }
  } catch (e) {
    /* never let a notification-check failure break page load */
  }
}
