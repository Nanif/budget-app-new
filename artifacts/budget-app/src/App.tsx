import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import { BudgetYearProvider } from "@/contexts/BudgetYearContext";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Budget from "@/pages/Budget";
import CashWallet from "@/pages/CashWallet";
import FixedExpenses from "@/pages/FixedExpenses";
import Incomes from "@/pages/Incomes";
import Charity from "@/pages/Charity";
import Expenses from "@/pages/Expenses";
import Savings from "@/pages/Savings";
import Settings from "@/pages/Settings";
import Categories from "@/pages/Categories";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    }
  }
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/budget" component={Budget} />
        <Route path="/cash" component={CashWallet} />
        <Route path="/fixed" component={FixedExpenses} />
        <Route path="/expenses" component={Expenses} />
        <Route path="/incomes" component={Incomes} />
        <Route path="/charity" component={Charity} />
        <Route path="/savings" component={Savings} />
        <Route path="/settings" component={Settings} />
        <Route path="/categories" component={Categories} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BudgetYearProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </BudgetYearProvider>
    </QueryClientProvider>
  );
}

export default App;
