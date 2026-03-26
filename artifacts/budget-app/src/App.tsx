import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Expenses from "@/pages/Expenses";
import Incomes from "@/pages/Incomes";
import Charity from "@/pages/Charity";
import Debts from "@/pages/Debts";
import Savings from "@/pages/Savings";
import Notes from "@/pages/Notes";
import Reminders from "@/pages/Reminders";
import Settings from "@/pages/Settings";

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
        <Route path="/expenses" component={Expenses} />
        <Route path="/incomes" component={Incomes} />
        <Route path="/charity" component={Charity} />
        <Route path="/debts" component={Debts} />
        <Route path="/savings" component={Savings} />
        <Route path="/notes" component={Notes} />
        <Route path="/reminders" component={Reminders} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
