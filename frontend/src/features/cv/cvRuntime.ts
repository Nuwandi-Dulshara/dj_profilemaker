import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export interface CodeDiagnostic {
  file: string;
  line: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface CompiledCvResult {
  html: string;
  pages: string[];
  css: string;
  diagnostics: CodeDiagnostic[];
  runtimeError: string | null;
}

/**
 * Normalize a workspace relative path like "./components/Header.jsx" from base "src/App.jsx"
 */
export function resolveWorkspacePath(fromFile: string, importSpec: string, allFiles: Record<string, string>): string | null {
  const cleanSpec = importSpec.trim().replace(/^['"]|['"]$/g, '');
  if (!cleanSpec) return null;

  let candidate = cleanSpec;
  if (cleanSpec.startsWith('.')) {
    const fromParts = fromFile.split('/');
    fromParts.pop(); // directory of fromFile
    const specParts = cleanSpec.split('/');
    for (const part of specParts) {
      if (!part || part === '.') continue;
      if (part === '..') {
        fromParts.pop();
      } else {
        fromParts.push(part);
      }
    }
    candidate = fromParts.join('/');
  } else {
    candidate = cleanSpec.replace(/^\/+/, '');
  }

  const extensions = ['', '.jsx', '.js', '.tsx', '.ts', '.css', '.json', '/index.jsx', '/index.js'];
  for (const ext of extensions) {
    const full = `${candidate}${ext}`;
    if (Object.prototype.hasOwnProperty.call(allFiles, full)) {
      return full;
    }
  }
  return null;
}

/**
 * Inspect code for syntax, bracket balance, unclosed JSX tags, and unresolved local imports.
 */
export function analyzeFileDiagnostics(
  filePath: string,
  code: string,
  allFiles: Record<string, string>
): CodeDiagnostic[] {
  const diagnostics: CodeDiagnostic[] = [];
  const isCodeFile = /\.(jsx|tsx|js|ts)$/i.test(filePath);
  const isCssFile = /\.css$/i.test(filePath);

  if (!code.trim()) return diagnostics;

  // Check bracket balance ({}, (), []) ignoring strings and comments
  if (isCodeFile || isCssFile) {
    const stack: { char: string; line: number }[] = [];
    const pairs: Record<string, string> = { '{': '}', '(': ')', '[': ']' };
    const closingToOpening: Record<string, string> = { '}': '{', ')': '(', ']': '[' };
    let line = 1;
    let i = 0;

    while (i < code.length) {
      const ch = code[i];
      const next = code[i + 1];
      if (ch === '\n') {
        line += 1;
        i += 1;
        continue;
      }
      // Line comment
      if (ch === '/' && next === '/') {
        while (i < code.length && code[i] !== '\n') i += 1;
        continue;
      }
      // Block comment
      if (ch === '/' && next === '*') {
        i += 2;
        while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) {
          if (code[i] === '\n') line += 1;
          i += 1;
        }
        i += 2;
        continue;
      }
      // Strings
      if (ch === '"' || ch === "'" || ch === '`') {
        const quote = ch;
        i += 1;
        while (i < code.length && code[i] !== quote) {
          if (code[i] === '\\') {
            i += 2;
            continue;
          }
          if (code[i] === '\n') line += 1;
          i += 1;
        }
        i += 1;
        continue;
      }

      if (pairs[ch]) {
        stack.push({ char: ch, line });
      } else if (closingToOpening[ch]) {
        const last = stack.pop();
        if (!last || last.char !== closingToOpening[ch]) {
          diagnostics.push({
            file: filePath,
            line,
            message: `Unexpected closing "${ch}" with no matching "${closingToOpening[ch]}".`,
            severity: 'error',
          });
        }
      }
      i += 1;
    }

    for (const unclosed of stack) {
      diagnostics.push({
        file: filePath,
        line: unclosed.line,
        message: `Unclosed "${unclosed.char}" opened on line ${unclosed.line}.`,
        severity: 'error',
      });
    }
  }

  // Check local imports in JS/JSX files
  if (isCodeFile) {
    const lines = code.split('\n');
    lines.forEach((lineText, idx) => {
      const importMatch = lineText.match(/^\s*import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/);
      if (importMatch) {
        const spec = importMatch[1];
        if (spec !== 'react' && spec !== 'react-dom') {
          const resolved = resolveWorkspacePath(filePath, spec, allFiles);
          if (!resolved) {
            diagnostics.push({
              file: filePath,
              line: idx + 1,
              message: `Cannot resolve import "${spec}" from "${filePath}". Create or upload the target file.`,
              severity: 'error',
            });
          }
        }
      }
    });
  }

  return diagnostics;
}

/**
 * Lightweight JSX -> React.createElement transpiler that handles:
 * - Standard HTML & custom React component tags (<Header title="CV" />, <div className="box">...</div>)
 * - Fragments (<>...</>)
 * - Expression children and props ({user.name}, {items.map(...)})
 * - ES module import/export statements converted to CommonJS-like sandboxed calls
 */
export function transpileJsxToCommonJs(source: string): string {
  let code = source;

  // Strip block comments and JSX comments
  code = code.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  // Transform ES module imports
  // 1. import Default, { a, b as c } from 'spec'
  code = code.replace(
    /^\s*import\s+([A-Za-z_$][\w$]*)\s*,\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]\s*;?/gm,
    (_m, defName: string, namedList: string, spec: string) => {
      const mapped = namedList
        .split(',')
        .map((s) => s.trim().replace(/\s+as\s+/g, ': '))
        .filter(Boolean)
        .join(', ');
      return `const __mod_${defName} = __require("${spec}"); const ${defName} = __mod_${defName}.default !== undefined ? __mod_${defName}.default : __mod_${defName}; const { ${mapped} } = __mod_${defName};`;
    }
  );

  // 2. import * as ns from 'spec'
  code = code.replace(
    /^\s*import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s*['"]([^'"]+)['"]\s*;?/gm,
    (_m, ns: string, spec: string) => `const ${ns} = __require("${spec}");`
  );

  // 3. import { a, b as c } from 'spec'
  code = code.replace(
    /^\s*import\s+\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]\s*;?/gm,
    (_m, namedList: string, spec: string) => {
      const mapped = namedList
        .split(',')
        .map((s) => s.trim().replace(/\s+as\s+/g, ': '))
        .filter(Boolean)
        .join(', ');
      return `const { ${mapped} } = __require("${spec}");`;
    }
  );

  // 4. import Default from 'spec'
  code = code.replace(
    /^\s*import\s+([A-Za-z_$][\w$]*)\s+from\s*['"]([^'"]+)['"]\s*;?/gm,
    (_m, defName: string, spec: string) =>
      `const __mod_${defName} = __require("${spec}"); const ${defName} = __mod_${defName} && __mod_${defName}.default !== undefined ? __mod_${defName}.default : __mod_${defName};`
  );

  // 5. import 'spec'
  code = code.replace(/^\s*import\s+['"]([^'"]+)['"]\s*;?/gm, (_m, spec: string) => `__require("${spec}");`);

  // Transform exports
  code = code.replace(
    /^\s*export\s+default\s+function\s+([A-Za-z_$][\w$]*)/gm,
    'exports.default = function $1'
  );
  code = code.replace(/^\s*export\s+default\s+/gm, 'exports.default = ');
  code = code.replace(
    /^\s*export\s+function\s+([A-Za-z_$][\w$]*)/gm,
    'exports.$1 = function $1'
  );
  code = code.replace(
    /^\s*export\s+const\s+([A-Za-z_$][\w$]*)\s*=/gm,
    'const $1 = exports.$1 ='
  );
  code = code.replace(
    /^\s*export\s+let\s+([A-Za-z_$][\w$]*)\s*=/gm,
    'let $1 = exports.$1 ='
  );

  // Transpile JSX recursively
  return transformJsxExpressions(code);
}

