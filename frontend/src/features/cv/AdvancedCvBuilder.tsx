import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Code2,
  Columns3,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileArchive,
  FileCode,
  FilePlus,
  FileText,
  Folder as FolderIcon,
  FolderInput,
  FolderOpen,
  FolderPlus,
  HelpCircle,
  Image as ImageIcon,
  LifeBuoy,
  Pencil,
  Plus,
  Printer,
  Save,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Dialog } from '../../components/Dialog';
import { api } from '../../services/api';
import {
  formatDate,
  useRefreshWorkspace,
  useWorkspace,
  type Folder,
  type Project,
  type ProjectsResponse,
} from '../dashboard/data';
import { QueryState } from '../dashboard/QueryState';
import {
  CvAnalysisDrawer,
  CvAnalysisToolbar,
  type ActiveAnalysisTool,
} from './CvAnalysisPanels';
import { MonacoCodeEditor } from './MonacoCodeEditor';
import { compileAndRenderCvWorkspace, exportRenderedCvToDocx } from './cvRuntime';
import './advanced-cv.css';

interface DocumentPayload {
  project: Project;
  content: {
    files?: Record<string, string>;
    folders?: string[];
  };
  design: Record<string, unknown>;
  revision: number;
}

function downloadBlobFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Derive all folder paths (including intermediate parent directories) from explicit folders and file keys.
 */
function computeAllFolderPaths(explicitFolders: string[], fileKeys: string[]): string[] {
  const set = new Set<string>();
  for (const dir of explicitFolders) {
    const clean = dir.replace(/^\/+|\/+$/g, '');
    if (!clean) continue;
    const parts = clean.split('/');
    for (let i = 1; i <= parts.length; i += 1) {
      set.add(parts.slice(0, i).join('/'));
    }
  }
  for (const file of fileKeys) {
    const clean = file.replace(/^\/+|\/+$/g, '');
    const parts = clean.split('/');
    for (let i = 1; i < parts.length; i += 1) {
      set.add(parts.slice(0, i).join('/'));
    }
  }
  return Array.from(set).sort();
}

/**
 * Step 2: Advanced CV Builder Index Page (/dashboard/advanced-cv)
 */
