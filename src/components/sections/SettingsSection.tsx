import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Bell,
  Camera,
  Code2,
  Download,
  Fingerprint,
  ImagePlus,
  KeyRound,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  Upload,
  User,
  MoreVertical,
  RotateCcw,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { compressFile } from "@/lib/image";
import { VerifyDialog } from "@/components/AppLock";
import { TrashSection } from "@/components/sections/TrashSection";
import {
  getState,
  replaceState,
  updateSettings,
  useAppState,
  type AppState,
} from "@/lib/store";
import {
  biometricSupported,
  biometricAvailable,
  clearBiometric,
  hasBiometricCredential,
  registerBiometric,
} from "@/lib/biometric";
import {
  notificationPermission,
  refreshNotificationPermission,
  requestNotificationPermission,
  runReminderCheck,
} from "@/lib/notify";
import {
  createBackup,
  deleteBackup,
  downloadBackup,
  backupFileName,
  formatSize,
  listBackups,
  restoreBackup,
  subscribeBackups,
} from "@/lib/backup";

const DEV = {
  name: "أحمد الصعفاني",
  version: "1.0.0",
  phone: "777981012",
  email: "",
};

export function SettingsSection() {
  const { settings } = useAppState();
  const [pinOpen, setPinOpen] = useState(false);
  const [verify, setVerify] = useState<"lock" | "sensitive" | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [showBackups, setShowBackups] = useState(false);
  const [perm, setPerm] = useState<ReturnType<typeof notificationPermission>>(() =>
    notificationPermission(),
  );
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void refreshNotificationPermission().then(setPerm);
  }, []);

  function exportBackup() {
    const data = JSON.stringify(getState(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFileName();
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم إنشاء النسخة الاحتياطية");
  }

  async function importBackup(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as AppState;
      if (!parsed || !Array.isArray(parsed.clients)) throw new Error("bad");
      replaceState(parsed);
      toast.success("تم استعادة النسخة الاحتياطية");
    } catch {
      toast.error("ملف غير صالح");
    }
  }

  async function toggleBiometric(next: boolean) {
    if (!next) {
      clearBiometric();
      updateSettings({ biometric: false });
      return;
    }
    if (!biometricSupported() || !(await biometricAvailable())) {
      toast.error(lastBiometricError() || "لا توجد بصمة مسجّلة أو مدعومة على هذا الجهاز");
      return;
    }
    const ok = await registerBiometric(settings.userName);
    if (ok) {
      updateSettings({ biometric: true });
      toast.success("تم تفعيل البصمة");
    } else {
      toast.error(lastBiometricError() || "تعذر تفعيل البصمة");
    }
  }

  async function toggleNotifications(kind: "notifyLedger" | "notifyDaily", v: boolean) {
    if (v) {
      const ok = await requestNotificationPermission();
      setPerm(notificationPermission());
      if (!ok) {
        toast.error("لم يتم السماح بالإشعارات على هذا الجهاز");
        return;
      }
    }
    updateSettings({ [kind]: v } as never);
  }

  if (showTrash) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setShowTrash(false)}
          className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-semibold"
        >
          رجوع إلى الإعدادات
        </button>
        <TrashSection />
      </div>
    );
  }

  if (showBackups) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setShowBackups(false)}
          className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-semibold"
        >
          رجوع إلى الإعدادات
        </button>
        <Section title="النسخ المحفوظة" icon={<Download className="size-4" />}>
          <p className="text-xs text-muted-foreground">
            جميع النسخ مرتّبة من الأحدث إلى الأقدم — يمكنك استعادتها أو تصديرها أو حذفها.
          </p>
          <BackupManager mode="list" />
        </Section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ===== الأمان والخصوصية ===== */}
      <Section title="الأمان والخصوصية" icon={<ShieldCheck className="size-4" />}>
        <Row label="قفل فتح التطبيق" hint="طلب الرمز عند فتح التطبيق فقط">
          <Switch
            checked={settings.lockEnabled}
            onCheckedChange={(v) => {
              if (v && !settings.pin) {
                setPinOpen(true);
                return;
              }
              if (!v) {
                setVerify("lock");
                return;
              }
              updateSettings({ lockEnabled: true });
            }}
          />
        </Row>
        <Row
          label="حماية العمليات الحساسة"
          hint="طلب الرمز عند الحذف أو التصفير أو إعادة التعيين"
        >
          <Switch
            checked={settings.sensitiveLock}
            onCheckedChange={(v) => {
              if (v && !settings.pin) {
                setPinOpen(true);
                return;
              }
              if (!v) {
                setVerify("sensitive");
                return;
              }
              updateSettings({ sensitiveLock: true });
            }}
          />
        </Row>
        {settings.sensitiveLock && (
          <div className="space-y-3 rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">
              حذف العميل وتصفير حسابه محميان دائمًا. اختر ما تريد حمايته إضافيًا:
            </p>
            <Row label="حذف العملية" hint="طلب الرمز عند حذف عملية دين أو سداد">
              <Switch
                checked={settings.sensitiveDelete}
                onCheckedChange={(v) => updateSettings({ sensitiveDelete: v })}
              />
            </Row>
            <Row label="تعديل العملية" hint="طلب الرمز عند تعديل عملية">
              <Switch
                checked={settings.sensitiveEdit}
                onCheckedChange={(v) => updateSettings({ sensitiveEdit: v })}
              />
            </Row>
          </div>
        )}
        <Row label="البصمة" hint="فتح سريع بالبصمة بدل الرمز">
          <Switch
            checked={settings.biometric}
            disabled={!settings.pin}
            onCheckedChange={(v) => void toggleBiometric(v)}
          />
        </Row>
        <Button variant="secondary" className="w-full" onClick={() => setPinOpen(true)}>
          <KeyRound className="size-4" /> {settings.pin ? "تغيير رمز PIN" : "إنشاء رمز PIN"}
        </Button>
        <p className="text-xs text-muted-foreground">
          كل البيانات محفوظة على جهازك فقط ولا تُرسل إلى أي خادم.
        </p>
      </Section>

      {/* ===== الإشعارات ===== */}
      <Section title="الإشعارات والتنبيهات" icon={<Bell className="size-4" />}>
        <Row
          label="تفعيل التنبيهات"
          hint="إيقاف مؤقت شامل — لا يحذف إعدادات تنبيهات العملاء"
        >
          <Switch
            checked={settings.notifyEnabled}
            onCheckedChange={(v) => updateSettings({ notifyEnabled: v })}
          />
        </Row>
        <Row label="تنبيه متابعة المديونية" hint="تذكير بالعملاء الذين تأخر سدادهم">
          <Switch
            checked={settings.notifyLedger}
            onCheckedChange={(v) => void toggleNotifications("notifyLedger", v)}
          />
        </Row>
        <div className="space-y-2">
          <Label htmlFor="nl">التذكير بعد (أيام) بدون سداد</Label>
          <Input
            id="nl"
            className="num"
            inputMode="numeric"
            value={String(settings.notifyLedgerDays)}
            onChange={(e) =>
              updateSettings({ notifyLedgerDays: Number(e.target.value.replace(/\D/g, "")) || 1 })
            }
          />
        </div>

        <Row label="تنبيه ديون اليومية" hint="تذكير بالديون اليومية غير المسددة">
          <Switch
            checked={settings.notifyDaily}
            onCheckedChange={(v) => void toggleNotifications("notifyDaily", v)}
          />
        </Row>
        <div className="space-y-2">
          <Label htmlFor="nd">التذكير بعد (أيام) من تسجيل الدين</Label>
          <Input
            id="nd"
            className="num"
            inputMode="numeric"
            value={String(settings.notifyDailyDays)}
            onChange={(e) =>
              updateSettings({ notifyDailyDays: Number(e.target.value.replace(/\D/g, "")) || 1 })
            }
          />
        </div>

        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            const due = runReminderCheck();
            toast.success(due.length ? `تم إرسال ${due.length} تنبيهًا` : "لا توجد تنبيهات مستحقة");
          }}
        >
          <Bell className="size-4" /> فحص التنبيهات الآن
        </Button>
        {perm === "unsupported" && (
          <p className="text-xs text-muted-foreground">الإشعارات غير مدعومة على هذا الجهاز.</p>
        )}
        {perm === "denied" && (
          <p className="text-xs text-destructive">
            الإشعارات محظورة من إعدادات المتصفح — فعّلها للسماح بالتنبيهات.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          يمكنك كتم التنبيهات أو تخصيص عدد الأيام لكل عميل من صفحة معلومات العميل.
        </p>
      </Section>

      {/* ===== معلومات المستخدم ===== */}
      <ProfileCard />

      {/* ===== المحذوفات ===== */}
      <Section title="المحذوفات" icon={<Trash2 className="size-4" />}>
        <Button variant="secondary" className="w-full" onClick={() => setShowTrash(true)}>
          <Trash2 className="size-4" /> فتح المحذوفات
        </Button>
      </Section>

      {/* ===== النسخ الاحتياطي ===== */}
      <Section title="النسخ الاحتياطي" icon={<Download className="size-4" />}>
        <BackupManager />
        <Button variant="secondary" className="w-full" onClick={() => setShowBackups(true)}>
          <RotateCcw className="size-4" /> النسخ المحفوظة
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={exportBackup}>
            <Download className="size-4" /> تصدير ملف
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> استيراد ملف
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importBackup(f);
            e.target.value = "";
          }}
        />
        <p className="text-xs text-muted-foreground">
          نسخة تلقائية واحدة لكل يوم تفتح فيه التطبيق، مع الاحتفاظ بآخر 7 نسخ تلقائية — كل شيء محفوظ على جهازك.
        </p>
      </Section>

      {/* ===== مطور التطبيق ===== */}
      <Section title="مطور التطبيق" icon={<Code2 className="size-4" />}>
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-lg font-extrabold text-primary">
            {DEV.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{DEV.name}</p>
            <p className="num text-xs text-muted-foreground">الإصدار {DEV.version}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <DevLink
            icon={<Phone className="size-4" />}
            label="اتصال"
            href={DEV.phone ? `tel:${DEV.phone}` : null}
          />
          <DevLink
            icon={<MessageCircle className="size-4" />}
            label="واتساب"
            href={DEV.phone ? `https://wa.me/${DEV.phone.replace(/\D/g, "")}` : null}
          />
          <DevLink
            icon={<Mail className="size-4" />}
            label="بريد"
            href={DEV.email ? `mailto:${DEV.email}` : null}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          تطبيق «دفتري» لإدارة الديون — يعمل بالكامل بدون إنترنت.
        </p>
      </Section>

      <PinDialog open={pinOpen} onOpenChange={setPinOpen} />
      <VerifyDialog
        open={verify !== null}
        onOpenChange={(v) => !v && setVerify(null)}
        title={verify === "lock" ? "تعطيل قفل الفتح" : "تعطيل حماية العمليات"}
        onSuccess={() => {
          if (verify === "lock") updateSettings({ lockEnabled: false });
          else updateSettings({ sensitiveLock: false });
          setVerify(null);
        }}
      />
    </div>
  );
}

