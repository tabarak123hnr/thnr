export function formatRs(value: number, prefix = "Rs") {
  return `${prefix} ${value.toLocaleString("en-PK")}`;
}

export function formatAge(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
