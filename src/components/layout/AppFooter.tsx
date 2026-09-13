import { useApp } from "../../context/app-context";

export function AppFooter() {
  const { t } = useApp();
  const year = new Date().getFullYear();

  return (
    <footer
      className="shrink-0 px-3 py-3 sm:px-4 lg:px-6"
      style={{ background: "#050B18" }}
    >
      <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center justify-center gap-0.5 text-center text-[11px] sm:flex-row sm:gap-2 sm:text-xs">
        <p className="text-white/70">
          © {year} {t.brand} {t.brandSub}. {t.appFooter.rights}
        </p>
        <span className="hidden text-white/30 sm:inline" aria-hidden>
          ·
        </span>
        <p className="text-white/70">
          {t.appFooter.developedBy}{" "}
          <span className="font-semibold text-[#C5A059]">S.S</span>
        </p>
      </div>
    </footer>
  );
}
