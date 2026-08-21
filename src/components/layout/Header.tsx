import { Bell, Menu, Moon, Search, Sun, Volume2 } from "lucide-react";
import { useApp } from "../../context/app-context";
import { Button } from "../ui/Button";

export function Header({ onMenu }: { onMenu: () => void }) {
  const { t, language, setLanguage, theme, toggleTheme } = useApp();

  return (
    <header className="sticky top-0 z-20 border-b border-app bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
        <button
          type="button"
          onClick={onMenu}
          className="rounded-xl border border-app p-2 lg:hidden"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder={t.searchPlaceholder}
            className="h-11 w-full rounded-2xl border border-app bg-elevated pe-4 ps-10 text-sm outline-none transition focus:ring-2 ring-accent"
          />
        </div>

        <div className="hidden items-center gap-1 sm:flex">
          <button
            type="button"
            onClick={() => setLanguage(language === "en" ? "ur" : "en")}
            className="h-10 rounded-xl border border-app px-3 text-xs font-bold hover:bg-accent-soft"
          >
            {language === "en" ? "اردو" : "EN"}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-xl border border-app p-2.5 hover:bg-accent-soft"
            title={theme === "light" ? t.darkMode : t.lightMode}
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <button type="button" className="rounded-xl border border-app p-2.5 hover:bg-accent-soft">
            <Volume2 className="h-4 w-4" />
          </button>
          <button type="button" className="relative rounded-xl border border-app p-2.5 hover:bg-accent-soft">
            <Bell className="h-4 w-4" />
            <span className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--danger)] ring-2 ring-[var(--bg)]" />
          </button>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Button size="md">{t.newCheckIn}</Button>
          <Button size="md" variant="secondary">
            {t.newOrder}
          </Button>
        </div>
      </div>
    </header>
  );
}
