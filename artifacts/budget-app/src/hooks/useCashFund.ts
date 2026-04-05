import { useState, useEffect } from "react";

const KEY = "cash_fund_id";

export function useCashFund() {
  const [cashFundId, setCashFundIdState] = useState<number | null>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return v ? parseInt(v) : null;
    } catch { return null; }
  });

  const setCashFundId = (id: number | null) => {
    try {
      if (id === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, String(id));
    } catch { /* ignore */ }
    setCashFundIdState(id);
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: id ? String(id) : null }));
  };

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === KEY) setCashFundIdState(e.newValue ? parseInt(e.newValue) : null);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return { cashFundId, setCashFundId };
}