function DevLink({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string | null;
}) {
  if (!href) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-xl bg-secondary/50 p-3 text-xs font-semibold text-muted-foreground">
        {icon}
        {label}
      </div>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex flex-col items-center gap-1 rounded-xl bg-secondary p-3 text-xs font-semibold"
    >
      {icon}
      {label}
    </a>
  );
}

function ProfileCard() {
  const { settings } = useAppState();
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      updateSettings({ logo: await compressFile(file) });
    } catch {
      toast.error("تعذر معالجة الصورة");
    }
    setBusy(false);
  }

  return (
    <div className="card-soft overflow-hidden">
      <div className="bg-primary p-4 text-primary-foreground">
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="تغيير صورة المتجر"
              disabled={busy}
              className="relative shrink-0 rounded-2xl outline-none"
            >
              {settings.logo ? (
                <img
                  src={settings.logo}
                  alt="شعار المتجر"
                  className="size-16 rounded-2xl border border-primary-foreground/25 object-cover"
                />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-2xl border border-primary-foreground/25 bg-primary-foreground/15">
                  <User className="size-7" />
                </div>
              )}
              <span className="absolute -bottom-1 -left-1 flex size-6 items-center justify-center rounded-full bg-primary-foreground text-primary shadow">
                <Camera className="size-3.5" />
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => camRef.current?.click()}>
                <Camera className="size-4" /> الكاميرا
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => galRef.current?.click()}>
                <ImagePlus className="size-4" /> المعرض
              </DropdownMenuItem>
              {settings.logo && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => updateSettings({ logo: "" })}
                >
                  <Trash2 className="size-4" /> حذف الصورة
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            ref={camRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void pick(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={galRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void pick(e.target.files);
              e.target.value = "";
            }}
          />

          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold">
              {settings.shopName || settings.userName || "بيانات المتجر"}
            </p>
            <p className="num text-xs opacity-85">{settings.userPhone || "أضف رقم التواصل"}</p>
            {busy && <p className="text-[11px] opacity-85">جارٍ معالجة الصورة…</p>}
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="space-y-2">
          <Label htmlFor="shop">اسم المتجر / النشاط</Label>
          <Input
            id="shop"
            value={settings.shopName}
            onChange={(e) => updateSettings({ shopName: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="uname">اسمك</Label>
          <Input
            id="uname"
            value={settings.userName}
            onChange={(e) => updateSettings({ userName: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="uphone">رقم الهاتف</Label>
          <Input
            id="uphone"
            className="num"
            inputMode="tel"
            value={settings.userPhone}
            onChange={(e) => updateSettings({ userPhone: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="uaddr">العنوان</Label>
          <Input
            id="uaddr"
            placeholder="اختياري — المدينة أو موقع المتجر"
            value={settings.address ?? ""}
            onChange={(e) => updateSettings({ address: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card-soft space-y-3 p-4">
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <h3 className="font-bold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <p className="font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function PinDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { settings } = useAppState();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  function save() {
    if (settings.pin && current !== settings.pin) {
      toast.error("الرمز الحالي غير صحيح");
      return;
    }
    if (!/^\d{4}$/.test(next)) {
      toast.error("الرمز يجب أن يكون 4 أرقام");
      return;
    }
    if (next !== confirm) {
      toast.error("الرمزان غير متطابقين");
      return;
    }
    updateSettings({ pin: next });
    toast.success("تم حفظ الرمز");
    setCurrent("");
    setNext("");
    setConfirm("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fingerprint className="size-5" /> رمز الحماية
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {settings.pin && (
            <div className="space-y-2">
              <Label htmlFor="cur">الرمز الحالي</Label>
              <Input
                id="cur"
                type="password"
                inputMode="numeric"
                maxLength={4}
                className="num text-center text-lg"
                value={current}
                onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="new">الرمز الجديد (4 أرقام)</Label>
            <Input
              id="new"
              type="password"
              inputMode="numeric"
              maxLength={4}
              className="num text-center text-lg"
              value={next}
              onChange={(e) => setNext(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="conf">تأكيد الرمز</Label>
            <Input
              id="conf"
              type="password"
              inputMode="numeric"
              maxLength={4}
              className="num text-center text-lg"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={save}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function backupTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("ar-EG")} · ${d.toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function BackupManager({ mode = "summary" }: { mode?: "summary" | "list" }) {
  const backups = useSyncExternalStore(subscribeBackups, listBackups, () => []);
  const [confirm, setConfirm] = useState<{ id: string; action: "restore" | "delete" } | null>(
    null,
  );
  const latest = backups[0];

  return (
    <div className="space-y-3">
      {mode === "summary" && (
        <>
      {/* آخر نسخة احتياطية */}
      <div className="rounded-xl border border-border bg-secondary/40 p-3">
        <p className="text-xs font-semibold text-muted-foreground">آخر نسخة احتياطية</p>
        {latest ? (
          <>
            <p className="num mt-1 text-sm font-bold">{backupTime(latest.at)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {latest.kind === "auto" ? "تلقائية" : "يدوية"} · {formatSize(latest.size)} ·{" "}
              <span className="font-semibold text-success">ناجحة</span>
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">لا توجد نسخ محفوظة بعد</p>
        )}
      </div>

      <Button
        className="w-full"
        onClick={() => {
          const res = createBackup("manual");
          if (res.ok) toast.success("تم إنشاء نسخة احتياطية");
          else if (res.reason === "duplicate")
            toast.info("لا توجد تغييرات جديدة منذ آخر نسخة يدوية");
          else toast.error("تعذر إنشاء النسخة — لم يتم حذف أي نسخة سابقة");
        }}
      >
        <Download className="size-4" /> إنشاء نسخة احتياطية الآن
      </Button>
        </>
      )}

      {mode === "list" && backups.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">لا توجد نسخ محفوظة بعد</p>
      )}

      {mode === "list" &&
        backups.map((b, idx) => (
        <div key={b.id} className="flex items-center gap-2 rounded-xl border border-border p-3">
          <div className="min-w-0 flex-1">
            <p className="num text-sm font-bold">
              {backupTime(b.at)}
              {idx === 0 && (
                <span className="mr-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  الأحدث
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {b.kind === "auto" ? "تلقائية" : "يدوية"} · {formatSize(b.size)} ·{" "}
              <span className="text-success">ناجحة</span>
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
              aria-label="خيارات النسخة"
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => setConfirm({ id: b.id, action: "restore" })}>
                <RotateCcw className="size-4" /> استعادة
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  if (!downloadBackup(b.id)) toast.error("تعذر تصدير النسخة");
                }}
              >
                <Download className="size-4" /> تصدير النسخة
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirm({ id: b.id, action: "delete" })}
              >
                <Trash2 className="size-4" /> حذف
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}

      <AlertDialog open={confirm !== null} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === "restore" ? "استعادة هذه النسخة؟" : "حذف هذه النسخة؟"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === "restore"
                ? "سيتم استبدال جميع البيانات الحالية ببيانات النسخة المختارة."
                : "سيتم حذف النسخة الاحتياطية نهائيًا ولا يمكن التراجع."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirm) return;
                if (confirm.action === "restore") {
                  if (restoreBackup(confirm.id)) toast.success("تمت الاستعادة");
                  else toast.error("تعذرت الاستعادة");
                } else {
                  deleteBackup(confirm.id);
                  toast.success("تم حذف النسخة");
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

