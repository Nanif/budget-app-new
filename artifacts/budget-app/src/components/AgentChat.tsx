import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBudgetYear } from "@/contexts/BudgetYearContext";
import { apiFetch, API_BASE } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Bot, X, Send, User, Loader2, Trash2,
  KeyRound, Eye, EyeOff, Settings2, CheckCircle2,
} from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
};

function uid() { return Math.random().toString(36).slice(2); }

function formatContent(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-bold mt-2 mb-0.5">{line.slice(4)}</h3>;
    if (line.startsWith("## "))  return <h2 key={i} className="text-sm font-bold mt-2 mb-0.5">{line.slice(3)}</h2>;
    if (line.startsWith("- ") || line.startsWith("• "))
      return <li key={i} className="mr-3 list-disc text-xs leading-relaxed">{line.slice(2)}</li>;
    if (line.trim() === "") return <div key={i} className="h-1.5" />;
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="text-xs leading-relaxed">
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**")
            ? <strong key={j}>{part.slice(2, -2)}</strong>
            : part
        )}
      </p>
    );
  });
}

function KeySetup({ onSaved }: { onSaved: () => void }) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!key.trim()) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch("/agent/key", { method: "POST", body: JSON.stringify({ key: key.trim() }) });
      onSaved();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-primary" />
        <span className="font-semibold text-sm">הגדרת מפתח Groq</span>
      </div>
      <div className="bg-muted rounded-lg p-3 text-xs space-y-1 text-muted-foreground">
        <p className="font-medium text-foreground">איך מקבלים מפתח חינמי:</p>
        <ol className="list-decimal mr-4 space-y-0.5">
          <li>כנס ל-<strong className="text-foreground">console.groq.com</strong></li>
          <li>הירשם עם Google / GitHub</li>
          <li>לחץ <strong className="text-foreground">API Keys → Create API Key</strong></li>
          <li>העתק והדבק למטה</li>
        </ol>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">מפתח API</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type={show ? "text" : "password"}
              value={key}
              onChange={e => setKey(e.target.value)}
              onKeyDown={e => e.key === "Enter" && save()}
              placeholder="gsk_..."
              className="text-xs pl-8"
              dir="ltr"
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <Button size="sm" onClick={save} disabled={!key.trim() || saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "שמור"}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

export function AgentChat() {
  const { activeBudgetYearId } = useBudgetYear();
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [showKeySetup, setShowKeySetup] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", content: "שלום! אני הסוכן הפיננסי שלך.\nשאל אותי כל שאלה על התקציב, או בקש ממני לבצע פעולה." },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const checkStatus = () => {
    apiFetch("/agent/status")
      .then((d: any) => { setConfigured(d.configured); if (!d.configured) setShowKeySetup(true); })
      .catch(() => setConfigured(false));
  };

  useEffect(() => { if (open && configured === null) checkStatus(); }, [open]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");

    const userMsg: Message = { id: uid(), role: "user", content: text };
    const aId = uid();
    setMessages(prev => [...prev, userMsg, { id: aId, role: "assistant", content: "", pending: true }]);
    setIsStreaming(true);

    const history = messages
      .filter(m => m.id !== "welcome" && !m.pending)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(`${API_BASE}/agent/chat?bid=${activeBudgetYearId ?? 1}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "", full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json) continue;
          try {
            const p = JSON.parse(json);
            if (p.error) throw new Error(p.error);
            if (p.content) {
              full += p.content;
              setMessages(prev => prev.map(m => m.id === aId ? { ...m, content: full, pending: false } : m));
            }
          } catch (e: any) { if (e.message !== "Unexpected end of JSON input") throw e; }
        }
      }
    } catch (err: any) {
      setMessages(prev => prev.map(m =>
        m.id === aId ? { ...m, content: `❌ שגיאה: ${err.message}`, pending: false } : m
      ));
    } finally { setIsStreaming(false); }
  };

  const clearChat = () => setMessages([
    { id: "welcome", role: "assistant", content: "שיחה חדשה. במה אוכל לעזור?" }
  ]);

  return (
    <>
      {/* Floating button */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "fixed bottom-6 left-6 z-50 w-13 h-13 rounded-full shadow-lg flex items-center justify-center transition-colors",
          open ? "bg-muted border text-muted-foreground" : "bg-primary text-primary-foreground"
        )}
        style={{ width: 52, height: 52 }}
        title="סוכן חכם"
      >
        <AnimatePresence mode="wait">
          {open
            ? <motion.div key="x"   initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X className="w-5 h-5" /></motion.div>
            : <motion.div key="bot" initial={{ rotate: 90, opacity: 0 }}  animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><Bot className="w-5 h-5" /></motion.div>
          }
        </AnimatePresence>
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* backdrop on mobile */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/20 md:hidden"
              onClick={() => setOpen(false)}
            />

            <motion.div
              key="panel"
              initial={{ x: -320, opacity: 0 }}
              animate={{ x: 0,    opacity: 1 }}
              exit={{ x: -320,   opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 z-50 w-80 md:w-96 flex flex-col bg-background border border-border rounded-t-2xl md:rounded-2xl shadow-2xl"
              style={{ height: "min(600px, calc(100vh - 5rem))", bottom: "4.5rem", left: "1rem" }}
              dir="rtl"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-none">סוכן חכם</p>
                    {configured && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />
                        <span className="text-[10px] text-green-600">Groq פעיל</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowKeySetup(s => !s)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="הגדרות מפתח">
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={clearChat} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="נקה שיחה">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Key setup */}
              <AnimatePresence>
                {showKeySetup && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-b"
                  >
                    <KeySetup onSaved={() => { setConfigured(true); setShowKeySetup(false); checkStatus(); }} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                {messages.map(msg => (
                  <div key={msg.id} className={cn("flex gap-2", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                      msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted border"
                    )}>
                      {msg.role === "user" ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                    </div>
                    <div className={cn(
                      "max-w-[82%] rounded-xl px-3 py-2",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm text-xs"
                        : "bg-muted/60 border rounded-tl-sm"
                    )}>
                      {msg.pending ? (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span className="text-xs">חושב...</span>
                        </div>
                      ) : msg.role === "user" ? (
                        <p className="text-xs leading-relaxed">{msg.content}</p>
                      ) : (
                        <div className="space-y-0.5">{formatContent(msg.content)}</div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t flex-shrink-0">
                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="שאל שאלה... (Enter לשליחה)"
                    className="resize-none text-xs min-h-[40px] max-h-24"
                    rows={1}
                    disabled={isStreaming || !configured}
                  />
                  <Button
                    onClick={send}
                    disabled={!input.trim() || isStreaming || !configured}
                    size="icon"
                    className="h-auto w-9 self-end flex-shrink-0"
                  >
                    {isStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
