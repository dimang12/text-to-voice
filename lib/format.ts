export function fmtDuration(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(seconds ?? 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Rough spoken-duration estimate: 150 words per minute at 1x speed. */
export function estimateSeconds(text: string, speed: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const khmerChars = (text.match(/[ក-៿]/g) ?? []).length;
  const units = words + khmerChars / 6;
  return units / (150 / 60) / Math.max(0.25, speed);
}

export function fmtDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "km" ? "km-KH" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
