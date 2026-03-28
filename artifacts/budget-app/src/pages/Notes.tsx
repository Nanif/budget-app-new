import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

type Note = {
  id: number; userId: number; tabId: number; title: string; content: string;
  color: string; isPinned: boolean; sortOrder: number; createdAt: string; updatedAt: string;
};

const NOTE_COLORS = [
  { val: 'bg-amber-100 text-amber-900 border-amber-200', name: 'צהוב' },
  { val: 'bg-emerald-100 text-emerald-900 border-emerald-200', name: 'ירוק' },
  { val: 'bg-sky-100 text-sky-900 border-sky-200', name: 'כחול' },
  { val: 'bg-rose-100 text-rose-900 border-rose-200', name: 'אדום' },
  { val: 'bg-purple-100 text-purple-900 border-purple-200', name: 'סגול' },
  { val: 'bg-card text-foreground border-border', name: 'רגיל' }
];

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}

export default function Notes() {
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Note | null>(null);
  const [selectedColor, setSelectedColor] = useState(NOTE_COLORS[0].val);
  const [isSaving, setIsSaving] = useState(false);

  const loadNotes = async () => {
    setIsLoading(true);
    try { setNotes(await apiFetch("/notes")); }
    catch { toast({ title: "שגיאה בטעינה", variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadNotes(); }, []);

  const sortedNotes = notes.slice().sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title") as string,
      content: formData.get("content") as string,
      color: selectedColor,
      isPinned: editingItem ? editingItem.isPinned : false,
    };
    try {
      if (editingItem) {
        await apiFetch(`/notes/${editingItem.id}`, { method: "PUT", body: JSON.stringify(data) });
      } else {
        await apiFetch("/notes", { method: "POST", body: JSON.stringify(data) });
      }
      setIsDialogOpen(false);
      await loadNotes();
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
    finally { setIsSaving(false); }
  };

  const togglePin = async (note: Note) => {
    try {
      await apiFetch(`/notes/${note.id}`, { method: "PUT", body: JSON.stringify({ ...note, isPinned: !note.isPinned }) });
      await loadNotes();
    } catch { toast({ title: "שגיאה", variant: "destructive" }); }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/notes/${id}`, { method: "DELETE" });
      await loadNotes();
    } catch { toast({ title: "שגיאה במחיקה", variant: "destructive" }); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="פתקים"
        description="רעיונות, מחשבות ותזכורות טקסטואליות חופשיות"
        action={
          <Button onClick={() => { setEditingItem(null); setSelectedColor(NOTE_COLORS[0].val); setIsDialogOpen(true); }} className="rounded-xl shadow-lg gap-2">
            <Plus className="w-4 h-4" />פתק חדש
          </Button>
        }
      />

      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
        {isLoading ? (
          <div className="h-40 bg-muted rounded-2xl animate-pulse w-full inline-block" />
        ) : sortedNotes.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground">אין פתקים. צור את הראשון!</div>
        ) : sortedNotes.map((note) => (
          <div
            key={note.id}
            className={cn("break-inside-avoid rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all relative group cursor-pointer mb-6", note.color)}
            onClick={() => { setEditingItem(note); setSelectedColor(note.color); setIsDialogOpen(true); }}
          >
            <div className="absolute top-3 end-3 flex gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); togglePin(note); }}
                className={cn("p-1.5 rounded-full transition-colors", note.isPinned ? "text-foreground bg-black/10" : "text-foreground/40 opacity-0 group-hover:opacity-100 hover:bg-black/5")}
              ><Pin className="w-4 h-4" /></button>
              <button
                onClick={(e) => { e.stopPropagation(); if (confirm("למחוק פתק?")) handleDelete(note.id); }}
                className="p-1.5 rounded-full text-foreground/40 opacity-0 group-hover:opacity-100 hover:bg-black/5 hover:text-red-600 transition-colors"
              ><Trash2 className="w-4 h-4" /></button>
            </div>
            {note.title && <h3 className="font-bold text-lg mb-2 pe-14">{note.title}</h3>}
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{note.content}</p>
            <div className="mt-4 text-[10px] opacity-50">עודכן: {new Date(note.updatedAt).toLocaleDateString('he-IL')}</div>
          </div>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <form onSubmit={handleSubmit}>
            <DialogHeader><DialogTitle>{editingItem ? "עריכת פתק" : "פתק חדש"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <Input name="title" placeholder="כותרת הפתק" defaultValue={editingItem?.title} className="text-lg font-bold rounded-xl border-none focus-visible:ring-0 px-0" />
              <Textarea name="content" placeholder="תוכן הפתק..." required defaultValue={editingItem?.content} className="min-h-[150px] resize-none rounded-xl border-none focus-visible:ring-0 px-0" />
              <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                {NOTE_COLORS.map(c => (
                  <button key={c.val} type="button" onClick={() => setSelectedColor(c.val)}
                    className={cn("w-8 h-8 rounded-full border-2 transition-transform", c.val.split(' ')[0], selectedColor === c.val ? "scale-110 border-foreground/50 shadow-md" : "border-transparent hover:scale-105")}
                  />
                ))}
              </div>
            </div>
            <DialogFooter><Button type="submit" disabled={isSaving} className="rounded-xl px-8">{isSaving ? "שומר..." : "שמור"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
