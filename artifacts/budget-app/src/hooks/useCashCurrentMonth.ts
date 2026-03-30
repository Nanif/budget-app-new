import { useState, useEffect } from "react";

const KEY = "cash_current_month";

export function toMonthStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function defaultDateForMonth(month: string): string {
  const todayMonth = toMonthStr(new Date());
  if (month === todayMonth) return new Date().toISOString().split("T")[0];
  const [y, m] = month.split("-");
  return `${y}-${m}-01`;
}

export function useCashCurrentMonth() {
  const [currentMonth, setCurrentMonthState] = useState<string>(() => {
    try { return localStorage.getItem(KEY) || toMonthStr(new Date()); }
    catch { return toMonthStr(new Date()); }
  });

  const setCurrentMonth = (month: string) => {
    try { localStorage.setItem(KEY, month); } catch { /* ignore */ }
    setCurrentMonthState(month);
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: month }));
  };

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) setCurrentMonthState(e.newValue);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return { currentMonth, setCurrentMonth };
}
