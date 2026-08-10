import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Pencil, Trash2, StickyNote } from "lucide-react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TxnDialog, type TxnKind } from "@/components/TxnDialog";
import { VerifyDialog } from "@/components/AppLock";
import { formatTime, formatDateShort } from "@/lib/format";
import { Money } from "@/components/Riyal";
import { deleteTxn, type Txn } from "@/lib/store";

const LONG_PRESS_MS = 450;

export function TxnRow({
  txn,
  kind,
  name,
  clientId,
  showDate = false,
}: {
  txn: Txn;
  kind: TxnKind;
  name: string;
  clientId?: string;
  showDate?: boolean;
}) {
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [actions, setActions] = useState(false);
  const [verify, setVerify] = useState<"edit" | "delete" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const isDebt = kind === "debt";
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  function start() {
    longPressed.current = false;
    timer.current = setTimeout(() => {
      longPressed.current = true;
      if (navigator.vibrate) navigator.vibrate(15);
      setActions(true);
    }, LONG_PRESS_MS);
  }

  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  useEffect(() => () => cancel(), []);

  return (
    <div className="relative overflow-hidden rounded-2xl" data-no-swipe>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex w-28 items-center justify-center gap-1 bg-destructive/10 text-sm font-bold text-destructive">
        <Trash2 className="size-4" /> حذف
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 flex w-28 items-center justify-center gap-1 bg-secondary text-sm font-bold">
        <Pencil className="size-4" /> تعديل
      </div>
    <div
      style={{ transform: `translateX(${dx}px)` }}
      className="card-soft relative flex touch-pan-y items-center gap-3 p-3 select-none active:bg-secondary/40"
      onPointerDown={(e) => {
        startX.current = e.clientX;
        startY.current = e.clientY;
        start();
      }}
      onPointerMove={(e) => {
        if (startX.current === null || startY.current === null) return;
        const mx = e.clientX - startX.current;
        const my = e.clientY - startY.current;
        if (Math.abs(mx) > 8) cancel();
        if (Math.abs(mx) > Math.abs(my)) setDx(Math.max(-140, Math.min(140, mx)));
      }}
      onPointerUp={() => {
        cancel();
        const moved = dx;
        startX.current = null;
        startY.current = null;
        setDx(0);
        if (moved <= -90) setVerify("edit");
        else if (moved >= 90) setVerify("delete");
      }}
      onPointerLeave={() => {
        cancel();
        setDx(0);
        startX.current = null;
      }}
      onPointerCancel={() => {
        cancel();
        setDx(0);
        startX.current = null;
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {clientId ? (
            <Link
              to="/client/$id"
              params={{ id: clientId }}
              className="truncate font-semibold hover:underline"
              onClick={(e) => {
                if (longPressed.current || dx !== 0) e.preventDefault();
              }}
            >
              {name}
            </Link>
          ) : (
            <span className="truncate font-semibold">{name}</span>
          )}
          {txn.note ? <StickyNote className="size-3.5 shrink-0 text-muted-foreground" /> : null}
        </div>
        <p className="num mt-0.5 text-xs text-muted-foreground">
          {showDate ? `${formatDateShort(txn.at)} · ` : ""}
          {formatTime(txn.at)}
        </p>
        {txn.note ? <p className="mt-1 text-xs text-muted-foreground">{txn.note}</p> : null}
        {txn.photos && txn.photos.length > 0 ? (
          <div className="mt-2 flex gap-1.5">
            {txn.photos.map((p, i) => (
              <img
                key={i}
                src={p}
                alt="مرفق"
                className="size-12 rounded-lg border border-border object-cover"
              />
            ))}
          </div>
        ) : null}
      </div>

      <span
        className={`shrink-0 text-base font-bold ${isDebt ? "text-destructive" : "text-success"}`}
      >
        <span className="num">{isDebt ? "+" : "−"}</span>
        <Money value={txn.amount} />
      </span>

      <Sheet open={actions} onOpenChange={setActions}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="text-right">{name}</SheetTitle>
          </SheetHeader>
          <div className="space-y-2 p-4 pt-0">
            <button
              onClick={() => {
                setActions(false);
                setVerify("edit");
              }}
              className="flex w-full items-center gap-3 rounded-xl bg-secondary p-4 text-right font-semibold"
            >
              <Pencil className="size-5" /> تعديل العملية
            </button>
            <button
              onClick={() => {
                setActions(false);
                setVerify("delete");
              }}
              className="flex w-full items-center gap-3 rounded-xl bg-destructive/10 p-4 text-right font-semibold text-destructive"
            >
              <Trash2 className="size-5" /> حذف العملية
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <TxnDialog open={edit} onOpenChange={setEdit} kind={kind} txn={txn} />

      <VerifyDialog
        open={verify !== null}
        onOpenChange={(v) => !v && setVerify(null)}
        title={verify === "edit" ? "تأكيد تعديل العملية" : "تأكيد حذف العملية"}
        onSuccess={() => {
          if (verify === "edit") setEdit(true);
          else setConfirm(true);
          setVerify(null);
        }}
      />

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف العملية؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذفها من القسم الخاص بها ومن التقارير.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteTxn(kind, txn.id);
                toast.success("تم الحذف");
              }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </div>
  );
}
