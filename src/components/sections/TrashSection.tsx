import { useState } from "react";
import { RotateCcw, Trash2, Inbox } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { VerifyDialog } from "@/components/AppLock";
import { Money } from "@/components/Riyal";
import { formatDateShort, formatTime } from "@/lib/format";
import { clientName, purgeTxn, restoreTxn, useAppState } from "@/lib/store";

export function TrashSection() {
  const state = useAppState();
  const [verifyId, setVerifyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const items = [...state.trash].sort((a, b) => +new Date(b.deletedAt) - +new Date(a.deletedAt));

  function askPurge(id: string) {
    if (state.settings.sensitiveLock && state.settings.pin) setVerifyId(id);
    else setConfirmId(id);
  }

  return (
    <div className="space-y-3">
      <div className="card-soft p-4">
        <p className="text-sm text-muted-foreground">العمليات المحذوفة</p>
        <p className="num mt-1 text-3xl font-extrabold">{items.length}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          لا تُحتسب ضمن الأرصدة أو التقارير حتى تتم استعادتها.
        </p>
      </div>

      {items.length === 0 && (
        <div className="card-soft flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
          <Inbox className="size-8" />
          <p className="text-sm font-semibold">لا توجد عمليات محذوفة</p>
        </div>
      )}

      {items.map((it) => (
        <div key={it.txn.id} className="card-soft space-y-3 p-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{clientName(state, it.txn.clientId)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {it.kind === "debt" ? "دين" : "سداد"} · {formatDateShort(it.txn.at)}{" "}
                {formatTime(it.txn.at)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                حُذفت في {formatDateShort(it.deletedAt)} {formatTime(it.deletedAt)}
              </p>
              {it.txn.note ? (
                <p className="mt-1 text-xs text-muted-foreground">{it.txn.note}</p>
              ) : null}
            </div>
            <Money
              value={it.txn.amount}
              className={`shrink-0 text-base font-bold ${
                it.kind === "debt" ? "text-destructive" : "text-success"
              }`}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                restoreTxn(it.txn.id);
                toast.success("تمت الاستعادة");
              }}
              className="flex items-center justify-center gap-2 rounded-xl bg-secondary p-3 text-sm font-semibold"
            >
              <RotateCcw className="size-4" /> استعادة
            </button>
            <button
              onClick={() => askPurge(it.txn.id)}
              className="flex items-center justify-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
            >
              <Trash2 className="size-4" /> حذف نهائي
            </button>
          </div>
        </div>
      ))}

      <VerifyDialog
        open={verifyId !== null}
        onOpenChange={(v) => !v && setVerifyId(null)}
        title="تأكيد الحذف النهائي"
        onSuccess={() => {
          setConfirmId(verifyId);
          setVerifyId(null);
        }}
      />

      <AlertDialog open={confirmId !== null} onOpenChange={(v) => !v && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف نهائي؟</AlertDialogTitle>
            <AlertDialogDescription>
              لا يمكن استعادة العملية بعد الحذف النهائي.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmId) purgeTxn(confirmId);
                toast.success("تم الحذف نهائيًا");
              }}
            >
              حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
