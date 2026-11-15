import { Fragment } from 'react';
import { listSections, pageSizes, sectionLabels, type CvDoc, type Item, type ListSectionDef } from './schema';

export function safeLink(value: string): string | undefined {
  return /^(https?:\/\/|mailto:|tel:)/i.test(value.trim()) ? value.trim() : undefined;
}

function ItemView({ def, item }: { def: ListSectionDef; item: Item }) {
  const [first, ...rest] = def.fields;
  const meta = rest.filter(f => !f.multiline).map(f => item[f.key]).filter(Boolean);
  const paragraphs = rest.filter(f => f.multiline).map(f => item[f.key]).filter(Boolean);
  if (!item[first.key] && !meta.length && paragraphs.length === 0) return null;
  return <div className="cv-item"><strong>{item[first.key]}</strong>{meta.length > 0 && <span className="cv-meta">{meta.map((value, i) => <Fragment key={i}>{i > 0 && ' · '}{safeLink(value) ? <a href={safeLink(value)}>{value}</a> : value}</Fragment>)}</span>}{paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>;
}

/** Renders structured CV data. Used for the editor preview and, later, templates and exports. */
export function CvDocument({ doc, zoom = 1 }: { doc: CvDoc; zoom?: number }) {
  const { content, design } = doc;
  const { width, height } = pageSizes[design.pageSize];
  const p = content.personal;
  const contact = [p.email, p.phone, p.location, p.website].filter(Boolean);
  const margin = design.margin * 3.78;
  const sections = design.order.filter(key => !design.hidden.includes(key));
  return (
    <div className="cv-stage" style={{ width: width * zoom }}>
      <article className="cv-page" aria-label="CV preview" data-layout={design.layout} data-header={design.headerStyle} data-headings={design.headingStyle} style={{ width, minHeight: height, padding: margin, fontFamily: `'${design.fontFamily}', serif`, fontSize: `${design.fontSize}pt`, color: design.textColor, lineHeight: design.lineHeight, ['--cv-spacing' as string]: `${design.sectionSpacing}em`, ['--cv-accent' as string]: design.accent, ['--cv-page' as string]: `${height}px`, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
        <header className="cv-header">
          <h1>{p.name || 'Your name'}</h1>
          {p.title && <p className="cv-title">{p.title}</p>}
          {contact.length > 0 && <p className="cv-contact">{contact.map((value, index) => { const href = value === p.email ? `mailto:${value}` : value === p.phone ? `tel:${value}` : safeLink(value); return <Fragment key={index}>{index > 0 && ' | '}{href ? <a href={href}>{value}</a> : value}</Fragment>; })}</p>}
        </header>
        <div className="cv-document-sections">{sections.map(key => {
          const attrs = { className: 'cv-section', 'data-section': key, 'data-page-break': design.pageBreaks.includes(key) ? 'true' : undefined };
          if (key === 'summary') return content.summary.trim() ? <section key={key} {...attrs}><h2>{design.headings[key] || sectionLabels.summary}</h2><p>{content.summary}</p></section> : null;
          const def = listSections.find(s => s.key === key)!;
          const items = content[key];
          if (items.length === 0) return null;
          return <section key={key} {...attrs}><h2>{design.headings[key] || def.label}</h2>{key === 'skills' ? <p>{items.map(i => i.name).filter(Boolean).join(', ')}</p> : items.map(item => <ItemView key={item.id} def={def} item={item} />)}</section>;
        })}</div>
      </article>
    </div>
  );
}

