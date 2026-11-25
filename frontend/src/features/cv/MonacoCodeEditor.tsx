import { useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import type { CodeDiagnostic } from './cvRuntime';

interface CompletionItem {
  label: string;
  insertText: string;
  detail: string;
}

const JSX_COMPLETIONS: CompletionItem[] = [
  {
    label: 'export default function',
    insertText: 'export default function CV() {\n  return (\n    <div className="cv-container">\n      \n    </div>\n  );\n}',
    detail: 'React CV component',
  },
  {
    label: 'import component',
    insertText: "import Component from './Component.jsx';",
    detail: 'Import user React file',
  },
  {
    label: 'import styles',
    insertText: "import './styles.css';",
    detail: 'Import CSS stylesheet',
  },
  { label: 'className', insertText: 'className=""', detail: 'JSX CSS class attribute' },
  { label: 'useState', insertText: 'const [state, setState] = useState();', detail: 'React state hook' },
  { label: 'useMemo', insertText: 'const value = useMemo(() => , []);', detail: 'React memo hook' },
  { label: 'header', insertText: '<header className="cv-header">\n  \n</header>', detail: 'CV Header section' },
  { label: 'section', insertText: '<section className="cv-section">\n  <h2></h2>\n</section>', detail: 'CV Content section' },
  { label: 'page-break', insertText: '<div className="page-break" />', detail: 'Multi-page A4 break' },
];

const CSS_COMPLETIONS: CompletionItem[] = [
  { label: 'display: flex', insertText: 'display: flex;', detail: 'Flexbox layout' },
  { label: 'display: grid', insertText: 'display: grid;', detail: 'CSS Grid layout' },
  { label: 'grid-template-columns', insertText: 'grid-template-columns: 1fr 2fr;', detail: 'Two-column CV grid' },
  { label: 'justify-content', insertText: 'justify-content: space-between;', detail: 'Flex alignment' },
  { label: 'font-family', insertText: 'font-family: Inter, system-ui, sans-serif;', detail: 'Typography' },
  { label: 'font-size', insertText: 'font-size: 14px;', detail: 'Font size' },
  { label: 'font-weight', insertText: 'font-weight: 700;', detail: 'Bold text' },
  { label: 'color', insertText: 'color: #0b1f3a;', detail: 'Text color' },
  { label: 'border-bottom', insertText: 'border-bottom: 2px solid #0b1f3a;', detail: 'Section divider' },
  { label: 'padding', insertText: 'padding: 16px;', detail: 'Inner spacing' },
  { label: 'margin-bottom', insertText: 'margin-bottom: 16px;', detail: 'Bottom spacing' },
];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Tokenize JSX/JS/CSS source into syntax-highlighted HTML tokens for the Monaco overlay.
 */
function highlightCode(code: string, isCss: boolean): string {
  if (!code) return '';
  if (isCss) {
    return escapeHtml(code)
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tok-comment">$1</span>')
      .replace(/^(\s*[.#@]?[a-zA-Z0-9_-]+(?:\s*,\s*[.#@]?[a-zA-Z0-9_-]+)*)(?=\s*\{)/gm, '<span class="tok-tag">$1</span>')
      .replace(/\b([a-z-]+)(?=\s*:)/gi, '<span class="tok-attr">$1</span>')
      .replace(/(#[0-9a-fA-F]{3,8}|\b\d+(?:px|rem|em|%|vh|vw|pt|mm)?\b)/g, '<span class="tok-num">$1</span>');
  }

  const tokenRegex =
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\b(import|from|export|default|function|return|const|let|var|if|else|for|while|switch|case|break|continue|new|typeof|null|undefined|true|false|class|extends|map|filter|join)\b|(&lt;\/?[A-Za-z_$][\w$.-]*)|(\b[a-zA-Z_][\w-]*(?==))|\b(\d+(?:\.\d+)?)\b/g;

  return escapeHtml(code).replace(
    tokenRegex,
    (match, comment, str, kw, tag, attr, num) => {
      if (comment) return `<span class="tok-comment">${comment}</span>`;
      if (str) return `<span class="tok-str">${str}</span>`;
      if (kw) return `<span class="tok-kw">${kw}</span>`;
      if (tag) return `<span class="tok-tag">${tag}</span>`;
      if (attr) return `<span class="tok-attr">${attr}</span>`;
      if (num) return `<span class="tok-num">${num}</span>`;
      return match;
    }
  );
}

export function MonacoCodeEditor({
  filePath,
  value,
  allFilePaths,
  diagnostics,
  onChange,
  onImproveSelection,
}: {
  filePath: string;
  value: string;
  allFilePaths: string[];
  diagnostics: CodeDiagnostic[];
  onChange: (nextValue: string) => void;
  onImproveSelection?: (selection: { text: string; start: number; end: number }) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ text: string; start: number; end: number } | null>(null);

  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const [queryWord, setQueryWord] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const isCss = /\.css$/i.test(filePath);
  const languageLabel = isCss
    ? 'CSS'
    : /\.(jsx|tsx)$/i.test(filePath)
    ? 'React JSX'
    : /\.(js|ts)$/i.test(filePath)
    ? 'JavaScript'
    : /\.json$/i.test(filePath)
    ? 'JSON'
    : 'HTML';

  const lines = useMemo(() => (value ? value.split('\n') : ['']), [value]);
  const highlightedHtml = useMemo(() => highlightCode(value, isCss), [value, isCss]);

  const fileDiagnostics = useMemo(
    () => diagnostics.filter((d) => d.file === filePath),
    [diagnostics, filePath]
  );

  const errorLineSet = useMemo(
    () => new Set(fileDiagnostics.map((d) => d.line)),
    [fileDiagnostics]
  );

  const suggestions = useMemo(() => {
    const base = isCss ? CSS_COMPLETIONS : JSX_COMPLETIONS;
    const siblingImports: CompletionItem[] = isCss
      ? []
      : allFilePaths
          .filter((p) => p !== filePath)
          .map((p) => {
            const baseName = (p.split('/').pop() || p).replace(/\.[a-z0-9]+$/i, '');
            const CompName = baseName.replace(/[^a-zA-Z0-9]/g, '') || 'Module';
            const isStyle = p.endsWith('.css');
            return {
              label: `import ./${p}`,
              insertText: isStyle ? `import './${p}';` : `import ${CompName} from './${p}';`,
              detail: `Project file (${p})`,
            };
          });

    const combined = [...base, ...siblingImports];
    if (!queryWord.trim()) return combined.slice(0, 7);
    const q = queryWord.toLowerCase();
    return combined.filter((item) => item.label.toLowerCase().includes(q)).slice(0, 7);
  }, [isCss, allFilePaths, filePath, queryWord]);

  function updateCursorStats(el: HTMLTextAreaElement) {
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    if (end > start) {
      const selected = el.value.slice(start, end);
      setSelectedRange(selected.trim() ? { text: selected, start, end } : null);
    } else {
      setSelectedRange(null);
    }

    const pos = start;
    const before = el.value.slice(0, pos);
    const split = before.split('\n');
    setCursorLine(split.length);
    setCursorCol((split[split.length - 1]?.length || 0) + 1);

    const currentLineText = split[split.length - 1] || '';
    const wordMatch = currentLineText.match(/([A-Za-z_./-]{2,})$/);
    if (wordMatch) {
      setQueryWord(wordMatch[1]);
      setSelectedIndex(0);
    } else {
      setQueryWord('');
      setShowSuggestions(false);
    }
  }

  function applySuggestion(item: CompletionItem) {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart || 0;
    const before = value.slice(0, pos);
    const after = value.slice(pos);
    const replacedBefore = queryWord
      ? before.slice(0, Math.max(0, before.length - queryWord.length))
      : before;
    const nextValue = `${replacedBefore}${item.insertText}${after}`;
    onChange(nextValue);
    setShowSuggestions(false);
    setQueryWord('');
    window.setTimeout(() => {
      el.focus();
      const nextPos = replacedBefore.length + item.insertText.length;
      el.setSelectionRange(nextPos, nextPos);
    }, 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;

    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && queryWord.length >= 2)) {
        e.preventDefault();
        applySuggestion(suggestions[selectedIndex] || suggestions[0]);
        return;
      }
    }

    // Ctrl+Space triggers autocomplete explicitly
    if (e.ctrlKey && e.key === ' ') {
      e.preventDefault();
      setShowSuggestions(true);
      setSelectedIndex(0);
      return;
    }

    // Tab inserts 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const next = `${value.slice(0, start)}  ${value.slice(end)}`;
      onChange(next);
      window.setTimeout(() => {
        el.setSelectionRange(start + 2, start + 2);
      }, 0);
      return;
    }

    // Enter preserves current line indentation (+2 spaces after '{' or '(')
    if (e.key === 'Enter') {
      e.preventDefault();
      const before = value.slice(0, start);
      const after = value.slice(end);
      const currentLine = before.split('\n').pop() || '';
      const indentMatch = currentLine.match(/^(\s*)/);
      const baseIndent = indentMatch ? indentMatch[1] : '';
      const opensBlock = /[{(]\s*$/.test(currentLine.trimEnd());
      const extraIndent = opensBlock ? '  ' : '';
      const insertion = `\n${baseIndent}${extraIndent}`;
      const next = `${before}${insertion}${after}`;
      onChange(next);
      window.setTimeout(() => {
        const nextCursor = start + insertion.length;
        el.setSelectionRange(nextCursor, nextCursor);
      }, 0);
    }
  }

  function handleScroll(e: React.UIEvent<HTMLTextAreaElement>) {
    const top = e.currentTarget.scrollTop;
    const left = e.currentTarget.scrollLeft;
    if (preRef.current) {
      preRef.current.scrollTop = top;
      preRef.current.scrollLeft = left;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = top;
    }
  }

  return (
    <div className="monaco-cv-editor" data-language={languageLabel}>
      <div className="monaco-cv-main">
        {/* Line Numbers Gutter */}
        <div className="monaco-cv-gutter" ref={gutterRef} aria-hidden="true">
          {lines.map((_, idx) => {
            const lineNum = idx + 1;
            const hasError = errorLineSet.has(lineNum);
            return (
              <div
                key={lineNum}
                className={`monaco-cv-line-num ${cursorLine === lineNum ? 'is-current' : ''} ${
                  hasError ? 'is-error' : ''
                }`}
              >
                {hasError && <span className="monaco-cv-err-dot" />}
                <span>{lineNum}</span>
              </div>
            );
          })}
        </div>

        {/* Synchronized Highlight Layer + Editable Textarea */}
        <div className="monaco-cv-stage">
          <pre className="monaco-cv-highlight" ref={preRef} aria-hidden="true">
            <code
              dangerouslySetInnerHTML={{
                __html: `${highlightedHtml}${value.endsWith('\n') ? ' ' : ''}`,
              }}
            />
          </pre>
          <textarea
            ref={textareaRef}
            aria-label={`Code editor for ${filePath}`}
            className="monaco-cv-textarea"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            placeholder={
              isCss
                ? '/* Write custom CSS rules for your A4 CV here... */'
                : '// Write your React JSX / JavaScript CV component code here...'
            }
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              updateCursorStats(e.currentTarget);
            }}
            onKeyDown={handleKeyDown}
            onClick={(e) => updateCursorStats(e.currentTarget)}
            onKeyUp={(e) => updateCursorStats(e.currentTarget)}
            onSelect={(e) => updateCursorStats(e.currentTarget)}
            onScroll={handleScroll}
          />

          {onImproveSelection && selectedRange && (
            <div className="monaco-cv-selection-popover" role="region" aria-label="Text Selection Assistant">
              <button
                type="button"
                className="dash-secondary"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onImproveSelection(selectedRange);
                }}
              >
                <Sparkles size={13} />
                Improve Selected Text
              </button>
            </div>
          )}

          {/* Autocomplete Popup */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="monaco-cv-suggest" role="listbox" aria-label="Code autocomplete suggestions">
              <div className="monaco-cv-suggest-head">
                <Sparkles size={12} />
                <span>Autocomplete Suggestions (Tab or Click to insert)</span>
              </div>
              {suggestions.map((item, idx) => (
                <button
                  key={item.label}
                  type="button"
                  role="option"
                  aria-selected={idx === selectedIndex}
                  className={`monaco-cv-suggest-item ${idx === selectedIndex ? 'is-selected' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applySuggestion(item);
                  }}
                >
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Inline Diagnostics & Editor Status Bar */}
      {fileDiagnostics.length > 0 && (
        <div className="monaco-cv-diagnostics" role="region" aria-label="Editor diagnostics">
          {fileDiagnostics.map((diag, i) => (
            <div key={`${diag.line}-${i}`} className="monaco-cv-diag-row">
              <AlertCircle size={14} />
              <span>
                <strong>Line {diag.line}:</strong> {diag.message}
              </span>
            </div>
          ))}
        </div>
      )}

      <footer className="monaco-cv-statusbar">
        <div className="monaco-cv-status-left">
          {fileDiagnostics.length === 0 ? (
            <span className="monaco-cv-ok">
              <CheckCircle2 size={13} />0 Errors
            </span>
          ) : (
            <span className="monaco-cv-err-count">
              <AlertCircle size={13} />
              {fileDiagnostics.length} {fileDiagnostics.length === 1 ? 'Error' : 'Errors'}
            </span>
          )}
          <button
            type="button"
            className="monaco-cv-suggest-trigger"
            onClick={() => setShowSuggestions((prev) => !prev)}
          >
            <Sparkles size={12} />
            Autocomplete
          </button>
        </div>
        <div className="monaco-cv-status-right">
          <span>
            Ln {cursorLine}, Col {cursorCol}
          </span>
          <span>{languageLabel}</span>
          <span>UTF-8</span>
        </div>
      </footer>
    </div>
  );
}

