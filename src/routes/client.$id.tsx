import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Archive,
  ArchiveRestore,
  BellOff,
  Contact,
  Eraser,
  FileText,
  MoreVertical,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PhotoInput } from "@/components/PhotoInput";
import { ClientAvatar } from "@/components/ClientAvatar";
import { TxnRow } from "@/components/TxnRow";
import { TxnDialog } from "@/components/TxnDialog";
import { VerifyDialog } from "@/components/AppLock";
import { ReportDialog } from "@/components/ReportDialog";
import { ImageViewer } from "@/components/ImageViewer";
import { pickContactDetailed } from "@/lib/contacts";
import { shareUrlFor } from "@/lib/share";
import { buildClientReport, type ReportData } from "@/lib/report";
import { Money } from "@/components/Riyal";
import {
  ALERT_INTERVALS,
  accountTxns,
  alertFor,
  balanceOf,
  deleteClient,
  getState,
  loadState,
  removeAlert,
  resetClientAccount,
  setAlert,
  setArchived,
  updateClient,
  useAppState,
  type Client,
} from "@/lib/store";


export const Route = createFileRoute("/client/$id")({
  head: () => ({
    meta: [
      { title: "حساب العميل — دفتر الديون" },
      { name: "description", content: "تفاصيل مديونية العميل وعمليات الدين والسداد الخاصة به." },
      { property: "og:title", content: "حساب العميل — دفتر الديون" },
      {
        property: "og:description",
        content: "تفاصيل مديونية العميل وعمليات الدين والسداد الخاصة به.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClientPage,
});

function ClientPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const state = useAppState();
  const [ready, setReady] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addKind, setAddKind] = useState<"debt" | "payment" | null>(null);
  const [pendingAction, setPendingAction] = useState<"reset" | "delete" | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [confirm, setConfirm] = useState<"reset" | "delete" | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  useEffect(() => {
    loadState();
    setReady(true);
  }, []);

  const client = state.clients.find((c) => c.id === id);

  const txns = useMemo(() => {
    const { debts, payments } = accountTxns(state, id);
    return [
      ...debts.map((t) => ({ t, kind: "debt" as const })),
      ...payments.map((t) => ({ t, kind: "payment" as const })),
    ].sort((a, b) => +new Date(b.t.at) - +new Date(a.t.at));
  }, [state, id]);


  if (!ready) return <div className="min-h-screen bg-background" />;

  if (!client) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6">
        <p className="font-semibold">العميل غير موجود</p>
        <Button asChild variant="secondary">
          <Link to="/">رجوع</Link>
        </Button>
      </div>
    );
  }

  const balance = balanceOf(state, client.id);

  /** العمليات الحساسة: تُطلب الهوية إذا كانت حماية العمليات مفعّلة */
  function runProtected(action: "reset" | "delete") {
    if (state.settings.sensitiveLock && state.settings.pin) {
      setPendingAction(action);
      setVerifyOpen(true);
      return;
    }
    setConfirm(action);
  }

  async function shareAccount() {
    const url = shareUrlFor(getState(), id);
    if (!url) {
      toast.error("تعذر إنشاء رابط المتابعة");
      return;
    }
    const text = `متابعة حسابك لدى ${getState().settings.shopName || "دفتري"}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: text, text, url });
        toast.success("تمت مشاركة الرابط");
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("تم نسخ رابط المتابعة");
    } catch {
      toast.error("تعذر نسخ الرابط على هذا الجهاز");
    }
  }




  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/90 px-3 py-3 backdrop-blur">
        <Link to="/" className="rounded-lg p-2 hover:bg-secondary" aria-label="رجوع">
          <ArrowRight className="size-5" />
        </Link>
        <h1 className="flex-1 truncate text-lg font-extrabold">{client.name}</h1>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary"
            aria-label="خيارات إضافية"
          >
            <MoreVertical className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Pencil className="size-4" /> تعديل بيانات العميل
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setReport(buildClientReport(getState(), id))}>
              <FileText className="size-4" /> كشف حساب PDF
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void shareAccount()}>
              <Share2 className="size-4" /> مشاركة الرابط
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                const next = client.archived !== true;
                setArchived(client.id, next);
                toast.success(next ? "تمت أرشفة العميل" : "تمت إعادة العميل إلى المديونية");
              }}
            >
              {client.archived ? (
                <>
                  <ArchiveRestore className="size-4" /> إلغاء الأرشفة
                </>
              ) : (
                <>
                  <Archive className="size-4" /> أرشفة العميل
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => runProtected("reset")}>
              <Eraser className="size-4" /> تصفير الحساب
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => runProtected("delete")}>
              <Trash2 className="size-4" /> حذف العميل
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <div className="card-soft flex items-center gap-4 p-4">
          {client.photo ? (
            <button
              type="button"
              aria-label="عرض صورة العميل"
              onClick={() => setViewPhoto(client.photo ?? null)}
            >
              <ClientAvatar name={client.name} photo={client.photo} size="lg" />
            </button>
          ) : (
            <ClientAvatar name={client.name} photo={client.photo} size="lg" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">{client.name}</p>
            {client.phone ? (
              <a href={`tel:${client.phone}`} className="num text-sm text-muted-foreground">
                {client.phone}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">لا يوجد رقم</p>
            )}
          </div>
          <div className="text-left">
            <p className="text-xs text-muted-foreground">
              {balance > 0 ? "المديونية" : "الرصيد"}
            </p>
            <p
              className={`num text-2xl font-extrabold ${balance > 0 ? "text-destructive" : "text-success"}`}
            >
              <Money value={balance} />
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setAddKind("debt")}>إضافة دين</Button>
          <Button variant="secondary" onClick={() => setAddKind("payment")}>
            إضافة سداد
          </Button>
        </div>



        <div className="space-y-2">
          <p className="px-1 text-sm font-semibold text-muted-foreground">
            العمليات ({txns.length})
          </p>
          {txns.length === 0 && (
            <div className="card-soft p-8 text-center text-sm text-muted-foreground">
              لا توجد عمليات
            </div>
          )}
          {txns.map(({ t, kind }) => (
            <TxnRow key={t.id} txn={t} kind={kind} name={client.name} showDate />
          ))}
        </div>
      </main>

      <ClientInfoDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        client={client}
      />

      <ReportDialog
        open={report !== null}
        onOpenChange={(v) => !v && setReport(null)}
        data={report}
      />


      <TxnDialog
        open={addKind !== null}
        onOpenChange={(v) => !v && setAddKind(null)}
        kind={addKind ?? "debt"}
        lockedClientId={client.id}
        scope="ledger"

      />

      <VerifyDialog
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        title="تأكيد الهوية"
        onSuccess={() => setConfirm(pendingAction)}
      />

      <AlertDialog open={confirm !== null} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "delete" ? "حذف العميل نهائيًا؟" : "تصفير حساب العميل؟"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete"
                ? "سيتم حذف العميل وجميع عملياته من كل الأقسام. لا يمكن التراجع."
                : "سيتم حذف جميع عمليات الدين والسداد مع بقاء العميل في المديونية. لا يمكن التراجع."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm === "delete") {
                  deleteClient(client.id);
                  toast.success("تم حذف العميل");
                  void navigate({ to: "/" });
                } else {
                  resetClientAccount(client.id);
                  toast.success("تم تصفير الحساب");
                }
                setConfirm(null);
              }}
            >
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClientInfoDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: Client;
}) {
  const state = useAppState();
  const rule = alertFor(state, client.id);
  const [n, setN] = useState(client.name);
  const [p, setP] = useState(client.phone ?? "");
  const [photos, setPhotos] = useState<string[]>(client.photo ? [client.photo] : []);

  useEffect(() => {
    if (open) {
      setN(client.name);
      setP(client.phone ?? "");
      setPhotos(client.photo ? [client.photo] : []);
    }
  }, [open, client]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>معلومات العميل</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="en">الاسم</Label>
            <Input id="en" value={n} onChange={(e) => setN(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ep">رقم الهاتف</Label>
            <div className="flex gap-2">
              <Input
                id="ep"
                className="num flex-1"
                inputMode="tel"
                value={p}
                onChange={(e) => setP(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="اختيار من جهات الاتصال"
                onClick={() => {
                  void (async () => {
                    const res = await pickContactDetailed();
                    if (!res.ok) {
                      if (res.reason === "denied")
                        toast.error("لم يتم السماح بالوصول إلى جهات الاتصال");
                      else if (res.reason === "unsupported")
                        toast.error("جهات الاتصال غير مدعومة على هذا الجهاز");
                      else if (res.reason === "error") toast.error("تعذر فتح جهات الاتصال");
                      return;
                    }
                    if (res.contact.phone) setP(res.contact.phone);
                    if (res.contact.name && !n.trim()) setN(res.contact.name);
                  })();
                }}
              >
                <Contact className="size-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>الصورة</Label>
            <PhotoInput photos={photos} onChange={setPhotos} single />
          </div>

          <div className="space-y-3 rounded-xl border border-border p-3">
            <p className="flex items-center gap-2 text-sm font-bold">
              <BellOff className="size-4" /> تذكير متابعة هذا العميل
            </p>
            <p className="text-xs text-muted-foreground">
              تنبيه واحد فقط لكل عميل — اختيار تكرار جديد يستبدل التذكير القديم، ويُلغى تلقائيًا
              عند سداد كامل المبلغ.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {ALERT_INTERVALS.map((i) => {
                const on = rule?.everyDays === i.days;
                return (
                  <button
                    key={i.days}
                    type="button"
                    onClick={() => {
                      setAlert(client.id, i.days);
                      toast.success(`تم ضبط التذكير: ${i.label}`);
                    }}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground"
                    }`}
                  >
                    {i.label}
                  </button>
                );
              })}
            </div>
            {rule && (
              <Button
                variant="ghost"
                className="w-full text-destructive"
                onClick={() => {
                  removeAlert(client.id);
                  toast.success("تم إلغاء التذكير");
                }}
              >
                إلغاء التذكير
              </Button>
            )}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">كتم إشعارات النظام</p>
                <p className="text-xs text-muted-foreground">
                  يبقى التنبيه ظاهرًا في مركز التنبيهات دون إشعار
                </p>
              </div>
              <Switch
                checked={client.notifyMuted === true}
                onCheckedChange={(v) => updateClient(client.id, { notifyMuted: v })}
              />
            </div>
          </div>


        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            onClick={() => {
              if (!n.trim()) {
                toast.error("الاسم مطلوب");
                return;
              }
              updateClient(client.id, {
                name: n.trim(),
                phone: p.trim(),
                photo: photos[0] ?? "",
              });
              toast.success("تم الحفظ");
              onOpenChange(false);
            }}
          >
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
