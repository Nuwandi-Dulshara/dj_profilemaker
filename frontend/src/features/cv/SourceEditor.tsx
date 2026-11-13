import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';

export default function SourceEditor({ value, onChange, language, disabled = false, reveal }: {
  value: string; onChange: (value: string) => void; language: 'html' | 'css'; disabled?: boolean;
  reveal?: {text:string;sequence:number};
}) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const callback = useRef(onChange);
  const editable = useRef(new Compartment());
  useEffect(() => { callback.current = onChange; }, [onChange]);
  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({ parent: host.current, state: EditorState.create({doc: value,
      extensions: [basicSetup, language === 'html' ? html() : css(), EditorView.lineWrapping,
        editable.current.of(EditorView.editable.of(!disabled)),
        EditorView.contentAttributes.of({'aria-label': `${language.toUpperCase()} source code`, 'id': `cv-${language}`}),
        EditorView.updateListener.of(update => { if (update.docChanged) callback.current(update.state.doc.toString()); }),
        EditorView.theme({'&': {height:'360px', fontSize:'13px'}, '.cm-scroller': {overflow:'auto'}})]})});
    editor.current = view;
    return () => { view.destroy(); editor.current = null; };
    // Initial value only; subsequent external edits are synchronized below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);
  useEffect(() => {
    const view = editor.current;
    if (view && view.state.doc.toString() !== value) view.dispatch({changes:{from:0, to:view.state.doc.length, insert:value}});
  }, [value]);
  useEffect(() => { editor.current?.dispatch({effects:editable.current.reconfigure(EditorView.editable.of(!disabled))}); }, [disabled]);
  useEffect(() => {
    const view=editor.current;
    if(!view || !reveal?.text) return;
    const terms:Record<string,string>={summary:'Professional Summary',experience:'Work Experience',skills:'Technical Skills',contact:'<h1',document:'<main',job:'Work Experience'};
    const needle=terms[reveal.text.toLowerCase()] ?? reveal.text;
    const position=view.state.doc.toString().toLowerCase().indexOf(needle.toLowerCase());
    view.dispatch({selection:{anchor:Math.max(0,position),head:position<0 ? 0 : position+needle.length},scrollIntoView:true});
    view.focus(); host.current?.scrollIntoView({behavior:'smooth',block:'center'});
  }, [reveal]);
  return <div ref={host} className="cv-code-editor" />;
}
