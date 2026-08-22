import { BedDouble, Eye, EyeOff, Lock, Mail, Moon, Sun } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { pathPermission } from "../config/navigation";
import { useApp } from "../context/app-context";
import { useAuth } from "../context/auth-context";

function mapAuthError(code: string) {
  switch (code) {
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again shortly.";
    default:
      return "Could not sign in. Please try again.";
  }
}

export function LoginPage() {
  const { t, theme, toggleTheme, language, setLanguage } = useApp();
  const { user, loading, login, defaultPath, hasPermission, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const requested = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickLanding(preferred?: string | null) {
    if (preferred) {
      const need = pathPermission[preferred];
      if (!need || isAdmin || hasPermission(need)) return preferred;
    }
    if (requested && requested !== "/login") {
      const need = pathPermission[requested];
      if (!need || isAdmin || hasPermission(need)) return requested;
    }
    return defaultPath || preferred || "";
  }

  if (!loading && user) {
    const home = pickLanding(defaultPath);
    if (home) return <Navigate to={home} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const home = await login(email, password);
      if (!home) {
        setError("No modules assigned to this account. Contact an admin.");
        return;
      }
      navigate(home, { replace: true });
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: string }).code)
          : "";
      setError(mapAuthError(code));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-app text-app">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            theme === "dark"
              ? "radial-gradient(ellipse 80% 60% at 10% 20%, rgba(232,197,71,0.14), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 80%, rgba(232,197,71,0.08), transparent 50%), linear-gradient(160deg, #0c0c0c 0%, #161616 100%)"
              : "radial-gradient(ellipse 80% 60% at 8% 15%, rgba(212,175,55,0.22), transparent 55%), radial-gradient(ellipse 60% 45% at 95% 85%, rgba(212,175,55,0.12), transparent 50%), linear-gradient(165deg, #f7f7f8 0%, #efefef 45%, #faf6ea 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4af37' fill-opacity='0.07'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative z-10 flex min-h-dvh flex-col lg:flex-row">
        <aside className="flex flex-1 flex-col justify-between px-8 py-10 lg:px-14 lg:py-14">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-[var(--accent-text)] shadow-lg shadow-[color-mix(in_oklab,var(--accent)_35%,transparent)]">
                <BedDouble className="h-6 w-6" strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-lg font-extrabold tracking-tight">{t.brand}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                  {t.brandSub}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLanguage(language === "en" ? "ur" : "en")}
                className="h-9 cursor-pointer rounded-xl border border-app bg-elevated/70 px-3 text-xs font-bold backdrop-blur hover:border-[var(--accent)]"
              >
                {language === "en" ? "اردو" : "EN"}
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className="cursor-pointer rounded-xl border border-app bg-elevated/70 p-2 backdrop-blur hover:border-[var(--accent)]"
              >
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="my-12 max-w-md lg:my-0">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
              {t.login.eyebrow}
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
              {t.login.heroTitle}
            </h1>
            <p className="mt-4 text-base text-muted leading-relaxed">{t.login.heroSub}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {[t.login.pill1, t.login.pill2, t.login.pill3].map((pill) => (
                <span
                  key={pill}
                  className="rounded-full border border-[color-mix(in_oklab,var(--accent)_40%,var(--border))] bg-accent-soft px-3 py-1.5 text-xs font-semibold text-[var(--text)]"
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>

          <p className="hidden text-xs text-muted lg:block">{t.login.footer}</p>
        </aside>

        <main className="flex flex-1 items-center justify-center px-5 pb-10 lg:px-12 lg:py-14">
          <div className="w-full max-w-[420px]">
            <div className="surface relative overflow-hidden rounded-3xl p-7 sm:p-8">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" />
              <h2 className="text-2xl font-extrabold tracking-tight">{t.login.title}</h2>
              <p className="mt-1 text-sm text-muted">{t.login.subtitle}</p>

              <form className="mt-7 space-y-4" onSubmit={onSubmit}>
                {error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                  </div>
                ) : null}

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-muted">{t.common.email}</span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@tabarak.pk"
                      className="h-12 w-full rounded-2xl border border-app bg-app pe-3 ps-10 text-sm outline-none transition focus:ring-2 ring-accent"
                    />
                  </div>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-muted">{t.pages.password}</span>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-12 w-full rounded-2xl border border-app bg-app pe-11 ps-10 text-sm outline-none transition focus:ring-2 ring-accent"
                    />
                    <button
                      type="button"
                      className="absolute end-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-2 text-muted hover:text-app"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                <Button
                  type="submit"
                  size="lg"
                  className="mt-2 w-full cursor-pointer !h-12 text-sm"
                  disabled={submitting || loading}
                >
                  {submitting ? t.login.signingIn : t.login.signIn}
                </Button>
              </form>

              <p className="mt-6 text-center text-xs text-muted">{t.login.hint}</p>
            </div>
            <p className="mt-6 text-center text-xs text-muted lg:hidden">{t.login.footer}</p>
          </div>
        </main>
      </div>
    </div>
  );
}
