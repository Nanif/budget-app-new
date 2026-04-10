import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { QuickActions } from "./QuickActions";
import { AgentChat } from "./AgentChat";
import { motion } from "framer-motion";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background flex" dir="rtl">
      <Sidebar />
      <main className="flex-1 md:ms-64 min-w-0 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 pl-20">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="max-w-7xl mx-auto w-full"
          >
            {children}
          </motion.div>
        </div>
      </main>
      <QuickActions />
      <AgentChat />
    </div>
  );
}