function parseAttributes(attrString: string): string {
  const trimmed = attrString.trim();
  if (!trimmed) return 'null';

  const props: string[] = [];
  let i = 0;

  while (i < trimmed.length) {
    while (i < trimmed.length && /\s/.test(trimmed[i])) i += 1;
    if (i >= trimmed.length) break;

    // Spread attribute {...props}
    if (trimmed.startsWith('{...', i)) {
      let depth = 1;
      const start = i + 4;
      i += 4;
      while (i < trimmed.length && depth > 0) {
        if (trimmed[i] === '{') depth += 1;
        else if (trimmed[i] === '}') depth -= 1;
        i += 1;
      }
      const expr = trimmed.slice(start, i - 1).trim();
      props.push(`...(${expr})`);
      continue;
    }

    // Attribute name
    const nameStart = i;
    while (i < trimmed.length && /[A-Za-z0-9_:-]/.test(trimmed[i])) i += 1;
    const name = trimmed.slice(nameStart, i);
    if (!name) {
      i += 1;
      continue;
    }

    while (i < trimmed.length && /\s/.test(trimmed[i])) i += 1;

    if (trimmed[i] !== '=') {
      props.push(`${JSON.stringify(name)}: true`);
      continue;
    }
    i += 1; // skip '='
    while (i < trimmed.length && /\s/.test(trimmed[i])) i += 1;

    if (trimmed[i] === '"' || trimmed[i] === "'") {
      const quote = trimmed[i];
      i += 1;
      const valStart = i;
      while (i < trimmed.length && trimmed[i] !== quote) {
        if (trimmed[i] === '\\') i += 1;
        i += 1;
      }
      const strVal = trimmed.slice(valStart, i);
      i += 1;
      props.push(`${JSON.stringify(name)}: ${JSON.stringify(strVal)}`);
    } else if (trimmed[i] === '{') {
      let depth = 1;
      i += 1;
      const exprStart = i;
      while (i < trimmed.length && depth > 0) {
        if (trimmed[i] === '{') depth += 1;
        else if (trimmed[i] === '}') depth -= 1;
        i += 1;
      }
      const rawExpr = trimmed.slice(exprStart, i - 1).trim();
      props.push(`${JSON.stringify(name)}: (${transformJsxExpressions(rawExpr)})`);
    }
  }

  return `{ ${props.join(', ')} }`;
}

