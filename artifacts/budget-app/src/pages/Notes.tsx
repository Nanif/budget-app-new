import { useState } from "react";
import { 
  useGetNotes, 
  useCreateNote, 
  useUpdateNote, 
  useDeleteNote,
  getGetNotesQueryKey,
  type Note 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pin } from "lucide-react";
import { cn } from "@/lib/utils";

const NOTE_COLORS = [
  { val: 'bg-amber-100 text-amber-900 border-amber-200', name: 'צהוב' },
  { val: 'bg-emerald-100 text-emerald-900 border-emerald-200', name: 'ירוק' },
  { val: 'bg-sky-100 text-sky-900 border-sky-200', name: 'כחול' },
  { val: 'bg-rose-100 text-rose-900 border-rose-200', name: 'אדום' },
  { val: 'bg-purple-100 text-purple-900 border-purple-200', name: 'סגול' },
  { val: 'bg-card text-foreground border-border', name: 'רגיל' }
];

export default function Notes() {
  const { data: notes, isLoading } = useGetNotes();
  const queryClient = useQueryClient();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Note | null>(null);
  const [selectedColor, setSelectedColor] = useState(NOTE_COLORS[0].val);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
  const createMut = useCreateNote({ mutation: { onSuccess: invalidate }});
  const updateMut = useUpdateNote({ mutation: { onSuccess: invalidate }});
  const deleteMut = useDeleteNote({ mutation: { onSuccess: invalidate }});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title") as string,
      content: formData.get("content") as string,
      color: selectedColor,
      isPinned: editingItem ? editingItem.isPinned : false,
    };

    if (editingItem) await updateMut.mutateAsync({ id: editingItem.id, data });
    else await createMut.mutateAsync({ data });
    
    setIsDialogOpen(false);
  };

  const togglePin = (note: Note) => {
    updateMut.mutate({ id: note.id, data: { title: note.title, content: note.content, color: note.color, isPinned: !note.isPinned }});
  };

  const sortedNotes = notes?.slice().sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return (
    <div className="space-y-6">
      <PageHeader 
        title="פתקים" 
        description="רעיונות, מחשבות ותזכורות טקסטואליות חופשיות"
        action={
          <Button onClick={() => { setEditingItem(null); setSelectedColor(NOTE_COLORS[0].val); setIsDialogOpen(true); }} className="rounded-xl shadow-lg gap-2">
            <Plus className="w-4 h-4" />
            פתק חדש
          </Button>
        }
      />

      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
        {isLoading ? (
          <div className="h-40 bg-muted rounded-2xl animate-pulse w-full inline-block" />
        ) : sortedNotes?.map((note) => (
          <div 
            key={note.id} 
            className={cn(
              "break-inside-avoid rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all relative group cursor-pointer",
              note.color
            )}
            onClick={() => { setEditingItem(note); setSelectedColor(note.color); setIsDialogOpen(true); }}
          >
            <div className="absolute top-3 end-3 flex gap-1">
              <button 
                onClick={(e) => { e.stopPropagation(); togglePin(note); }} 
                className={cn("p-1.5 rounded-full transition-colors", note.isPinned ? "text-foreground bg-black/10" : "text-foreground/40 opacity-0 group-hover:opacity-100 hover:bg-black/5")}
              >
                <Pin className="w-4 h-4" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); if(confirm("למחוק פתק?")) deleteMut.mutate({ id: note.id }); }} 
                className="p-1.5 rounded-full text-foreground/40 opacity-0 group-hover:opacity-100 hover:bg-black/5 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
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
                  <button 
                    key={c.val} type="button" 
                    onClick={() => setSelectedColor(c.val)}
                    className={cn("w-8 h-8 rounded-full border-2 transition-transform", c.val.split(' ')[0], selectedColor === c.val ? "scale-110 border-foreground/50 shadow-md" : "border-transparent hover:scale-105")}
                  />
                ))}
              </div>
            </div>
            <DialogFooter><Button type="submit" className="rounded-xl px-8">שמור</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
