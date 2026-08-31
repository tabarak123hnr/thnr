import { Bell, Menu, Moon, Search, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "../../context/app-context";
import { useOpsBadges } from "../../hooks/useOpsBadges";
import { Button } from "../ui/Button";

export function Header({ onMenu }: { onMenu: () => void }) {
  const { t, language, setLanguage, theme, toggleTheme } = useApp();
  const { notificationsBadge } = useOpsBadges();
  const notifCount = notificationsBadge ?? 0;

  return (
    <header className="sticky top-0 z-20 border-b border-app bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
        <button
          type="button"
          onClick={onMenu}
          className="cursor-pointer rounded-xl border border-app p-2 lg:hidden"
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
            className="h-10 cursor-pointer rounded-xl border border-app px-3 text-xs font-bold hover:bg-accent-soft"
          >
            {language === "en" ? "اردو" : "EN"}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="cursor-pointer rounded-xl border border-app p-2.5 hover:bg-accent-soft"
            title={theme === "light" ? t.darkMode : t.lightMode}
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <Link
            to="/notifications"
            className="relative inline-flex cursor-pointer rounded-xl border border-app p-2.5 hover:bg-accent-soft"
            title={t.pages.notificationsTitle}
            aria-label={`${t.pages.notificationsTitle}${notifCount ? `: ${notifCount}` : ""}`}
          >
            <Bell className="h-4 w-4" />
            {notifCount > 0 ? (
              <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[var(--bg)]">
                {notifCount > 99 ? "99+" : notifCount}
              </span>
            ) : null}
          </Link>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link to="/check-in" className="cursor-pointer">
            <Button size="md">{t.newCheckIn}</Button>
          </Link>
          <Link to="/counter" className="cursor-pointer">
            <Button size="md" variant="secondary">
              {t.newOrder}
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