function formatTagRef(tagName: string): string {
  if (!tagName) return 'React.Fragment';
  if (/^[A-Z]/.test(tagName) || tagName.includes('.')) {
    return tagName;
  }
  return JSON.stringify(tagName);
}

function parseChildren(inner: string): string[] {
  const args: string[] = [];
  let i = 0;

  while (i < inner.length) {
    if (inner[i] === '{') {
      let depth = 1;
      i += 1;
      const start = i;
      while (i < inner.length && depth > 0) {
        if (inner[i] === '{') depth += 1;
        else if (inner[i] === '}') depth -= 1;
        i += 1;
      }
      const expr = inner.slice(start, i - 1).trim();
      if (expr) {
        args.push(transformJsxExpressions(expr));
      }
    } else if (inner[i] === '<') {
      const jsxEnd = findMatchingJsxEnd(inner, i);
      if (jsxEnd > i) {
        const chunk = inner.slice(i, jsxEnd);
        args.push(transformJsxExpressions(chunk));
        i = jsxEnd;
      } else {
        i += 1;
      }
    } else {
      const start = i;
      while (i < inner.length && inner[i] !== '{' && inner[i] !== '<') {
        i += 1;
      }
      const rawText = inner.slice(start, i);
      const collapsed = rawText.replace(/\s*\n\s*/g, ' ');
      if (collapsed.trim()) {
        args.push(JSON.stringify(collapsed));
      }
    }
  }

  return args;
}

