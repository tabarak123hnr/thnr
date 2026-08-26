export interface MenuItem {
  id: string;
  name: string;
  nameUr: string;
  category: string;
  categoryUr: string;
  price: number;
  available: boolean;
  prepMinutes: number;
  description?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
}

/** Restaurant menu sections (EN + UR). */
export const MENU_CATEGORIES: { value: string; label: string; labelUr: string }[] = [
  { value: "Breakfast", label: "Breakfast", labelUr: "ناشتہ" },
  { value: "Karahi", label: "Karahi", labelUr: "کڑاہی" },
  { value: "Curries", label: "Curries", labelUr: "ذائقے دار سالن" },
  { value: "BBQ", label: "BBQ", labelUr: "بار بی کیو" },
  { value: "Accompaniments", label: "Accompaniments", labelUr: "لوازمات" },
  { value: "Naan/Roti", label: "Naan/Roti", labelUr: "نان/روٹی" },
  { value: "Drinks", label: "Drinks", labelUr: "ڈرنکس" },
];
