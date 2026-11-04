import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';

export async function exportProfileAsPdf(elementId: string, filename: string = 'resume.pdf') {
  const element = document.getElementById(elementId);
  if (!element) {
    toast.error('Preview element not found for export.');
    return;
  }

  const toastId = toast.loading('Generating PDF resume with clickable links...');

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1024,
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const printableWidth = pageWidth - margin * 2;
    const printableHeight = pageHeight - margin * 2;

    const imgData = canvas.toDataURL('image/png');
    const contentRatio = canvas.width / canvas.height;

    // Calculate height when scaled to fit printable width
    const scaledHeight = printableWidth / contentRatio;

    // Extract all links inside the profile
    const elementRect = element.getBoundingClientRect();
    const linkElements = element.querySelectorAll<HTMLAnchorElement>('a[href]');

    // If the content fits within one page (or is close to 1 page, within 15%),
    // scale it to fit cleanly on exactly ONE page.
    if (scaledHeight <= printableHeight * 1.15) {
      const finalScale = scaledHeight > printableHeight ? printableHeight / scaledHeight : 1;
      const finalWidth = printableWidth * finalScale;
      const finalHeight = scaledHeight * finalScale;
      const xOffset = margin + (printableWidth - finalWidth) / 2;
      const yOffset = margin + (printableHeight - finalHeight) / 2;

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight);

      // Overlay clickable PDF links
      const scaleX = finalWidth / elementRect.width;
      const scaleY = finalHeight / elementRect.height;

      linkElements.forEach((link) => {
        const href = link.href;
        if (!href) return;
        const rect = link.getBoundingClientRect();
        const relX = rect.left - elementRect.left;
        const relY = rect.top - elementRect.top;
        const pdfX = xOffset + relX * scaleX;
        const pdfY = yOffset + relY * scaleY;
        const pdfW = rect.width * scaleX;
        const pdfH = rect.height * scaleY;

        pdf.link(pdfX, pdfY, pdfW, pdfH, { url: href });
      });
    } else {
      // True multi-page content
      let heightLeft = scaledHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, printableWidth, scaledHeight);
      heightLeft -= printableHeight;

      // Only add another page if remaining content is substantial (> 25mm)
      while (heightLeft > 25) {
        position -= printableHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, printableWidth, scaledHeight);
        heightLeft -= printableHeight;
      }

      // Overlay clickable PDF links for multi-page
      const scaleX = printableWidth / elementRect.width;
      const scaleY = scaledHeight / elementRect.height;

      linkElements.forEach((link) => {
        const href = link.href;
        if (!href) return;
        const rect = link.getBoundingClientRect();
        const relX = rect.left - elementRect.left;
        const relY = rect.top - elementRect.top;
        const totalY = margin + relY * scaleY;
        const pageIndex = Math.floor((totalY - margin) / printableHeight);
        const pageY = margin + ((totalY - margin) % printableHeight);
        const pdfX = margin + relX * scaleX;
        const pdfW = rect.width * scaleX;
        const pdfH = rect.height * scaleY;

        if (pageIndex < pdf.getNumberOfPages()) {
          pdf.setPage(pageIndex + 1);
          pdf.link(pdfX, pageY, pdfW, pdfH, { url: href });
        }
      });
    }

    pdf.save(filename);
    toast.success('PDF Resume downloaded successfully with active links!', { id: toastId });
  } catch (error) {
    console.error('PDF generation error:', error);
    toast.error('Failed to generate PDF. Using browser print as fallback.', { id: toastId });
    window.print();
  }
}
