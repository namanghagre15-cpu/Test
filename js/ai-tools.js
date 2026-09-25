/* ============================================================
   ai-tools.js — The 10 tools exposed to the AI assistant.
   Each tool wraps an existing db.js function — the assistant
   can only do what these functions allow (read your data, or
   add entries the same way the UI does); it can never touch
   anything outside of this list, and every write action is
   confirmed back to you in the chat as it happens.
   ============================================================ */
import {
  getAvailableToSpend,
  getWallets,
  getTotalVaultLocked,
  addExpense,
  addIncome,
  getRecentTransactions,
  getMonthlyIncomeExpense,
  getCategoryBreakdown,
  getNeedsVsWants,
  searchTransactions,
  getVaultGoals,
  addVaultGoal,
  addLedgerEntry,
  getCategoryBudgetStatus,
  formatINR,
  CATEGORIES,
} from './db.js';

/** Provider-agnostic tool schema (OpenAI/Groq function-call format). */
export const TOOL_DEFS = [
  {
    name: 'get_balance',
    description: 'Get the current Available to Spend, cash/online wallet balances, and total Vault savings.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'add_expense',
    description: 'Log a new expense.',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount in rupees' },
        category: { type: 'string', enum: CATEGORIES },
        walletType: { type: 'string', enum: ['cash', 'online'] },
        expenseType: { type: 'string', enum: ['need', 'want'] },
        note: { type: 'string', description: 'Optional short note' },
      },
      required: ['amount', 'category', 'walletType', 'expenseType'],
    },
  },
  {
    name: 'add_income',
    description: 'Log pocket money / income received.',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number' },
        walletType: { type: 'string', enum: ['cash', 'online'] },
        note: { type: 'string' },
      },
      required: ['amount', 'walletType'],
    },
  },
  {
    name: 'get_recent_transactions',
    description: 'Get the most recent transactions (expenses and income).',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'How many to fetch, default 10' } },
      required: [],
    },
  },
  {
    name: 'get_spending_summary',
    description: 'Get this month\'s total income, total expense, category breakdown, and needs-vs-wants split.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'search_transactions',
    description: 'Search transactions by text, category, or amount range.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to search in note/category' },
        category: { type: 'string', enum: CATEGORIES },
        minAmount: { type: 'number' },
        maxAmount: { type: 'number' },
      },
      required: [],
    },
  },
  {
    name: 'get_vault_goals',
    description: 'List all Vault savings goals with their progress.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'add_vault_goal',
    description: 'Create a new Vault savings goal.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        targetAmount: { type: 'number' },
        deadline: { type: 'string', description: 'ISO date, optional' },
      },
      required: ['title', 'targetAmount'],
    },
  },
  {
    name: 'add_khata_entry',
    description: 'Record a lend/borrow entry in Khata (money owed between you and someone else).',
    parameters: {
      type: 'object',
      properties: {
        personName: { type: 'string' },
        amount: { type: 'number' },
        direction: { type: 'string', enum: ['owe_me', 'i_owe'], description: 'owe_me = they owe you, i_owe = you owe them' },
        note: { type: 'string' },
      },
      required: ['personName', 'amount', 'direction'],
    },
  },
  {
    name: 'get_category_budget_status',
    description: 'Get progress against any per-category monthly budgets the user has set.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
];

/** Executes a tool call by name and returns a JSON-serializable result. */
export async function executeTool(name, args) {
  switch (name) {
    case 'get_balance': {
      const [available, wallets, vaultLocked] = await Promise.all([
        getAvailableToSpend(),
        getWallets(),
        getTotalVaultLocked(),
      ]);
      return {
        availableToSpend: available,
        availableToSpendFormatted: formatINR(available),
        cashBalance: wallets.find((w) => w.type === 'cash')?.balance || 0,
        onlineBalance: wallets.find((w) => w.type === 'online')?.balance || 0,
        vaultLocked,
      };
    }
    case 'add_expense': {
      const id = await addExpense({
        amount: Number(args.amount),
        category: args.category,
        walletType: args.walletType,
        expenseType: args.expenseType,
        note: args.note || '',
        isPending: false,
      });
      return { success: true, id, message: `Logged ${formatINR(args.amount)} expense in ${args.category}.` };
    }
    case 'add_income': {
      const id = await addIncome({ amount: Number(args.amount), walletType: args.walletType, note: args.note || '' });
      return { success: true, id, message: `Logged ${formatINR(args.amount)} income.` };
    }
    case 'get_recent_transactions': {
      const txs = await getRecentTransactions(args.limit || 10);
      return txs.map((t) => ({
        date: t.date,
        type: t.type,
        category: t.category,
        amount: t.amount,
        note: t.note,
      }));
    }
    case 'get_spending_summary': {
      const [{ income, expense }, byCategory, needsWants] = await Promise.all([
        getMonthlyIncomeExpense(),
        getCategoryBreakdown(),
        getNeedsVsWants(),
      ]);
      return { income, expense, byCategory, needsWants };
    }
    case 'search_transactions': {
      const results = await searchTransactions({
        query: args.query || null,
        category: args.category || null,
        minAmount: args.minAmount != null ? Number(args.minAmount) : null,
        maxAmount: args.maxAmount != null ? Number(args.maxAmount) : null,
      });
      return results.slice(0, 30).map((t) => ({ date: t.date, type: t.type, category: t.category, amount: t.amount, note: t.note }));
    }
    case 'get_vault_goals': {
      const goals = await getVaultGoals();
      return goals.map((g) => ({ title: g.title, targetAmount: g.targetAmount, savedAmount: g.savedAmount, deadline: g.deadline }));
    }
    case 'add_vault_goal': {
      const id = await addVaultGoal({ title: args.title, targetAmount: Number(args.targetAmount), deadline: args.deadline || null });
      return { success: true, id, message: `Created Vault goal "${args.title}" for ${formatINR(args.targetAmount)}.` };
    }
    case 'add_khata_entry': {
      const id = await addLedgerEntry({
        personName: args.personName,
        amount: Number(args.amount),
        direction: args.direction,
        note: args.note || '',
      });
      return { success: true, id, message: `Recorded: ${args.personName} — ${args.direction === 'owe_me' ? 'owes you' : 'you owe'} ${formatINR(args.amount)}.` };
    }
    case 'get_category_budget_status': {
      return getCategoryBudgetStatus();
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