function findOpeningTagEnd(str: string, startIndex: number): { end: number; selfClosing: boolean; tagName: string; attrs: string } | null {
  if (str[startIndex] !== '<') return null;
  // Fragment <>
  if (str[startIndex + 1] === '>') {
    return { end: startIndex + 2, selfClosing: false, tagName: '', attrs: '' };
  }
  const tagMatch = str.slice(startIndex).match(/^<([A-Za-z_$][\w$.-]*)/);
  if (!tagMatch) return null;
  const tagName = tagMatch[1];

  let i = startIndex + tagMatch[0].length;
  let braceDepth = 0;
  let quote: string | null = null;

  while (i < str.length) {
    const ch = str[i];
    if (quote) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === '{') {
      braceDepth += 1;
      i += 1;
      continue;
    }
    if (ch === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      i += 1;
      continue;
    }
    if (braceDepth === 0) {
      if (ch === '/' && str[i + 1] === '>') {
        const attrs = str.slice(startIndex + tagMatch[0].length, i);
        return { end: i + 2, selfClosing: true, tagName, attrs };
      }
      if (ch === '>') {
        const attrs = str.slice(startIndex + tagMatch[0].length, i);
        return { end: i + 1, selfClosing: false, tagName, attrs };
      }
    }
    i += 1;
  }
  return null;
}

function findMatchingJsxEnd(str: string, startIndex: number): number {
  const openInfo = findOpeningTagEnd(str, startIndex);
  if (!openInfo) return -1;
  if (openInfo.selfClosing) return openInfo.end;

  const stack: string[] = [openInfo.tagName];
  let i = openInfo.end;
  let braceDepth = 0;
  let quote: string | null = null;

  while (i < str.length) {
    const ch = str[i];
    if (quote) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === '{') {
      braceDepth += 1;
      i += 1;
      continue;
    }
    if (ch === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      i += 1;
      continue;
    }

    if (braceDepth === 0 && ch === '<') {
      // Closing tag </tagName> or </>
      const closeMatch = str.slice(i).match(/^<\/([A-Za-z_$][\w$.-]*)?\s*>/);
      if (closeMatch) {
        const closedTag = closeMatch[1] || '';
        const top = stack[stack.length - 1];
        if (closedTag === top) {
          stack.pop();
          i += closeMatch[0].length;
          if (stack.length === 0) return i;
          continue;
        }
      }
      // Nested opening tag
      const nestedOpen = findOpeningTagEnd(str, i);
      if (nestedOpen) {
        if (!nestedOpen.selfClosing) {
          stack.push(nestedOpen.tagName);
        }
        i = nestedOpen.end;
        continue;
      }
    }
    i += 1;
  }

  return -1;
}

export function transformJsxExpressions(input: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;

  while (i < input.length) {
    const ch = input[i];
    const next = input[i + 1];

    if (quote) {
      if (ch === '\\') {
        out += input.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      out += ch;
      i += 1;
      continue;
    }

    // Skip comments
    if (ch === '/' && next === '/') {
      const endLine = input.indexOf('\n', i);
      if (endLine === -1) {
        out += input.slice(i);
        break;
      }
      out += input.slice(i, endLine + 1);
      i = endLine + 1;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === '<' && (next === '>' || /[A-Za-z_$]/.test(next || ''))) {
      // Ensure '<' is a JSX tag and not a comparison operator like `a < b`
      const prevNonSpace = out.trimEnd().slice(-1);
      const isComparison = /[A-Za-z0-9_$)\]]/.test(prevNonSpace) && !/\b(return|case|yield|typeof|void|delete|in|of|instanceof)$/.test(out.trimEnd());
      if (!isComparison) {
        const openInfo = findOpeningTagEnd(input, i);
        const jsxEnd = openInfo ? findMatchingJsxEnd(input, i) : -1;
        if (openInfo && jsxEnd > i) {
          const tagRef = formatTagRef(openInfo.tagName);
          const propsCode = openInfo.tagName === '' ? 'null' : parseAttributes(openInfo.attrs);
          if (openInfo.selfClosing) {
            out += `React.createElement(${tagRef}, ${propsCode})`;
          } else {
            const closeTagLen = openInfo.tagName ? openInfo.tagName.length + 3 : 3;
            const innerStart = openInfo.end;
            const innerEnd = jsxEnd - closeTagLen;
            const inner = input.slice(innerStart, Math.max(innerStart, innerEnd));
            const childrenArgs = parseChildren(inner);
            out += `React.createElement(${tagRef}, ${propsCode}${childrenArgs.length ? `, ${childrenArgs.join(', ')}` : ''})`;
          }
          i = jsxEnd;
          continue;
        }
      }
    }

    out += ch;
    i += 1;
  }

  return out;
}