export function AdvancedCvIndexPage() {
  const navigate = useNavigate();
  const refresh = useRefreshWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlSearch = searchParams.get('search') || '';
  const stateParam = searchParams.get('state') === 'archived' ? 'archived' : 'active';
  const favoriteParam = searchParams.get('favorite') === 'true';
  const folderParam = searchParams.get('folder') || '';
  const orderingParam = searchParams.get('ordering') || '-updated_at';
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);

  const [searchInput, setSearchInput] = useState(urlSearch);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [renameInput, setRenameInput] = useState('');

  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === urlSearch) return;
    const timer = window.setTimeout(() => {
      updateParams({ search: trimmed || null, page: null });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput, urlSearch]);

  function updateParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(updates)) {
      if (!v || v === 'all' || (k === 'state' && v === 'active') || (k === 'ordering' && v === '-updated_at')) {
        next.delete(k);
      } else {
        next.set(k, v);
      }
    }
    setSearchParams(next, { replace: true });
  }

  const queryString = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set('kind', 'advanced_cv');
    qs.set('state', stateParam);
    qs.set('page', String(page));
    qs.set('page_size', '12');
    qs.set('ordering', orderingParam);
    if (urlSearch) qs.set('search', urlSearch);
    if (favoriteParam) qs.set('favorite', 'true');
    if (folderParam) qs.set('folder', folderParam);
    return qs.toString();
  }, [stateParam, page, orderingParam, urlSearch, favoriteParam, folderParam]);

  const cvsQuery = useWorkspace<ProjectsResponse>('advanced-cv-index', `/projects/?${queryString}`);
  const foldersQuery = useWorkspace<Folder[]>('folders', '/project-folders/');
  const cvs = cvsQuery.data?.results || [];
  const folders = foldersQuery.data || [];

  async function handleCreateNewCv() {
    if (creating) return;
    setCreating(true);
    setError('');
    try {
      const created = await api<Project>('/projects/', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Untitled',
          kind: 'advanced_cv',
          content: {},
          design: {},
        }),
      });
      await refresh();
      navigate(`/dashboard/advanced-cv/${created.id}`);
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
    }
  }

  async function toggleFavorite(project: Project) {
    setBusyId(project.id);
    setError('');
    try {
      await api(`/projects/${project.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ favorite: !project.favorite }),
      });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function submitRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renameTarget || !renameInput.trim()) return;
    setBusyId(renameTarget.id);
    setError('');
    try {
      await api(`/projects/${renameTarget.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ title: renameInput.trim() }),
      });
      setRenameTarget(null);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function softDeleteCv(project: Project) {
    setBusyId(project.id);
    setError('');
    try {
      await api(`/projects/${project.id}/delete/`, { method: 'POST' });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="adv-cv-index">
      <div className="dash-page-header">
        <div>
          <span className="eyebrow">ADVANCED CV BUILDER</span>
          <h1>Advanced CV Builder</h1>
          <p className="dash-subtitle">
            Manage your created React CV projects, search and filter by status or folder, or start a new blank CV.
          </p>
        </div>
        <div className="dash-header-cta">
          <button
            type="button"
            className="button button-primary"
            disabled={creating}
            onClick={() => void handleCreateNewCv()}
          >
            <Plus size={18} />
            {creating ? 'Creating…' : 'Create New CV'}
          </button>
        </div>
      </div>

      {error && (
        <p className="dash-error" role="alert">
          {error}
        </p>
      )}

      {/* SEARCH BAR & FILTERS */}
      <div className="adv-cv-toolbar" role="region" aria-label="Search and filter CVs">
        <label className="projects-search-input">
          <Search size={17} />
          <input
            type="search"
            placeholder="Search CVs by project name…"
            aria-label="Search CVs by project name"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </label>

        <div className="adv-cv-filters">
          <div className="projects-filter-pills" role="group" aria-label="CV status filter">
            <button
              type="button"
              className={`filter-pill ${stateParam === 'active' && !favoriteParam ? 'is-active' : ''}`}
              aria-pressed={stateParam === 'active' && !favoriteParam}
              onClick={() => updateParams({ state: 'active', favorite: null, page: null })}
            >
              Active
            </button>
            <button
              type="button"
              className={`filter-pill ${favoriteParam ? 'is-active' : ''}`}
              aria-pressed={favoriteParam}
              onClick={() => updateParams({ favorite: favoriteParam ? null : 'true', page: null })}
            >
              <Star size={14} />
              Favorites
            </button>
            <button
              type="button"
              className={`filter-pill ${stateParam === 'archived' ? 'is-active' : ''}`}
              aria-pressed={stateParam === 'archived'}
              onClick={() =>
                updateParams({
                  state: stateParam === 'archived' ? 'active' : 'archived',
                  page: null,
                })
              }
            >
              <Archive size={14} />
              Archived
            </button>
          </div>

          <label className="toolbar-select-label">
            <span>Folder</span>
            <select
              aria-label="Filter CVs by folder"
              value={folderParam || 'all'}
              onChange={(e) => updateParams({ folder: e.target.value === 'all' ? null : e.target.value, page: null })}
            >
              <option value="all">All Folders</option>
              <option value="none">Unfiled</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>

          <label className="toolbar-select-label">
            <span>Sort by</span>
            <select
              aria-label="Sort CVs"
              value={orderingParam}
              onChange={(e) => updateParams({ ordering: e.target.value, page: null })}
            >
              <option value="-updated_at">Recently Modified</option>
              <option value="-created_at">Recently Created</option>
              <option value="title">Name A–Z</option>
              <option value="-title">Name Z–A</option>
            </select>
          </label>
        </div>
      </div>

      {/* CREATED CVS TABLE */}
      <section className="dash-panel" aria-label="Created CVs Table">
        <div className="dash-panel-header">
          <div>
            <h2>Created CVs</h2>
          </div>
        </div>

        <QueryState pending={cvsQuery.isPending} error={cvsQuery.error} retry={cvsQuery.refetch}>
          {cvs.length === 0 ? (
            <div className="dash-empty">
              <FileText size={36} />
              <h3>{urlSearch ? 'No matching CVs found' : 'No CV projects created yet'}</h3>
              <p>
                {urlSearch
                  ? 'Try a different project name or clear your active filters.'
                  : 'Click Create New CV to open a blank React CV workspace.'}
              </p>
              <button
                type="button"
                className="button button-primary"
                disabled={creating}
                onClick={() => void handleCreateNewCv()}
              >
                <Plus size={17} />
                Create New CV
              </button>
            </div>
          ) : (
            <div className="projects-table-wrap">
              <table className="projects-table" aria-label="Created CVs">
                <thead>
                  <tr>
                    <th scope="col">Project Name</th>
                    <th scope="col">Folder</th>
                    <th scope="col">Last Modified</th>
                    <th scope="col">Favorite</th>
                    <th scope="col" className="col-actions">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cvs.map((project) => (
                    <tr key={project.id}>
                      <td>
                        <div className="table-project-title">
                          <span className="project-icon">
                            <Code2 size={20} />
                          </span>
                          <div>
                            <strong>{project.title}</strong>
                            {project.archived && <span className="status-pill">Archived</span>}
                          </div>
                        </div>
                      </td>
                      <td>{project.folder_name || 'Unfiled'}</td>
                      <td>
                        <time dateTime={project.updated_at}>{formatDate(project.updated_at)}</time>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`dash-icon-button ${project.favorite ? 'is-favorite' : ''}`}
                          aria-label={`${project.favorite ? 'Unfavorite' : 'Favorite'} ${project.title}`}
                          aria-pressed={project.favorite}
                          disabled={busyId === project.id}
                          onClick={() => void toggleFavorite(project)}
                        >
                          <Star size={18} fill={project.favorite ? 'currentColor' : 'none'} />
                        </button>
                      </td>
                      <td>
                        <div className="table-row-actions">
                          <Link className="dash-secondary" to={`/dashboard/advanced-cv/${project.id}`}>
                            Open
                          </Link>
                          <button
                            type="button"
                            className="dash-icon-button"
                            aria-label={`Rename ${project.title}`}
                            title="Rename"
                            onClick={() => {
                              setRenameTarget(project);
                              setRenameInput(project.title);
                            }}
                          >
                            <Pencil size={17} />
                          </button>
                          <button
                            type="button"
                            className="dash-icon-button"
                            aria-label={`Delete ${project.title}`}
                            title="Move to Deleted Files"
                            disabled={busyId === project.id}
                            onClick={() => void softDeleteCv(project)}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {cvsQuery.data && cvsQuery.data.count > 12 && (
            <div className="dash-pagination">
              <button
                type="button"
                className="dash-secondary"
                disabled={!cvsQuery.data.previous}
                onClick={() => updateParams({ page: String(page - 1) })}
              >
                Previous
              </button>
              <span>
                Page {page} · {cvsQuery.data.count} CVs
              </span>
              <button
                type="button"
                className="dash-secondary"
                disabled={!cvsQuery.data.next}
                onClick={() => updateParams({ page: String(page + 1) })}
              >
                Next
              </button>
            </div>
          )}
        </QueryState>
      </section>

      {renameTarget && (
        <Dialog title="Rename CV project" onClose={() => setRenameTarget(null)}>
          <form className="dash-form" onSubmit={(e) => void submitRename(e)}>
            <label>
              Project name
              <input
                required
                maxLength={200}
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <button type="button" className="dash-secondary" onClick={() => setRenameTarget(null)}>
                Cancel
              </button>
              <button type="submit" className="button button-primary" disabled={!renameInput.trim()}>
                Save changes
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}

function CreateBlankCvRedirect() {
  const navigate = useNavigate();
  const refresh = useRefreshWorkspace();
  const started = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const created = await api<Project>('/projects/', {
          method: 'POST',
          body: JSON.stringify({
            title: 'Untitled',
            kind: 'advanced_cv',
            content: {},
            design: {},
          }),
        });
        await refresh();
        navigate(`/dashboard/advanced-cv/${created.id}`, { replace: true });
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [navigate, refresh]);

  if (error) {
    return (
      <section className="dash-panel">
        <h1>Unable to create CV</h1>
        <p className="dash-error" role="alert">
          {error}
        </p>
        <Link className="dash-secondary" to="/dashboard/advanced-cv">
          Back to Advanced CV Builder
        </Link>
      </section>
    );
  }

  return (
    <div className="dash-skeleton" role="status" aria-label="Creating new blank CV">
      <span />
      <span />
    </div>
  );
}

/**
 * Step 3, Step 4, Step 5 & Step 6: Advanced CV Builder Workspace (/dashboard/advanced-cv/:projectId)
 */
export function BlankCvWorkspace() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const refresh = useRefreshWorkspace();

  const [title, setTitle] = useState('Untitled');
  const savedTitle = useRef('Untitled');
  const [files, setFiles] = useState<Record<string, string>>({});
  const [savedFiles, setSavedFiles] = useState<Record<string, string>>({});
  const [folders, setFolders] = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState<'saved' | 'unsaved' | 'saving' | 'failed'>('saved');
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState('');
  const [activeAnalysisTool, setActiveAnalysisTool] = useState<ActiveAnalysisTool>(null);

  // Step 4.3 Ribbon Tabs & View Modes
  const [ribbonTab, setRibbonTab] = useState<'file' | 'view' | 'help'>('file');
  const [viewMode, setViewMode] = useState<'split' | 'editor' | 'preview'>('split');
  const [explorerWidth, setExplorerWidth] = useState(260);
  const [editorWidth, setEditorWidth] = useState(500);
  const [previewZoom, setPreviewZoom] = useState<number>(100);

  // Modals for Ribbon & File Operations
  const [modalMode, setModalMode] = useState<
    | 'new-file'
    | 'new-folder'
    | 'rename-file'
    | 'rename-folder'
    | 'make-copy'
    | 'contact'
    | 'help'
    | 'docs'
    | null
  >(null);
  const [modalInput, setModalInput] = useState('');
  const [modalTarget, setModalTarget] = useState('');
  const [modalFolderChoice, setModalFolderChoice] = useState('');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [busyAction, setBusyAction] = useState(false);

  // Hidden file upload inputs
  const uploadFilesRef = useRef<HTMLInputElement | null>(null);
  const uploadZipRef = useRef<HTMLInputElement | null>(null);
  const uploadImagesRef = useRef<HTMLInputElement | null>(null);

  const loadWorkspace = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setLoadError('');
      try {
        const res = await api<DocumentPayload>(`/projects/${projectId}/document/`, { signal });
        const loadedTitle = res.project.title || 'Untitled';
        setTitle(loadedTitle);
        savedTitle.current = loadedTitle;

        const rawFiles =
          res.content && typeof res.content.files === 'object' && res.content.files !== null
            ? res.content.files
            : {};
        const rawFolders =
          res.content && Array.isArray(res.content.folders) ? res.content.folders : [];

        const normalizedFolders = computeAllFolderPaths(rawFolders, Object.keys(rawFiles));
        setFiles(rawFiles);
        setSavedFiles(rawFiles);
        setFolders(normalizedFolders);
        setExpandedFolders(new Set(normalizedFolders));
        const fileKeys = Object.keys(rawFiles);
        setOpenTabs(fileKeys);
        setActiveTab(fileKeys[0] || '');
        setStatus('saved');
        setLoading(false);
      } catch (err) {
        if ((err as Error).name === 'AbortError' || signal?.aborted) return;
        setLoadError((err as Error).message);
        setLoading(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadWorkspace(controller.signal);
    return () => controller.abort();
  }, [loadWorkspace]);

  // Step 6: Save functionality (separate from Download)
  const handleSave = useCallback(
    async (overrideTitle?: string, overrideFiles?: Record<string, string>, overrideFolders?: string[]) => {
      const nextTitle = (overrideTitle ?? title).trim() || 'Untitled';
      const nextFiles = overrideFiles ?? files;
      const nextFolders = computeAllFolderPaths(overrideFolders ?? folders, Object.keys(nextFiles));

      setStatus('saving');
      setMessage('');
      try {
        const res = await api<DocumentPayload>(`/projects/${projectId}/document/`, {
          method: 'PUT',
          body: JSON.stringify({
            title: nextTitle,
            content: {
              files: nextFiles,
              folders: nextFolders,
            },
            design: {},
          }),
        });
        setTitle(res.project.title);
        savedTitle.current = res.project.title;
        setSavedFiles(nextFiles);
        setStatus('saved');
        await refresh();
      } catch (err) {
        setStatus('failed');
        setMessage((err as Error).message);
      }
    },
    [projectId, title, files, folders, refresh]
  );

  // Support Ctrl + S for saving and Ctrl + P for clean A4 PDF printing
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSave();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handleExportPdf(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave, files, title]);

  function handleTitleChange(val: string) {
    setTitle(val);
    setStatus('unsaved');
  }

  function handleTitleBlur() {
    const trimmed = title.trim() || 'Untitled';
    if (trimmed !== title) setTitle(trimmed);
    if (trimmed !== savedTitle.current) {
      void handleSave(trimmed);
    }
  }

  const allFolders = useMemo(
    () => computeAllFolderPaths(folders, Object.keys(files)),
    [folders, files]
  );

  function handleCreateFile(e: React.FormEvent) {
    e.preventDefault();
    const rawName = modalInput.trim().replace(/^\/+|\/+$/g, '');
    if (!rawName) return;
    const prefix = modalFolderChoice ? `${modalFolderChoice.replace(/^\/+|\/+$/g, '')}/` : '';
    const path = rawName.includes('/') ? rawName : `${prefix}${rawName}`;

    if (files[path] !== undefined) {
      setMessage(`File "${path}" already exists.`);
      return;
    }
    const nextFiles = { ...files, [path]: '' };
    const nextFolders = computeAllFolderPaths(folders, Object.keys(nextFiles));
    setFolders(nextFolders);
    setExpandedFolders((prev) => {
      const s = new Set(prev);
      nextFolders.forEach((f) => s.add(f));
      return s;
    });
    setFiles(nextFiles);
    if (!openTabs.includes(path)) setOpenTabs((prev) => [...prev, path]);
    setActiveTab(path);
    setModalMode(null);
    setModalInput('');
    setModalFolderChoice('');
    setStatus('unsaved');
  }

  function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    const rawDir = modalInput.trim().replace(/^\/+|\/+$/g, '');
    if (!rawDir) return;
    const prefix = modalFolderChoice ? `${modalFolderChoice.replace(/^\/+|\/+$/g, '')}/` : '';
    const dir = rawDir.includes('/') ? rawDir : `${prefix}${rawDir}`;

    if (allFolders.includes(dir)) {
      setMessage(`Folder "${dir}" already exists.`);
      return;
    }
    const nextFolders = computeAllFolderPaths([...folders, dir], Object.keys(files));
    setFolders(nextFolders);
    setExpandedFolders((prev) => {
      const s = new Set(prev);
      nextFolders.forEach((f) => s.add(f));
      return s;
    });
    setModalMode(null);
    setModalInput('');
    setModalFolderChoice('');
    setStatus('unsaved');
  }

  // Step 5.1: Rename or move a file (including organizing uploaded assets into folders)
  function handleRenameOrMoveFile(e: React.FormEvent) {
    e.preventDefault();
    const oldPath = modalTarget;
    const rawName = modalInput.trim().replace(/^\/+|\/+$/g, '');
    if (!oldPath || !rawName || files[oldPath] === undefined) return;

    const newPath =
      modalFolderChoice && !rawName.includes('/')
        ? `${modalFolderChoice}/${rawName}`
        : rawName;

    if (newPath === oldPath) {
      setModalMode(null);
      return;
    }
    if (files[newPath] !== undefined) {
      setMessage(`A file named "${newPath}" already exists.`);
      return;
    }

    const nextFiles: Record<string, string> = {};
    for (const [k, v] of Object.entries(files)) {
      nextFiles[k === oldPath ? newPath : k] = v;
    }
    const nextFolders = computeAllFolderPaths(folders, Object.keys(nextFiles));
    setFiles(nextFiles);
    setFolders(nextFolders);
    setExpandedFolders((prev) => {
      const s = new Set(prev);
      nextFolders.forEach((f) => s.add(f));
      return s;
    });
    setOpenTabs((prev) => prev.map((t) => (t === oldPath ? newPath : t)));
    if (activeTab === oldPath) setActiveTab(newPath);
    setModalMode(null);
    setModalTarget('');
    setModalInput('');
    setModalFolderChoice('');
    setStatus('unsaved');
  }

  // Step 5.1: Duplicate a file in the File Explorer
  function handleDuplicateFile(sourcePath: string) {
    if (files[sourcePath] === undefined) return;
    const slashIdx = sourcePath.lastIndexOf('/');
    const dirPrefix = slashIdx !== -1 ? sourcePath.slice(0, slashIdx + 1) : '';
    const fileName = slashIdx !== -1 ? sourcePath.slice(slashIdx + 1) : sourcePath;
    const dotIdx = fileName.lastIndexOf('.');
    const base = dotIdx !== -1 ? fileName.slice(0, dotIdx) : fileName;
    const ext = dotIdx !== -1 ? fileName.slice(dotIdx) : '';

    let candidate = `${dirPrefix}${base}-copy${ext}`;
    let counter = 2;
    while (files[candidate] !== undefined) {
      candidate = `${dirPrefix}${base}-copy-${counter}${ext}`;
      counter += 1;
    }

    const nextFiles = { ...files, [candidate]: files[sourcePath] };
    setFiles(nextFiles);
    if (!openTabs.includes(candidate)) setOpenTabs((prev) => [...prev, candidate]);
    setActiveTab(candidate);
    setStatus('unsaved');
  }

  // Step 5.1: Rename a folder in the File Explorer
  function handleRenameFolder(e: React.FormEvent) {
    e.preventDefault();
    const oldDir = modalTarget;
    const newDir = modalInput.trim().replace(/^\/+|\/+$/g, '');
    if (!oldDir || !newDir || oldDir === newDir) {
      setModalMode(null);
      return;
    }
    if (allFolders.includes(newDir)) {
      setMessage(`Folder "${newDir}" already exists.`);
      return;
    }

    const nextFoldersRaw = folders.map((f) =>
      f === oldDir ? newDir : f.startsWith(`${oldDir}/`) ? `${newDir}${f.slice(oldDir.length)}` : f
    );
    const nextFiles: Record<string, string> = {};
    for (const [k, v] of Object.entries(files)) {
      if (k.startsWith(`${oldDir}/`)) {
        nextFiles[`${newDir}${k.slice(oldDir.length)}`] = v;
      } else {
        nextFiles[k] = v;
      }
    }
    const nextFolders = computeAllFolderPaths(nextFoldersRaw, Object.keys(nextFiles));
    setFolders(nextFolders);
    setFiles(nextFiles);
    setExpandedFolders((prev) => {
      const s = new Set(prev);
      s.add(newDir);
      return s;
    });
    setOpenTabs((prev) =>
      prev.map((t) => (t.startsWith(`${oldDir}/`) ? `${newDir}${t.slice(oldDir.length)}` : t))
    );
    if (activeTab.startsWith(`${oldDir}/`)) {
      setActiveTab(`${newDir}${activeTab.slice(oldDir.length)}`);
    }
    setModalMode(null);
    setModalTarget('');
    setModalInput('');
    setStatus('unsaved');
  }

  // Upload existing files & documents
  function handleUploadFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    setMessage('');
    Array.from(list).forEach((file) => {
      const reader = new FileReader();
      const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|svg|gif|webp)$/i.test(file.name);
      reader.onload = () => {
        const content = typeof reader.result === 'string' ? reader.result : '';
        setFiles((prev) => ({ ...prev, [file.name]: content }));
        setOpenTabs((prev) => (prev.includes(file.name) ? prev : [...prev, file.name]));
        setActiveTab(file.name);
        setStatus('unsaved');
      };
      if (isImg) reader.readAsDataURL(file);
      else reader.readAsText(file);
    });
    e.target.value = '';
  }

  // Upload images (PNG, JPG, JPEG, SVG, etc.)
  function handleUploadImages(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    setMessage('');
    Array.from(list).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const content = typeof reader.result === 'string' ? reader.result : '';
        setFiles((prev) => ({ ...prev, [file.name]: content }));
        setOpenTabs((prev) => (prev.includes(file.name) ? prev : [...prev, file.name]));
        setActiveTab(file.name);
        setStatus('unsaved');
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  // Upload ZIP archive & safely extract preserving folder structure
  async function handleUploadZip(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusyAction(true);
    setMessage('');
    setToast('');
    try {
      await handleSave();
      const csrfRes = await api<{ csrfToken: string }>('/auth/csrf/');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/projects/${projectId}/upload-zip/`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRFToken': csrfRes.csrfToken },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.file || data.detail || 'Unable to extract ZIP archive.');
      }
      const nextFiles = data.content?.files || {};
      const nextFolders = computeAllFolderPaths(data.content?.folders || [], Object.keys(nextFiles));
      setFiles(nextFiles);
      setSavedFiles(nextFiles);
      setFolders(nextFolders);
      setExpandedFolders(new Set(nextFolders));
      const keys = Object.keys(nextFiles);
      setOpenTabs(keys);
      if (keys.length > 0 && !activeTab) setActiveTab(keys[0]);
      setStatus('saved');
      setToast(`Extracted ${data.extracted_count ?? keys.length} file(s) from ZIP archive.`);
      await refresh();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusyAction(false);
    }
  }

  // Make a Copy under a new project name
  async function handleMakeCopy(e: React.FormEvent) {
    e.preventDefault();
    const copyName = modalInput.trim();
    if (!copyName || busyAction) return;
    setBusyAction(true);
    setMessage('');
    try {
      await handleSave();
      const copy = await api<Project>(`/projects/${projectId}/duplicate/`, {
        method: 'POST',
        body: JSON.stringify({ title: copyName }),
      });
      setModalMode(null);
      setModalInput('');
      await refresh();
      navigate(`/dashboard/advanced-cv/${copy.id}`);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusyAction(false);
    }
  }

  // Step 5.2 & 5.3: Compile multi-file React JSX/JS & CSS workspace
  const compiledPreview = useMemo(() => compileAndRenderCvWorkspace(files), [files]);

  // Step 7: Compile the saved CV snapshot so analysis tools strictly analyze the saved, rendered CV
  const savedCompiledPreview = useMemo(() => compileAndRenderCvWorkspace(savedFiles), [savedFiles]);
  const canAnalyzeSavedCv = Boolean(savedCompiledPreview.html.trim());

  // Step 6: Download as PDF / Open PDF in New Tab (preserves exact A4 layout, formatting & multi-page pagination without blank spillover pages)
  function handleExportPdf(openInNewTab = false) {
    const pagesToRender =
      compiledPreview.pages.length > 0
        ? compiledPreview.pages
        : [compiledPreview.html || `<p>${title || 'Untitled'}</p>`];

    const sheetsHtml = pagesToRender
      .map(
        (pageHtml, idx) =>
          `<div class="cv-print-sheet${idx < pagesToRender.length - 1 ? ' has-page-break' : ''}">${pageHtml}</div>`
      )
      .join('\n');

    const printNormalizationCss = `
      @page { size: A4 portrait; margin: 0; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 210mm;
        background: #ffffff !important;
        font-family: system-ui, -apple-system, sans-serif;
        color: #111827;
      }
      .screen-toolbar { display: none !important; }
      .cv-print-sheet {
        width: 210mm;
        height: auto !important;
        min-height: 0 !important;
        max-height: 296mm !important;
        margin: 0 auto !important;
        padding: 14mm;
        background: #ffffff;
        overflow: hidden !important;
        page-break-inside: avoid;
        break-inside: avoid;
        page-break-after: auto !important;
        break-after: auto !important;
      }
      .cv-print-sheet:has(.cv-page),
      .cv-print-sheet:has(.cv-document),
      .cv-print-sheet:has(.app-shell) {
        padding: 0 !important;
      }
      .cv-print-sheet .app-shell,
      .cv-print-sheet .cv-app,
      .cv-print-sheet .cv-document {
        display: block !important;
        width: 210mm !important;
        max-width: 210mm !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        gap: 0 !important;
        background: #ffffff !important;
        box-shadow: none !important;
      }
      .cv-print-sheet .cv-document .cv-page,
      .cv-print-sheet .cv-page {
        display: block !important;
        width: 210mm !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: 296mm !important;
        margin: 0 !important;
        box-shadow: none !important;
        overflow: hidden !important;
        page-break-after: auto !important;
        break-after: auto !important;
      }
      .cv-print-sheet.has-page-break {
        page-break-after: always !important;
        break-after: page !important;
      }
      .cv-print-sheet:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
    `;

    const docHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${
      title || 'Untitled'
    }</title><style>${compiledPreview.css}\n${printNormalizationCss}</style></head><body>${sheetsHtml}</body></html>`;

    if (openInNewTab) {
      const blob = new Blob([docHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.title = 'Print CV PDF';
    iframe.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;top:0;border:0';
    document.body.appendChild(iframe);
    const frameDoc = iframe.contentDocument!;
    frameDoc.open();
    frameDoc.write(docHtml);
    frameDoc.close();
    window.setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => iframe.remove(), 30000);
    }, 100);
  }

  // Step 6: Download as DOCX (exports rendered CV document, never raw React source code; separate from Save)
  async function handleDownloadDocx() {
    setBusyAction(true);
    setMessage('');
    try {
      const fullRenderedHtml =
        compiledPreview.pages.length > 1
          ? compiledPreview.pages.join('<div class="page-break"></div>')
          : compiledPreview.html;
      const docxBlob = await exportRenderedCvToDocx(fullRenderedHtml, title || 'Untitled');
      const safeSlug = (title || 'Untitled').replace(/[^a-zA-Z0-9_-]+/g, '-') || 'Untitled';
      downloadBlobFile(docxBlob, `${safeSlug}.docx`);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusyAction(false);
    }
  }

  function handleDeleteFile(path: string) {
    const nextFiles = { ...files };
    delete nextFiles[path];
    setFiles(nextFiles);
    const nextTabs = openTabs.filter((t) => t !== path);
    setOpenTabs(nextTabs);
    if (activeTab === path) setActiveTab(nextTabs[0] || '');
    setStatus('unsaved');
  }

  function handleDeleteFolder(dir: string) {
    const nextFolders = folders.filter((f) => f !== dir && !f.startsWith(`${dir}/`));
    const nextFiles = { ...files };
    for (const k of Object.keys(nextFiles)) {
      if (k.startsWith(`${dir}/`)) delete nextFiles[k];
    }
    setFolders(nextFolders);
    setFiles(nextFiles);
    const nextTabs = openTabs.filter((t) => !t.startsWith(`${dir}/`));
    setOpenTabs(nextTabs);
    if (activeTab.startsWith(`${dir}/`)) setActiveTab(nextTabs[0] || '');
    setStatus('unsaved');
  }

  function handleCodeChange(val: string) {
    if (!activeTab) return;
    setFiles((prev) => ({ ...prev, [activeTab]: val }));
    setStatus('unsaved');
  }

  // Resizable workspace panel drag handlers
  function startExplorerResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = explorerWidth;
    function onMove(ev: MouseEvent) {
      setExplorerWidth(Math.max(180, Math.min(460, startW + (ev.clientX - startX))));
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function startEditorResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = editorWidth;
    function onMove(ev: MouseEvent) {
      setEditorWidth(Math.max(260, Math.min(860, startW + (ev.clientX - startX))));
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // Recursive Nested Folder & File Tree Renderer (Step 5.1)
  function renderExplorerTree(parentDir = ''): React.ReactNode {
    const childFolders = allFolders.filter((dir) => {
      if (!parentDir) return !dir.includes('/');
      const prefix = `${parentDir}/`;
      return dir.startsWith(prefix) && !dir.slice(prefix.length).includes('/');
    });

    const childFiles = Object.keys(files)
      .filter((filePath) => {
        if (!parentDir) return !filePath.includes('/');
        const prefix = `${parentDir}/`;
        return filePath.startsWith(prefix) && !filePath.slice(prefix.length).includes('/');
      })
      .sort();

    if (childFolders.length === 0 && childFiles.length === 0) return null;

    return (
      <ul
        className="adv-cv-tree-list"
        role={parentDir === '' ? 'tree' : 'group'}
        aria-label={parentDir === '' ? 'Workspace files' : `${parentDir} contents`}
        style={parentDir ? { paddingLeft: 14 } : undefined}
      >
        {childFolders.map((dir) => {
          const isOpen = expandedFolders.has(dir);
          const displayName = parentDir ? dir.slice(parentDir.length + 1) : dir;
          return (
            <li key={`folder-${dir}`} role="treeitem" aria-expanded={isOpen}>
              <div className="adv-cv-tree-item">
                <button
                  type="button"
                  className="adv-cv-tree-select"
                  onClick={() =>
                    setExpandedFolders((prev) => {
                      const next = new Set(prev);
                      if (next.has(dir)) next.delete(dir);
                      else next.add(dir);
                      return next;
                    })
                  }
                >
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {isOpen ? <FolderOpen size={16} /> : <FolderIcon size={16} />}
                  <span>{displayName}</span>
                </button>
                <div className="adv-cv-tree-actions">
                  <button
                    type="button"
                    className="dash-icon-button"
                    aria-label={`New file in ${dir}`}
                    title={`New file in ${dir}`}
                    onClick={() => {
                      setModalFolderChoice(dir);
                      setModalInput('');
                      setModalMode('new-file');
                    }}
                  >
                    <FilePlus size={13} />
                  </button>
                  <button
                    type="button"
                    className="dash-icon-button"
                    aria-label={`Rename folder ${dir}`}
                    title="Rename folder"
                    onClick={() => {
                      setModalTarget(dir);
                      setModalInput(dir);
                      setModalMode('rename-folder');
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    className="dash-icon-button"
                    aria-label={`Delete folder ${dir}`}
                    title="Delete folder"
                    onClick={() => handleDeleteFolder(dir)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {isOpen && renderExplorerTree(dir)}
            </li>
          );
        })}

        {childFiles.map((filePath) => {
          const displayName = parentDir ? filePath.slice(parentDir.length + 1) : filePath;
          const isImg =
            /\.(png|jpe?g|svg|gif|webp)$/i.test(filePath) ||
            (files[filePath] || '').startsWith('data:image/');
          const slashIdx = filePath.lastIndexOf('/');
          const currentFolder = slashIdx !== -1 ? filePath.slice(0, slashIdx) : '';

          return (
            <li
              key={filePath}
              role="treeitem"
              aria-selected={activeTab === filePath}
              className={`adv-cv-tree-item ${activeTab === filePath ? 'is-active' : ''}`}
            >
              <button
                type="button"
                className="adv-cv-tree-select"
                onClick={() => {
                  if (!openTabs.includes(filePath)) setOpenTabs((prev) => [...prev, filePath]);
                  setActiveTab(filePath);
                }}
              >
                {isImg ? <ImageIcon size={15} /> : <FileCode size={15} />}
                <span>{displayName}</span>
              </button>
              <div className="adv-cv-tree-actions">
                <button
                  type="button"
                  className="dash-icon-button"
                  aria-label={`Rename ${filePath}`}
                  title="Rename or move file"
                  onClick={() => {
                    setModalTarget(filePath);
                    setModalInput(displayName);
                    setModalFolderChoice(currentFolder);
                    setModalMode('rename-file');
                  }}
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  className="dash-icon-button"
                  aria-label={`Duplicate ${filePath}`}
                  title="Duplicate file"
                  onClick={() => handleDuplicateFile(filePath)}
                >
                  <Copy size={13} />
                </button>
                <button
                  type="button"
                  className="dash-icon-button"
                  aria-label={`Delete file ${filePath}`}
                  title="Delete file"
                  onClick={() => handleDeleteFile(filePath)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  if (loadError) {
    return (
      <section className="dash-panel">
        <h1>Unable to open CV project</h1>
        <p className="dash-error" role="alert">
          {loadError}
        </p>
        <div className="dialog-actions">
          <button type="button" className="dash-secondary" onClick={() => void loadWorkspace()}>
            Try again
          </button>
          <Link className="button button-primary" to="/dashboard/advanced-cv">
            Back to Advanced CV Builder
          </Link>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <div className="dash-skeleton" role="status" aria-label="Loading CV workspace">
        <span />
        <span />
        <span />
      </div>
    );
  }

  const isEmptyProject = allFolders.length === 0 && Object.keys(files).length === 0;
  const activeFileValue = files[activeTab] ?? '';
  const isActiveImage =
    /\.(png|jpe?g|svg|gif|webp)$/i.test(activeTab) || activeFileValue.startsWith('data:image/');

  return (
    <div className="adv-cv-workspace">
      {/* Hidden File Inputs for Ribbon & File Explorer */}
      <input
        ref={uploadFilesRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        aria-label="Upload files input"
        onChange={handleUploadFiles}
      />
      <input
        ref={uploadZipRef}
        type="file"
        accept=".zip,application/zip"
        style={{ display: 'none' }}
        aria-label="Upload ZIP input"
        onChange={(e) => void handleUploadZip(e)}
      />
      <input
        ref={uploadImagesRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/svg+xml,image/gif,image/webp,.png,.jpg,.jpeg,.svg"
        style={{ display: 'none' }}
        aria-label="Upload images input"
        onChange={handleUploadImages}
      />

      {/* 4.2 EDITABLE PROJECT NAME BAR */}
      <header className="adv-cv-header" aria-label="Project Name Bar">
        <div className="adv-cv-header-left">
          <Link className="dash-secondary" to="/dashboard/advanced-cv">
            <ArrowLeft size={16} />
            Back to CVs
          </Link>
          <label>
            <span className="sr-only">Project name</span>
            <input
              aria-label="Project name"
              className="adv-cv-title-input"
              value={title}
              maxLength={200}
              onChange={(e) => handleTitleChange(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
            />
          </label>
          <span className={`adv-cv-status is-${status}`} role="status">
            {status === 'saved'
              ? 'All Changes Saved'
              : status === 'saving'
              ? 'Saving…'
              : status === 'failed'
              ? 'Save Failed'
              : 'Unsaved Changes'}
          </span>
        </div>

        <div className="adv-cv-header-actions">
          <button
            type="button"
            className="button button-primary"
            disabled={status === 'saving'}
            onClick={() => void handleSave()}
          >
            <Save size={16} />
            Save
          </button>
        </div>
      </header>

      {/* 4.3 RIBBON MENU / TOOLBAR */}
      <section className="adv-cv-ribbon" aria-label="Workspace Ribbon">
        <div className="adv-cv-ribbon-tabs" role="tablist" aria-label="Ribbon tabs">
          <button
            type="button"
            role="tab"
            aria-selected={ribbonTab === 'file'}
            className={`adv-cv-ribbon-tab ${ribbonTab === 'file' ? 'is-active' : ''}`}
            onClick={() => setRibbonTab('file')}
          >
            File
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={ribbonTab === 'view'}
            className={`adv-cv-ribbon-tab ${ribbonTab === 'view' ? 'is-active' : ''}`}
            onClick={() => setRibbonTab('view')}
          >
            View
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={ribbonTab === 'help'}
            className={`adv-cv-ribbon-tab ${ribbonTab === 'help' ? 'is-active' : ''}`}
            onClick={() => setRibbonTab('help')}
          >
            Contacts / Help
          </button>
        </div>

        <div className="adv-cv-ribbon-commands" role="toolbar" aria-label={`${ribbonTab} commands`}>
          {ribbonTab === 'file' && (
            <>
              <button
                type="button"
                className="adv-cv-ribbon-btn"
                onClick={() => {
                  setModalFolderChoice('');
                  setModalInput('');
                  setModalMode('new-file');
                }}
              >
                <FilePlus size={16} />
                New File
              </button>
              <button
                type="button"
                className="adv-cv-ribbon-btn"
                onClick={() => {
                  setModalFolderChoice('');
                  setModalInput('');
                  setModalMode('new-folder');
                }}
              >
                <FolderPlus size={16} />
                New Folder
              </button>
              <span className="adv-cv-ribbon-divider" aria-hidden="true" />
              <button
                type="button"
                className="adv-cv-ribbon-btn"
                onClick={() => uploadFilesRef.current?.click()}
              >
                <Upload size={16} />
                Upload Files
              </button>
              <button
                type="button"
                className="adv-cv-ribbon-btn"
                disabled={busyAction}
                onClick={() => uploadZipRef.current?.click()}
              >
                <FileArchive size={16} />
                Upload ZIP
              </button>
              <button
                type="button"
                className="adv-cv-ribbon-btn"
                onClick={() => uploadImagesRef.current?.click()}
              >
                <ImageIcon size={16} />
                Upload Images
              </button>
              <span className="adv-cv-ribbon-divider" aria-hidden="true" />
              <button
                type="button"
                className="adv-cv-ribbon-btn"
                onClick={() => {
                  setModalInput(`${title} (Copy)`);
                  setModalMode('make-copy');
                }}
              >
                <Copy size={16} />
                Make a Copy
              </button>
              <button
                type="button"
                className="adv-cv-ribbon-btn"
                disabled={status === 'saving'}
                onClick={() => void handleSave()}
              >
                <Save size={16} />
                Save
              </button>
              <span className="adv-cv-ribbon-divider" aria-hidden="true" />
              <button
                type="button"
                className="adv-cv-ribbon-btn"
                onClick={() => handleExportPdf(false)}
              >
                <Printer size={16} />
                Download as PDF
              </button>
              <button
                type="button"
                className="adv-cv-ribbon-btn"
                disabled={busyAction}
                onClick={() => void handleDownloadDocx()}
              >
                <Download size={16} />
                Download as DOCX
              </button>
            </>
          )}

          {ribbonTab === 'view' && (
            <>
              <button
                type="button"
                className={`adv-cv-ribbon-btn ${viewMode === 'split' ? 'is-active' : ''}`}
                aria-pressed={viewMode === 'split'}
                onClick={() => setViewMode('split')}
              >
                <Columns3 size={16} />
                Split View
              </button>
              <button
                type="button"
                className={`adv-cv-ribbon-btn ${viewMode === 'editor' ? 'is-active' : ''}`}
                aria-pressed={viewMode === 'editor'}
                onClick={() => setViewMode('editor')}
              >
                <Code2 size={16} />
                Editor Only
              </button>
              <button
                type="button"
                className={`adv-cv-ribbon-btn ${viewMode === 'preview' ? 'is-active' : ''}`}
                aria-pressed={viewMode === 'preview'}
                onClick={() => setViewMode('preview')}
              >
                <Eye size={16} />
                Preview Only
              </button>
              <span className="adv-cv-ribbon-divider" aria-hidden="true" />
              <button
                type="button"
                className="adv-cv-ribbon-btn"
                onClick={() => handleExportPdf(true)}
              >
                <ExternalLink size={16} />
                Open PDF in New Tab
              </button>
            </>
          )}

          {ribbonTab === 'help' && (
            <>
              <button
                type="button"
                className="adv-cv-ribbon-btn"
                onClick={() => {
                  setSupportSubject('');
                  setSupportMessage('');
                  setModalMode('contact');
                }}
              >
                <LifeBuoy size={16} />
                Contact Support
              </button>
              <button
                type="button"
                className="adv-cv-ribbon-btn"
                onClick={() => setModalMode('help')}
              >
                <HelpCircle size={16} />
                Help
              </button>
              <button
                type="button"
                className="adv-cv-ribbon-btn"
                onClick={() => setModalMode('docs')}
              >
                <BookOpen size={16} />
                Documentation
              </button>
            </>
          )}
        </div>
      </section>

      {/* STEP 7: CV ANALYSIS TOOLS (ENABLED AFTER SAVING CV, ANALYZING SAVED RENDERED CV) */}
      <CvAnalysisToolbar
        canAnalyze={canAnalyzeSavedCv}
        hasUnsavedChanges={status === 'unsaved'}
        activeTool={activeAnalysisTool}
        onSelectTool={setActiveAnalysisTool}
        onSaveNow={() => void handleSave()}
      />

      {activeAnalysisTool && canAnalyzeSavedCv && (
        <CvAnalysisDrawer
          activeTool={activeAnalysisTool}
          savedRenderedHtml={savedCompiledPreview.html}
          savedRenderedCss={savedCompiledPreview.css}
          hasUnsavedChanges={status === 'unsaved'}
          onClose={() => setActiveAnalysisTool(null)}
          onSaveNow={() => void handleSave()}
        />
      )}

      {toast && (
        <p className="dash-toast" role="status">
          {toast}
        </p>
      )}
      {message && (
        <p className="dash-error" role="alert">
          {message}
        </p>
      )}

      {/* STEP 5: THREE-PANEL WORKSPACE (FILE EXPLORER, CODE EDITOR, LIVE PREVIEW) */}
      <div className="adv-cv-body" data-view={viewMode}>
        {/* 5.1 LEFT PANEL — FILE EXPLORER */}
        {viewMode === 'split' && (
          <>
            <aside
              className="adv-cv-explorer"
              style={{ width: `${explorerWidth}px` }}
              aria-label="File Explorer"
            >
              <div className="adv-cv-explorer-head">
                <strong>Files &amp; Folders</strong>
                <div className="adv-cv-explorer-btns">
                  <button
                    type="button"
                    className="dash-icon-button"
                    aria-label="Create file"
                    title="New File"
                    onClick={() => {
                      setModalFolderChoice('');
                      setModalInput('');
                      setModalMode('new-file');
                    }}
                  >
                    <FilePlus size={15} />
                  </button>
                  <button
                    type="button"
                    className="dash-icon-button"
                    aria-label="Create folder"
                    title="New Folder"
                    onClick={() => {
                      setModalFolderChoice('');
                      setModalInput('');
                      setModalMode('new-folder');
                    }}
                  >
                    <FolderPlus size={15} />
                  </button>
                  <button
                    type="button"
                    className="dash-icon-button"
                    aria-label="Upload files to explorer"
                    title="Upload Files or Documents"
                    onClick={() => uploadFilesRef.current?.click()}
                  >
                    <Upload size={15} />
                  </button>
                  <button
                    type="button"
                    className="dash-icon-button"
                    aria-label="Upload images to explorer"
                    title="Upload Images"
                    onClick={() => uploadImagesRef.current?.click()}
                  >
                    <ImageIcon size={15} />
                  </button>
                  <button
                    type="button"
                    className="dash-icon-button"
                    aria-label="Upload ZIP to explorer"
                    title="Upload ZIP Archive"
                    disabled={busyAction}
                    onClick={() => uploadZipRef.current?.click()}
                  >
                    <FileArchive size={15} />
                  </button>
                </div>
              </div>

              <div className="adv-cv-tree">
                {isEmptyProject ? (
                  <div className="adv-cv-tree-empty">
                    <FolderIcon size={28} />
                    <p>No files or folders yet.</p>
                    <p>Create your own React JSX/JS files and folders to build your CV.</p>
                  </div>
                ) : (
                  renderExplorerTree('')
                )}
              </div>
            </aside>
            <div
              className="adv-cv-resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize file explorer panel"
              tabIndex={0}
              onMouseDown={startExplorerResize}
            />
          </>
        )}

        {/* 5.2 MIDDLE PANEL — REACT CODE EDITOR */}
        {viewMode !== 'preview' && (
          <section
            className="adv-cv-editor-panel"
            style={viewMode === 'split' ? { width: `${editorWidth}px` } : { flex: 1 }}
            aria-label="React JSX Code Editor"
          >
            {openTabs.length > 0 && (
              <div className="adv-cv-tabs" role="tablist" aria-label="Open file tabs">
                {openTabs.map((tab) => {
                  const isTabImg =
                    /\.(png|jpe?g|svg|gif|webp)$/i.test(tab) ||
                    (files[tab] || '').startsWith('data:image/');
                  return (
                    <div
                      key={tab}
                      role="tab"
                      aria-selected={activeTab === tab}
                      className={`adv-cv-tab ${activeTab === tab ? 'is-active' : ''}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {isTabImg ? <ImageIcon size={14} /> : <FileCode size={14} />}
                      <span>{tab}</span>
                      <button
                        type="button"
                        className="adv-cv-tab-close"
                        aria-label={`Close ${tab}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = openTabs.filter((t) => t !== tab);
                          setOpenTabs(next);
                          if (activeTab === tab) setActiveTab(next[0] || '');
                        }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab ? (
              isActiveImage ? (
                <div className="adv-cv-image-preview">
                  {activeFileValue.startsWith('data:image/') ? (
                    <img src={activeFileValue} alt={activeTab} />
                  ) : (
                    <>
                      <ImageIcon size={48} />
                      <p>No image uploaded for <strong>{activeTab}</strong> yet.</p>
                    </>
                  )}
                  <p>
                    <strong>{activeTab}</strong>
                  </p>
                  <small>
                    Reference this uploaded image in your React JSX using{' '}
                    <code>{`<img src="${activeTab}" alt="" />`}</code> or{' '}
                    <code>{`import img from './${activeTab}'`}</code>
                  </small>
                  <div className="adv-cv-header-actions">
                    <label className="button button-primary" style={{ cursor: 'pointer' }}>
                      <Upload size={14} />
                      {activeFileValue.startsWith('data:image/') ? 'Replace Image File' : `Upload Image for ${activeTab}`}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/gif,image/webp,.png,.jpg,.jpeg,.svg"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            const content = typeof reader.result === 'string' ? reader.result : '';
                            setFiles((prev) => ({ ...prev, [activeTab]: content }));
                            setStatus('unsaved');
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="dash-secondary"
                      onClick={() => {
                        const slashIdx = activeTab.lastIndexOf('/');
                        setModalTarget(activeTab);
                        setModalInput(slashIdx !== -1 ? activeTab.slice(slashIdx + 1) : activeTab);
                        setModalFolderChoice(slashIdx !== -1 ? activeTab.slice(0, slashIdx) : '');
                        setModalMode('rename-file');
                      }}
                    >
                      <FolderInput size={14} />
                      Organize / Move Asset
                    </button>
                  </div>
                </div>
              ) : (
                <div className="adv-cv-code-area">
                  <MonacoCodeEditor
                    filePath={activeTab}
                    value={activeFileValue}
                    allFilePaths={Object.keys(files)}
                    diagnostics={compiledPreview.diagnostics}
                    onChange={handleCodeChange}
                  />
                </div>
              )
            ) : (
              <div className="adv-cv-empty-workspace">
                <Code2 size={42} />
                <h2>Empty React CV Workspace</h2>
                <p>
                  This workspace has no predefined templates, forms, or auto-generated files.
                  Create your own files and folders to build your CV with React JSX/JavaScript code.
                </p>
                <div className="adv-cv-header-actions">
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => {
                      setModalFolderChoice('');
                      setModalInput('');
                      setModalMode('new-file');
                    }}
                  >
                    <FilePlus size={16} />
                    Create First File
                  </button>
                  <button
                    type="button"
                    className="dash-secondary"
                    onClick={() => {
                      setModalFolderChoice('');
                      setModalInput('');
                      setModalMode('new-folder');
                    }}
                  >
                    <FolderPlus size={16} />
                    Create Folder
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {viewMode === 'split' && (
          <div
            className="adv-cv-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize code editor and live preview panels"
            tabIndex={0}
            onMouseDown={startEditorResize}
          />
        )}

        {/* 5.3 RIGHT PANEL — LIVE PREVIEW */}
        {viewMode !== 'editor' && (
          <section className="adv-cv-preview-panel" aria-label="Live Preview">
            <div className="adv-cv-preview-head">
              <div className="adv-cv-preview-head-left">
                <span>Live Preview</span>
                <span className="adv-cv-page-badge">
                  A4 · {Math.max(1, compiledPreview.pages.length)}{' '}
                  {compiledPreview.pages.length > 1 ? 'Pages' : 'Page'}
                </span>
              </div>
              <div className="adv-cv-preview-controls">
                <label className="adv-cv-zoom-label">
                  <span className="sr-only">Preview zoom</span>
                  <select
                    aria-label="Preview zoom"
                    value={previewZoom}
                    onChange={(e) => setPreviewZoom(Number(e.target.value))}
                  >
                    <option value={60}>60%</option>
                    <option value={75}>75%</option>
                    <option value={100}>100%</option>
                    <option value={125}>125%</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="dash-secondary"
                  onClick={() => handleExportPdf(true)}
                >
                  <ExternalLink size={14} />
                  Open PDF in New Tab
                </button>
              </div>
            </div>

            {/* Useful Error Messages if React Code Contains Errors */}
            {(compiledPreview.runtimeError || compiledPreview.diagnostics.length > 0) && (
              <div className="adv-cv-preview-errors" role="alert" aria-label="React compile error">
                <AlertTriangle size={16} />
                <div>
                  <strong>React Code Error Detected</strong>
                  {compiledPreview.runtimeError && <p>{compiledPreview.runtimeError}</p>}
                  {compiledPreview.diagnostics.map((d, idx) => (
                    <p key={`${d.file}-${d.line}-${idx}`}>
                      {d.file} (Line {d.line}): {d.message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="adv-cv-preview-stage" data-sandbox="isolated-a4-preview">
              {compiledPreview.css && <style>{compiledPreview.css}</style>}
              <div
                className="adv-cv-a4-stack"
                style={{
                  transform: previewZoom !== 100 ? `scale(${previewZoom / 100})` : undefined,
                  transformOrigin: 'top center',
                }}
              >
                {compiledPreview.pages.length > 0 ? (
                  compiledPreview.pages.map((pageHtml, idx) => (
                    <article
                      key={`a4-page-${idx + 1}`}
                      className="adv-cv-a4-page"
                      aria-label={
                        compiledPreview.pages.length > 1
                          ? `Rendered CV Document Page ${idx + 1}`
                          : 'Rendered CV Document'
                      }
                    >
                      {compiledPreview.pages.length > 1 && (
                        <div className="adv-cv-a4-page-num">
                          Page {idx + 1} of {compiledPreview.pages.length}
                        </div>
                      )}
                      <div dangerouslySetInnerHTML={{ __html: pageHtml }} />
                    </article>
                  ))
                ) : (
                  <article className="adv-cv-a4-page" aria-label="Rendered CV Document">
                    <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: '120px' }}>
                      Write React JSX code in your files to render your CV here.
                    </p>
                  </article>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* DIALOGS FOR RIBBON & FILE EXPLORER ACTIONS */}
      {modalMode === 'new-file' && (
        <Dialog title="Create New File" onClose={() => setModalMode(null)}>
          <form className="dash-form" onSubmit={handleCreateFile}>
            {allFolders.length > 0 && (
              <label>
                Folder (optional)
                <select
                  aria-label="Target folder"
                  value={modalFolderChoice}
                  onChange={(e) => setModalFolderChoice(e.target.value)}
                >
                  <option value="">Root workspace</option>
                  {allFolders.map((dir) => (
                    <option key={dir} value={dir}>
                      {dir}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              File name (for example: main.jsx, header.jsx, or styles.css)
              <input
                required
                value={modalInput}
                onChange={(e) => setModalInput(e.target.value)}
                placeholder="main.jsx"
              />
            </label>
            <div className="dialog-actions">
              <button type="button" className="dash-secondary" onClick={() => setModalMode(null)}>
                Cancel
              </button>
              <button type="submit" className="button button-primary" disabled={!modalInput.trim()}>
                Create File
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {modalMode === 'new-folder' && (
        <Dialog title="Create New Folder" onClose={() => setModalMode(null)}>
          <form className="dash-form" onSubmit={handleCreateFolder}>
            {allFolders.length > 0 && (
              <label>
                Parent folder (optional)
                <select
                  aria-label="Parent folder"
                  value={modalFolderChoice}
                  onChange={(e) => setModalFolderChoice(e.target.value)}
                >
                  <option value="">Root workspace</option>
                  {allFolders.map((dir) => (
                    <option key={dir} value={dir}>
                      {dir}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Folder name
              <input
                required
                value={modalInput}
                onChange={(e) => setModalInput(e.target.value)}
                placeholder="components"
              />
            </label>
            <div className="dialog-actions">
              <button type="button" className="dash-secondary" onClick={() => setModalMode(null)}>
                Cancel
              </button>
              <button type="submit" className="button button-primary" disabled={!modalInput.trim()}>
                Create Folder
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {modalMode === 'rename-file' && (
        <Dialog title="Rename or Move File" onClose={() => setModalMode(null)}>
          <form className="dash-form" onSubmit={handleRenameOrMoveFile}>
            {allFolders.length > 0 && (
              <label>
                Folder location
                <select
                  aria-label="Move to folder"
                  value={modalFolderChoice}
                  onChange={(e) => setModalFolderChoice(e.target.value)}
                >
                  <option value="">Root workspace</option>
                  {allFolders.map((dir) => (
                    <option key={dir} value={dir}>
                      {dir}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              File name
              <input
                required
                value={modalInput}
                onChange={(e) => setModalInput(e.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <button type="button" className="dash-secondary" onClick={() => setModalMode(null)}>
                Cancel
              </button>
              <button type="submit" className="button button-primary" disabled={!modalInput.trim()}>
                Save File Name
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {modalMode === 'rename-folder' && (
        <Dialog title="Rename Folder" onClose={() => setModalMode(null)}>
          <form className="dash-form" onSubmit={handleRenameFolder}>
            <label>
              Folder path
              <input
                required
                value={modalInput}
                onChange={(e) => setModalInput(e.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <button type="button" className="dash-secondary" onClick={() => setModalMode(null)}>
                Cancel
              </button>
              <button type="submit" className="button button-primary" disabled={!modalInput.trim()}>
                Save Folder Name
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {modalMode === 'make-copy' && (
        <Dialog title="Make a Copy" onClose={() => !busyAction && setModalMode(null)}>
          <form className="dash-form" onSubmit={(e) => void handleMakeCopy(e)}>
            <label>
              New project name
              <input
                required
                maxLength={200}
                value={modalInput}
                onChange={(e) => setModalInput(e.target.value)}
                disabled={busyAction}
              />
            </label>
            <div className="dialog-actions">
              <button
                type="button"
                className="dash-secondary"
                disabled={busyAction}
                onClick={() => setModalMode(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button button-primary"
                disabled={busyAction || !modalInput.trim()}
              >
                {busyAction ? 'Duplicating…' : 'Create Copy'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {modalMode === 'contact' && (
        <Dialog title="Contact Support" onClose={() => setModalMode(null)}>
          <form
            className="dash-form"
            onSubmit={(e) => {
              e.preventDefault();
              setModalMode(null);
              setToast('Your support request has been submitted.');
            }}
          >
            <p className="dash-dialog-lead">
              Need help with your CV project? Send a message to our support team.
            </p>
            <label>
              Subject
              <input
                required
                value={supportSubject}
                onChange={(e) => setSupportSubject(e.target.value)}
                placeholder="Question about my CV workspace"
              />
            </label>
            <label>
              Message
              <textarea
                rows={4}
                required
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                placeholder="Describe what you need help with…"
              />
            </label>
            <div className="dialog-actions">
              <button type="button" className="dash-secondary" onClick={() => setModalMode(null)}>
                Cancel
              </button>
              <button
                type="submit"
                className="button button-primary"
                disabled={!supportSubject.trim() || !supportMessage.trim()}
              >
                Send Message
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {modalMode === 'help' && (
        <Dialog title="How to Use the Advanced CV Builder" onClose={() => setModalMode(null)}>
          <div className="dash-form">
            <p>
              <strong>1. Name Your Project:</strong> Click the project name in the top bar (default: <code>Untitled</code>) to rename your CV at any time.
            </p>
            <p>
              <strong>2. Create Files &amp; Folders:</strong> Use the <strong>File</strong> ribbon tab or File Explorer buttons to create blank files (such as <code>main.jsx</code>, <code>header.jsx</code>, or <code>styles.css</code>) and nested folders.
            </p>
            <p>
              <strong>3. Import Between Files:</strong> Import components and stylesheets across your files using standard ES syntax (e.g. <code>import Header from &apos;./components/Header.jsx&apos;</code>).
            </p>
            <p>
              <strong>4. Save &amp; Export:</strong> Press <kbd>Ctrl + S</kbd> or click <strong>Save</strong> to save all files without downloading, or export your rendered A4 CV as PDF or DOCX.
            </p>
          </div>
        </Dialog>
      )}

      {modalMode === 'docs' && (
        <Dialog title="Advanced CV Builder Documentation" onClose={() => setModalMode(null)}>
          <div className="dash-form">
            <p>
              <strong>Creating React-Based CVs:</strong> Write React JSX functional components returning semantic HTML elements (such as <code>&lt;header&gt;</code>, <code>&lt;section&gt;</code>, <code>&lt;h1&gt;</code>, <code>&lt;p&gt;</code>) in <code>.jsx</code> files.
            </p>
            <p>
              <strong>Multi-File Imports &amp; Styling:</strong> Place modular components inside folders (e.g. <code>components/Header.jsx</code>), import them into <code>main.jsx</code> or <code>App.jsx</code>, and write custom CSS rules in <code>styles.css</code>.
            </p>
            <p>
              <strong>Multi-Page A4 CVs:</strong> Add <code>&lt;div className=&quot;page-break&quot; /&gt;</code> between sections to split your CV across multiple A4 pages in both Live Preview and PDF/DOCX exports.
            </p>
            <p>
              <strong>Uploading Images &amp; ZIP Archives:</strong> Use <strong>Upload Images</strong> to add PNG, JPG, JPEG, or SVG files and reference them via <code>&lt;img src=&quot;photo.png&quot; /&gt;</code> or <code>import photo from &apos;./photo.png&apos;</code>.
            </p>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export function AdvancedCvRoutes() {
  return (
    <Routes>
      <Route path="advanced-cv" element={<AdvancedCvIndexPage />} />
      <Route path="advanced-cv/new" element={<CreateBlankCvRedirect />} />
      <Route path="advanced-cv/:projectId" element={<BlankCvWorkspace />} />
    </Routes>
  );
}
