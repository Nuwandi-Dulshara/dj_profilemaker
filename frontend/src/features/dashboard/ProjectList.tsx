import { useState } from 'react';
import { Archive, Copy, FileText, FolderInput, MoreHorizontal, Pencil, RotateCcw, Star, Trash2 } from 'lucide-react';
import { Dialog } from '../../components/Dialog';
import { api } from '../../services/api';
import { formatDate, kindNames, useRefreshWorkspace, useWorkspace, type Folder, type Page, type Project } from './data';
import { QueryState } from './QueryState';

type Action = 'rename' | 'move' | 'delete' | 'menu';
export function ProjectList({ search = '', expanded = false, state = 'active' }: { search?: string; expanded?: boolean; state?: string }) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{ project: Project; action: Action } | null>(null);
  const [value, setValue] = useState('');
  const [newFolder, setNewFolder] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = useRefreshWorkspace();
  const query = useWorkspace<Page<Project>>('projects', `/dashboard/recent-projects/?search=${encodeURIComponent(search)}&state=${state}&page=${page}&page_size=${expanded ? 12 : 6}`);
  const folders = useWorkspace<Folder[]>('folders', '/folders/');

  function open(project: Project, action: Action) { setError(''); setSelected({ project, action }); setValue(action === 'rename' ? project.title : project.folder || ''); setNewFolder(''); }
  async function mutate(project: Project, action: string, data?: object) {
    setPending(true); setError(''); setNotice('');
    try {
      await api(`/projects/${project.id}/${action === 'update' ? '' : `${action}/`}`, { method: action === 'update' ? 'PATCH' : 'POST', ...(data ? { body: JSON.stringify(data) } : {}) });
      setSelected(null); setNotice(action === 'delete' ? 'Project moved to Deleted Files.' : action === 'duplicate' ? 'Project duplicated.' : action === 'restore' ? 'Project restored.' : 'Project updated.');
      await refresh();
    } catch (err) { setError((err as Error).message); }
    finally { setPending(false); }
  }
  async function createFolder() {
    setPending(true); setError('');
    try { const folder = await api<Folder>('/folders/', { method: 'POST', body: JSON.stringify({ name: newFolder }) }); await folders.refetch(); setValue(folder.id); setNewFolder(''); }
    catch (err) { setError((err as Error).message); }
    finally { setPending(false); }
  }
  return <>
    {notice && <p className="dash-toast" role="status">{notice}</p>}
    {error && !selected && <p className="dash-error" role="alert">{error}</p>}
    <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
      {query.data?.results.length === 0 ? <div className="dash-empty"><FileText size={34} /><h3>{search ? 'No matching projects' : state === 'deleted' ? 'No deleted projects' : state === 'archived' ? 'No archived projects' : 'No projects yet'}</h3><p>{search ? 'Try a different project title.' : 'Your documents will appear here when you have projects to manage.'}</p></div> : <div className="project-list">{query.data?.results.map(project => <article className="project-row" key={project.id}>
        <span className="project-icon"><FileText size={24} /></span><div className="project-details"><h3>{project.title}</h3><p>{kindNames[project.kind]}{project.folder_name && ` · ${project.folder_name}`}</p><time dateTime={project.updated_at}>Edited {formatDate(project.updated_at)}</time></div>
        <div className="project-controls"><button className={`dash-icon-button ${project.favorite ? 'is-favorite' : ''}`} aria-label={`${project.favorite ? 'Unfavorite' : 'Favorite'} ${project.title}`} aria-pressed={project.favorite} disabled={pending || !!project.deleted_at} onClick={() => mutate(project, 'update', { favorite: !project.favorite })}><Star size={19} fill={project.favorite ? 'currentColor' : 'none'} /></button>
          {project.deleted_at ? <button className="dash-secondary" disabled={pending} onClick={() => mutate(project, 'restore') }><RotateCcw size={16} />Restore</button> : <button className="dash-secondary editor-unavailable" disabled title="The document editor is not available yet">Continue Editing</button>}
          {!project.deleted_at && <button className="dash-icon-button" aria-label={`Actions for ${project.title}`} onClick={() => open(project, 'menu')}><MoreHorizontal size={22} /></button>}
        </div>
      </article>)}</div>}
      {query.data && query.data.count > (expanded ? 12 : 6) && <div className="dash-pagination"><button className="dash-secondary" disabled={!query.data.previous} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} · {query.data.count} projects</span><button className="dash-secondary" disabled={!query.data.next} onClick={() => setPage(page + 1)}>Next</button></div>}
    </QueryState>
    <p className="dash-caption">Document editors are not available yet. Project organization and recovery are available.</p>
    {selected && <Dialog title={selected.action === 'menu' ? selected.project.title : selected.action === 'rename' ? 'Rename project' : selected.action === 'move' ? 'Move to folder' : 'Move to Deleted Files?'} onClose={() => { if (!pending) setSelected(null); }}>
      {error && <p className="dash-error" role="alert">{error}</p>}
      {selected.action === 'menu' ? <div className="project-action-menu">
        <button disabled={pending} onClick={() => open(selected.project, 'rename')}><Pencil size={18} />Rename</button>
        <button disabled={pending} onClick={() => mutate(selected.project, 'duplicate')}><Copy size={18} />Duplicate</button>
        <button disabled={pending} onClick={() => mutate(selected.project, 'update', { favorite: !selected.project.favorite })}><Star size={18} />{selected.project.favorite ? 'Remove favorite' : 'Add to favorites'}</button>
        <button disabled={pending} onClick={() => open(selected.project, 'move')}><FolderInput size={18} />Move to folder</button>
        <button disabled={pending} onClick={() => mutate(selected.project, 'update', { archived: !selected.project.archived })}><Archive size={18} />{selected.project.archived ? 'Unarchive' : 'Archive'}</button>
        <button disabled={pending} onClick={() => open(selected.project, 'delete')}><Trash2 size={18} />Move to Deleted Files</button>
      </div> : <form className="dash-form" onSubmit={e => { e.preventDefault(); if (!pending) void mutate(selected.project, selected.action === 'delete' ? 'delete' : 'update', selected.action === 'rename' ? { title: value } : selected.action === 'move' ? { folder: value || null } : undefined); }}>
        {selected.action === 'rename' && <label>Project title<input required maxLength={200} value={value} onChange={e => setValue(e.target.value)} disabled={pending} /></label>}
        {selected.action === 'move' && <><QueryState pending={folders.isPending} error={folders.error} retry={folders.refetch}><label>Folder<select value={value} onChange={e => setValue(e.target.value)} disabled={pending}><option value="">No folder</option>{folders.data?.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label></QueryState><label>New folder name<input maxLength={120} value={newFolder} onChange={e => setNewFolder(e.target.value)} disabled={pending} /></label><button className="dash-secondary" type="button" disabled={pending || !newFolder.trim()} onClick={createFolder}>Create folder</button></>}
        {selected.action === 'delete' && <p>“{selected.project.title}” will be removed from your active projects. You can restore it from Deleted Files.</p>}
        <div className="dialog-actions"><button type="button" className="dash-secondary" disabled={pending} onClick={() => setSelected(null)}>Cancel</button><button className="button button-primary" disabled={pending || (selected.action === 'move' && !folders.isSuccess)}>{pending ? 'Saving…' : selected.action === 'delete' ? 'Move to Deleted Files' : 'Save changes'}</button></div>
      </form>}
    </Dialog>}
  </>;
}
