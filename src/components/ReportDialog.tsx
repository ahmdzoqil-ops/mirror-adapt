import { useEffect, useState } from "react";
import { Download, FileText, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { reportHtml, type ReportData } from "@/lib/report";
import { pdfFileName, reportToPdfBlob, savePdf, sharePdf } from "@/lib/pdf";

export function ReportDialog({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: ReportData | null;
}) {
  const [busy, setBusy] = useState<"save" | "share" | null>(null);
  const [html, setHtml] = useState("");

  useEffect(() => {
    if (open && data) setHtml(reportHtml(data));
  }, [open, data]);

  async function run(mode: "save" | "share") {
    if (!data || busy) return;
    setBusy(mode);
    try {
      const blob = await reportToPdfBlob(data);
      const name = pdfFileName(data);
      if (mode === "save") {
        savePdf(blob, name);
        toast.success("تم حفظ ملف PDF");
      } else {
        const shared = await sharePdf(blob, name, data.title);
        toast.success(shared ? "تمت المشاركة" : "المشاركة غير مدعومة — تم حفظ الملف");
      }
    } catch {
      toast.error("تعذر إنشاء ملف PDF");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5" /> معاينة التقرير
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto rounded-xl border border-border bg-muted/40 p-2">
          {/* معاينة مطابقة تمامًا لملف PDF الناتج */}
          <div
            className="mx-auto w-fit"
            style={{ zoom: 0.45 }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>


        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => void run("save")} disabled={busy !== null}>
            {busy === "save" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            حفظ PDF
          </Button>
          <Button
            variant="secondary"
            onClick={() => void run("share")}
            disabled={busy !== null}
          >
            {busy === "share" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Share2 className="size-4" />
            )}
            مشاركة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
