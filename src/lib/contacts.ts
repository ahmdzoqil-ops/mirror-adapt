/** اختيار جهة اتصال من الهاتف عبر Contact Picker API (يعمل على أندرويد/كروم) */

type ContactsManager = {
  select: (
    props: string[],
    opts?: { multiple?: boolean },
  ) => Promise<Array<{ name?: string[]; tel?: string[] }>>;
};

export function contactsSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { contacts?: ContactsManager };
  return !!nav.contacts && typeof nav.contacts.select === "function";
}

export async function pickContact(): Promise<{ name: string; phone: string } | null> {
  if (!contactsSupported()) return null;
  try {
    const nav = navigator as Navigator & { contacts?: ContactsManager };
    const result = await nav.contacts!.select(["name", "tel"], { multiple: false });
    const first = result?.[0];
    if (!first) return null;
    return {
      name: first.name?.[0] ?? "",
      phone: (first.tel?.[0] ?? "").replace(/\s+/g, ""),
    };
  } catch {
    return null;
  }
}
