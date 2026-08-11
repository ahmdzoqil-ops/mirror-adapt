import { accountTxns, clientById, clientName, type AppState, type Txn } from "@/lib/store";
import { formatDateShort, formatMoney, riyalSvg } from "@/lib/format";

export type ReportRow = {
  at: string;
  kind: "debt" | "payment";
  amount: number;
  note?: string | undefined;
  balanceAfter: number;
  name?: string | undefined;
};

export type ReportData = {
  title: string;
  clientName?: string | undefined;
  clientPhone?: string | undefined;
  from: string;
  to: string;
  rows: ReportRow[];
  totalDebt: number;
  totalPay: number;
  balance: number;
  clientsCount: number;
  shop: string;
  owner: string;
  ownerPhone: string;
  logo: string;
  currency: string;
  issuedAt: string;
};

function head(s: AppState) {
  return {
    shop: s.settings.shopName || "دفتري",
    owner: s.settings.userName,
    ownerPhone: s.settings.userPhone,
    logo: s.settings.logo,
    currency: s.settings.currency,
    issuedAt: new Date().toISOString(),
  };
}

function build(rows: { t: Txn; kind: "debt" | "payment"; name?: string }[]): {
  rows: ReportRow[];
  totalDebt: number;
  totalPay: number;
} {
  const sorted = [...rows].sort((a, b) => +new Date(a.t.at) - +new Date(b.t.at));
  let running = 0;
  let totalDebt = 0;
  let totalPay = 0;
  const out: ReportRow[] = sorted.map(({ t, kind, name }) => {
    if (kind === "debt") {
      running += t.amount;
      totalDebt += t.amount;
    } else {
      running -= t.amount;
      totalPay += t.amount;
    }
    return { at: t.at, kind, amount: t.amount, note: t.note, balanceAfter: running, name };
  });
  return { rows: out, totalDebt, totalPay };
}

/** تقرير حساب عميل محدد */
export function buildClientReport(s: AppState, clientId: string): ReportData | null {
  const client = clientById(s, clientId);
  if (!client) return null;
  const { debts, payments } = accountTxns(s, clientId);
  const all = [
    ...debts.map((t) => ({ t, kind: "debt" as const })),
    ...payments.map((t) => ({ t, kind: "payment" as const })),
  ];
  const { rows, totalDebt, totalPay } = build(all);
  return {
    title: "كشف حساب عميل",
    clientName: client.name,
    clientPhone: client.phone ?? "",
    from: rows[0]?.at ?? client.createdAt,
    to: rows[rows.length - 1]?.at ?? new Date().toISOString(),
    rows,
    totalDebt,
    totalPay,
    balance: totalDebt - totalPay,
    clientsCount: 1,
    ...head(s),
  };
}

/** تقرير لفترة زمنية — لكل العملاء أو لعميل واحد */
export function buildRangeReport(
  s: AppState,
  from: string,
  to: string,
  title = "تقرير العمليات",
  clientId?: string,
): ReportData {
  const inRange = (t: Txn) =>
    t.at >= from && t.at <= to && (!clientId || t.clientId === clientId);
  const all = [
    ...s.debts.filter(inRange).map((t) => ({
      t,
      kind: "debt" as const,
      name: clientName(s, t.clientId),
    })),
    ...s.payments.filter(inRange).map((t) => ({
      t,
      kind: "payment" as const,
      name: clientName(s, t.clientId),
    })),
  ];
  const { rows, totalDebt, totalPay } = build(all);
  const ids = new Set([
    ...s.debts.filter(inRange).map((t) => t.clientId),
    ...s.payments.filter(inRange).map((t) => t.clientId),
  ]);
  const client = clientId ? clientById(s, clientId) : undefined;
  return {
    title,
    clientName: client?.name,
    clientPhone: client?.phone ?? "",
    from,
    to,
    rows,
    totalDebt,
    totalPay,
    balance: totalDebt - totalPay,
    clientsCount: ids.size,
    ...head(s),
  };
}

