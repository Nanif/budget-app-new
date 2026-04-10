import { useState, useRef, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBudgetYear } from "@/contexts/BudgetYearContext";
import { apiFetch, API_BASE } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Send, Bot, User, Loader2, Trash2, CheckCircle2,
  KeyRound, Eye, EyeOff, Settings2,
} from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
};

function uid() {
  return Math.random().toString(36).slice(2);
}

function formatContent(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("### ")) return <h3 key={i} className="text-base font-bold mt-3 mb-1">{line.slice(4)}</h3>;
    if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-bold mt-4 mb-1">{line.slice(3)}</h2>;
    if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold mt-4 mb-1">{line.slice(2)}</h1>;
    if (line.startsWith("- ") || line.startsWith("• "))
      return <li key={i} className="mr-4 list-disc leading-relaxed">{line.slice(2)}</li>;
    if (line.trim() === "") return <div key={i} className="h-2" />;
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="leading-relaxed">
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**")
            ? <strong key={j}>{part.slice(2, -2)}</strong>
            : part
        )}
      </p>
    );
  });
}

/* ─── Key Setup Screen ─────────────────────────────────── */
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
      await apiFetch("/agent/key", {
        method: "POST",
        body: JSON.stringify({ key: key.trim() }),
      });
      onSaved();
    } catch (e: any) {
      setError("שגיאה בשמירה: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 max-w-md mx-auto w-full">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <KeyRound className="w-8 h-8 text-primary" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-bold mb-2">הגדרת מפתח Groq</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          כדי להפעיל את הסוכן החכם, נדרש מפתח API חינמי מ-Groq.
        </p>
      </div>

      <div className="bg-muted/50 rounded-xl p-4 text-sm w-full space-y-2">
        <p className="font-semibold">איך מקבלים מפתח חינמי:</p>
        <ol className="list-decimal mr-4 space-y-1 text-muted-foreground">
          <li>כנס ל-<strong className="text-foreground">console.groq.com</strong></li>
          <li>הירשם עם חשבון Google / GitHub</li>
          <li>לחץ <strong className="text-foreground">API Keys → Create API Key</strong></li>
          <li>העתק את המפתח והדבק למטה</li>
        </ol>
      </div>

      <div className="w-full space-y-2">
        <Label htmlFor="groq-key">מפתח API</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="groq-key"
              type={show ? "text" : "password"}
              value={key}
              onChange={e => setKey(e.target.value)}
              onKeyDown={e => e.key === "Enter" && save()}
              placeholder="gsk_..."
              className="pl-10"
              dir="ltr"
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Button onClick={save} disabled={!key.trim() || saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "שמור"}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}

/* ─── Main Chat ────────────────────────────────────────── */
export default function Agent() {
  const { activeBudgetYearId } = useBudgetYear();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "שלום! אני הסוכן הפיננסי שלך 👋\n\nאני מכיר את כל נתוני התקציב המשפחתי ויכול לעזור לך לנתח הוצאות, הכנסות, קופות ועוד.\n\nכשתבקש ממני לבצע פעולה — אוודא איתך את הפרטים לפני הביצוע.\n\nמה תרצה לדעת?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [showKeyChange, setShowKeyChange] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const checkStatus = () => {
    apiFetch("/agent/status")
      .then((d: any) => setConfigured(d.configured))
      .catch(() => setConfigured(false));
  };

  useEffect(() => { checkStatus(); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");

    const userMsg: Message = { id: uid(), role: "user", content: text };
    const assistantId = uid();
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", pending: true };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
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
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json) continue;
          try {
            const parsed = JSON.parse(json);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.content) {
              full += parsed.content;
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, content: full, pending: false } : m)
              );
            }
          } catch (e: any) {
            if (e.message !== "Unexpected end of JSON input") throw e;
          }
        }
      }
    } catch (err: any) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: `❌ שגיאה: ${err.message}`, pending: false }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: "שיחה חדשה. במה אוכל לעזור?",
    }]);
  };

  if (configured === null) {
    return (
      <div className="flex items-center justify-center flex-1">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (configured === false || showKeyChange) {
    return (
      <div className="flex flex-col h-full" dir="rtl">
        <PageHeader title="סוכן חכם" subtitle="הגדרת חיבור ל-AI" />
        <KeySetup onSaved={() => { setConfigured(true); setShowKeyChange(false); }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-2rem)]" dir="rtl">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <PageHeader title="סוכן חכם" subtitle="שאל שאלות ותן הוראות על התקציב" />
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowKeyChange(true)} className="gap-1.5 text-muted-foreground">
            <Settings2 className="w-4 h-4" />
            מפתח
          </Button>
          <Button variant="ghost" size="sm" onClick={clearChat} className="gap-1.5 text-muted-foreground">
            <Trash2 className="w-4 h-4" />
            נקה
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2 mb-4 flex-shrink-0">
        <CheckCircle2 className="w-4 h-4 text-green-600" />
        <span className="text-sm text-green-700">Groq מחובר ופעיל</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4 min-h-0">
        {messages.map(msg => (
          <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
              msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted border"
            )}>
              {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={cn(
              "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-tr-sm"
                : "bg-card border shadow-sm rounded-tl-sm"
            )}>
              {msg.pending ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>חושב...</span>
                </div>
              ) : (
                <div className={cn("space-y-0.5", msg.role === "assistant" && "text-foreground")}>
                  {msg.role === "assistant" ? formatContent(msg.content) : msg.content}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 border-t pt-4">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="שאל שאלה או תן הוראה... (Enter לשליחה)"
            className="resize-none text-sm min-h-[56px] max-h-32"
            rows={2}
            disabled={isStreaming}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="h-auto aspect-square self-end"
          >
            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          לפני כל פעולה — הסוכן יבקש אישור מלא
        </p>
      </div>
    </div>
  );
}
