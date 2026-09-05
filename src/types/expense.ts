/** Operating expense / expenditure categories for hotel & restaurant. */
export const EXPENSE_CATEGORIES = [
  "supplies",
  "utilities",
  "salaries",
  "maintenance",
  "food_purchase",
  "laundry",
  "transport",
  "marketing",
  "rent",
  "miscellaneous",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_PAYMENT_METHODS = [
  "cash",
  "card",
  "bank_transfer",
  "other",
] as const;

export type ExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number];

export interface ExpenseRecord {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  /** ISO date (YYYY-MM-DD) the expense belongs to */
  date: string;
  paymentMethod: ExpensePaymentMethod;
  vendor: string;
  notes: string;
  recordedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  supplies: "Supplies",
  utilities: "Utilities",
  salaries: "Salaries",
  maintenance: "Maintenance",
  food_purchase: "Food purchase",
  laundry: "Laundry",
  transport: "Transport",
  marketing: "Marketing",
  rent: "Rent",
  miscellaneous: "Miscellaneous",
};

export const EXPENSE_PAYMENT_LABELS: Record<ExpensePaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  other: "Other",
};