const C = {
  ink: "#101f1a",
  soft: "#5c706a",
  line: "#e3ebe8",
  lineSoft: "#f0f5f3",
  brand: "#0f6b4f",
  brandSoft: "#eef6f2",
  debt: "#b3261e",
  pay: "#0f6b4f",
};

function esc(v: string) {
  return v.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}

/** توليد HTML التقرير (A4، عربي RTL، تصميم احترافي للطباعة والمشاركة) */
export function reportHtml(d: ReportData) {
  const perClient = Boolean(d.clientName);
  const cols = perClient ? 6 : 7;

  const rows = d.rows
    .map((r, i) => {
      const color = r.kind === "debt" ? C.debt : C.pay;
      const cell = `padding:11px 10px;border-bottom:1px solid ${C.lineSoft};font-size:12.5px;vertical-align:middle`;
      return `<tr style="background:${i % 2 ? "#fbfdfc" : "#ffffff"}">
        <td style="${cell};text-align:center;color:${C.soft};font-size:11px">${i + 1}</td>
        <td style="${cell};white-space:nowrap;color:${C.soft}">${esc(formatDateShort(r.at))}</td>
        ${perClient ? "" : `<td style="${cell};font-weight:600">${esc(r.name ?? "")}</td>`}
        <td style="${cell}">
          <span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700;color:${color};background:${r.kind === "debt" ? "#fdeceb" : C.brandSoft}">
            ${r.kind === "debt" ? "دين" : "سداد"}
          </span>
        </td>
        <td style="${cell};font-weight:800;text-align:left;color:${color};white-space:nowrap">${riyalSvg(color, 11)} ${esc(formatMoney(r.amount))}</td>
        <td style="${cell};text-align:left;font-weight:700;white-space:nowrap">${riyalSvg("#4b5563", 11)} ${esc(formatMoney(r.balanceAfter))}</td>
        <td style="${cell};color:${C.soft};font-size:11.5px">${esc(r.note ?? "—")}</td>
      </tr>`;
    })
    .join("");

  const card = (label: string, value: string, color: string, strong = false) => `
    <div style="flex:1;border:1px solid ${C.line};border-radius:14px;padding:14px 16px;background:${strong ? C.brandSoft : "#ffffff"}">
      <div style="font-size:11.5px;color:${C.soft};margin-bottom:6px;letter-spacing:.2px">${label}</div>
      <div style="font-size:19px;font-weight:800;color:${color};line-height:1.2">${value}</div>
    </div>`;

  const th = `padding:11px 10px;font-size:11.5px;font-weight:700`;

  return `<div dir="rtl" style="width:794px;box-sizing:border-box;padding:40px 38px;background:#ffffff;color:${C.ink};font-family:'Noto Naskh Arabic','Segoe UI',Tahoma,sans-serif;line-height:1.7">

    <!-- الترويسة -->
    <div style="display:flex;align-items:center;gap:16px;padding-bottom:18px;border-bottom:2px solid ${C.brand}">
      ${
        d.logo
          ? `<img src="${d.logo}" style="width:60px;height:60px;border-radius:14px;object-fit:cover"/>`
          : `<div style="width:60px;height:60px;border-radius:14px;background:${C.brandSoft};color:${C.brand};display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800">${esc(d.shop.charAt(0))}</div>`
      }
      <div style="flex:1">
        <div style="font-size:21px;font-weight:800;color:${C.brand};line-height:1.3">${esc(d.shop)}</div>
        <div style="font-size:12px;color:${C.soft}">${esc(d.owner)}${d.ownerPhone ? " · " + esc(d.ownerPhone) : ""}</div>
      </div>
      <div style="text-align:left">
        <div style="font-size:15px;font-weight:800">${esc(d.title)}</div>
        <div style="font-size:11.5px;color:${C.soft}">تاريخ الإصدار: ${esc(formatDateShort(d.issuedAt))}</div>
      </div>
    </div>

    <!-- بيانات العميل / النطاق -->
    <div style="margin-top:22px;display:flex;gap:12px;align-items:stretch">
      <div style="flex:1;border:1px solid ${C.line};border-radius:14px;padding:14px 16px">
        <div style="font-size:11.5px;color:${C.soft};margin-bottom:4px">${perClient ? "العميل" : "النطاق"}</div>
        <div style="font-size:17px;font-weight:800">${esc(d.clientName ?? "جميع العملاء")}</div>
        <div style="font-size:12px;color:${C.soft};margin-top:2px">${
          perClient
            ? d.clientPhone
              ? esc(d.clientPhone)
              : "لا يوجد رقم هاتف"
            : `${d.clientsCount} عميل`
        }</div>
      </div>
      <div style="flex:1;border:1px solid ${C.line};border-radius:14px;padding:14px 16px">
        <div style="font-size:11.5px;color:${C.soft};margin-bottom:4px">الفترة</div>
        <div style="font-size:14px;font-weight:700">من ${esc(formatDateShort(d.from))}</div>
        <div style="font-size:14px;font-weight:700">إلى ${esc(formatDateShort(d.to))}</div>
      </div>
    </div>

    <!-- الملخص -->
    <div style="display:flex;gap:12px;margin-top:12px">
      ${card("إجمالي الديون", `${riyalSvg(C.debt, 13)} ${esc(formatMoney(d.totalDebt))}`, C.debt)}
      ${card("إجمالي السداد", `${riyalSvg(C.pay, 13)} ${esc(formatMoney(d.totalPay))}`, C.pay)}
      ${card("الرصيد المتبقي", `${riyalSvg(d.balance > 0 ? C.debt : C.pay, 13)} ${esc(formatMoney(d.balance))}`, d.balance > 0 ? C.debt : C.pay, true)}
    </div>

    <!-- الجدول -->
    <div style="margin-top:26px;font-size:13px;font-weight:800">تفاصيل العمليات <span style="color:${C.soft};font-weight:600;font-size:11.5px">(${d.rows.length} عملية)</span></div>
    <table style="width:100%;border-collapse:collapse;margin-top:10px;border:1px solid ${C.line};border-radius:12px;overflow:hidden">
      <thead>
        <tr style="background:${C.brand};color:#ffffff">
          <th style="${th};text-align:center;width:34px">#</th>
          <th style="${th};text-align:right">التاريخ</th>
          ${perClient ? "" : `<th style="${th};text-align:right">العميل</th>`}
          <th style="${th};text-align:right">النوع</th>
          <th style="${th};text-align:left">المبلغ</th>
          <th style="${th};text-align:left">الرصيد بعد العملية</th>
          <th style="${th};text-align:right">الملاحظة</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="${cols}" style="padding:34px;text-align:center;color:${C.soft};font-size:12.5px">لا توجد عمليات في هذه الفترة</td></tr>`}</tbody>
    </table>

    <!-- الرصيد النهائي -->
    <div style="margin-top:22px;display:flex;justify-content:flex-start">
      <div style="min-width:300px;border:2px solid ${d.balance > 0 ? C.debt : C.brand};border-radius:14px;padding:14px 18px;background:${d.balance > 0 ? "#fdf4f3" : C.brandSoft};display:flex;align-items:center;justify-content:space-between;gap:20px">
        <span style="font-size:13.5px;font-weight:700;color:${C.soft}">الرصيد النهائي المستحق</span>
        <span style="font-size:23px;font-weight:800;color:${d.balance > 0 ? C.debt : C.brand}">${riyalSvg(d.balance > 0 ? C.debt : C.brand, 18)} ${esc(formatMoney(d.balance))}</span>
      </div>
    </div>

    <!-- التذييل -->
    <div style="margin-top:34px;border-top:1px solid ${C.line};padding-top:14px;display:flex;justify-content:space-between;align-items:center;gap:14px;font-size:13px;color:${C.soft}">
      <span style="display:flex;align-items:center;gap:10px">
        <img src="/icon-192.png" style="width:30px;height:30px;border-radius:8px;object-fit:cover"/>
        <span style="font-size:13px;font-weight:600">تطبيق «دفتري» لإدارة الديون — يعمل بالكامل بدون إنترنت وبياناتك محفوظة على جهازك.</span>
      </span>
      <span style="font-size:13px;white-space:nowrap">${esc(formatDateShort(d.issuedAt))}</span>
    </div>
  </div>`;
}
