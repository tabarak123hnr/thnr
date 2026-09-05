import { Eye, EyeOff, Lock, Mail } from "lucide-react";
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
  const { t, language, setLanguage } = useApp();
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
    <div className="dark relative min-h-dvh overflow-hidden text-app">
      {/* Building photo */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url("/building-image.png")' }}
        aria-hidden
      />
      {/* Dark wash — login always uses dark look */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(115deg, rgba(8,8,8,0.82) 0%, rgba(12,12,12,0.62) 42%, rgba(10,10,10,0.72) 100%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 15% 20%, rgba(232,197,71,0.12), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 85%, rgba(232,197,71,0.08), transparent 50%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 flex min-h-dvh flex-col lg:flex-row">
        <aside className="flex flex-1 flex-col justify-between px-5 py-8 sm:px-8 sm:py-10 lg:px-14 lg:py-14">
          <div className="flex items-center justify-between gap-3">
            <img
              src="/logo.jpg"
              alt={t.brand}
              className="h-14 w-auto max-w-[min(100%,280px)] object-contain object-left drop-shadow-md sm:h-20 sm:max-w-[min(100%,320px)]"
            />
            <button
              type="button"
              onClick={() => setLanguage(language === "en" ? "ur" : "en")}
              className="h-9 shrink-0 cursor-pointer rounded-xl border border-app bg-[color-mix(in_oklab,var(--bg-elevated)_78%,transparent)] px-3 text-xs font-bold backdrop-blur-md hover:border-[var(--accent)]"
            >
              {language === "en" ? "اردو" : "EN"}
            </button>
          </div>

          <div className="my-8 max-w-md sm:my-12 lg:my-0">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
              {t.login.eyebrow}
            </p>
            <h1 className="text-3xl font-extrabold leading-[1.1] tracking-tight drop-shadow-sm sm:text-5xl">
              {t.login.heroTitle}
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">{t.login.heroSub}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {[t.login.pill1, t.login.pill2, t.login.pill3].map((pill) => (
                <span
                  key={pill}
                  className="rounded-full border border-[color-mix(in_oklab,var(--accent)_40%,var(--border))] bg-[color-mix(in_oklab,var(--accent-soft)_85%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] backdrop-blur-sm"
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
            <div className="relative overflow-hidden rounded-3xl border border-app bg-[color-mix(in_oklab,var(--bg-elevated)_92%,transparent)] p-7 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" />
              <h2 className="text-2xl font-extrabold tracking-tight">{t.login.title}</h2>
              <p className="mt-1 text-sm text-muted">{t.login.subtitle}</p>

              <form className="mt-7 space-y-4" onSubmit={onSubmit}>
                {error ? (
                  <div className="rounded-xl border border-red-900 bg-red-950/40 px-3 py-2.5 text-sm text-red-300">
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
                  disabled={submitting}
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
