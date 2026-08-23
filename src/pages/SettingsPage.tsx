import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { Field, Input, PageHeader } from "../components/ui/Page";
import { useApp } from "../context/app-context";
import { useAuth } from "../context/auth-context";
import { useToast } from "../context/toast-context";
import {
  updateCurrentUserEmail,
  updateCurrentUserPassword,
} from "../services/userManagement";

function mapAccountError(err: unknown) {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: string }).code)
      : "";
  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Current password is incorrect.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/email-already-in-use":
      return "That email is already used by another account.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
      return "New password is too weak. Use at least 6 characters.";
    case "auth/requires-recent-login":
      return "For security, enter your current password and try again.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in must be enabled in Firebase.";
    default:
      return err instanceof Error ? err.message : "Could not update account.";
  }
}

export function SettingsPage() {
  const { t, theme, toggleTheme, language, setLanguage } = useApp();
  const { user, profile, isAdmin } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const currentEmail = user?.email || profile?.email || "";

  const [emailForm, setEmailForm] = useState({
    currentPassword: "",
    newEmail: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showEmailPw, setShowEmailPw] = useState(false);
  const [showPwCurrent, setShowPwCurrent] = useState(false);
  const [showPwNew, setShowPwNew] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setEmailSaving(true);
    try {
      await updateCurrentUserEmail(emailForm.currentPassword, emailForm.newEmail);
      setEmailForm({ currentPassword: "", newEmail: "" });
      toastSuccess("Email updated", "Sign in next time with your new email.");
    } catch (err) {
      const message = mapAccountError(err);
      setEmailError(message);
      toastError("Email not updated", message);
    } finally {
      setEmailSaving(false);
    }
  }

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    setPasswordSaving(true);
    try {
      await updateCurrentUserPassword(
        passwordForm.currentPassword,
        passwordForm.newPassword,
      );
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toastSuccess("Password updated", "Use your new password the next time you sign in.");
    } catch (err) {
      const message = mapAccountError(err);
      setPasswordError(message);
      toastError("Password not updated", message);
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t.pages.settingsTitle}
        subtitle="Account security, appearance, and language."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Appearance & language" />
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-app px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Theme</p>
                <p className="text-xs text-muted">
                  {theme === "light" ? t.lightMode : t.darkMode}
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={toggleTheme}>
                Toggle
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-app px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Language</p>
                <p className="text-xs text-muted">{language === "en" ? "English" : "اردو"}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setLanguage(language === "en" ? "ur" : "en")}
              >
                Switch
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Signed-in account" />
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3 rounded-xl bg-app px-3 py-2.5">
              <dt className="text-muted">Name</dt>
              <dd className="font-semibold text-end">
                {profile?.name || user?.displayName || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3 rounded-xl bg-app px-3 py-2.5">
              <dt className="text-muted">Email</dt>
              <dd className="font-semibold break-all text-end">{currentEmail || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3 rounded-xl bg-app px-3 py-2.5">
              <dt className="text-muted">Role</dt>
              <dd className="font-semibold text-end">
                {profile?.roleName || (isAdmin ? "Admin" : "—")}
              </dd>
            </div>
          </dl>
        </Card>

        {isAdmin ? (
          <>
            <Card>
              <CardHeader
                title="Change email"
                action={
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
                    <Mail className="h-3.5 w-3.5" />
                    Admin
                  </span>
                }
              />
              <form className="space-y-4" onSubmit={(e) => void submitEmail(e)}>
                {emailError ? (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                    {emailError}
                  </p>
                ) : null}
                <p className="text-sm text-muted">
                  Enter your <span className="font-semibold text-app">current password</span> to
                  change the login email.
                </p>
                <Field label="Current password">
                  <div className="relative">
                    <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input
                      required
                      type={showEmailPw ? "text" : "password"}
                      autoComplete="current-password"
                      value={emailForm.currentPassword}
                      onChange={(e) =>
                        setEmailForm((p) => ({ ...p, currentPassword: e.target.value }))
                      }
                      className="ps-10 pe-10"
                      placeholder="Current password"
                    />
                    <button
                      type="button"
                      className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-app"
                      onClick={() => setShowEmailPw((v) => !v)}
                      aria-label={showEmailPw ? "Hide password" : "Show password"}
                    >
                      {showEmailPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                <Field label="New email">
                  <Input
                    required
                    type="email"
                    autoComplete="email"
                    value={emailForm.newEmail}
                    onChange={(e) => setEmailForm((p) => ({ ...p, newEmail: e.target.value }))}
                    placeholder={currentEmail || "you@example.com"}
                  />
                </Field>
                <Button type="submit" disabled={emailSaving} className="w-full sm:w-auto">
                  {emailSaving ? "Updating…" : "Update email"}
                </Button>
              </form>
            </Card>

            <Card>
              <CardHeader
                title="Change password"
                action={
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
                    <Lock className="h-3.5 w-3.5" />
                    Admin
                  </span>
                }
              />
              <form className="space-y-4" onSubmit={(e) => void submitPassword(e)}>
                {passwordError ? (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                    {passwordError}
                  </p>
                ) : null}
                <p className="text-sm text-muted">
                  Enter your <span className="font-semibold text-app">current password</span> before
                  setting a new one.
                </p>
                <Field label="Current password">
                  <div className="relative">
                    <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input
                      required
                      type={showPwCurrent ? "text" : "password"}
                      autoComplete="current-password"
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))
                      }
                      className="ps-10 pe-10"
                      placeholder="Current password"
                    />
                    <button
                      type="button"
                      className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-app"
                      onClick={() => setShowPwCurrent((v) => !v)}
                      aria-label={showPwCurrent ? "Hide password" : "Show password"}
                    >
                      {showPwCurrent ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </Field>
                <Field label="New password">
                  <div className="relative">
                    <Input
                      required
                      type={showPwNew ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={6}
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))
                      }
                      className="pe-10"
                      placeholder="At least 6 characters"
                    />
                    <button
                      type="button"
                      className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-app"
                      onClick={() => setShowPwNew((v) => !v)}
                      aria-label={showPwNew ? "Hide password" : "Show password"}
                    >
                      {showPwNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                <Field label="Confirm new password">
                  <Input
                    required
                    type={showPwNew ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={6}
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))
                    }
                    placeholder="Repeat new password"
                  />
                </Field>
                <Button type="submit" disabled={passwordSaving} className="w-full sm:w-auto">
                  {passwordSaving ? "Updating…" : "Update password"}
                </Button>
              </form>
            </Card>
          </>
        ) : (
          <Card className="lg:col-span-2">
            <p className="text-sm text-muted">
              Only an admin can change the account email or password here. Ask an administrator if
              you need access updated.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
