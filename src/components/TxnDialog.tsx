import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NoteField } from "@/components/NoteField";
import { DateTimeField } from "@/components/DateTimeField";
import {
  addDebt,
  addPayment,
  balanceOf,
  suggestableClients,
  updateTxn,
  useAppState,
  type Scope,
  type Txn,
} from "@/lib/store";
import { matchScore } from "@/lib/arabic";

export type TxnKind = "debt" | "payment";

export function TxnDialog({
  open,
  onOpenChange,
  kind,
  txn,
  lockedClientId,
  scope = "daily",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: TxnKind;
  txn?: Txn | null;
  lockedClientId?: string | null;
  scope?: Scope;
}) {
  const state = useAppState();
  const isEdit = !!txn;
  const effectiveScope: Scope = txn?.scope ?? scope;

  const [name, setName] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [at, setAt] = useState(new Date().toISOString());
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const preset = txn?.clientId ?? lockedClientId ?? null;
    setClientId(preset);
    setName(preset ? (state.clients.find((c) => c.id === preset)?.name ?? "") : "");
    setAmount(txn ? String(txn.amount) : "");
    setAt(txn?.at ?? new Date().toISOString());
    setNote(txn?.note ?? "");
    setPhotos(txn?.photos ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const suggestions = useMemo(() => {
    if (!name.trim() || clientId) return [];
    return suggestableClients(state)
      .map((c) => ({ c, score: matchScore(name, c.name) }))
      .filter((r) => r.score > 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((r) => r.c);
  }, [name, clientId, state]);

  function submit() {
    const value = Number(amount);
    if (!name.trim() && !clientId) {
      toast.error("أدخل اسم العميل");
      return;
    }
    if (!value || value <= 0) {
      toast.error("أدخل مبلغًا صحيحًا");
      return;
    }

    if (isEdit && txn) {
      updateTxn(kind, txn.id, {
        amount: value,
        at,
        note: note.trim(),
        photos,
      });
    } else {
      const payload = {
        ...(clientId ? { clientId } : { clientName: name }),
        amount: value,
        at,
        scope: effectiveScope,
        note: note.trim(),
        photos,
      };
      if (kind === "debt") addDebt(payload);
      else addPayment(payload);
    }
    onOpenChange(false);
  }

  const currentBalance = clientId && effectiveScope === "ledger" ? balanceOf(state, clientId) : null;
  const title = isEdit
    ? kind === "debt"
      ? "تعديل عملية دين"
      : "تعديل عملية سداد"
    : kind === "debt"
      ? "إضافة دين"
      : "إضافة سداد";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client">اسم العميل</Label>
            <Input
              id="client"
              value={name}
              disabled={isEdit || !!lockedClientId}
              placeholder="اكتب اسم العميل"
              onChange={(e) => {
                setName(e.target.value);
                setClientId(null);
              }}
            />
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setClientId(c.id);
                      setName(c.name);
                    }}
                    className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {currentBalance !== null && (
              <p className="text-xs text-muted-foreground">
                المديونية الحالية: <span className="num">{currentBalance}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">المبلغ</Label>
            <div className="flex items-center gap-2">
              <Input
                id="amount"
                type="number"
                inputMode="decimal"
                className="num flex-1 text-lg font-bold"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
              <DateTimeField value={at} onChange={setAt} />
            </div>
          </div>

          <NoteField
            note={note}
            onNoteChange={setNote}
            photos={photos}
            onPhotosChange={setPhotos}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={submit}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
