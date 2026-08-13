import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShareView } from "@/components/ShareView";
import { publicBase, type SharePayload } from "@/lib/share";

export const Route = createFileRoute("/share/$token")({
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
  component: SharedAccount,
});

function SharedAccount() {
  const { token } = Route.useParams();
  const [data, setData] = useState<SharePayload | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    fetch(`${publicBase()}/api/public/share?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { payload?: SharePayload } | null) => {
        if (alive) setData(j?.payload ?? null);
      })
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [token]);

  if (data === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <p className="text-sm text-muted-foreground">جارٍ تحميل كشف الحساب…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <p className="font-semibold text-muted-foreground">الرابط غير صالح أو تم إلغاؤه</p>
      </div>
    );
  }

  return <ShareView data={data} />;
}