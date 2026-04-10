import { Link, useLocation } from "wouter";
import {
  Home, CalendarDays, Wallet, ShoppingBag, Calendar, PiggyBank,
  Landmark, HeartHandshake, CreditCard, StickyNote, CheckSquare,
  Settings, Receipt, Scale, LayoutDashboard, BotMessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { YearSwitcher } from "@/components/YearSwitcher";
import { MonthSwitcher } from "@/components/MonthSwitcher";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  section?: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "לוח", icon: Home },
  { href: "/dashboard", label: "דשבורד", icon: LayoutDashboard },
  { href: "/budget", label: "מסגרת התקציב", icon: CalendarDays, section: "קופות" },
  { href: "/expenses", label: "הוצאות", icon: Receipt, section: "מעקב פיננסי" },
  { href: "/incomes", label: "הכנסות", icon: Landmark, section: "מעקב פיננסי" },
  { href: "/charity", label: "מעשרות", icon: HeartHandshake, section: "מעקב פיננסי" },
  { href: "/savings", label: "נכסים והתחייבויות", icon: Scale, section: "מעקב פיננסי" },
  { href: "/agent", label: "סוכן חכם", icon: BotMessageSquare, section: "הגדרות" },
  { href: "/settings", label: "הגדרות", icon: Settings, section: "הגדרות" },
];

export function Sidebar() {
  const [location] = useLocation();

  const sections: Record<string, NavItem[]> = {};
  const topItems: NavItem[] = [];
  for (const item of NAV_ITEMS) {
    if (!item.section) { topItems.push(item); continue; }
    if (!sections[item.section]) sections[item.section] = [];
    sections[item.section].push(item);
  }

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = location === item.href;
    const Icon = item.icon;
    return (
      <Link key={item.href} href={item.href} className="block">
        <div className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group cursor-pointer",
          isActive
            ? "bg-primary text-primary-foreground font-medium shadow-md shadow-primary/20"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}>
          <Icon className={cn(
            "w-4 h-4 shrink-0 transition-transform duration-200",
            isActive ? "scale-110" : "group-hover:scale-110 text-muted-foreground group-hover:text-primary"
          )} />
          <span className="text-sm">{item.label}</span>
        </div>
      </Link>
    );
  };

  const SectionLabel = ({ label }: { label: string }) => (
    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-4 pt-4 pb-1.5">{label}</p>
  );

  return (
    <aside className="fixed top-0 bottom-0 start-0 z-40 w-64 border-e border-sidebar-border bg-sidebar pt-6 pb-4 flex flex-col hidden md:flex shadow-xl shadow-black/5">
      <div className="px-6 mb-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-teal-400 flex items-center justify-center text-white shadow-lg shadow-primary/20">
          <Wallet className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-display font-bold text-xl text-sidebar-foreground tracking-tight">קליר</h1>
          <p className="text-xs text-muted-foreground font-medium">ניהול תקציב חכם</p>
        </div>
      </div>

      <div className="px-4 mb-1">
        <YearSwitcher />
      </div>
      <div className="px-4 mb-3">
        <MonthSwitcher />
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-0.5">
        {topItems.map(item => <NavLink key={item.href} item={item} />)}
        {Object.entries(sections).map(([section, items]) => (
          <div key={section}>
            <SectionLabel label={section} />
            {items.map(item => <NavLink key={item.href} item={item} />)}
          </div>
        ))}
      </div>

      <div className="px-6 mt-auto">
        <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
          <p className="text-xs text-center text-primary font-medium">Clear Budget v2.0</p>
        </div>
      </div>
    </aside>
  );
}
