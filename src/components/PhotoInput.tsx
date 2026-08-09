import { useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressFile } from "@/lib/image";

export function PhotoInput({
  photos,
  onChange,
  single = false,
}: {
  photos: string[];
  onChange: (next: string[]) => void;
  single?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    const added: string[] = [];
    for (const file of Array.from(files)) added.push(await compressFile(file));
    onChange(single ? added.slice(0, 1) : [...photos, ...added]);
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <label className="flex-1">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            multiple={!single}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button type="button" variant="secondary" className="w-full" asChild>
            <span>
              <Camera className="size-4" /> كاميرا
            </span>
          </Button>
        </label>
        <label className="flex-1">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            multiple={!single}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button type="button" variant="secondary" className="w-full" asChild>
            <span>
              <ImagePlus className="size-4" /> المعرض
            </span>
          </Button>
        </label>
      </div>
      {busy && <p className="text-xs text-muted-foreground">جارٍ معالجة الصورة…</p>}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((src, i) => (
            <div key={i} className="relative">
              <img
                src={src}
                alt={`مرفق ${i + 1}`}
                className="size-20 rounded-xl border border-border object-cover"
              />
              <button
                type="button"
                aria-label="حذف الصورة"
                onClick={() => onChange(photos.filter((_, idx) => idx !== i))}
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
