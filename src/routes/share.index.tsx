import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { decodeShare, type SharePayload } from "@/lib/share";
import { ShareView } from "@/components/ShareView";
export const Route = createFileRoute("/share/")({
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

  return <ShareView data={data} />;
}
