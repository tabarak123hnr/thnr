import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/** Render an invoice DOM node to a multi-page PDF and download it. */
export async function downloadInvoicePdf(
  element: HTMLElement,
  filename: string,
) {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * usableWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = margin;

  pdf.addImage(imgData, "PNG", margin, position, usableWidth, imgHeight);
  heightLeft -= pageHeight - margin * 2;

  while (heightLeft > 0) {
    position = margin - (imgHeight - heightLeft);
    pdf.addPage();
    pdf.addImage(imgData, "PNG", margin, position, usableWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;
  }

  const name = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  pdf.save(name);
}

export function printInvoiceElement(element: HTMLElement, title: string) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
  if (!win) {
    throw new Error("Pop-up blocked. Allow pop-ups to print the invoice.");
  }

  const styles = `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      background: #ffffff;
      color: #000000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page { margin: 10mm; size: A4; }
    @media print {
      body { background: #ffffff; padding: 0; }
    }
  `;

  win.document.open();
  win.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title>
    <style>${styles}</style></head><body></body></html>`);
  win.document.close();

  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.boxShadow = "none";
  clone.style.margin = "0 auto";
  win.document.body.appendChild(clone);

  win.focus();
  setTimeout(() => {
    win.print();
  }, 350);
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