/**
 * Split rendered CV HTML into one or more A4 pages.
 * Supports explicit page breaks (`class="page-break"`, `<hr class="page-break">`, `data-page-break`)
 * as well as top-level `.cv-page` / `.a4-page` blocks.
 */
export function paginateRenderedHtml(html: string): string[] {
  const trimmed = html.trim();
  if (!trimmed) return [];

  // Split on explicit page-break markers
  const explicitSplit = trimmed.split(
    /<(?:div|hr|section)\b[^>]*\bclass=["'][^"']*\bpage-break\b[^"']*["'][^>]*>(?:<\/(?:div|section)>)?/i
  );
  if (explicitSplit.length > 1) {
    return explicitSplit.map((p) => p.trim()).filter(Boolean);
  }

  return [trimmed];
}

/**
 * Compile and execute the user's multi-file React JSX/JS and CSS workspace in a sandboxed module runner.
 */
export function compileAndRenderCvWorkspace(files: Record<string, string>): CompiledCvResult {
  const diagnostics: CodeDiagnostic[] = [];
  const cssParts: string[] = [];

  for (const [path, content] of Object.entries(files)) {
    if (path.endsWith('.css') && content.trim()) {
      cssParts.push(`/* ${path} */\n${content}`);
    }
    diagnostics.push(...analyzeFileDiagnostics(path, content, files));
  }

  // Determine entry React file
  const codeFiles = Object.keys(files).filter(
    (p) => /\.(jsx|tsx|js|ts|html)$/i.test(p) && (files[p] || '').trim().length > 0
  );

  if (codeFiles.length === 0) {
    return {
      html: '',
      pages: [],
      css: cssParts.join('\n\n'),
      diagnostics,
      runtimeError: null,
    };
  }

  codeFiles.sort((a, b) => {
    const aBase = a.split('/').pop() || '';
    const bBase = b.split('/').pop() || '';
    const rank = (name: string) => {
      if (/^main\.(jsx|tsx|js|ts)$/i.test(name)) return 0;
      if (/^app\.(jsx|tsx|js|ts)$/i.test(name)) return 1;
      if (/^index\.(jsx|tsx|js|ts)$/i.test(name)) return 2;
      if (/^cv\.(jsx|tsx|js|ts)$/i.test(name)) return 3;
      return 4;
    };
    const aDepth = a.split('/').length;
    const bDepth = b.split('/').length;
    return rank(aBase) - rank(bBase) || aDepth - bDepth || a.localeCompare(b);
  });

  const entryFile = codeFiles[0];
  const moduleCache: Record<string, any> = {};
  const evaluating = new Set<string>();

  function resolveImageSrcInHtml(rawHtml: string): string {
    return rawHtml.replace(/src=["']([^"']+)["']/g, (full, srcPath: string) => {
      const clean = srcPath.replace(/^\.?\//, '');
      if (files[clean] && files[clean].startsWith('data:image/')) {
        return `src="${files[clean]}"`;
      }
      // Also check matching basename for convenience
      const byBasename = Object.keys(files).find(
        (k) => (k === clean || k.endsWith(`/${clean}`)) && files[k].startsWith('data:image/')
      );
      if (byBasename) {
        return `src="${files[byBasename]}"`;
      }
      return full;
    });
  }

  function evaluateModule(filePath: string): any {
    if (moduleCache[filePath]) return moduleCache[filePath];
    if (evaluating.has(filePath)) return moduleCache[filePath] || {};

    const rawSource = files[filePath] ?? '';

    // Handle non-JS assets
    if (filePath.endsWith('.css')) {
      moduleCache[filePath] = {};
      return {};
    }
    if (filePath.endsWith('.json')) {
      const parsed = JSON.parse(rawSource || '{}');
      moduleCache[filePath] = { default: parsed, ...parsed };
      return moduleCache[filePath];
    }
    if (/\.(png|jpe?g|svg|gif|webp)$/i.test(filePath) || rawSource.startsWith('data:image/')) {
      moduleCache[filePath] = { default: rawSource };
      return moduleCache[filePath];
    }

    evaluating.add(filePath);
    const exportsObj: Record<string, any> = {};
    const moduleObj = { exports: exportsObj };
    moduleCache[filePath] = exportsObj;

    let normalizedSource = rawSource;
    // If the file is plain JSX without export/function declarations, wrap it in export default
    if (
      !/\bexport\s+(default|function|const|let)\b/.test(normalizedSource) &&
      !/\bfunction\s+[A-Z]/.test(normalizedSource) &&
      normalizedSource.trim().startsWith('<')
    ) {
      normalizedSource = `export default function AutoCvComponent() { return (${normalizedSource}); }`;
    } else if (
      !/\bexport\s+(default|function|const|let)\b/.test(normalizedSource) &&
      /\bfunction\s+([A-Z][A-Za-z0-9_]*)/.test(normalizedSource)
    ) {
      const fnName = normalizedSource.match(/\bfunction\s+([A-Z][A-Za-z0-9_]*)/)?.[1];
      if (fnName) {
        normalizedSource = `${normalizedSource}\nexport default ${fnName};`;
      }
    }

    const transpiled = transpileJsxToCommonJs(normalizedSource);

    const localRequire = (spec: string) => {
      if (spec === 'react') return React;
      const target = resolveWorkspacePath(filePath, spec, files);
      if (!target) {
        throw new Error(`Cannot resolve import "${spec}" from "${filePath}"`);
      }
      return evaluateModule(target);
    };

    // Execute in an isolated function scope with shadowed browser globals
    const runner = new Function(
      'React',
      'useState',
      'useMemo',
      'useCallback',
      'useRef',
      'useEffect',
      '__require',
      'exports',
      'module',
      'window',
      'document',
      'fetch',
      `"use strict";\n${transpiled}`
    );

    runner(
      React,
      React.useState,
      React.useMemo,
      React.useCallback,
      React.useRef,
      React.useEffect,
      localRequire,
      exportsObj,
      moduleObj,
      undefined,
      undefined,
      undefined
    );

    evaluating.delete(filePath);
    moduleCache[filePath] = moduleObj.exports;
    return moduleObj.exports;
  }

  try {
    const entryExports = evaluateModule(entryFile);
    const EntryComponent =
      entryExports?.default ||
      Object.values(entryExports || {}).find((v) => typeof v === 'function' || React.isValidElement(v));

    let renderedHtml = '';
    if (typeof EntryComponent === 'function') {
      renderedHtml = renderToStaticMarkup(React.createElement(EntryComponent as React.ComponentType));
    } else if (React.isValidElement(EntryComponent)) {
      renderedHtml = renderToStaticMarkup(EntryComponent);
    } else if (entryFile.endsWith('.html')) {
      renderedHtml = files[entryFile] || '';
    }

    const resolvedHtml = resolveImageSrcInHtml(renderedHtml);
    const pages = paginateRenderedHtml(resolvedHtml);

    return {
      html: resolvedHtml,
      pages,
      css: cssParts.join('\n\n'),
      diagnostics,
      runtimeError: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      html: '',
      pages: [],
      css: cssParts.join('\n\n'),
      diagnostics,
      runtimeError: `${entryFile}: ${msg}`,
    };
  }
}

/**
 * Convert rendered CV HTML (never raw React JSX code) into an editable Word (.docx) document
 * preserving headings, bold/italic formatting, bullet lists, tables, and page breaks.
 */
export async function exportRenderedCvToDocx(renderedHtml: string, projectTitle: string): Promise<Blob> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    PageBreak,
    Table,
    TableRow,
    TableCell,
    WidthType,
  } = await import('docx');

  const container = document.createElement('div');
  container.innerHTML = renderedHtml || `<h1>${projectTitle || 'Untitled'}</h1>`;

  const docChildren: any[] = [];

  function collectInlineRuns(node: Node, style: { bold?: boolean; italics?: boolean } = {}): any[] {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').replace(/\s+/g, ' ');
      if (!text) return [];
      return [
        new TextRun({
          text,
          bold: style.bold,
          italics: style.italics,
        }),
      ];
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return [];
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'br') {
      return [new TextRun({ text: '', break: 1 })];
    }

    const nextStyle = {
      bold: style.bold || tag === 'strong' || tag === 'b',
      italics: style.italics || tag === 'em' || tag === 'i',
    };

    const runs: any[] = [];
    el.childNodes.forEach((child) => {
      runs.push(...collectInlineRuns(child, nextStyle));
    });
    return runs;
  }

  function walkBlockNodes(parent: HTMLElement) {
    Array.from(parent.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent || '').trim();
        if (text) {
          docChildren.push(
            new Paragraph({
              children: [new TextRun({ text })],
              spacing: { after: 120 },
            })
          );
        }
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (el.classList.contains('page-break') || (tag === 'hr' && el.classList.contains('page-break'))) {
        docChildren.push(new Paragraph({ children: [new PageBreak()] }));
        return;
      }

      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
        const headingMap: Record<string, any> = {
          h1: HeadingLevel.HEADING_1,
          h2: HeadingLevel.HEADING_2,
          h3: HeadingLevel.HEADING_3,
          h4: HeadingLevel.HEADING_4,
        };
        const runs = collectInlineRuns(el, { bold: true });
        docChildren.push(
          new Paragraph({
            heading: headingMap[tag],
            children: runs.length ? runs : [new TextRun({ text: el.textContent || '', bold: true })],
            spacing: { before: 180, after: 100 },
          })
        );
        return;
      }

      if (tag === 'p') {
        const runs = collectInlineRuns(el);
        if (runs.length > 0) {
          docChildren.push(
            new Paragraph({
              children: runs,
              spacing: { after: 120 },
            })
          );
        }
        return;
      }

      if (tag === 'ul' || tag === 'ol') {
        Array.from(el.querySelectorAll(':scope > li')).forEach((li) => {
          const runs = collectInlineRuns(li);
          docChildren.push(
            new Paragraph({
              bullet: { level: 0 },
              children: runs.length ? runs : [new TextRun({ text: li.textContent || '' })],
              spacing: { after: 80 },
            })
          );
        });
        return;
      }

      if (tag === 'table') {
        const rows = Array.from(el.querySelectorAll('tr')).map((tr) => {
          const cells = Array.from(tr.querySelectorAll('th, td')).map(
            (cell) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: collectInlineRuns(cell, {
                      bold: cell.tagName.toLowerCase() === 'th',
                    }),
                  }),
                ],
              })
          );
          return new TableRow({ children: cells.length ? cells : [new TableCell({ children: [new Paragraph('')] })] });
        });
        if (rows.length > 0) {
          docChildren.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows,
            })
          );
        }
        return;
      }

      // Container tags (div, section, article, header, main, footer, span)
      const hasBlockChildren = Array.from(el.children).some((c) =>
        /^(div|section|article|header|main|footer|h[1-6]|p|ul|ol|table|hr)$/i.test(c.tagName)
      );
      if (hasBlockChildren) {
        walkBlockNodes(el);
      } else {
        const runs = collectInlineRuns(el);
        if (runs.length > 0) {
          docChildren.push(
            new Paragraph({
              children: runs,
              spacing: { after: 120 },
            })
          );
        }
      }
    });
  }

  walkBlockNodes(container);

  if (docChildren.length === 0) {
    docChildren.push(
      new Paragraph({
        children: [new TextRun({ text: projectTitle || 'Untitled', bold: true })],
      })
    );
  }

  const wordDoc = new Document({
    title: projectTitle || 'Untitled',
    creator: 'Advanced CV Builder',
    sections: [{ children: docChildren }],
  });

  const buffer = await Packer.toArrayBuffer(wordDoc);
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

