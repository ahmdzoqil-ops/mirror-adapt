import type { ReportData } from "@/lib/report";
import { reportHtml } from "@/lib/report";

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

export function pdfFileName(data: ReportData) {
  const who = data.clientName ? data.clientName.replace(/\s+/g, "-") : "تقرير-عام";
  return `${who}-${new Date().toISOString().slice(0, 10)}.pdf`;
}

export function savePdf(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function sharePdf(blob: Blob, name: string, title: string) {
  const file = new File([blob], name, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && navigator.share) {
    await navigator.share({ files: [file], title });
    return true;
  }
  savePdf(blob, name);
  return false;
}
