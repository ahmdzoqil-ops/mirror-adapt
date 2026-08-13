import type { ReportData } from "@/lib/report";
import { reportHtml } from "@/lib/report";
import { saveFile, shareFile, stamp, type SaveResult, type ShareResult } from "@/lib/native-file";

const A4 = { w: 595.28, h: 841.89 }; // نقاط PDF

/** تحويل HTML التقرير إلى ملف PDF بجودة عالية مع دعم العربية */
export async function reportToPdfBlob(data: ReportData): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const host = document.createElement("div");
  host.setAttribute("dir", "rtl");
  host.style.cssText =
    "position:fixed;top:0;left:-10000px;width:794px;background:#ffffff;z-index:-1;";
  host.innerHTML = reportHtml(data);
  document.body.appendChild(host);

  try {
    const canvas = await html2canvas(host.firstElementChild as HTMLElement, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const imgW = A4.w;
    const imgH = (canvas.height * imgW) / canvas.width;
    const img = canvas.toDataURL("image/jpeg", 0.92);

    let remaining = imgH;
    let position = 0;
    pdf.addImage(img, "JPEG", 0, 0, imgW, imgH);
    remaining -= A4.h;
    while (remaining > 1) {
      position -= A4.h;
      pdf.addPage();
      pdf.addImage(img, "JPEG", 0, position, imgW, imgH);
      remaining -= A4.h;
    }
    return pdf.output("blob");
  } finally {
    host.remove();
  }
}

export function pdfFileName(_data: ReportData) {
  return `دفتري_تقرير_${stamp()}.pdf`;
}

export function savePdf(blob: Blob, name: string): Promise<SaveResult> {
  return saveFile(blob, name);
}

export function sharePdf(blob: Blob, name: string, title: string): Promise<ShareResult> {
  return shareFile(blob, name, title);
}
