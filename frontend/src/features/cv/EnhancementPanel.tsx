import { useEffect, useRef, useState } from 'react';
import { enhancements } from './enhancementsApi';
import type { AnalysisRecord, Asset, Suggestion } from './enhancementsApi';
import type { CvSource, SavedCv } from './integrations';
import { sameSource } from './integrations';
import { applySuggestions, downloadSource } from './editing';
import { buildPreview } from './preview';

const errorText=(error:unknown)=>error instanceof Error ? error.message : 'Action failed. Please retry.';
const labels:Record<string,string>={compatibility:'ATS compatibility',content:'Content quality',jobMatch:'Job match',keywords:'Keyword optimization',formatting:'Formatting & readability',contact:'Contact completeness'};

export default function EnhancementPanel({source,onSource,saved,asset,onAsset,disabled,driveConnected,onBusy,onLocate}: {
  source:CvSource; onSource:(source:CvSource)=>void; saved:SavedCv|null; asset:Asset|null;
  onAsset:(asset:Asset|null)=>void; disabled:boolean; driveConnected:boolean;
  onBusy:(busy:boolean)=>void;
  onLocate:(text:string)=>void;
}) {
  const [busy,setBusy]=useState('');
  const lock=useRef(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [editedText,setEditedText]=useState<{assetId:string;text:string}|null>(null);
  const text=editedText?.assetId===asset?.id ? editedText?.text ?? '' : asset?.text ?? '';
  const [jd,setJd]=useState('');
  const [jobName,setJobName]=useState('');
  const [targetRole,setTargetRole]=useState('');
  const [record,setRecord]=useState<AnalysisRecord|null>(null);
  const [analyzedSource,setAnalyzedSource]=useState<CvSource|null>(null);
  const [analyzedJd,setAnalyzedJd]=useState('');
  const [history,setHistory]=useState<AnalysisRecord[]>([]);
  const [previous,setPrevious]=useState<AnalysisRecord|null>(null);
  const [suggestions,setSuggestions]=useState<Suggestion[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [aiSource,setAiSource]=useState<CvSource|null>(null);
  const [original,setOriginal]=useState<{assetId:string;url:string}|null>(null);
  const originalUrl=original?.assetId===asset?.id ? original?.url ?? '' : '';
  const [imports,setImports]=useState<{id:string;name:string;fileId:string}[]>([]);
  const [importId,setImportId]=useState('');
  const [revisions,setRevisions]=useState<{id:number;createdAt:string;source:CvSource}[]>([]);
  const [revisionId,setRevisionId]=useState('');
  useEffect(()=>()=>{if(original) URL.revokeObjectURL(original.url);},[original]);
  const blocked=disabled || !!busy;
  async function run(label:string,action:()=>Promise<void>) {
    if(lock.current || disabled) return;
    lock.current=true; setBusy(label); onBusy(true); setError(''); setNotice('');
    try {await action();} catch(error) {setError(errorText(error));}
    finally {lock.current=false;setBusy('');onBusy(false);}
  }
  async function upload(file?:File) {
    if(!file) return;
    if(source.html && !window.confirm('Open this upload as a new CV? Save or download your current edits first.')) return;
    await run('Uploading original to Google Drive and extracting text',async()=>{
      const result=await enhancements.upload(file); onAsset(result); onSource(result.source);
      setNotice('Original uploaded. Review extracted content before editing.');
    });
  }
  const dirtyAnalysis=!!record && (!analyzedSource || !sameSource(source,analyzedSource) || jd!==analyzedJd);
  return <div className="cv-enhancements">
    <section className="cv-panel">
      <h2>Upload Existing CV &amp; Edit Source Code</h2>
      <p>Upload PDF, DOCX, HTML or a CV image. Originals are stored privately in your Google Drive. Converted documents are editable reconstructions, not identical source recovery.</p>
      <label className="cv-file-label">Upload Existing CV<input type="file" accept=".pdf,.docx,.html,.htm,.png,.jpg,.jpeg,.webp" disabled={blocked || !driveConnected} onChange={event=>{void upload(event.target.files?.[0]);event.target.value='';}} /></label>
      {!driveConnected && <p>Connect Google Drive above to upload and retain your original.</p>}
      <div className="cv-actions">
        <button className="btn btn-outline" disabled={blocked} onClick={()=>run('Loading imports',async()=>setImports(await enhancements.assets()))}>Previous uploads</button>
        {!!imports.length && <><select aria-label="Choose original upload" value={importId} onChange={event=>setImportId(event.target.value)}><option value="">Choose upload</option>{imports.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="btn btn-outline" disabled={blocked || !importId} onClick={()=>{if(window.confirm('Open this original as a new editable draft? Current edits will be replaced.')) void run('Opening original',async()=>{const result=await enhancements.asset(importId);onAsset(result);onSource(result.source);});}}>Open original</button></>}
      </div>
      {asset && <>
        <h3>{asset.name}</h3><p>{asset.conversion==='original-html' ? 'Original HTML source preserved.' : 'Reconstructed HTML — compare against the original.'}</p>
        {asset.limitations.map((item,index)=><p key={index} className="cv-help">{item}</p>)}
        <div className="cv-actions">
          <button className="btn btn-outline" disabled={blocked} onClick={()=>run('Loading original',async()=>{const blob=await enhancements.original(asset.id);setOriginal({assetId:asset.id,url:URL.createObjectURL(blob)});})}>Preview original</button>
          <button className="btn btn-outline" disabled={blocked} onClick={()=>{if(window.confirm('Restore the original imported source and discard current edits?')) onSource(asset.source);}}>Restore original code</button>
          {asset.layoutSource && <button className="btn btn-outline" disabled={blocked} onClick={()=>{if(window.confirm('Use the detected PDF text placement? This approximates layout, substitutes fonts and does not reproduce graphics.')) onSource(asset.layoutSource!);}}>Use detected PDF layout</button>}
          <button className="btn btn-outline" disabled={blocked} onClick={()=>{if(window.confirm('Move this original upload to Drive trash? Your current editable source remains.')) void run('Deleting original',async()=>{await enhancements.removeAsset(asset.id);onAsset(null);setImports(items=>items.filter(item=>item.id!==asset.id));});}}>Delete original</button>
        </div>
        {originalUrl && <div className="cv-original">
          {asset.mime.startsWith('image/') ? <img src={originalUrl} alt="Original uploaded CV" /> : asset.mime==='application/pdf' ? <object data={originalUrl} type="application/pdf" aria-label="Original PDF"><a href={originalUrl} download={asset.name}>Download original PDF</a></object> : asset.mime==='text/html' ? <iframe title="Original HTML reference (isolated)" sandbox="" srcDoc={buildPreview(asset.source)} /> : <p>DOCX original preview requires a document viewer. Use the download and extracted text.</p>}
          <a className="btn btn-outline" href={originalUrl} download={asset.name}>Download original</a>
        </div>}
        <label htmlFor="cv-extracted">Extracted content — review and correct OCR</label>
        <textarea id="cv-extracted" value={text} onChange={event=>setEditedText({assetId:asset.id,text:event.target.value})} disabled={blocked} rows={9} />
        {!!asset.uncertain.length && <details><summary>{asset.uncertain.length} OCR words need review</summary><p>{asset.uncertain.map(item=>`${item.text} (${Math.round(item.confidence)}%)`).join(', ')}</p></details>}
        <button className="btn btn-outline" disabled={blocked || !text.trim()} onClick={()=>{if(window.confirm('Generate new HTML from this text? This replaces the working layout, retaining the original separately.')) void run('Generating editable CV',async()=>onSource(await enhancements.reconstruct(text,source.title)));}}>Generate editable CV from reviewed text</button>
      </>}
      {saved && <div className="cv-actions">
        <button className="btn btn-outline" disabled={blocked} onClick={()=>run('Loading revisions',async()=>setRevisions(await enhancements.revisions(saved.fileId)))}>Saved revisions</button>
        {!!revisions.length && <><select aria-label="Choose revision" value={revisionId} onChange={event=>setRevisionId(event.target.value)}><option value="">Choose revision</option>{revisions.map(item=><option key={item.id} value={item.id}>{new Date(item.createdAt).toLocaleString()}</option>)}</select><button className="btn btn-outline" disabled={blocked || !revisionId} onClick={()=>{const item=revisions.find(item=>String(item.id)===revisionId);if(item && window.confirm('Restore this revision into your editor? Save to make it current.')) onSource(item.source);}}>Restore revision</button></>}
      </div>}
    </section>
    <section className="cv-panel">
      <h2>ATS analysis &amp; job matching</h2>
      <p>Scores explain detected risks and content checks. They do not guarantee acceptance by every ATS.</p>
      <label htmlFor="cv-target">Target role (optional)</label><input id="cv-target" value={targetRole} onChange={event=>setTargetRole(event.target.value)} />
      <label htmlFor="cv-job">Job description (optional)</label><textarea id="cv-job" rows={7} value={jd} onChange={event=>setJd(event.target.value)} placeholder="Paste a job description. No job-match penalty when omitted." />
      <div className="cv-actions"><label>Upload job description<input type="file" accept=".pdf,.docx,.txt" disabled={blocked} onChange={event=>{const file=event.target.files?.[0];if(file) void run('Extracting job description',async()=>{const result=await enhancements.job(file);setJd(result.text);setJobName(result.name);setNotice(result.limitations.join(' '));});event.target.value='';}} /></label><button className="btn btn-outline" disabled={blocked || !jd} onClick={()=>{setJd('');setJobName('');}}>Remove job description</button></div>
      {jobName && <p>Extracted from {jobName}. You can edit the text above.</p>}
      <div className="cv-actions">
        <button className="btn btn-primary" disabled={blocked || !source.html.trim()} onClick={()=>run('Analyzing CV',async()=>{const snapshot={...source};const result=await enhancements.analyze(snapshot,jd,saved?.fileId,asset?.id);setPrevious(record);setRecord(result);setAnalyzedSource(snapshot);setAnalyzedJd(jd);})}>Run ATS analysis</button>
        <button className="btn btn-outline" disabled={blocked} onClick={()=>run('Loading history',async()=>setHistory(await enhancements.history(saved?.fileId)))}>Analysis history</button>
        {record && <button className="btn btn-outline" onClick={()=>downloadSource(JSON.stringify(record,null,2),'cv-analysis.json','application/json')}>Download analysis report</button>}
      </div>
      {!!history.length && <label>Compare previous analysis<select aria-label="Previous analysis" onChange={event=>setPrevious(history.find(item=>item.id===event.target.value) ?? null)}><option value="">Choose previous analysis</option>{history.map(item=><option key={item.id} value={item.id}>{new Date(item.createdAt).toLocaleString()} — {item.result.overall ?? 'N/A'}</option>)}</select></label>}
      {record && <>
        {dirtyAnalysis && <p className="cv-notice">Source or job description changed. Re-run analysis for current results.</p>}
        <h3>Overall score: {record.result.overall ?? 'Not available'} / 100</h3>
        {previous && <p>Previous: {previous.result.overall ?? 'N/A'} → Current: {record.result.overall ?? 'N/A'}. Compare scores only when the target job and analysis method are comparable.</p>}
        <div className="cv-score-grid">{Object.entries(record.result.scores).map(([key,value])=><article key={key}><h3>{labels[key] ?? key}</h3><strong>{value===null ? 'Not applicable' : `${value}/100`}</strong>{value!==null && <progress max={100} value={value} aria-label={labels[key] ?? key} />}</article>)}</div>
        <h3>Issues and recommended fixes</h3>
        <div className="cv-issues">{record.result.issues.map((issue,index)=><article key={`${issue.id}-${index}`} className={`cv-issue cv-issue-${issue.severity}`}><strong>{issue.severity} · {issue.kind} · {issue.section}</strong><p>{issue.message}</p><p>{issue.recommendation}</p><button className="btn btn-outline" onClick={()=>onLocate(issue.section)}>Edit source · {issue.section}</button></article>)}</div>
        <details><summary>Section evaluations, strengths and weaknesses</summary><Readable value={record.result.sections} /></details>
        <details><summary>Extracted contact information</summary><Readable value={record.result.contacts} /></details>
        {record.result.job && <details open><summary>Job requirements, gaps and matching evidence</summary><JobEvidence value={record.result.job} onLocate={onLocate} /></details>}
        <details><summary>Scoring methodology</summary><Readable value={record.result.methodology} /></details>
        <ul>{record.result.limitations.map((item,index)=><li key={index}>{item}</li>)}</ul>
      </>}
    </section>
    <section className="cv-panel">
      <h2>AI improvements — review before applying</h2>
      <p>Generating suggestions sends CV text and the optional job description to the configured AI provider. Verify facts and wording before accepting changes.</p>
      <button className="btn btn-primary" disabled={blocked || !source.html.trim()} onClick={()=>run('Requesting AI suggestions',async()=>{const snapshot={...source};const result=await enhancements.improve(snapshot,jd,targetRole);setAiSource(snapshot);setSuggestions(result.suggestions);setSelected([]);if(!result.suggestions.length)setNotice('The provider returned no applicable suggestions. No changes were made.');})}>Generate AI suggestions</button>
      {aiSource && !sameSource(aiSource,source) && <p className="cv-notice">The CV changed after these suggestions were generated. Generate new suggestions before applying.</p>}
      {suggestions.map(item=><article className="cv-suggestion" key={item.id}>
        <h3>{item.section}</h3><p>{item.reason}</p>
        <div className="cv-comparison"><div><strong>Original</strong><p><TextDiff original={item.original} replacement={item.replacement} side="original" /></p></div><div><label htmlFor={`suggestion-${item.id}`}>Improved — editable</label><p><TextDiff original={item.original} replacement={item.replacement} side="replacement" /></p><textarea id={`suggestion-${item.id}`} value={item.replacement} onChange={event=>setSuggestions(items=>items.map(candidate=>candidate.id===item.id ? {...candidate,replacement:event.target.value} : candidate))} /></div></div>
        <label><input type="checkbox" checked={selected.includes(item.id)} onChange={event=>setSelected(ids=>event.target.checked ? [...ids,item.id] : ids.filter(id=>id!==item.id))} /> Accept suggestion — I verified its accuracy</label>
        <button className="btn btn-outline" onClick={()=>{setSuggestions(items=>items.filter(candidate=>candidate.id!==item.id));setSelected(ids=>ids.filter(id=>id!==item.id));}}>Reject suggestion</button>
      </article>)}
      {!!suggestions.length && <div className="cv-actions"><button className="btn btn-primary" disabled={blocked || !selected.length || !aiSource || !sameSource(aiSource,source)} onClick={()=>{try{onSource(applySuggestions(source,suggestions.filter(item=>selected.includes(item.id))));setNotice('Selected suggestions applied to the working CV. Save and re-run ATS analysis.');setSelected([]);}catch(error){setError(errorText(error));}}}>Apply selected suggestions</button><button className="btn btn-outline" disabled={blocked || !aiSource} onClick={()=>{if(aiSource && window.confirm('Restore the CV from before AI improvements?')) onSource(aiSource);}}>Restore before AI</button></div>}
    </section>
    {busy && <div role="status" className="cv-notice"><progress aria-label={busy} /> {busy}…</div>}
    {error && <p role="alert" className="cv-error">{error}</p>}
    {notice && <p role="status" className="cv-notice">{notice}</p>}
  </div>;
}

function TextDiff({original,replacement,side}:{original:string;replacement:string;side:'original'|'replacement'}) {
  let start=0,end=0;
  while(start<original.length && start<replacement.length && original[start]===replacement[start]) start++;
  while(end<original.length-start && end<replacement.length-start && original[original.length-end-1]===replacement[replacement.length-end-1]) end++;
  const value=side==='original' ? original : replacement;
  return <>{value.slice(0,start)}{side==='original' ? <del>{value.slice(start,value.length-end)}</del> : <ins>{value.slice(start,value.length-end)}</ins>}{end ? value.slice(-end) : ''}</>;
}

function JobEvidence({value,onLocate}:{value:unknown;onLocate:(text:string)=>void}) {
  const job=value as {requirements?:{id:string;term:string;importance:string;status:string;source:string;evidence:string[]}[];recommendations?:string[]};
  return <div>{job.requirements?.map(item=><article className="cv-issue" key={item.id}>
    <strong>{item.term} — {item.importance} · {item.status}</strong><p>Job requirement: {item.source}</p>
    {item.evidence.map((text,index)=><p key={index}><mark>{text}</mark> <button className="btn btn-outline" onClick={()=>onLocate(text)}>Locate evidence in source</button></p>)}
    {!item.evidence.length && <p>No supporting evidence found. Add only information you can verify.</p>}
  </article>)}<ul>{job.recommendations?.map(text=><li key={text}>{text}</li>)}</ul></div>;
}

function Readable({value}:{value:unknown}) {
  if(value===null || value===undefined) return <span>Not available</span>;
  if(typeof value !== 'object') return <span>{String(value)}</span>;
  if(Array.isArray(value)) return <ul>{value.map((item,index)=><li key={index}><Readable value={item} /></li>)}</ul>;
  return <dl className="cv-detail-list">{Object.entries(value).map(([key,item])=><div key={key}><dt>{key.replace(/([A-Z])/g,' $1')}</dt><dd><Readable value={item} /></dd></div>)}</dl>;
}
