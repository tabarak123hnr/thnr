import { createContext, useContext } from "react";
import type { Language, ThemeMode } from "../types";
import type { TranslationKeys } from "../i18n/dictionaries";

export interface AppContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
  dir: "ltr" | "rtl";
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
