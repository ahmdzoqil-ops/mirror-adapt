import { formatMoney } from "@/lib/format";

/** رمز الريال السعودي الرسمي — يُرسم كـ SVG ليظهر على كل الأجهزة */
export function RiyalMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={`inline-block size-[0.85em] shrink-0 align-[-0.06em] ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.5 2.5v9.2c0 2.6-1.9 4.6-4.4 4.6" />
      <path d="M11 4.6v6.9" />
      <path d="M21 13.4 3.2 16.6" />
      <path d="M21 18.2 3.2 21.4" />
    </svg>
  );
}

/** مبلغ مالي مسبوق برمز الريال */
export function Money({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} dir="ltr">
      <RiyalMark />
      <span className="num">{formatMoney(value)}</span>
    </span>
  );
}
