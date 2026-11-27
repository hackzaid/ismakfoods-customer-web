import type { AppConfig } from "./api";

const grouping = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatPrice(config: Pick<AppConfig, "currencySymbol" | "currencySymbolPosition"> | null | undefined, amount: number) {
  const value = grouping.format(Math.round(amount));
  const symbol = config?.currencySymbol || "UGX";
  return config?.currencySymbolPosition === "right" ? `${value} ${symbol}` : `${symbol} ${value}`;
}

/** "07:00:00" -> "7:00 am" */
export function formatTime(value?: string | null) {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h)) return null;
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return `${hour}:${String(m || 0).padStart(2, "0")} ${suffix}`;
}

export function formatOrderDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `Today, ${time}` : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function pluralize(count: number, word: string, plural = `${word}s`) {
  return `${count} ${count === 1 ? word : plural}`;
}
