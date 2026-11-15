import { listSections, sectionLabels, type CvDoc } from './schema';
import { safeLink } from './CvDocument';
import printStyles from '../features/cv/cv.css?inline';
import coverLetterStyles from '../features/cover-letter/cover-letter.css?inline';
import type { CoverLetterContent } from '../features/cover-letter/CoverLetterRoutes';

/** Export the same structured content used by React; Word uses linear reading order. */
export async function buildDocx(doc: CvDoc, title: string): Promise<ArrayBuffer> {
  const { Document, Packer, Paragraph, TextRun, ExternalHyperlink, HeadingLevel, AlignmentType } = await import('docx');
  const { content, design } = doc;
  const run = (text: string, bold = false) => new TextRun({ text, bold });
  const linked = (text: string) => safeLink(text) ? new ExternalHyperlink({ link: safeLink(text)!, children: [new TextRun({ text, style: 'Hyperlink' })] }) : run(text);
  const children = [new Paragraph({ children: [run(content.personal.name || 'Your name', true)], heading: HeadingLevel.TITLE, alignment: design.headerStyle === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT }), new Paragraph(content.personal.title)];
  for (const key of ['email', 'phone', 'location', 'website'] as const) {
    const value = content.personal[key];
    if (value) children.push(new Paragraph({ children: [key === 'email' || key === 'phone' ? new ExternalHyperlink({ link: `${key === 'email' ? 'mailto' : 'tel'}:${value}`, children: [run(value)] }) : linked(value)] }));
  }
  for (const key of design.order.filter(k => !design.hidden.includes(k))) {
    if (key === 'summary' ? !content.summary.trim() : !content[key].length) continue;
    children.push(new Paragraph({ children: [new TextRun({ text: design.headings[key] || sectionLabels[key], bold: true, color: design.accent.slice(1) })], heading: HeadingLevel.HEADING_1, pageBreakBefore: design.pageBreaks.includes(key), spacing: { before: Math.round(design.sectionSpacing * 240), after: 100 }, keepNext: true }));
    if (key === 'summary') { for (const line of content.summary.split('\n')) children.push(new Paragraph(line)); continue; }
    const fields = listSections.find(s => s.key === key)!.fields;
    for (const item of content[key]) {
      fields.forEach((field, index) => {
        if (!item[field.key]) return;
        for (const line of item[field.key].split('\n')) children.push(new Paragraph({ children: [index === 0 ? run(line, true) : linked(line)], spacing: { after: index === fields.length - 1 ? 100 : 40 } }));
      });
    }
  }
  const margin = Math.round(design.margin * 56.6929);
  const word = new Document({ title, creator: 'CV Studio', styles: { default: { document: { run: { font: design.fontFamily, size: design.fontSize * 2, color: design.textColor.slice(1) }, paragraph: { spacing: { line: Math.round(design.lineHeight * 240) } } } } }, sections: [{ properties: { page: { size: design.pageSize === 'Letter' ? { width: 12240, height: 15840 } : { width: 11906, height: 16838 }, margin: { top: margin, bottom: margin, left: margin, right: margin } } }, children }] });
  return Packer.toArrayBuffer(word);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Prints a clone of the React-rendered CV, excluding application navigation. */
export function printCv(doc: CvDoc): Promise<void> {
  const source = document.querySelector<HTMLElement>('.cv-preview-panel .cv-page, .template-live-preview .cv-page');
  if (!source) throw new Error('Open a CV preview before printing.');
  const frame = document.createElement('iframe');
  frame.title = 'Print CV'; frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;top:0;border:0';
  document.body.appendChild(frame);
  const target = frame.contentDocument!;
  const style = target.createElement('style');
  style.textContent = `${printStyles}\n@page { size: ${doc.design.pageSize === 'Letter' ? 'letter' : 'A4'}; margin: ${doc.design.margin}mm; } body { margin:0; } .cv-page { width:auto!important; min-height:0!important; padding:0!important; transform:none!important; box-shadow:none!important; }`;
  target.head.appendChild(style);
  target.body.appendChild(source.cloneNode(true));
  return (target.fonts?.ready || Promise.resolve()).then(() => new Promise<void>(resolve => {
    window.setTimeout(() => {
      frame.contentWindow!.addEventListener('afterprint', () => frame.remove(), { once: true });
      frame.contentWindow!.focus(); frame.contentWindow!.print();
      // Some engines do not dispatch afterprint for a canceled embedded print.
      window.setTimeout(() => frame.remove(), 60000);
      resolve();
    }, 100);
  }));
}

/** Prints a clone of the React-rendered cover letter, excluding application navigation. */
export function printCoverLetter(design: { pageSize: 'A4' | 'Letter'; margin: number }): Promise<void> {
  const source = document.querySelector<HTMLElement>('.letter-preview-container .cover-letter-document');
  if (!source) throw new Error('Open a cover letter preview before printing.');
  const frame = document.createElement('iframe');
  frame.title = 'Print Cover Letter'; frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;top:0;border:0';
  document.body.appendChild(frame);
  const target = frame.contentDocument!;
  const style = target.createElement('style');
  style.textContent = `${coverLetterStyles}\n@page { size: ${design.pageSize === 'Letter' ? 'letter' : 'A4'}; margin: ${design.margin}mm; } body { margin:0; } .cover-letter-document { width:auto!important; min-height:0!important; padding:0!important; transform:none!important; box-shadow:none!important; }`;
  target.head.appendChild(style);
  target.body.appendChild(source.cloneNode(true));
  return (target.fonts?.ready || Promise.resolve()).then(() => new Promise<void>(resolve => {
    window.setTimeout(() => {
      frame.contentWindow!.addEventListener('afterprint', () => frame.remove(), { once: true });
      frame.contentWindow!.focus(); frame.contentWindow!.print();
      window.setTimeout(() => frame.remove(), 60000);
      resolve();
    }, 100);
  }));
}

/** Export cover letter to DOCX format. */
export async function buildCoverLetterDocx(content: CoverLetterContent, design: { pageSize: 'A4' | 'Letter'; margin: number; fontFamily: string; fontSize: number; lineHeight: number }, title: string): Promise<ArrayBuffer> {
  const { Document, Packer, Paragraph, TextRun, ExternalHyperlink, AlignmentType, HeadingLevel } = await import('docx');
  const run = (text: string, bold = false) => new TextRun({ text, bold });
  const linked = (text: string) => {
    const urlMatch = text.match(/^https?:\/\//i);
    if (urlMatch) return new ExternalHyperlink({ link: text, children: [new TextRun({ text, style: 'Hyperlink' })] });
    return run(text);
  };
  
  const children: any[] = [];
  
  // Header with applicant info
  children.push(new Paragraph({ 
    children: [run(content.applicant.name || 'Your Name', true)], 
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 100 }
  }));
  
  if (content.applicant.email) {
    children.push(new Paragraph({ children: [new ExternalHyperlink({ link: `mailto:${content.applicant.email}`, children: [run(content.applicant.email)] })] }));
  }
  if (content.applicant.phone) {
    children.push(new Paragraph({ children: [new ExternalHyperlink({ link: `tel:${content.applicant.phone}`, children: [run(content.applicant.phone)] })] }));
  }
  if (content.applicant.location) {
    children.push(new Paragraph({ children: [run(content.applicant.location)] }));
  }
  if (content.applicant.linkedin) {
    children.push(new Paragraph({ children: [linked(content.applicant.linkedin)] }));
  }
  if (content.applicant.portfolio) {
    children.push(new Paragraph({ children: [linked(content.applicant.portfolio)] }));
  }
  
  children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
  
  // Recipient info
  if (content.recipient.company) {
    children.push(new Paragraph({ children: [run(content.recipient.company, true)] }));
  }
  if (content.recipient.hiringManager) {
    children.push(new Paragraph({ children: [run(content.recipient.hiringManager)] }));
  }
  if (content.recipient.jobTitle) {
    children.push(new Paragraph({ children: [run(content.recipient.jobTitle)] }));
  }
  if (content.recipient.department) {
    children.push(new Paragraph({ children: [run(content.recipient.department)] }));
  }
  if (content.recipient.reference) {
    children.push(new Paragraph({ children: [run(`Ref: ${content.recipient.reference}`)] }));
  }
  if (content.recipient.date) {
    children.push(new Paragraph({ children: [run(content.recipient.date)] }));
  }
  
  children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
  
  // Letter body
  if (content.letter.greeting) {
    children.push(new Paragraph({ children: [run(content.letter.greeting)], spacing: { after: 200 } }));
  }
  
  const bodyParagraphs = [
    content.letter.opening,
    content.letter.experience,
    content.letter.skills,
    content.letter.company,
    content.letter.value,
    content.letter.closing
  ].filter(p => p && p.trim());
  
  bodyParagraphs.forEach(p => {
    p.split('\n').forEach(line => {
      children.push(new Paragraph({ children: [run(line)] }));
    });
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
  });
  
  if (content.letter.signOff) {
    children.push(new Paragraph({ children: [run(content.letter.signOff)], spacing: { before: 400, after: 100 } }));
  }
  
  if (content.letter.signature) {
    children.push(new Paragraph({ children: [run(content.letter.signature)] }));
  }
  
  const margin = Math.round(design.margin * 56.6929);
  const word = new Document({ 
    title, 
    creator: 'CV Studio', 
    styles: { 
      default: { 
        document: { 
          run: { font: design.fontFamily, size: design.fontSize * 2 }, 
          paragraph: { spacing: { line: Math.round(design.lineHeight * 240) } } 
        } 
      } 
    }, 
    sections: [{ 
      properties: { 
        page: { 
          size: design.pageSize === 'Letter' ? { width: 12240, height: 15840 } : { width: 11906, height: 16838 }, 
          margin: { top: margin, bottom: margin, left: margin, right: margin } 
        } 
      }, 
      children 
    }] 
  });
  
  return Packer.toArrayBuffer(word);
}
