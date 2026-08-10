import { useEffect, useState } from "react";

/** شاشة افتتاحية قصيرة بهوية «دفتري» */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const a = setTimeout(() => setFade(true), 1100);
    const b = setTimeout(onDone, 1500);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background transition-opacity duration-300 ${
        fade ? "opacity-0" : "opacity-100"
      }`}
    >
      <img
        src="/icon-192.png"
        alt="دفتري"
        className="size-24 rounded-3xl shadow-[var(--shadow-float)]"
      />
      <div className="text-center">
        <p className="text-3xl font-extrabold text-primary">دفتري</p>
        <p className="mt-1 text-xs text-muted-foreground">تطوير: أحمد الصعفاني</p>
      </div>
    </div>
  );
}
