import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ChevronRight, ChevronDown, FileCode, Folder, FolderOpen,
  Loader2, Database, Table2, RefreshCw, ChevronLeft, Monitor, Server,
  Copy, Check, Rocket,
} from "lucide-react";

/* ── useCopy ───────────────────────────────────────────────── */
function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }, []);
  return { copied, copy };
}

/* ── Types ─────────────────────────────────────────────────── */
type FileEntry = { name: string; path: string; isDir: boolean; ext?: string };
type Column    = { name: string; type: string };
type TableData = { rows: Record<string, unknown>[]; columns: Column[]; total: number; page: number; limit: number };

type Tab = "client" | "server" | "db";

/* ════════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════════ */
export default function Dev() {
  const [tab, setTab] = useState<Tab>("client");

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]" dir="rtl">
      <div className="flex items-center justify-between">
        <PageHeader title="מסך פיתוח" description="צפייה בקוד ובנתוני מסד הנתונים" />
        <a
          href="https://replit.com/deployments"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Rocket className="w-4 h-4" />
          פרסם אפליקציה
        </a>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mt-4 mb-3">
        {([
          { key: "client", label: "קוד לקוח",  Icon: Monitor  },
          { key: "server", label: "קוד שרת",   Icon: Server   },
          { key: "db",     label: "דאטה",       Icon: Database },
        ] as const).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
              tab === key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden rounded-xl border border-border/50 shadow-sm">
        {tab === "client" && <CodePane root="client" />}
        {tab === "server" && <CodePane root="server" />}
        {tab === "db"     && <DbPane />}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   CODE PANE
════════════════════════════════════════════════════════════ */
function CodePane({ root }: { root: "client" | "server" }) {
  const [tree,     setTree]     = useState<Record<string, FileEntry[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set([""]));
  const [selected, setSelected] = useState<{ path: string; content: string; name: string } | null>(null);
  const [loading,  setLoading]  = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const fetchDir = useCallback(async (dirPath: string) => {
    if (tree[dirPath]) return;
    setLoading(dirPath);
    try {
      const data = await apiFetch(`/dev/files?root=${root}&path=${encodeURIComponent(dirPath)}`);
      setTree(prev => ({ ...prev, [dirPath]: data.items }));
    } catch { /* ignore */ }
    finally { setLoading(null); }
  }, [root, tree]);

  useEffect(() => {
    setTree({}); setExpanded(new Set([""])); setSelected(null);
    (async () => {
      setLoading("");
      try {
        const data = await apiFetch(`/dev/files?root=${root}&path=`);
        setTree({ "": data.items });
      } catch { /* ignore */ }
      finally { setLoading(null); }
    })();
  }, [root]);

  const toggleDir = async (p: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(p)) { next.delete(p); } else { next.add(p); fetchDir(p); }
      return next;
    });
  };

  const openFile = async (p: string, name: string) => {
    if (selected?.path === p) return;
    setLoading(p);
    try {
      const data = await apiFetch(`/dev/files?root=${root}&path=${encodeURIComponent(p)}`);
      setSelected({ path: p, content: data.content, name: data.name });
    } catch { /* ignore */ }
    finally { setLoading(null); }
  };

  const renderTree = (entries: FileEntry[], depth = 0): React.ReactNode =>
    entries.map(entry => {
      const isExpanded = expanded.has(entry.path);
      const isSelected = selected?.path === entry.path;
      const isLoading  = loading === entry.path;

      return (
        <div key={entry.path}>
          <button
            onClick={() => entry.isDir ? toggleDir(entry.path) : openFile(entry.path, entry.name)}
            className={cn(
              "w-full flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-white/10 transition-colors text-right",
              isSelected ? "bg-primary/20 text-primary font-medium" : "text-slate-300",
            )}
            style={{ paddingRight: `${8 + depth * 14}px` }}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-slate-400" />
            ) : entry.isDir ? (
              isExpanded
                ? <FolderOpen className="w-3.5 h-3.5 shrink-0 text-yellow-400" />
                : <Folder     className="w-3.5 h-3.5 shrink-0 text-yellow-400" />
            ) : (
              <FileCode className="w-3.5 h-3.5 shrink-0 text-blue-400" />
            )}
            <span className="truncate">{entry.name}</span>
            {entry.isDir && (
              isExpanded
                ? <ChevronDown  className="w-3 h-3 shrink-0 mr-auto text-slate-500" />
                : <ChevronRight className="w-3 h-3 shrink-0 mr-auto text-slate-500" />
            )}
          </button>
          {entry.isDir && isExpanded && tree[entry.path] && (
            <div>{renderTree(tree[entry.path], depth + 1)}</div>
          )}
        </div>
      );
    });

  return (
    <div className="flex h-full bg-slate-900" dir="ltr">
      {/* File tree */}
      <div className="w-56 shrink-0 border-r border-slate-700 overflow-y-auto py-2 px-1">
        {loading === "" ? (
          <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
        ) : (
          renderTree(tree[""] ?? [])
        )}
      </div>

      {/* Code viewer */}
      <div className="flex-1 overflow-auto">
        {selected ? (
          <>
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center gap-2 z-10">
              <FileCode className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-300 font-mono flex-1">{selected.path}</span>
              <button
                onClick={() => copy(selected.content)}
                title="העתק קוד"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "הועתק!" : "העתק קוד"}
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-slate-200 leading-relaxed whitespace-pre overflow-x-auto">
              <code>{selected.content}</code>
            </pre>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
            <FileCode className="w-10 h-10 opacity-30" />
            <p className="text-sm">בחר קובץ מהעץ</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   DB PANE
════════════════════════════════════════════════════════════ */
function DbPane() {
  const [tables,   setTables]   = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [data,     setData]     = useState<TableData | null>(null);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const { copied, copy } = useCopy();

  const copyData = () => {
    if (!data) return;
    copy(JSON.stringify(data.rows, null, 2));
  };

  useEffect(() => {
    apiFetch("/dev/db/tables").then((t: string[]) => {
      setTables(t);
      if (t.length > 0) setSelected(t[0]);
    });
  }, []);

  const loadTable = useCallback(async (name: string, p: number) => {
    if (!name) return;
    setLoading(true);
    try {
      const d = await apiFetch(`/dev/db/table/${name}?page=${p}&limit=50`);
      setData(d);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (selected) { setPage(1); loadTable(selected, 1); }
  }, [selected]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="flex h-full bg-white" dir="rtl">
      {/* Tables sidebar */}
      <div className="w-48 shrink-0 border-l border-border/50 bg-muted/20 overflow-y-auto py-2">
        <p className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">טבלאות</p>
        {tables.map(t => (
          <button
            key={t}
            onClick={() => setSelected(t)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 text-xs text-right hover:bg-muted transition-colors",
              selected === t ? "bg-primary/10 text-primary font-medium" : "text-foreground"
            )}
          >
            <Table2 className="w-3.5 h-3.5 shrink-0 opacity-60" />
            <span className="truncate font-mono">{t}</span>
          </button>
        ))}
      </div>

      {/* Data grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/10 shrink-0">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium font-mono">{selected}</span>
            {data && <span className="text-xs text-muted-foreground">({data.total.toLocaleString()} שורות)</span>}
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <button
                onClick={copyData}
                title="העתק דאטה"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border/50"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "הועתק!" : "העתק דאטה"}
              </button>
            )}
            <button onClick={() => loadTable(selected, page)} className="p-1.5 rounded hover:bg-muted transition-colors">
              <RefreshCw className={cn("w-3.5 h-3.5 text-muted-foreground", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : data && data.columns.length > 0 ? (
          <>
            <div className="flex-1 overflow-auto" dir="ltr">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                  <tr>
                    {data.columns.map(c => (
                      <th key={c.name}
                        className="px-3 py-2 text-left border-b border-border/50 font-mono font-semibold text-foreground whitespace-nowrap">
                        <div>{c.name}</div>
                        <div className="font-normal text-[10px] text-muted-foreground">{c.type}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, i) => (
                    <tr key={i} className={cn("hover:bg-primary/5 transition-colors", i % 2 === 0 ? "bg-white" : "bg-muted/10")}>
                      {data.columns.map(c => {
                        const val = row[c.name];
                        const str = val === null || val === undefined ? "" : String(val);
                        return (
                          <td key={c.name}
                            className="px-3 py-1.5 border-b border-border/30 max-w-[200px] truncate align-top font-mono"
                            title={str}>
                            {val === null ? (
                              <span className="text-muted-foreground italic text-[10px]">null</span>
                            ) : (
                              <span>{str.length > 60 ? str.slice(0, 60) + "…" : str}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2 border-t border-border/50 bg-muted/10 shrink-0" dir="rtl">
                <span className="text-xs text-muted-foreground">
                  עמוד {page} מתוך {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page <= 1} onClick={() => { setPage(p => p - 1); loadTable(selected, page - 1); }}
                    className="p-1 rounded hover:bg-muted disabled:opacity-40 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    disabled={page >= totalPages} onClick={() => { setPage(p => p + 1); loadTable(selected, page + 1); }}
                    className="p-1 rounded hover:bg-muted disabled:opacity-40 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            בחר טבלה לצפייה
          </div>
        )}
      </div>
    </div>
  );
}
