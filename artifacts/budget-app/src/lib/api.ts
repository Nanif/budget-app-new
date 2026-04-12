const STORAGE_KEY = "budget_year_bid";

function readStoredBid(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? parseInt(stored) : NaN;
    return isNaN(parsed) ? 1 : parsed;
  } catch {
    return 1;
  }
}

let _activeBid: number = readStoredBid();

export function setActiveBid(bid: number) {
  _activeBid = bid;
}

export function getActiveBid(): number {
  return _activeBid;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
export const API_BASE = `${BASE}/api`;

export async function apiFetch(path: string, opts?: RequestInit): Promise<any> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${API_BASE}${path}${sep}bid=${_activeBid}`;
  const r = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}
