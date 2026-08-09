import { dueAlerts, getState, rollAlert, daysSince } from "@/lib/store";
import { formatMoney } from "@/lib/format";

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  const res = await Notification.requestPermission();
  return res === "granted";
}

export type Severity = "normal" | "elevated" | "high" | "urgent";

/**
 * درجة أهمية التنبيه:
 * تعتمد على مدة التأخير وحجم المبلغ المستحق — الإيموجي يُستخدم فقط
 * في الدرجات الأعلى حتى لا تبدو الإشعارات مبالغًا فيها.
 */
export function severityOf(amount: number, overdueDays: number): Severity {
  if (amount >= 50_000 || overdueDays >= 30) return "urgent";
  if (amount >= 20_000 || overdueDays >= 14) return "high";
  if (overdueDays >= 3) return "elevated";
  return "normal";
}

export function severityEmoji(s: Severity) {
  return s === "urgent" ? "😨" : s === "high" ? "😰" : s === "elevated" ? "😟" : "";
}

/** نص عنوان التنبيه حسب درجة أهميته */
export function alertTitle(name: string, severity: Severity) {
  const e = severityEmoji(severity);
  if (severity === "urgent") return `${e} تنبيه عاجل: ${name}`;
  if (severity === "high") return `${e} تنبيه مهم: ${name}`;
  if (severity === "elevated") return `${e} تذكير: ${name}`;
  return `تذكير: ${name}`;
}

export function alertBody(
  amount: number,
  currency: string,
  overdueDays: number,
  severity: Severity,
) {
  void currency;
  const money = `\uFDFC ${formatMoney(amount)}`;
  if (severity === "urgent") return `مبلغ مستحق كبير يحتاج إلى متابعة فورية — ${money}`;
  if (severity === "high") return `لديه مبلغ مستحق قدره ${money}`;
  if (severity === "elevated") return `لديه مبلغ مستحق منذ ${overdueDays} أيام — ${money}`;
  return `المتبقي ${money}`;
}

/**
 * فحص التنبيهات المستحقة: يعرض التنبيه ثم يعيد جدولة نفس التنبيه
 * بدل إنشاء سلسلة تنبيهات جديدة.
 */
export function runReminderCheck() {
  const state = getState();
  const due = dueAlerts(state);
  if (!due.length) return [];

  const canNotify = notificationsSupported() && Notification.permission === "granted";
  const currency = state.settings.currency;

  for (const a of due) {
    if (canNotify && !a.client.notifyMuted) {
      const overdue = daysSince(a.rule.lastNotifiedAt ?? a.rule.createdAt);
      const sev = severityOf(a.remaining, overdue);
      try {
        new Notification(alertTitle(a.client.name, sev), {
          body: alertBody(a.remaining, currency, overdue, sev),
          icon: "/icon-192.png",
          tag: `alert-${a.client.id}`,
        });
      } catch {
        /* تجاهل */
      }
    }
    rollAlert(a.client.id);
  }
  return due;
}

/** تشغيل الفحص عند فتح التطبيق ثم كل ساعة */
export function startReminderLoop() {
  if (typeof window === "undefined") return () => {};
  const t = setTimeout(() => runReminderCheck(), 3000);
  const i = setInterval(() => runReminderCheck(), 60 * 60 * 1000);
  return () => {
    clearTimeout(t);
    clearInterval(i);
  };
}
