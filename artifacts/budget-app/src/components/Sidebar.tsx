import { Link, useLocation } from "wouter";
import { 
  Home, 
  LayoutDashboard, 
  Receipt, 
  Landmark, 
  HeartHandshake, 
  CreditCard, 
  PiggyBank, 
  StickyNote, 
  CheckSquare, 
  Settings,
  Wallet
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "דף בית", icon: Home },
  { href: "/dashboard", label: "דשבורד", icon: LayoutDashboard },
  { href: "/expenses", label: "הוצאות", icon: Receipt },
  { href: "/incomes", label: "הכנסות", icon: Landmark },
  { href: "/charity", label: "צדקה ומעשרות", icon: HeartHandshake },
  { href: "/debts", label: "חובות", icon: CreditCard },
  { href: "/savings", label: "חסכונות ונכסים", icon: PiggyBank },
  { href: "/notes", label: "פתקים", icon: StickyNote },
  { href: "/reminders", label: "תזכורות ומשימות", icon: CheckSquare },
  { href: "/settings", label: "הגדרות", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="fixed top-0 bottom-0 start-0 z-40 w-64 border-e border-sidebar-border bg-sidebar pt-6 pb-4 flex flex-col hidden md:flex shadow-xl shadow-black/5">
      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-teal-400 flex items-center justify-center text-white shadow-lg shadow-primary/20">
          <Wallet className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-display font-bold text-xl text-sidebar-foreground tracking-tight">קליר</h1>
          <p className="text-xs text-muted-foreground font-medium">ניהול תקציב חכם</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          
          return (
            <Link key={item.href} href={item.href} className="block">
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group cursor-pointer",
                  isActive 
                    ? "bg-primary text-primary-foreground font-medium shadow-md shadow-primary/20" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className={cn(
                  "w-5 h-5 transition-transform duration-200", 
                  isActive ? "scale-110" : "group-hover:scale-110 text-muted-foreground group-hover:text-primary"
                )} />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
      
      <div className="px-6 mt-auto">
        <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
          <p className="text-xs text-center text-primary font-medium">Clear Budget v1.0</p>
        </div>
      </div>
    </aside>
  );
}
