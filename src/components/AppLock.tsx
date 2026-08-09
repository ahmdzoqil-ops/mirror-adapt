import { useEffect, useState } from "react";
import { Fingerprint, Delete, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppState } from "@/lib/store";
import { hasBiometricCredential, verifyBiometric } from "@/lib/biometric";

function PinPad({
  title,
  subtitle,
  expected,
  allowBiometric,
  onSuccess,
}: {
  title: string;
  subtitle?: string;
  expected: string | null;
  allowBiometric: boolean;
  onSuccess: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (pin.length !== 4) return;
    if (expected && pin === expected) {
      setPin("");
      onSuccess();
    } else {
      setError(true);
      const t = setTimeout(() => {
        setPin("");
        setError(false);
      }, 600);
      return () => clearTimeout(t);
    }
    return;
  }, [pin, expected, onSuccess]);

  async function tryBiometric() {
    const ok = await verifyBiometric();
    if (ok) onSuccess();
  }

  useEffect(() => {
    if (allowBiometric && hasBiometricCredential()) void tryBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Lock className="size-7" />
        </div>
        <h2 className="text-lg font-bold">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="flex gap-3" dir="ltr">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`size-4 rounded-full border-2 transition-colors ${
              error
                ? "border-destructive bg-destructive"
                : i < pin.length
                  ? "border-primary bg-primary"
                  : "border-border"
            }`}
          />
        ))}
      </div>

      <div className="grid w-full grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
          <Button
            key={n}
            variant="secondary"
            className="h-14 text-xl font-bold"
            onClick={() => setPin((p) => (p.length < 4 ? p + n : p))}
          >
            {n}
          </Button>
        ))}
        {allowBiometric && hasBiometricCredential() ? (
          <Button variant="secondary" className="h-14" onClick={tryBiometric}>
            <Fingerprint className="size-6" />
          </Button>
        ) : (
          <span />
        )}
        <Button
          variant="secondary"
          className="h-14 text-xl font-bold"
          onClick={() => setPin((p) => (p.length < 4 ? p + "0" : p))}
        >
          0
        </Button>
        <Button variant="secondary" className="h-14" onClick={() => setPin((p) => p.slice(0, -1))}>
          <Delete className="size-6" />
        </Button>
      </div>
    </div>
  );
}

/** بوابة القفل عند فتح التطبيق */
export function AppLock({ children }: { children: React.ReactNode }) {
  const { settings } = useAppState();
  const [unlocked, setUnlocked] = useState(false);

  const locked = settings.lockEnabled && !!settings.pin && !unlocked;

  if (!locked) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <PinPad
        title="دفتري"
        subtitle="أدخل الرمز لفتح التطبيق"
        expected={settings.pin}
        allowBiometric={settings.biometric}
        onSuccess={() => setUnlocked(true)}
      />
    </div>
  );
}

/** تحقق قبل العمليات الحساسة (تصفير الحساب / حذف العمليات) */
export function VerifyDialog({
  open,
  onOpenChange,
  onSuccess,
  title = "تأكيد الهوية",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  title?: string;
}) {
  const { settings } = useAppState();
  const active = settings.sensitiveLock && !!settings.pin;

  useEffect(() => {
    if (open && !active) {
      onOpenChange(false);
      onSuccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!active) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center pb-2">
          <PinPad
            title="أدخل الرمز"
            subtitle="مطلوب لإتمام هذه العملية"
            expected={settings.pin}
            allowBiometric={settings.biometric}
            onSuccess={() => {
              onOpenChange(false);
              onSuccess();
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { PinPad };
