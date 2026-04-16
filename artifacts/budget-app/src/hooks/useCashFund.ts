import { useState, useEffect } from "react";
import { apiFetch, getActiveBid } from "../lib/api";

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

  // Auto-detect the cash fund from the server if not already set
  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    // Always re-verify — stored ID might belong to a deleted/changed fund
    apiFetch(`/funds?all=true&bid=${getActiveBid()}`)
      .then((funds: { id: number; fundBehavior: string; isActive: boolean }[]) => {
        const cash = funds.find(f => f.fundBehavior === "cash_monthly" && f.isActive);
        if (cash) {
          // Update only if different from stored value
          if (!stored || parseInt(stored) !== cash.id) {
            setCashFundId(cash.id);
          } else {
            setCashFundIdState(cash.id);
          }
        } else if (stored) {
          // No cash fund exists anymore — clear the stale value
          setCashFundId(null);
        }
      })
      .catch(() => { /* keep whatever is in localStorage */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === KEY) setCashFundIdState(e.newValue ? parseInt(e.newValue) : null);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return { cashFundId, setCashFundId };
}
