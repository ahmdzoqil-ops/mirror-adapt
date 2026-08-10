import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { bellItems, getState, rollAlert, daysSince, slotReached, todayKey } from "@/lib/store";
import { formatMoney } from "@/lib/format";

/** هل نعمل داخل تطبيق أندرويد (Capacitor) بدل المتصفح؟ */
export function isNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** آخر حالة معروفة لإذن الإشعارات داخل التطبيق الأصلي */
let nativePerm: "granted" | "denied" | "prompt" = "prompt";

export function notificationsSupported() {
  if (isNativeApp()) return true;
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (isNativeApp()) {
    if (nativePerm === "granted") return "granted";
    if (nativePerm === "denied") return "denied";
    return "default";
  }
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** قراءة حالة الإذن الحقيقية من النظام (أندرويد 13+ يحتاج إذنًا صريحًا) */
export async function refreshNotificationPermission() {
  if (isNativeApp()) {
    try {
      const res = await LocalNotifications.checkPermissions();
      nativePerm = res.display === "granted" ? "granted" : res.display === "denied" ? "denied" : "prompt";
    } catch {
      nativePerm = "prompt";
    }
  }
  return notificationPermission();
}

export async function requestNotificationPermission() {
  if (isNativeApp()) {
    try {
      let res = await LocalNotifications.checkPermissions();
      if (res.display !== "granted") res = await LocalNotifications.requestPermissions();
      nativePerm = res.display === "granted" ? "granted" : res.display === "denied" ? "denied" : "prompt";
      return nativePerm === "granted";
    } catch {
      return false;
    }
  }
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  const res = await Notification.requestPermission();
  return res === "granted";
}

/** عرض تنبيه واحد بالطريقة المناسبة للمنصة (نفس المحتوى تمامًا) */
function showNotification(title: string, body: string, tagId: number) {
  if (isNativeApp()) {
    void LocalNotifications.schedule({
      notifications: [{ id: tagId, title, body }],
    }).catch(() => {});
    return;
  }
  try {
    new Notification(title, { body, icon: "/icon-192.png", tag: `alert-${tagId}` });
  } catch {
    /* تجاهل */
  }
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

/** سجل ما أُرسل اليوم — يمنع تكرار نفس التنبيه لنفس السبب في نفس اليوم */
const SENT_KEY = "daftari-sent-alerts-v1";

function sentToday(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = JSON.parse(localStorage.getItem(SENT_KEY) ?? "{}") as {
      day?: string;
      keys?: string[];
    };
    if (raw.day !== todayKey()) return new Set();
    return new Set(raw.keys ?? []);
  } catch {
    return new Set();
  }
}

function markSent(keys: Set<string>) {
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify({ day: todayKey(), keys: [...keys] }));
  } catch {
    /* تجاهل */
  }
}

/**
 * فحص التنبيهات المستحقة.
 * - يحترم المفتاح الرئيسي للتنبيهات (إيقاف مؤقت شامل).
 * - يوزّع الإرسال حسب وقت العميل أو فترة ثابتة من اليوم بدل دفعة واحدة.
 * - لا يرسل نفس التنبيه مرتين في نفس اليوم.
 */
export function runReminderCheck(opts?: { force?: boolean }) {
  const state = getState();
  if (!state.settings.notifyEnabled) return [];

  const items = bellItems(state).filter((i) => i.due);
  if (!items.length) return [];

  const canNotify = notificationsSupported() && notificationPermission() === "granted";
  const currency = state.settings.currency;
  const sent = sentToday();
  const delivered: typeof items = [];

  for (const item of items) {
    if (sent.has(item.key)) continue;
    if (!opts?.force && !slotReached(item.clientId)) continue;

    const client = state.clients.find((c) => c.id === item.clientId);
    if (canNotify && client && !client.notifyMuted) {
      const overdue = daysSince(client.createdAt);
      const sev = severityOf(item.amount, overdue);
      showNotification(
        alertTitle(item.clientName, sev),
        alertBody(item.amount, currency, overdue, sev),
        Math.abs(hashId(item.key)),
      );
    }
    sent.add(item.key);
    delivered.push(item);
    if (item.key.startsWith("rule-")) rollAlert(item.clientId);
  }

  markSent(sent);
  return delivered;
}

function hashId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h % 100000;
}

/**
 * تشغيل الفحص عند فتح التطبيق ثم كل 15 دقيقة.
 * الفحص خفيف جدًا ولا يرسل شيئًا قبل بلوغ وقت التنبيه المخصص.
 */
export function startReminderLoop() {
  if (typeof window === "undefined") return () => {};
  void refreshNotificationPermission();
  const t = setTimeout(() => runReminderCheck(), 3000);
  const i = setInterval(() => runReminderCheck(), 15 * 60 * 1000);
  return () => {
    clearTimeout(t);
    clearInterval(i);
  };
}
