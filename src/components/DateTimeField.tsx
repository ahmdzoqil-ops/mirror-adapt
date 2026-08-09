import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDateShort, formatTime, fromLocalInput, toLocalInput } from "@/lib/format";

/** أيقونة تقويم صغيرة تفتح نافذة اختيار التاريخ والوقت */
export function DateTimeField({
  value,
  onChange,
}: {
  value: string; // ISO
  onChange: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(toLocalInput(value));

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraft(toLocalInput(value));
          setOpen(true);
        }}
        aria-label="اختيار التاريخ والوقت"
        className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground"
      >
        <CalendarClock className="size-4 shrink-0" />
        <span className="num">
          {formatDateShort(value)} · {formatTime(value)}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>التاريخ والوقت</DialogTitle>
          </DialogHeader>
          <Input
            type="datetime-local"
            className="num"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => {
                if (draft) onChange(fromLocalInput(draft));
                setOpen(false);
              }}
            >
              تم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
