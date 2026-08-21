import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { dictionaries } from "../i18n/dictionaries";
import type { Language, ThemeMode } from "../types";
import { AppContext } from "./app-context";

const THEME_KEY = "thr-theme";
const LANG_KEY = "thr-lang";

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_KEY) as ThemeMode | null;
    return saved ?? "light";
  });
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem(LANG_KEY) as Language | null;
    return saved ?? "en";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = language === "ur" ? "rtl" : "ltr";
    localStorage.setItem(LANG_KEY, language);
  }, [language]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
      language,
      setLanguage,
      t: dictionaries[language],
      dir: (language === "ur" ? "rtl" : "ltr") as "ltr" | "rtl",
    }),
    [theme, toggleTheme, language, setLanguage],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
