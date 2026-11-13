/** CV source must only be persisted by the authorized Google Drive adapter. */
export interface CvSource {
  title: string;
  html: string;
  css: string;
}
export interface FileConfirmation { fileId: string }
export interface SavedCv extends FileConfirmation {
  source: Readonly<CvSource>;
  confirmation: string;
  revision: string;
  previewHtml: string;
}
export interface CvPdfCache { saved: SavedCv; blob: Blob }
export function cachedPdf(saved: SavedCv, cache: CvPdfCache | null): Blob | null {
  return cache?.saved === saved ? cache.blob : null;
}
export type PdfExporter = (saved: SavedCv) => Promise<FileConfirmation>;
export interface CvIntegrations {
  drive?: {
    /** Resolve only after Drive confirms a durable write. Reject on auth/save errors. */
    saveSource: (source: Readonly<CvSource>, previous?: SavedCv) => Promise<FileConfirmation>;
    loadSource: (fileId: string) => Promise<SavedCv>;
    exportPdf?: PdfExporter;
  };
  oneDrive?: { exportPdf: PdfExporter };
  /** Render in isolation; never insert source HTML into the application's DOM. */
  renderPdf?: (saved: SavedCv) => Promise<Blob>;
}

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
  integrations: CvIntegrations, source: CvSource, previous?: SavedCv,
): Promise<SavedCv> {
  if (!integrations.drive) throw new Error('Google Drive connection and save integration are required.');
  const snapshot = Object.freeze({ ...source });
  const result = confirmed(await integrations.drive.saveSource(snapshot, previous));
  const retrieved = await integrations.drive.loadSource(result.fileId);
  if (retrieved.fileId !== result.fileId || !retrieved.confirmation || !retrieved.revision || !retrieved.previewHtml) {
    throw new Error('Drive retrieval did not confirm a saved version. Reopen the CV and retry.');
  }
  if (!sameSource(snapshot, retrieved.source)) throw new Error('The retrieved Drive version is different. Reopen the CV before retrying.');
  return Object.freeze({ ...retrieved, source: Object.freeze({ ...retrieved.source }) });
}
export async function createPdf(integrations: CvIntegrations, saved: SavedCv): Promise<Blob> {
  if (!integrations.renderPdf) throw new Error('An isolated CV PDF rendering integration is required.');
  const pdf = await integrations.renderPdf(saved);
  if (!(pdf instanceof Blob) || pdf.type !== 'application/pdf' || !pdf.size) {
    throw new Error('The renderer did not return a valid PDF. Please retry.');
  }
  return pdf;
}
export async function exportPdf(exporter: PdfExporter | undefined, saved: SavedCv) {
  if (!exporter) throw new Error('Cloud connection and PDF export integration are required.');
  return confirmed(await exporter(saved));
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
