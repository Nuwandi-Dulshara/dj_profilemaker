import type { CvSource } from './integrations';

export function downloadSource(content: string, name: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], {type:mime}));
  const link = document.createElement('a'); link.href=url; link.download=name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function applySuggestions(source: CvSource, suggestions: {original:string; replacement:string}[]): CvSource {
  let html = source.html;
  const escape = (value:string) => value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // Locate only text tokens; preserve every byte outside the accepted replacement.
  const pattern = /<!--[\s\S]*?-->|<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)\s*>|<[^>]*(?:"[^"]*"[^>]*|'[^']*'[^>]*)*>|([^<]+)/gi;
  for (const suggestion of suggestions) {
    const matches:{start:number; end:number; value:string}[]=[];
    for (const match of html.matchAll(pattern)) {
      if (!match[1]) continue;
      const decoder=document.createElement('textarea'); decoder.innerHTML=match[1];
      const value=decoder.value;
      if (value.includes(suggestion.original)) matches.push({start:match.index!,end:match.index!+match[0].length,value});
    }
    if (matches.length !== 1 || matches[0].value.split(suggestion.original).length !== 2) {
      throw new Error('This suggestion spans formatting or repeats in the CV. Apply it manually in the code editor to preserve your layout.');
    }
    const match=matches[0];
    html=html.slice(0,match.start)+escape(match.value.replace(suggestion.original,suggestion.replacement))+html.slice(match.end);
  }
  return {...source,html};
}

export function validateSource(source:CvSource):string[] {
  const warnings:string[]=[];
  if (/<script\b|\bon\w+\s*=|<iframe\b/i.test(source.html)) warnings.push('Scripts, event handlers and embedded frames are disabled in the isolated preview.');
  if (/<(?:link|img)\b[^>]*(?:href|src)\s*=\s*["']https?:/i.test(source.html)) warnings.push('External resources are blocked. Embed supported images and include CSS in the source.');
  try {
    const sheet=new CSSStyleSheet(); sheet.replaceSync(source.css);
    if (source.css.trim() && !sheet.cssRules.length) warnings.push('No valid CSS rules were parsed. Check CSS syntax.');
  } catch { warnings.push('CSS could not be parsed. Check syntax; your source is unchanged.'); }
  const opens=(source.css.match(/{/g) ?? []).length, closes=(source.css.match(/}/g) ?? []).length;
  if (opens !== closes) warnings.push('CSS braces are unbalanced.');
  return warnings;
}
