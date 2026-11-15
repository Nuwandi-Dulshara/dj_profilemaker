import type { CoverLetterContent } from '../features/cover-letter/CoverLetterRoutes';

interface CoverLetterDesign {
  pageSize: 'A4' | 'Letter';
  fontFamily: string;
  fontSize: number;
  accent: string;
  margin: number;
  lineHeight: number;
  textColor: string;
  headerStyle: 'left' | 'center';
  alignment: 'left' | 'center';
  sectionSpacing: number;
}

interface CoverLetterDoc {
  content: CoverLetterContent;
  design: CoverLetterDesign;
}

interface CoverLetterDocumentProps {
  document: CoverLetterDoc;
  zoom?: number;
}

const pageSizes = {
  A4: { width: 794, height: 1123 },
  Letter: { width: 816, height: 1056 },
} as const;

export function CoverLetterDocument({ document, zoom = 1 }: CoverLetterDocumentProps) {
  const { content, design } = document;
  const { pageSize, fontFamily, fontSize, margin, lineHeight, textColor, headerStyle, alignment, sectionSpacing } = design;
  const page = pageSizes[pageSize];

  const containerStyle: React.CSSProperties = {
    width: `${page.width * zoom}px`,
    minHeight: `${page.height * zoom}px`,
    backgroundColor: '#fff',
    padding: `${margin * zoom}px`,
    fontFamily,
    fontSize: `${fontSize * zoom}px`,
    lineHeight,
    color: textColor,
    transform: `scale(${zoom})`,
    transformOrigin: 'top left',
  };

  const headerStyleObj: React.CSSProperties = {
    textAlign: headerStyle === 'center' ? 'center' : 'left',
    marginBottom: `${sectionSpacing * 16 * zoom}px`,
  };

  const bodyStyle: React.CSSProperties = {
    textAlign: alignment === 'center' ? 'center' : 'left',
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: `${sectionSpacing * 16 * zoom}px`,
  };

  return (
    <div className="cover-letter-document" style={containerStyle}>
      <header style={headerStyleObj}>
        <div style={{ marginBottom: '8px' }}>
          <strong style={{ fontSize: '1.1em' }}>{content.applicant.name || 'Your Name'}</strong>
        </div>
        <div style={{ fontSize: '0.9em', color: '#666' }}>
          {content.applicant.email && <div>{content.applicant.email}</div>}
          {content.applicant.phone && <div>{content.applicant.phone}</div>}
          {content.applicant.location && <div>{content.applicant.location}</div>}
          {content.applicant.linkedin && <div>{content.applicant.linkedin}</div>}
          {content.applicant.portfolio && <div>{content.applicant.portfolio}</div>}
        </div>
      </header>

      <section style={{ ...sectionStyle, marginBottom: `${sectionSpacing * 20 * zoom}px`, fontSize: '0.9em', color: '#666' }}>
        {content.recipient.company && <div><strong>{content.recipient.company}</strong></div>}
        {content.recipient.hiringManager && <div>{content.recipient.hiringManager}</div>}
        {content.recipient.jobTitle && <div>{content.recipient.jobTitle}</div>}
        {content.recipient.department && <div>{content.recipient.department}</div>}
        {content.recipient.reference && <div>Ref: {content.recipient.reference}</div>}
        {content.recipient.date && <div>{content.recipient.date}</div>}
      </section>

      <div style={bodyStyle}>
        {content.letter.greeting && (
          <p style={{ ...sectionStyle, fontWeight: '500' }}>{content.letter.greeting}</p>
        )}

        {content.letter.opening && (
          <p style={sectionStyle}>{content.letter.opening}</p>
        )}

        {content.letter.experience && (
          <p style={sectionStyle}>{content.letter.experience}</p>
        )}

        {content.letter.skills && (
          <p style={sectionStyle}>{content.letter.skills}</p>
        )}

        {content.letter.company && (
          <p style={sectionStyle}>{content.letter.company}</p>
        )}

        {content.letter.value && (
          <p style={sectionStyle}>{content.letter.value}</p>
        )}

        {content.letter.closing && (
          <p style={sectionStyle}>{content.letter.closing}</p>
        )}

        {content.letter.signOff && (
          <p style={{ ...sectionStyle, marginTop: `${sectionSpacing * 24 * zoom}px` }}>
            {content.letter.signOff}
          </p>
        )}

        {content.letter.signature && (
          <p style={{ marginTop: '8px' }}>{content.letter.signature}</p>
        )}
      </div>
    </div>
  );
}
