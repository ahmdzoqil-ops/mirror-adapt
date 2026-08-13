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
import {
  clientName,
  isClientTrash,
  purgeClient,
  purgeTxn,
  restoreClient,
  restoreTxn,
  useAppState,
} from "@/lib/store";

type Target = { kind: "txn" | "client"; id: string };

export function TrashSection() {
  const state = useAppState();
  const [verifyTarget, setVerifyTarget] = useState<Target | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Target | null>(null);
  const items = [...state.trash].sort((a, b) => +new Date(b.deletedAt) - +new Date(a.deletedAt));

  function askPurge(t: Target) {
    if (state.settings.sensitiveLock && state.settings.pin) setVerifyTarget(t);
    else setConfirmTarget(t);
  }

  return (
    <div className="space-y-3">
      <div className="card-soft p-4">
        <p className="text-sm text-muted-foreground">المحذوفات (عملاء وعمليات)</p>
        <p className="num mt-1 text-3xl font-extrabold">{items.length}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          لا تُحتسب ضمن الأرصدة أو التقارير حتى تتم استعادتها.
        </p>
      </div>

      {items.length === 0 && (
        <div className="card-soft flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
          <Inbox className="size-8" />
          <p className="text-sm font-semibold">لا توجد عناصر محذوفة</p>
        </div>
      )}

      {items.map((it) =>
        isClientTrash(it) ? (
          <div key={it.client.id} className="card-soft space-y-3 p-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{it.client.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  عميل محذوف · {it.debts.length + it.payments.length} عملية
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  حُذف في {formatDateShort(it.deletedAt)} {formatTime(it.deletedAt)}
                </p>
              </div>
              <Money
                value={
                  it.debts.reduce((a, t) => a + t.amount, 0) -
                  it.payments.reduce((a, t) => a + t.amount, 0)
                }
                className="shrink-0 text-base font-bold"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  restoreClient(it.client.id);
                  toast.success("تمت استعادة العميل وعملياته");
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-secondary p-3 text-sm font-semibold"
              >
                <RotateCcw className="size-4" /> استعادة
              </button>
              <button
                onClick={() => askPurge({ kind: "client", id: it.client.id })}
                className="flex items-center justify-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
              >
                <Trash2 className="size-4" /> حذف نهائي
              </button>
            </div>
          </div>
        ) : (
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
                onClick={() => askPurge({ kind: "txn", id: it.txn.id })}
                className="flex items-center justify-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
              >
                <Trash2 className="size-4" /> حذف نهائي
              </button>
            </div>
          </div>
        ),
      )}

      <VerifyDialog
        open={verifyTarget !== null}
        onOpenChange={(v) => !v && setVerifyTarget(null)}
        title="تأكيد الحذف النهائي"
        onSuccess={() => {
          setConfirmTarget(verifyTarget);
          setVerifyTarget(null);
        }}
      />

      <AlertDialog open={confirmTarget !== null} onOpenChange={(v) => !v && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف نهائي؟</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget?.kind === "client"
                ? "سيُحذف العميل وكل عملياته نهائيًا دون إمكانية استعادة."
                : "لا يمكن استعادة العملية بعد الحذف النهائي."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmTarget?.kind === "client") purgeClient(confirmTarget.id);
                else if (confirmTarget) purgeTxn(confirmTarget.id);
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
