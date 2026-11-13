/** Family food spending from approved bills: the sums are done here, in code. */

export type SpendBill = { id: string; bill_date: string; shop: string | null; total: number | null };
export type SpendLine = { bill_id: string; name: string; category: string; price: number | null; is_food: boolean };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Do the line prices add up to the printed total? A small gap is allowed for rounding and discounts. */
export function billCheck(prices: (number | null)[], total: number | null) {
  const sum = r2(prices.reduce<number>((a, p) => a + (p ?? 0), 0));
  const missing = prices.filter((p) => p == null).length;
  if (total == null) return { sum, missing, diff: null as number | null, ok: true };
  const diff = r2(total - sum);
  return { sum, missing, diff, ok: Math.abs(diff) <= Math.max(2, total * 0.02) };
}

/** What a bill cost: its printed total, else the sum of its lines. */
export function billAmount(bill: SpendBill, lines: SpendLine[]): number {
  if (bill.total != null) return bill.total;
  return r2(lines.filter((l) => l.bill_id === bill.id).reduce((a, l) => a + (l.price ?? 0), 0));
}

export const monthOf = (date: string) => date.slice(0, 7);
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export type MonthReport = {
  month: string; bills: number; total: number;
  byCategory: { category: string; amount: number }[];
  byShop: { shop: string; amount: number }[];
  unpriced: number;        // lines with no price: not in the category split
};

/** One month: total from bills, split by category from line prices, and by shop. */
export function monthReport(bills: SpendBill[], lines: SpendLine[], month: string): MonthReport {
  const mine = bills.filter((b) => monthOf(b.bill_date) === month);
  const ids = new Set(mine.map((b) => b.id));
  const ls = lines.filter((l) => ids.has(l.bill_id));
  const cat = new Map<string, number>();
  for (const l of ls) if (l.price != null) cat.set(l.category, (cat.get(l.category) ?? 0) + l.price);
  const shop = new Map<string, number>();
  let total = 0;
  for (const b of mine) {
    const a = billAmount(b, lines);
    total += a;
    const k = b.shop?.trim() || "Shop not named";
    shop.set(k, (shop.get(k) ?? 0) + a);
  }
  const sorted = <K extends string>(m: Map<string, number>, key: K) =>
    [...m.entries()].map(([k, v]) => ({ [key]: k, amount: r2(v) }) as Record<K, string> & { amount: number })
      .sort((a, b) => b.amount - a.amount);
  return {
    month, bills: mine.length, total: r2(total),
    byCategory: sorted(cat, "category") as { category: string; amount: number }[],
    byShop: sorted(shop, "shop") as { shop: string; amount: number }[],
    unpriced: ls.filter((l) => l.price == null).length,
  };
}

/** Spending categories: the shelf's own, plus household things that are not food. */
export const HOUSEHOLD = "household";
