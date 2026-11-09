/** CV source must only be persisted by the authorized Google Drive adapter. */
export interface CvSource {
  title: string;
  html: string;
  css: string;
}
export interface FileConfirmation { fileId: string }
export interface SavedCv extends FileConfirmation {
  source: Readonly<CvSource>;
}
export interface CvPdfCache { saved: SavedCv; blob: Blob }
export function cachedPdf(saved: SavedCv, cache: CvPdfCache | null): Blob | null {
  return cache?.saved === saved ? cache.blob : null;
}
export type PdfExporter = (pdf: Blob, filename: string) => Promise<FileConfirmation>;
export interface CvIntegrations {
  drive?: {
    /** Resolve only after Drive confirms a durable write. Reject on auth/save errors. */
    saveSource: (source: Readonly<CvSource>, fileId?: string) => Promise<FileConfirmation>;
    exportPdf?: PdfExporter;
  };
  oneDrive?: { exportPdf: PdfExporter };
  /** Render in isolation; never insert source HTML into the application's DOM. */
  renderPdf?: (source: Readonly<CvSource>) => Promise<Blob>;
}

// No cloud provider is connected in this repository. No simulated responses.
export const cvIntegrations: CvIntegrations = {};

export function sameSource(a: Readonly<CvSource>, b: Readonly<CvSource>): boolean {
  return a.title === b.title && a.html === b.html && a.css === b.css;
}
function confirmed(result: FileConfirmation): FileConfirmation {
  if (!result || typeof result.fileId !== 'string' || !result.fileId.trim()) {
    throw new Error('The provider did not confirm a saved file. Please retry.');
  }
  return result;
}
export async function saveCv(
  integrations: CvIntegrations, source: CvSource, fileId?: string,
): Promise<SavedCv> {
  if (!integrations.drive) throw new Error('Google Drive connection and save integration are required.');
  const snapshot = Object.freeze({ ...source });
  const result = confirmed(await integrations.drive.saveSource(snapshot, fileId));
  return Object.freeze({ fileId: result.fileId, source: snapshot });
}
export async function createPdf(integrations: CvIntegrations, saved: SavedCv): Promise<Blob> {
  if (!integrations.renderPdf) throw new Error('An isolated CV PDF rendering integration is required.');
  const pdf = await integrations.renderPdf(saved.source);
  if (!(pdf instanceof Blob) || pdf.type !== 'application/pdf' || !pdf.size) {
    throw new Error('The renderer did not return a valid PDF. Please retry.');
  }
  return pdf;
}
export async function exportPdf(exporter: PdfExporter | undefined, pdf: Blob, filename: string) {
  if (!exporter) throw new Error('Cloud connection and PDF export integration are required.');
  return confirmed(await exporter(pdf, filename));
}
export function downloadPdf(pdf: Blob, filename: string) {
  const url = URL.createObjectURL(pdf);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Keep the object URL alive while the browser starts the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
