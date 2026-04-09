import { useEffect, useState } from "react";
import { Lock } from "lucide-react";

const STORAGE_KEY = "klir_access";
const EXPECTED   = import.meta.env.VITE_ACCESS_TOKEN as string | undefined;

function checkAccess(): boolean {
  if (!EXPECTED) return true;
  if (localStorage.getItem(STORAGE_KEY) === EXPECTED) return true;
  const params = new URLSearchParams(window.location.search);
  const token  = params.get("access");
  if (token === EXPECTED) {
    localStorage.setItem(STORAGE_KEY, token);
    params.delete("access");
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? "?" + newSearch : "") + window.location.hash;
    window.history.replaceState(null, "", newUrl);
    return true;
  }
  return false;
}

export function AccessGuard({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    setAllowed(checkAccess());
  }, []);

  if (allowed === null) return null;

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <div className="text-center space-y-4 p-8 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">אין גישה</h1>
          <p className="text-sm text-muted-foreground">
            אפליקציה זו מוגנת. יש להיכנס דרך קישור מורשה.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
