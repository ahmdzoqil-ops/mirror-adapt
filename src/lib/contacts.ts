/**
 * اختيار جهة اتصال من الهاتف.
 * - داخل تطبيق أندرويد: إضافة Capacitor Contacts مع طلب الإذن عند الحاجة فقط.
 * - في الويب/PWA: Contact Picker API كما كان.
 */
import { Capacitor } from "@capacitor/core";
import { Contacts } from "@capacitor-community/contacts";

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
  if (isNative()) return pickNative();

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

type NativeContact = {
  name?: { display?: string | null; given?: string | null; family?: string | null } | null;
  phones?: Array<{ number?: string | null }> | null;
};

function mapContact(c: NativeContact) {
  const display =
    c.name?.display ?? [c.name?.given, c.name?.family].filter(Boolean).join(" ").trim();
  return {
    name: (display || "").trim(),
    phone: (c.phones?.[0]?.number ?? "").replace(/[\s\u200f\u200e-]+/g, ""),
  };
}

/** حالة الإذن الفعلية على أندرويد (READ_CONTACTS) */
async function contactsPermission(): Promise<"granted" | "denied" | "prompt" | "unknown"> {
  try {
    const p = await Contacts.checkPermissions();
    return (p?.contacts as "granted" | "denied" | "prompt") ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * أندرويد: المنتقي الأصلي يعمل عبر Intent ولا يحتاج إذنًا،
 * لكن قراءة الأرقام تحتاج READ_CONTACTS. نطلب الإذن ثم نعيد فحص الحالة فعليًا،
 * ولا نعرض رسالة الرفض إلا إذا فشلت القراءة فعلًا بسبب الإذن.
 */
async function pickNative(): Promise<PickResult> {
  let perm = await contactsPermission();
  if (perm !== "granted") {
    try {
      const asked = await Contacts.requestPermissions();
      perm = (asked?.contacts as "granted" | "denied" | "prompt") ?? perm;
    } catch {
      /* نكمل ونجرّب المنتقي على أي حال */
    }
    // إعادة الفحص بعد الطلب — بعض إصدارات أندرويد تعيد قيمة قديمة في نتيجة الطلب
    if (perm !== "granted") perm = await contactsPermission();
  }

  try {
    const res = await Contacts.pickContact({ projection: { name: true, phones: true } });
    const c = res?.contact as NativeContact | undefined;
    if (!c) return { ok: false, reason: "cancelled" };

    const mapped = mapContact(c);
    // بعض الأجهزة لا تعيد الأرقام من المنتقي — نقرأها بالمعرّف عند توفر الإذن
    if (!mapped.phone && perm === "granted") {
      const id = (res.contact as unknown as { contactId?: string })?.contactId;
      if (id) {
        try {
          const full = await Contacts.getContact({
            contactId: id,
            projection: { name: true, phones: true },
          });
          const m2 = mapContact(full?.contact as NativeContact);
          if (m2.phone || m2.name) return { ok: true, contact: { ...mapped, ...m2 } };
        } catch {
          /* نتجاهل ونعيد ما توفر */
        }
      }
    }
    return { ok: true, contact: mapped };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (/cancel|abort|dismiss|no result|user/i.test(msg)) return { ok: false, reason: "cancelled" };
    if (/permission|denied|not granted/i.test(msg)) return { ok: false, reason: "denied" };
    return { ok: false, reason: "error" };
  }
}

export async function pickContact(): Promise<{ name: string; phone: string } | null> {
  const res = await pickContactDetailed();
  return res.ok ? res.contact : null;
}
