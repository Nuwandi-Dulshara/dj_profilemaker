import { type ReactNode } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { fonts, listSections, newItem, personalFields, sectionLabels, type CvDoc, type FieldDef, type Item, type ListKey, type SectionKey } from '../../document-engine/schema';

export type Panel = SectionKey | 'personal' | 'design';
type Update = (fn: (doc: CvDoc) => CvDoc) => void;

function SortableEntry({ id, label, legend, children }: { id: string; label: string; legend: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return <fieldset ref={setNodeRef} className="cv-entry" style={{ transform: CSS.Transform.toString(transform), transition }}>
    <legend>{legend}</legend>
    <button type="button" className="dash-icon-button cv-drag-handle" {...attributes} {...listeners} aria-label={`Drag ${label}`}><GripVertical size={18} /></button>
    {children}
  </fieldset>;
}

function Field({ def, value, onChange, id }: { def: FieldDef; value: string; onChange: (v: string) => void; id: string }) {
  return <label htmlFor={id} className="cv-field"><span>{def.label}</span>{def.multiline ? <textarea id={id} rows={4} value={value} maxLength={4000} onChange={e => onChange(e.target.value)} /> : <input id={id} value={value} maxLength={300} onChange={e => onChange(e.target.value)} />}</label>;
}

function ListEditor({ listKey, doc, update }: { listKey: ListKey; doc: CvDoc; update: Update }) {
  const def = listSections.find(s => s.key === listKey)!;
  const items = doc.content[listKey];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const set = (next: Item[]) => update(d => ({ ...d, content: { ...d.content, [listKey]: next } }));
  const move = (index: number, by: number) => { const next = [...items]; [next[index], next[index + by]] = [next[index + by], next[index]]; set(next); };
  return (
    <div className="cv-form-body">
      {items.length === 0 && <p className="cv-hint">No entries yet. Add your first {def.itemLabel}.</p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => { if (over && active.id !== over.id) { const from = items.findIndex(i => i.id === active.id); const to = items.findIndex(i => i.id === over.id); if (from >= 0 && to >= 0) set(arrayMove(items, from, to)); } }}>
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
      {items.map((item, index) => (
        <SortableEntry key={item.id} id={item.id} label={`${def.itemLabel} ${index + 1}`} legend={`${def.label.replace(/s$/, '')} ${index + 1}`}>
          {def.fields.map(f => <Field key={f.key} id={`${item.id}-${f.key}`} def={f} value={item[f.key] ?? ''} onChange={v => set(items.map(i => i.id === item.id ? { ...i, [f.key]: v } : i))} />)}
          <div className="cv-entry-actions">
            <button type="button" className="dash-icon-button" aria-label={`Move ${def.itemLabel} ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></button>
            <button type="button" className="dash-icon-button" aria-label={`Move ${def.itemLabel} ${index + 1} down`} disabled={index === items.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></button>
            <button type="button" className="dash-secondary" onClick={() => set(items.filter(i => i.id !== item.id))}><Trash2 size={15} />Remove</button>
          </div>
        </SortableEntry>
      ))}
      </SortableContext></DndContext>
      <button type="button" className="dash-secondary" onClick={() => set([...items, newItem()])}><Plus size={16} />Add {def.itemLabel}</button>
    </div>
  );
}

function DesignEditor({ doc, update }: { doc: CvDoc; update: Update }) {
  const { design } = doc;
  const set = (patch: Partial<typeof design>) => update(d => ({ ...d, design: { ...d.design, ...patch } }));
  const move = (index: number, by: number) => { const order = [...design.order]; [order[index], order[index + by]] = [order[index + by], order[index]]; set({ order }); };
  return (
    <div className="cv-form-body">
      <label className="cv-field"><span>Page size</span><select value={design.pageSize} onChange={e => set({ pageSize: e.target.value as 'A4' | 'Letter' })}><option value="A4">A4</option><option value="Letter">US Letter</option></select></label>
      <label className="cv-field"><span>Font</span><select value={design.fontFamily} onChange={e => set({ fontFamily: e.target.value })}>{fonts.map(f => <option key={f}>{f}</option>)}</select></label>
      <label className="cv-field"><span>Font size ({design.fontSize} pt)</span><input type="range" min={8} max={16} step={0.5} value={design.fontSize} onChange={e => set({ fontSize: Number(e.target.value) })} /></label>
      <label className="cv-field"><span>Page margin ({design.margin} mm)</span><input type="range" min={5} max={40} value={design.margin} onChange={e => set({ margin: Number(e.target.value) })} /></label>
      <label className="cv-field"><span>Accent colour</span><input type="color" value={design.accent} onChange={e => set({ accent: e.target.value.toUpperCase() })} /></label>
      <label className="cv-field"><span>Text colour</span><input type="color" value={design.textColor} onChange={e => set({ textColor: e.target.value.toUpperCase() })} /></label>
      <label className="cv-field"><span>Column layout</span><select value={design.layout} onChange={e => set({ layout: e.target.value as typeof design.layout })}><option value="single">Single Column</option><option value="two-column">Two Column</option><option value="sidebar">Sidebar</option></select></label>
      <label className="cv-field"><span>Line spacing ({design.lineHeight})</span><input type="range" min="1" max="2" step="0.05" value={design.lineHeight} onChange={e => set({ lineHeight: Number(e.target.value) })} /></label>
      <label className="cv-field"><span>Section spacing ({design.sectionSpacing})</span><input type="range" min="0.3" max="3" step="0.1" value={design.sectionSpacing} onChange={e => set({ sectionSpacing: Number(e.target.value) })} /></label>
      <label className="cv-field"><span>Header style</span><select value={design.headerStyle} onChange={e => set({ headerStyle: e.target.value as typeof design.headerStyle })}><option value="left">Left aligned</option><option value="center">Centered</option><option value="banner">Colour banner</option></select></label>
      <label className="cv-field"><span>Heading style</span><select value={design.headingStyle} onChange={e => set({ headingStyle: e.target.value as typeof design.headingStyle })}><option value="line">Underlined</option><option value="plain">Plain</option><option value="band">Colour band</option></select></label>
      <h3 className="cv-subheading">Section order and visibility</h3>
      <ul className="cv-order-list">
        {design.order.map((key, index) => (
          <li key={key}>
            <label><input type="checkbox" checked={!design.hidden.includes(key)} onChange={e => set({ hidden: e.target.checked ? design.hidden.filter(k => k !== key) : [...design.hidden, key] })} /> {sectionLabels[key]}</label>
            <span><button type="button" className="dash-icon-button" aria-label={`Move ${sectionLabels[key]} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={15} /></button><button type="button" className="dash-icon-button" aria-label={`Move ${sectionLabels[key]} down`} disabled={index === design.order.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15} /></button></span>
            <input className="cv-heading-input" aria-label={`${sectionLabels[key]} heading`} maxLength={80} placeholder={sectionLabels[key]} value={design.headings[key] || ''} onChange={e => set({ headings: { ...design.headings, [key]: e.target.value } })} />
            <label><input type="checkbox" checked={design.pageBreaks.includes(key)} onChange={e => set({ pageBreaks: e.target.checked ? [...design.pageBreaks, key] : design.pageBreaks.filter(k => k !== key) })} /> Page break before section</label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PanelEditor({ panel, doc, update }: { panel: Panel; doc: CvDoc; update: Update }) {
  if (panel === 'personal') return <div className="cv-form-body">{personalFields.map(f => <Field key={f.key} id={`personal-${f.key}`} def={f} value={doc.content.personal[f.key as keyof typeof doc.content.personal]} onChange={v => update(d => ({ ...d, content: { ...d.content, personal: { ...d.content.personal, [f.key]: v } } }))} />)}</div>;
  if (panel === 'summary') return <div className="cv-form-body"><Field id="summary" def={{ key: 'summary', label: 'Professional summary', multiline: true }} value={doc.content.summary} onChange={v => update(d => ({ ...d, content: { ...d.content, summary: v } }))} /></div>;
  if (panel === 'design') return <DesignEditor doc={doc} update={update} />;
  return <ListEditor listKey={panel} doc={doc} update={update} />;
}

