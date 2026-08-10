import { X } from "lucide-react";

/** عرض صورة بحجم كامل — لا يعدّل الصورة الأصلية ولا يحذفها */
export function ImageViewer({ src, onClose }: { src: string | null; onClose: () => void }) {
  if (!src) return null;
  return (
    <div
      role="dialog"
      aria-label="عرض الصورة"
      onClick={onClose}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4 animate-in fade-in-0"
    >
      <button
        aria-label="إغلاق"
        onClick={onClose}
        className="absolute top-4 left-4 rounded-full bg-white/15 p-2 text-white"
      >
        <X className="size-5" />
      </button>
      <img src={src} alt="عرض كامل" className="max-h-full max-w-full rounded-xl object-contain" />
    </div>
  );
}
