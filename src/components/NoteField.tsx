import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { compressFile } from "@/lib/image";

/** خانة الملاحظات مع أيقونة مرفقات مدمجة داخلها */
export function NoteField({
  note,
  onNoteChange,
  photos,
  onPhotosChange,
}: {
  note: string;
  onNoteChange: (v: string) => void;
  photos: string[];
  onPhotosChange: (next: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    const added: string[] = [];
    for (const file of Array.from(files)) added.push(await compressFile(file));
    onPhotosChange([...photos, ...added]);
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Textarea
          id="note"
          value={note}
          rows={2}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="ملاحظة (اختياري)"
          className="pl-11"
        />
        <button
          type="button"
          aria-label="إرفاق صورة"
          onClick={() => inputRef.current?.click()}
          className="absolute bottom-2 left-2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary"
        >
          <Paperclip className="size-4" />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {busy && <p className="text-xs text-muted-foreground">جارٍ معالجة الصورة…</p>}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((src, i) => (
            <div key={i} className="relative">
              <img
                src={src}
                alt={`مرفق ${i + 1}`}
                className="size-16 rounded-xl border border-border object-cover"
              />
              <button
                type="button"
                aria-label="حذف الصورة"
                onClick={() => onPhotosChange(photos.filter((_, idx) => idx !== i))}
                className="absolute -top-2 -left-2 rounded-full bg-destructive p-1 text-destructive-foreground"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
