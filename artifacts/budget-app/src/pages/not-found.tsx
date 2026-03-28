import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background" dir="rtl">
      <div className="text-center max-w-md px-6">
        <p className="text-8xl font-black text-primary/20 mb-2 leading-none">404</p>
        <h1 className="text-2xl font-bold text-foreground mb-2">הדף לא נמצא</h1>
        <p className="text-muted-foreground mb-8">
          הדף שחיפשת אינו קיים או שהכתובת שגויה.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button asChild className="rounded-xl gap-2">
            <Link href="/">
              <Home className="w-4 h-4" />
              דף הבית
            </Link>
          </Button>
          <Button variant="outline" className="rounded-xl gap-2" onClick={() => window.history.back()}>
            <ArrowRight className="w-4 h-4" />
            חזור אחורה
          </Button>
        </div>
      </div>
    </div>
  );
}
