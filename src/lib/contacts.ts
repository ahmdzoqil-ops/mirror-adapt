/**
 * اختيار جهة اتصال من الهاتف.
 * - داخل تطبيق أندرويد: إضافة Capacitor Contacts مع طلب الإذن عند الحاجة فقط.
 * - في الويب/PWA: Contact Picker API كما كان.
 */
import { Capacitor } from "@capacitor/core";

function isNative() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

type ContactsManager = {
  select: (
    props: string[],
    opts?: { multiple?: boolean },
  ) => Promise<Array<{ name?: string[]; tel?: string[] }>>;
};

export function contactsSupported(): boolean {
  if (isNative()) return true;
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { contacts?: ContactsManager };
  return !!nav.contacts && typeof nav.contacts.select === "function";
}

export type PickResult =
  | { ok: true; contact: { name: string; phone: string } }
  | { ok: false; reason: "denied" | "cancelled" | "unsupported" | "error" };

/** يعيد النتيجة مع سبب الفشل حتى تُعرض رسالة صحيحة للمستخدم */
export async function pickContactDetailed(): Promise<PickResult> {
  if (isNative()) {
    try {
      const { Contacts } = await import("@capacitor-community/contacts");
      // منتقي جهات الاتصال الأصلي لا يحتاج إذنًا، لكن قراءة الحقول تحتاجه
      let perm = await Contacts.checkPermissions().catch(() => null);
      if (!perm || perm.contacts !== "granted") {
        perm = await Contacts.requestPermissions().catch(() => null);
      }
      if (!perm || perm.contacts !== "granted") return { ok: false, reason: "denied" };

      const res = await Contacts.pickContact({
        projection: { name: true, phones: true },
      });
      const c = res?.contact;
      if (!c) return { ok: false, reason: "cancelled" };
      const display =
        c.name?.display ??
        [c.name?.given, c.name?.family].filter(Boolean).join(" ").trim();
      return {
        ok: true,
        contact: {
          name: display || "",
          phone: (c.phones?.[0]?.number ?? "").replace(/\s+/g, ""),
        },
      };
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      // إلغاء المستخدم للمنتقي يصل كخطأ في بعض إصدارات أندرويد
      if (/cancel/i.test(msg)) return { ok: false, reason: "cancelled" };
      if (/permission|denied/i.test(msg)) return { ok: false, reason: "denied" };
      return { ok: false, reason: "error" };
    }
  }

  if (!contactsSupported()) return { ok: false, reason: "unsupported" };
  try {
    const nav = navigator as Navigator & { contacts?: ContactsManager };
    const result = await nav.contacts!.select(["name", "tel"], { multiple: false });
    const first = result?.[0];
    if (!first) return { ok: false, reason: "cancelled" };
    return {
      ok: true,
      contact: {
        name: first.name?.[0] ?? "",
        phone: (first.tel?.[0] ?? "").replace(/\s+/g, ""),
      },
    };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export async function pickContact(): Promise<{ name: string; phone: string } | null> {
  const res = await pickContactDetailed();
  return res.ok ? res.contact : null;
}
