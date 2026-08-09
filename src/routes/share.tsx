import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, Phone } from "lucide-react";
import { decodeShare, type SharePayload } from "@/lib/share";
import { Money } from "@/components/Riyal";

export const Route = createFileRoute("/share")({
  head: () => ({
    meta: [
      { title: "متابعة الحساب — دفتري" },
      { name: "description", content: "كشف حساب للعميل يعرض الديون والسداد والرصيد المتبقي." },
      { property: "og:title", content: "متابعة الحساب — دفتري" },
      {
        property: "og:description",
        content: "كشف حساب للعميل يعرض الديون والسداد والرصيد المتبقي.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharePage,
});

function SharePage() {
  const [data, setData] = useState<SharePayload | null | undefined>(undefined);

  useEffect(() => {
    setData(decodeShare(window.location.hash));
  }, []);

  if (data === undefined) return <div className="min-h-screen bg-background" />;

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <p className="font-semibold text-muted-foreground">الرابط غير صالح أو منتهي</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="bg-primary px-4 py-6 text-primary-foreground">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary-foreground/15">
            <BookOpen className="size-6" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold">{data.shop}</h1>
            <p className="text-xs opacity-85">كشف حساب — للاطلاع فقط</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <div className="card-soft p-4">
          <p className="text-sm text-muted-foreground">العميل</p>
          <p className="text-lg font-bold">{data.client.name}</p>
          <p className="mt-3 text-sm text-muted-foreground">الرصيد المتبقي</p>
          <p
            className={`text-3xl font-extrabold ${
              data.balance > 0 ? "text-destructive" : "text-success"
            }`}
          >
            <Money value={data.balance} />
          </p>
        </div>

        <div className="space-y-2">
          <p className="px-1 text-sm font-semibold text-muted-foreground">
            العمليات ({data.txns.length})
          </p>
          {data.txns
            .slice()
            .reverse()
            .map((t, i) => (
              <div key={i} className="card-soft flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t.k === "d" ? "دين" : "سداد"}</p>
                  <p className="num text-xs text-muted-foreground">
                    {new Date(t.at).toLocaleDateString("ar-EG")}
                  </p>
                  {t.n ? <p className="mt-1 text-xs text-muted-foreground">{t.n}</p> : null}
                </div>
                <span
                  className={`font-bold ${t.k === "d" ? "text-destructive" : "text-success"}`}
                >
                  <span className="num">{t.k === "d" ? "+" : "−"}</span>
                  <Money value={t.a} />
                </span>
              </div>
            ))}
        </div>

        {data.ownerPhone ? (
          <a
            href={`tel:${data.ownerPhone}`}
            className="card-soft flex items-center justify-center gap-2 p-4 font-semibold"
          >
            <Phone className="size-4" /> التواصل مع {data.owner || data.shop}
          </a>
        ) : null}

        <p className="text-center text-xs text-muted-foreground">
          صدر بتاريخ {new Date(data.issuedAt).toLocaleDateString("ar-EG")}
        </p>
      </main>
    </div>
  );
}
