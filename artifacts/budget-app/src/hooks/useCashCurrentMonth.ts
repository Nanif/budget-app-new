import { useState, useEffect } from "react";

export function toMonthStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function defaultDateForMonth(month: string): string {
  const todayMonth = toMonthStr(new Date());
  if (month === todayMonth) return new Date().toISOString().split("T")[0];
  const [y, m] = month.split("-");
  return `${y}-${m}-01`;
}

function keyForBid(bid: number | null) {
  return bid ? `cash_current_month_${bid}` : "cash_current_month";
}

export function useCashCurrentMonth(bid?: number | null) {
  const storageKey = keyForBid(bid ?? null);

  const [currentMonth, setCurrentMonthState] = useState<string>(() => {
    try {
      return localStorage.getItem(storageKey) || toMonthStr(new Date());
    } catch { return toMonthStr(new Date()); }
  });

  // Re-initialize when bid changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      setCurrentMonthState(stored || toMonthStr(new Date()));
    } catch {
      setCurrentMonthState(toMonthStr(new Date()));
    }
  }, [storageKey]);

  const setCurrentMonth = (month: string) => {
    try { localStorage.setItem(storageKey, month); } catch { /* ignore */ }
    setCurrentMonthState(month);
    window.dispatchEvent(new StorageEvent("storage", { key: storageKey, newValue: month }));
  };

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) setCurrentMonthState(e.newValue);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [storageKey]);

  return { currentMonth, setCurrentMonth };
}
