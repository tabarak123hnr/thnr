import { CheckCircle2, Star } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "../components/ui/Button";
import { FancySelect } from "../components/ui/FancySelect";
import { Field, Input, TextArea } from "../components/ui/Page";
import { useApp } from "../context/app-context";
import { submitGuestFeedback } from "../services/feedback";
import { FEEDBACK_CATEGORIES, type FeedbackCategory } from "../types/feedback";
import { cn } from "../lib/utils";

export function GuestFeedbackPage() {
  const { t, language, setLanguage } = useApp();
  const f = t.feedback;

  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [category, setCategory] = useState<FeedbackCategory>("hotel");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const categoryOptions = FEEDBACK_CATEGORIES.map((id) => ({
    value: id,
    label: f.categories[id],
  }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (rating < 1) {
      setError(f.ratingRequired);
      return;
    }
    setSubmitting(true);
    try {
      await submitGuestFeedback({
        guestName,
        phone,
        email,
        roomNumber,
        rating,
        category,
        message,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : f.submitError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-app text-app">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 10% 0%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, color-mix(in oklab, var(--accent) 10%, transparent), transparent 50%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-6 flex items-center justify-between gap-3">
          <img
            src="/logo.jpg"
            alt={t.brand}
            className="h-12 w-auto max-w-[min(100%,220px)] object-contain object-left sm:h-14"
          />
          <button
            type="button"
            onClick={() => setLanguage(language === "en" ? "ur" : "en")}
            className="h-9 shrink-0 cursor-pointer rounded-xl border border-app bg-elevated px-3 text-xs font-bold hover:border-[var(--accent)]"
          >
            {language === "en" ? "اردو" : "EN"}
          </button>
        </header>

        <div className="surface flex-1 rounded-3xl p-5 sm:p-7">
          {done ? (
            <div className="flex flex-col items-center py-10 text-center">
              <CheckCircle2 className="h-14 w-14 text-[var(--accent)]" strokeWidth={1.75} />
              <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{f.thanksTitle}</h1>
              <p className="mt-2 max-w-sm text-sm text-muted">{f.thanksSub}</p>
              <Button
                type="button"
                variant="secondary"
                className="mt-8 cursor-pointer"
                onClick={() => {
                  setDone(false);
                  setGuestName("");
                  setPhone("");
                  setEmail("");
                  setRoomNumber("");
                  setRating(0);
                  setCategory("hotel");
                  setMessage("");
                  setError(null);
                }}
              >
                {f.sendAnother}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                {t.brand}
              </p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                {f.formTitle}
              </h1>
              <p className="mt-1.5 text-sm text-muted">{f.formSub}</p>

              <form className="mt-6 space-y-4" onSubmit={onSubmit}>
                {error ? (
                  <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                  </div>
                ) : null}

                <Field label={f.yourName}>
                  <Input
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder={f.namePlaceholder}
                    autoComplete="name"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={f.roomOptional}>
                    <Input
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      placeholder="101"
                      inputMode="numeric"
                    />
                  </Field>
                  <Field label={t.common.phone}>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="03xx…"
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </Field>
                </div>

                <Field label={t.common.email}>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    autoComplete="email"
                  />
                </Field>

                <div>
                  <p className="mb-2 text-xs font-semibold text-muted">{f.rating}</p>
                  <div
                    className="flex items-center gap-1.5"
                    onMouseLeave={() => setHoverRating(0)}
                  >
                    {[1, 2, 3, 4, 5].map((n) => {
                      const active = (hoverRating || rating) >= n;
                      return (
                        <button
                          key={n}
                          type="button"
                          aria-label={`${n} star${n === 1 ? "" : "s"}`}
                          className="cursor-pointer rounded-lg p-1 transition hover:scale-110"
                          onMouseEnter={() => setHoverRating(n)}
                          onClick={() => setRating(n)}
                        >
                          <Star
                            className={cn(
                              "h-8 w-8 sm:h-9 sm:w-9",
                              active
                                ? "fill-[var(--accent)] text-[var(--accent)]"
                                : "text-muted",
                            )}
                            strokeWidth={1.5}
                          />
                        </button>
                      );
                    })}
                    {rating > 0 ? (
                      <span className="ms-2 text-sm font-semibold tabular-nums text-muted">
                        {rating}/5
                      </span>
                    ) : null}
                  </div>
                </div>

                <Field label={f.about}>
                  <FancySelect
                    value={category}
                    onChange={(v) => setCategory(v as FeedbackCategory)}
                    options={categoryOptions}
                  />
                </Field>

                <Field label={f.message}>
                  <TextArea
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={f.messagePlaceholder}
                    rows={5}
                  />
                </Field>

                <Button
                  type="submit"
                  className="w-full cursor-pointer justify-center"
                  disabled={submitting}
                >
                  {submitting ? f.sending : f.submit}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted">{f.footer}</p>
      </div>
    </div>
  );
}
