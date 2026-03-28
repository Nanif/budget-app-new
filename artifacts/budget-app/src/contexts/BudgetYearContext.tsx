import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { setActiveBid, API_BASE } from "@/lib/api";

export type BudgetYear = {
  id: number;
  userId: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  totalBudget: string | number;
  tithePercentage: string | number;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type BudgetYearContextType = {
  years: BudgetYear[];
  activeBid: number;
  activeYear: BudgetYear | null;
  loading: boolean;
  setViewedYear: (id: number) => void;
  createYear: (data: Partial<BudgetYear>) => Promise<BudgetYear>;
  updateYear: (id: number, data: Partial<BudgetYear>) => Promise<BudgetYear>;
  refreshYears: () => Promise<void>;
};

const BudgetYearContext = createContext<BudgetYearContextType | null>(null);

const STORAGE_KEY = "budget_year_bid";

async function rawFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}

export function BudgetYearProvider({ children }: { children: ReactNode }) {
  const [years, setYears] = useState<BudgetYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBid, setActiveBidState] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? parseInt(stored) : NaN;
    return isNaN(parsed) ? 1 : parsed;
  });

  const switchYear = useCallback((id: number) => {
    setActiveBidState(id);
    setActiveBid(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  }, []);

  const refreshYears = useCallback(async () => {
    try {
      const data: BudgetYear[] = await rawFetch("/budget-years");
      setYears(data);
      if (data.length > 0) {
        const stored = localStorage.getItem(STORAGE_KEY);
        const storedId = stored ? parseInt(stored) : NaN;
        const exists = !isNaN(storedId) && data.find(y => y.id === storedId);
        if (!exists) {
          const activeOrFirst = data.find(y => y.isActive) || data[0];
          switchYear(activeOrFirst.id);
        } else {
          setActiveBid(storedId);
        }
      }
    } catch (e) {
      console.error("Failed to load budget years", e);
    } finally {
      setLoading(false);
    }
  }, [switchYear]);

  useEffect(() => {
    setActiveBid(activeBid);
    refreshYears();
  }, []);

  const createYear = async (data: Partial<BudgetYear>): Promise<BudgetYear> => {
    const created: BudgetYear = await rawFetch("/budget-years", {
      method: "POST",
      body: JSON.stringify(data),
    });
    await refreshYears();
    switchYear(created.id);
    return created;
  };

  const updateYear = async (id: number, data: Partial<BudgetYear>): Promise<BudgetYear> => {
    const updated: BudgetYear = await rawFetch(`/budget-years/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    await refreshYears();
    return updated;
  };

  const activeYear = years.find(y => y.id === activeBid) || years[0] || null;

  return (
    <BudgetYearContext.Provider value={{
      years,
      activeBid,
      activeYear,
      loading,
      setViewedYear: switchYear,
      createYear,
      updateYear,
      refreshYears,
    }}>
      {children}
    </BudgetYearContext.Provider>
  );
}

export function useBudgetYear() {
  const ctx = useContext(BudgetYearContext);
  if (!ctx) throw new Error("useBudgetYear must be used inside BudgetYearProvider");
  return ctx;
}
