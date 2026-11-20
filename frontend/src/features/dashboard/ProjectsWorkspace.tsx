import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Archive,
  CheckSquare,
  Code2,
  Copy,
  FileSpreadsheet,
  FileText,
  Folder as FolderIcon,
  FolderInput,
  FolderPlus,
  History,
  LayoutGrid,
  List,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Square,
  Star,
  Trash2,
} from 'lucide-react';
import { Dialog } from '../../components/Dialog';
import { api } from '../../services/api';
import {
  formatDate,
  getProjectEditorPath,
  kindNames,
  useRefreshWorkspace,
  useWorkspace,
  type Folder,
  type Project,
  type ProjectsResponse,
} from './data';
import { NewProjectDialog } from './NewProjectDialog';
import { QueryState } from './QueryState';

type ProjectModalAction = 'menu' | 'rename' | 'move' | 'delete' | 'versions' | 'share' | 'permanent-delete';
type FolderModalState =
  | { mode: 'create'; parentId: string }
  | { mode: 'rename'; folder: Folder }
  | { mode: 'move'; folder: Folder }
  | { mode: 'delete'; folder: Folder };

function getDescendantIds(folders: Folder[], rootId: string): Set<string> {
  const result = new Set<string>([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const f of folders) {
      if (f.parent && result.has(f.parent) && !result.has(f.id)) {
        result.add(f.id);
        added = true;
      }
    }
  }
  return result;
}

function ProjectTypeIcon({ kind }: { kind: Project['kind'] }) {
  if (kind === 'advanced_cv') return <Code2 size={20} />;
  return <Mail size={20} />;
}

export function ProjectsWorkspace({
  mode = 'projects',
  workflows,
}: {
  mode?: 'projects' | 'deleted';
  workflows?: Record<string, boolean>;
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const refresh = useRefreshWorkspace();

  const urlSearch = searchParams.get('search') || '';
  const stateParam = mode === 'deleted' ? 'deleted' : searchParams.get('state') === 'archived' ? 'archived' : 'active';
  const kindParam = searchParams.get('kind') || 'all';
  const favoriteParam = searchParams.get('favorite') === 'true';
  const folderParam = searchParams.get('folder') || '';
  const orderingParam = searchParams.get('ordering') || '-updated_at';
  const viewMode = searchParams.get('view') === 'grid' ? 'grid' : 'list';
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);

  const [searchInput, setSearchInput] = useState(urlSearch);
  const [folderSearch, setFolderSearch] = useState('');
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkPermanentDeleteOpen, setBulkPermanentDeleteOpen] = useState(false);
  const [bulkTargetFolder, setBulkTargetFolder] = useState('');

  // Individual Project Action Dialog
  const [activeProjectModal, setActiveProjectModal] = useState<{
    project: Project;
    action: ProjectModalAction;
  } | null>(null);
  const [projectInput, setProjectInput] = useState('');
  const [inlineFolderName, setInlineFolderName] = useState('');

  // Folder Management Dialog
  const [folderModal, setFolderModal] = useState<FolderModalState | null>(null);
  const [folderNameInput, setFolderNameInput] = useState('');
  const [folderParentInput, setFolderParentInput] = useState('');

  // Feedback
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  // Debounce search input into URL query params
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
    setSelectedIds([]);
  }

  const queryString = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set('state', stateParam);
    qs.set('page', String(page));
    qs.set('page_size', '12');
    qs.set('ordering', orderingParam);
    if (urlSearch) qs.set('search', urlSearch);
    if (kindParam && kindParam !== 'all') qs.set('kind', kindParam);
    if (favoriteParam) qs.set('favorite', 'true');
    if (folderParam) qs.set('folder', folderParam);
    return qs.toString();
  }, [stateParam, page, orderingParam, urlSearch, kindParam, favoriteParam, folderParam]);

  const projectsQuery = useWorkspace<ProjectsResponse>('projects-workspace', `/projects/?${queryString}`);
  const foldersQuery = useWorkspace<Folder[]>('folders', '/project-folders/');

  const results = projectsQuery.data?.results || [];
  const stats = projectsQuery.data?.stats;
  const folders = foldersQuery.data || [];

  const filteredFolders = useMemo(() => {
    const q = folderSearch.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [folders, folderSearch]);

  const currentFolderObj = useMemo(
    () => folders.find((f) => f.id === folderParam) || null,
    [folders, folderParam]
  );

  const allOnPageSelected = results.length > 0 && results.every((p) => selectedIds.includes(p.id));

  function toggleSelectAll() {
    if (allOnPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !results.some((p) => p.id === id)));
    } else {
      const pageIds = results.map((p) => p.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function openProjectModal(project: Project, action: ProjectModalAction) {
    setError('');
    setActiveProjectModal({ project, action });
    setProjectInput(action === 'rename' ? project.title : project.folder || '');
    setInlineFolderName('');
  }

  async function mutateProject(project: Project, action: string, data?: object) {
    setPending(true);
    setError('');
    setNotice('');
    try {
      await api(`/projects/${project.id}/${action === 'update' ? '' : `${action}/`}`, {
        method: action === 'update' ? 'PATCH' : 'POST',
        ...(data ? { body: JSON.stringify(data) } : {}),
      });
      setActiveProjectModal(null);
      setSelectedIds((prev) => prev.filter((id) => id !== project.id));
      setNotice(
        action === 'delete'
          ? `“${project.title}” moved to Deleted Files.`
          : action === 'duplicate'
          ? `“${project.title}” duplicated.`
          : action === 'restore'
          ? `“${project.title}” restored to active projects.`
          : action === 'permanent-delete'
          ? `“${project.title}” permanently deleted.`
          : `“${project.title}” updated.`
      );
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function runBulkAction(action: string, extra?: Record<string, unknown>) {
    if (selectedIds.length === 0) return;
    setPending(true);
    setError('');
    setNotice('');
    try {
      const res = await api<{ updated_count: number; failed_ids: string[] }>('/projects/bulk-actions/', {
        method: 'POST',
        body: JSON.stringify({ action, project_ids: selectedIds, ...extra }),
      });
      setBulkMoveOpen(false);
      setBulkDeleteOpen(false);
      setSelectedIds([]);
      const partialNote =
        res.failed_ids.length > 0 ? ` (${res.failed_ids.length} could not be updated)` : '';
      const labels: Record<string, string> = {
        favorite: 'added to favorites',
        unfavorite: 'removed from favorites',
        archive: 'archived',
        unarchive: 'unarchived',
        move: 'moved to folder',
        delete: 'moved to Deleted Files',
        restore: 'restored',
        'permanent-delete': 'permanently deleted',
      };
      setNotice(`${res.updated_count} project(s) ${labels[action] || 'updated'}${partialNote}.`);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function createInlineFolder() {
    if (!inlineFolderName.trim()) return;
    setPending(true);
    setError('');
    try {
      const created = await api<Folder>('/project-folders/', {
        method: 'POST',
        body: JSON.stringify({ name: inlineFolderName.trim() }),
      });
      await foldersQuery.refetch();
      setProjectInput(created.id);
      setInlineFolderName('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  function openCreateFolder(parentId = '') {
    setError('');
    setFolderNameInput('');
    setFolderParentInput(parentId);
    setFolderModal({ mode: 'create', parentId });
  }

  function openRenameFolder(folder: Folder) {
    setError('');
    setFolderNameInput(folder.name);
    setFolderModal({ mode: 'rename', folder });
  }

  function openMoveFolder(folder: Folder) {
    setError('');
    setFolderParentInput(folder.parent || '');
    setFolderModal({ mode: 'move', folder });
  }

  function openDeleteFolder(folder: Folder) {
    setError('');
    setFolderModal({ mode: 'delete', folder });
  }

  async function submitFolderModal(e: React.FormEvent) {
    e.preventDefault();
    if (!folderModal || pending) return;
    setPending(true);
    setError('');
    setNotice('');
    try {
      if (folderModal.mode === 'create') {
        await api<Folder>('/project-folders/', {
          method: 'POST',
          body: JSON.stringify({
            name: folderNameInput.trim(),
            parent: folderParentInput || null,
          }),
        });
        setNotice('Folder created.');
      } else if (folderModal.mode === 'rename') {
        await api<Folder>(`/project-folders/${folderModal.folder.id}/`, {
          method: 'PATCH',
          body: JSON.stringify({ name: folderNameInput.trim() }),
        });
        setNotice('Folder renamed.');
      } else if (folderModal.mode === 'move') {
        await api<Folder>(`/project-folders/${folderModal.folder.id}/`, {
          method: 'PATCH',
          body: JSON.stringify({ parent: folderParentInput || null }),
        });
        setNotice('Folder moved.');
      } else if (folderModal.mode === 'delete') {
        const deletedId = folderModal.folder.id;
        await api(`/project-folders/${deletedId}/`, { method: 'DELETE' });
        if (folderParam === deletedId) {
          updateParams({ folder: null, page: null });
        }
        setNotice('Folder removed.');
      }
      setFolderModal(null);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  function renderFolderTree(parentId: string | null = null, depth = 0): React.ReactNode {
    const children = filteredFolders.filter((f) =>
      folderSearch.trim() ? true : (f.parent || null) === parentId
    );
    if (children.length === 0) return null;

    return (
      <ul className="folder-tree-list" role={depth === 0 ? 'tree' : 'group'}>
        {children.map((folder) => {
          const isSelected = folderParam === folder.id;
          return (
            <li key={folder.id} className="folder-tree-item" role="treeitem" aria-selected={isSelected}>
              <div
                className={`folder-tree-row ${isSelected ? 'is-active' : ''}`}
                style={{ paddingLeft: `${12 + depth * 16}px` }}
              >
                <button
                  type="button"
                  className="folder-select-btn"
                  onClick={() => updateParams({ folder: folder.id, page: null })}
                >
                  <FolderIcon size={16} />
                  <span className="folder-tree-name">{folder.name}</span>
                  <span className="folder-count-pill">{folder.project_count ?? 0}</span>
                </button>
                <div className="folder-row-actions">
                  <button
                    type="button"
                    className="dash-icon-button"
                    aria-label={`Create subfolder in ${folder.name}`}
                    title="Create subfolder"
                    onClick={() => openCreateFolder(folder.id)}
                  >
                    <FolderPlus size={15} />
                  </button>
                  <button
                    type="button"
                    className="dash-icon-button"
                    aria-label={`Rename folder ${folder.name}`}
                    title="Rename folder"
                    onClick={() => openRenameFolder(folder)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="dash-icon-button"
                    aria-label={`Move folder ${folder.name}`}
                    title="Move folder"
                    onClick={() => openMoveFolder(folder)}
                  >
                    <FolderInput size={15} />
                  </button>
                  <button
                    type="button"
                    className="dash-icon-button"
                    aria-label={`Remove folder ${folder.name}`}
                    title="Remove folder"
                    onClick={() => openDeleteFolder(folder)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              {!folderSearch.trim() && renderFolderTree(folder.id, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  }

  function renderContinueEditingButton(project: Project) {
    if (project.deleted_at) {
      return (
        <>
          <button
            type="button"
            className="dash-secondary"
            disabled={pending}
            onClick={() => void mutateProject(project, 'restore')}
          >
            <RotateCcw size={16} />
            Restore
          </button>
          <button
            type="button"
            className="dash-secondary dash-danger-btn"
            disabled={pending}
            onClick={() => openProjectModal(project, 'permanent-delete')}
          >
            <Trash2 size={16} />
            Delete Permanently
          </button>
        </>
      );
    }
    const editorPath = getProjectEditorPath(project);
    const isEditorAvailable = Boolean(workflows?.[project.kind]);
    if (isEditorAvailable) {
      return (
        <Link className="dash-secondary" to={editorPath}>
          Continue Editing
        </Link>
      );
    }
    return (
      <button
        type="button"
        className="dash-secondary editor-unavailable"
        disabled
        data-editor-path={editorPath}
        title="The document editor is not available yet"
      >
        Continue Editing
      </button>
    );
  }

  return (
    <div className="projects-workspace">
      {/* PAGE HEADER */}
      <div className="dash-page-header">
        <div>
          <span className="eyebrow">
            {mode === 'deleted' ? 'RECOVERY & RECYCLE BIN' : 'PROJECT MANAGEMENT WORKSPACE'}
          </span>
          <h1>{mode === 'deleted' ? 'Deleted Files' : 'Your Projects'}</h1>
          <p className="dash-subtitle">
            {mode === 'deleted'
              ? 'Restore soft-deleted CVs and cover letters back to your active workspace.'
              : 'Create, organize, search, filter, and manage your CVs and cover letters in one place.'}
          </p>
        </div>
        <div className="dash-header-cta">
          {mode === 'deleted' ? (
            <button
              type="button"
              className="dash-secondary"
              onClick={() => navigate('/dashboard/projects')}
            >
              Back to Your Projects
            </button>
          ) : (
            <button
              type="button"
              className="button button-primary"
              onClick={() => setNewProjectOpen(true)}
            >
              <Plus size={18} />
              New Project
            </button>
          )}
        </div>
      </div>

      {/* PROJECT STATISTICS CARDS */}
      {mode === 'projects' && stats && (
        <section className="stats-grid projects-stats-grid" aria-label="Project statistics">
          <article className="stat-card" aria-label={`Total Active Projects: ${stats.active}`}>
            <span className="stat-label">Total Active Projects</span>
            <strong className="stat-value">{stats.active}</strong>
            <span className="stat-meta">{stats.total} total non-deleted</span>
          </article>
          <article className="stat-card" aria-label={`Favorites: ${stats.favorites}`}>
            <span className="stat-label">Favorites</span>
            <strong className="stat-value">{stats.favorites}</strong>
            <span className="stat-meta">Starred documents</span>
          </article>
          <article className="stat-card" aria-label={`Archived Projects: ${stats.archived}`}>
            <span className="stat-label">Archived Projects</span>
            <strong className="stat-value">{stats.archived}</strong>
            <span className="stat-meta">Preserved in archive</span>
          </article>
          <article className="stat-card" aria-label="Document Types breakdown">
            <span className="stat-label">By Document Type</span>
            <strong className="stat-value">{stats.total}</strong>
            <span className="stat-meta">
              {stats.advanced_cv} Advanced · {stats.cover_letter} Letters
            </span>
          </article>
        </section>
      )}

      {notice && (
        <p className="dash-toast" role="status">
          {notice}
        </p>
      )}
      {error && !activeProjectModal && !folderModal && (
        <p className="dash-error" role="alert">
          {error}
        </p>
      )}

      <div className={mode === 'projects' ? 'projects-layout-grid' : 'projects-single-column'}>
        {/* FOLDER MANAGEMENT SIDEBAR (YOUR PROJECTS) */}
        {mode === 'projects' && (
          <aside className="folders-panel" aria-label="Folder navigation">
            <div className="folders-panel-header">
              <h2>Folders</h2>
              <button
                type="button"
                className="dash-secondary dash-btn-compact"
                onClick={() => openCreateFolder('')}
              >
                <FolderPlus size={16} />
                New Folder
              </button>
            </div>

            <label className="folder-search-box">
              <Search size={15} />
              <input
                type="search"
                placeholder="Search folders…"
                aria-label="Search folders"
                value={folderSearch}
                onChange={(e) => setFolderSearch(e.target.value)}
              />
            </label>

            <div className="folder-nav-list">
              <button
                type="button"
                className={`folder-nav-item ${!folderParam ? 'is-active' : ''}`}
                onClick={() => updateParams({ folder: null, page: null })}
              >
                <FolderIcon size={16} />
                <span>All Folders</span>
              </button>
              <button
                type="button"
                className={`folder-nav-item ${folderParam === 'none' ? 'is-active' : ''}`}
                onClick={() => updateParams({ folder: 'none', page: null })}
              >
                <FileText size={16} />
                <span>Unfiled Projects</span>
              </button>
            </div>

            <QueryState
              pending={foldersQuery.isPending}
              error={foldersQuery.error}
              retry={foldersQuery.refetch}
            >
              {filteredFolders.length === 0 ? (
                <p className="folder-empty-note">
                  {folderSearch.trim()
                    ? 'No matching folders.'
                    : 'No custom folders yet. Create a folder to organize your projects.'}
                </p>
              ) : (
                renderFolderTree(null, 0)
              )}
            </QueryState>
          </aside>
        )}

        {/* MAIN PROJECTS LIST / TABLE / GRID */}
        <section className="projects-main-panel" aria-label="Projects list">
          {/* FILTER & SEARCH BAR */}
          <div className="projects-toolbar">
            <label className="projects-search-input">
              <Search size={17} />
              <input
                type="search"
                placeholder="Search by project name…"
                aria-label="Search projects"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </label>

            {mode === 'projects' && (
              <div className="projects-filter-pills" role="group" aria-label="Status filters">
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
                  onClick={() =>
                    updateParams({ favorite: favoriteParam ? null : 'true', page: null })
                  }
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
            )}

            <div className="projects-select-controls">
              <label className="toolbar-select-label">
                <span>Type</span>
                <select
                  aria-label="Filter by project type"
                  value={kindParam}
                  onChange={(e) => updateParams({ kind: e.target.value, page: null })}
                >
                  <option value="all">All Types</option>
                  <option value="advanced_cv">Advanced CV</option>
                  <option value="cover_letter">Cover Letter</option>
                </select>
              </label>

              <label className="toolbar-select-label">
                <span>Sort by</span>
                <select
                  aria-label="Sort projects"
                  value={orderingParam}
                  onChange={(e) => updateParams({ ordering: e.target.value, page: null })}
                >
                  <option value="-updated_at">Recently Modified</option>
                  <option value="-created_at">Recently Created</option>
                  <option value="title">Name A–Z</option>
                  <option value="-title">Name Z–A</option>
                  <option value="kind">Project Type</option>
                </select>
              </label>

              {mode === 'projects' && (
                <div className="view-toggle-group" role="group" aria-label="Layout view">
                  <button
                    type="button"
                    className={`dash-icon-button ${viewMode === 'list' ? 'is-active' : ''}`}
                    aria-label="List view"
                    aria-pressed={viewMode === 'list'}
                    onClick={() => updateParams({ view: null })}
                  >
                    <List size={18} />
                  </button>
                  <button
                    type="button"
                    className={`dash-icon-button ${viewMode === 'grid' ? 'is-active' : ''}`}
                    aria-label="Grid view"
                    aria-pressed={viewMode === 'grid'}
                    onClick={() => updateParams({ view: 'grid' })}
                  >
                    <LayoutGrid size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ACTIVE FOLDER BANNER */}
          {currentFolderObj && (
            <div className="active-folder-banner">
              <span>
                Viewing folder: <strong>{currentFolderObj.name}</strong>
                {currentFolderObj.parent_name && ` (inside ${currentFolderObj.parent_name})`}
              </span>
              <button
                type="button"
                className="dash-link"
                onClick={() => updateParams({ folder: null, page: null })}
              >
                Show all folders
              </button>
            </div>
          )}

          {/* BULK ACTIONS TOOLBAR */}
          {selectedIds.length > 0 && (
            <div className="bulk-actions-bar" role="region" aria-label="Bulk actions">
              <strong>{selectedIds.length} selected</strong>
              <div className="bulk-actions-buttons">
                {mode === 'deleted' ? (
                  <>
                    <button
                      type="button"
                      className="dash-secondary"
                      disabled={pending}
                      onClick={() => void runBulkAction('restore')}
                    >
                      <RotateCcw size={15} />
                      Restore Selected
                    </button>
                    <button
                      type="button"
                      className="dash-secondary dash-danger-btn"
                      disabled={pending}
                      onClick={() => setBulkPermanentDeleteOpen(true)}
                    >
                      <Trash2 size={15} />
                      Delete Permanently
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="dash-secondary"
                      disabled={pending}
                      onClick={() => void runBulkAction('favorite')}
                    >
                      <Star size={15} />
                      Add to Favorites
                    </button>
                    <button
                      type="button"
                      className="dash-secondary"
                      disabled={pending}
                      onClick={() => void runBulkAction('unfavorite')}
                    >
                      Remove Favorite
                    </button>
                    <button
                      type="button"
                      className="dash-secondary"
                      disabled={pending}
                      onClick={() => {
                        setBulkTargetFolder('');
                        setBulkMoveOpen(true);
                      }}
                    >
                      <FolderInput size={15} />
                      Move to Folder
                    </button>
                    <button
                      type="button"
                      className="dash-secondary"
                      disabled={pending}
                      onClick={() =>
                        void runBulkAction(stateParam === 'archived' ? 'unarchive' : 'archive')
                      }
                    >
                      <Archive size={15} />
                      {stateParam === 'archived' ? 'Unarchive' : 'Archive'}
                    </button>
                    <button
                      type="button"
                      className="dash-secondary dash-danger-btn"
                      disabled={pending}
                      onClick={() => setBulkDeleteOpen(true)}
                    >
                      <Trash2 size={15} />
                      Soft Delete
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="dash-link"
                  disabled={pending}
                  onClick={() => setSelectedIds([])}
                >
                  Clear selection
                </button>
              </div>
            </div>
          )}

          {/* RESULTS AREA */}
          <QueryState
            pending={projectsQuery.isPending}
            error={projectsQuery.error}
            retry={projectsQuery.refetch}
          >
            {results.length === 0 ? (
              <div className="dash-empty">
                <FileText size={36} />
                <h3>
                  {currentFolderObj
                    ? `Folder “${currentFolderObj.name}” is empty`
                    : urlSearch
                    ? 'No matching projects'
                    : stateParam === 'deleted'
                    ? 'No deleted projects'
                    : stateParam === 'archived'
                    ? 'No archived projects'
                    : favoriteParam
                    ? 'No favorite projects yet'
                    : 'No projects yet'}
                </h3>
                <p>
                  {currentFolderObj
                    ? 'Move existing projects into this folder or clear the folder filter.'
                    : urlSearch
                    ? 'Try a different search term or clear active filters.'
                    : stateParam === 'deleted'
                    ? 'Projects moved to Deleted Files will appear here for safe recovery.'
                    : 'Your career documents and projects will appear here.'}
                </p>
                {(urlSearch || kindParam !== 'all' || favoriteParam || folderParam || stateParam !== 'active') &&
                  mode === 'projects' && (
                    <button
                      type="button"
                      className="dash-secondary"
                      onClick={() =>
                        setSearchParams(new URLSearchParams(), { replace: true })
                      }
                    >
                      Reset all filters
                    </button>
                  )}
              </div>
            ) : viewMode === 'grid' && mode === 'projects' ? (
              /* GRID VIEW */
              <div className="projects-grid-view">
                {results.map((project) => {
                  const isChecked = selectedIds.includes(project.id);
                  return (
                    <article
                      key={project.id}
                      className={`project-grid-card ${isChecked ? 'is-selected' : ''}`}
                    >
                      <div className="project-card-preview">
                        <div className="project-card-top-controls">
                          <button
                            type="button"
                            className="dash-icon-button"
                            aria-label={`Select ${project.title}`}
                            aria-pressed={isChecked}
                            onClick={() => toggleSelectOne(project.id)}
                          >
                            {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                          <button
                            type="button"
                            className={`dash-icon-button ${project.favorite ? 'is-favorite' : ''}`}
                            aria-label={`${project.favorite ? 'Unfavorite' : 'Favorite'} ${project.title}`}
                            aria-pressed={project.favorite}
                            disabled={pending}
                            onClick={() =>
                              void mutateProject(project, 'update', { favorite: !project.favorite })
                            }
                          >
                            <Star size={18} fill={project.favorite ? 'currentColor' : 'none'} />
                          </button>
                        </div>
                        <div className="project-card-placeholder">
                          <ProjectTypeIcon kind={project.kind} />
                          <span>{kindNames[project.kind]}</span>
                        </div>
                      </div>

                      <div className="project-card-body">
                        <h3>{project.title}</h3>
                        <p className="project-card-meta">
                          <span>{kindNames[project.kind]}</span>
                          <span>·</span>
                          <span>{project.folder_name || 'Unfiled'}</span>
                        </p>
                        <time dateTime={project.updated_at}>
                          Modified {formatDate(project.updated_at)}
                        </time>
                      </div>

                      <div className="project-card-footer">
                        {renderContinueEditingButton(project)}
                        <button
                          type="button"
                          className="dash-icon-button"
                          aria-label={`Actions for ${project.title}`}
                          onClick={() => openProjectModal(project, 'menu')}
                        >
                          <MoreHorizontal size={20} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              /* TABLE / LIST VIEW */
              <div className="projects-table-wrap">
                <table className="projects-table">
                  <thead>
                    <tr>
                      <th scope="col" className="col-check">
                        <button
                          type="button"
                          className="dash-icon-button"
                          aria-label={allOnPageSelected ? 'Deselect all on page' : 'Select all on page'}
                          aria-pressed={allOnPageSelected}
                          onClick={toggleSelectAll}
                        >
                          {allOnPageSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                      </th>
                      <th scope="col">Project Name</th>
                      <th scope="col">Type</th>
                      <th scope="col">Folder</th>
                      <th scope="col">{mode === 'deleted' ? 'Deleted Date' : 'Last Modified'}</th>
                      <th scope="col">Favorite</th>
                      <th scope="col" className="col-actions">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((project) => {
                      const isChecked = selectedIds.includes(project.id);
                      return (
                        <tr key={project.id} className={isChecked ? 'is-selected' : ''}>
                          <td>
                            <button
                              type="button"
                              className="dash-icon-button"
                              aria-label={`Select ${project.title}`}
                              aria-pressed={isChecked}
                              onClick={() => toggleSelectOne(project.id)}
                            >
                              {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                            </button>
                          </td>
                          <td>
                            <div className="table-project-title">
                              <span className="project-icon">
                                <ProjectTypeIcon kind={project.kind} />
                              </span>
                              <div>
                                <strong>{project.title}</strong>
                                {project.archived && !project.deleted_at && (
                                  <span className="status-pill">Archived</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="type-badge">{kindNames[project.kind]}</span>
                          </td>
                          <td>{project.folder_name || 'Unfiled'}</td>
                          <td>
                            <time dateTime={project.deleted_at || project.updated_at}>
                              {formatDate(project.deleted_at || project.updated_at)}
                            </time>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`dash-icon-button ${project.favorite ? 'is-favorite' : ''}`}
                              aria-label={`${project.favorite ? 'Unfavorite' : 'Favorite'} ${project.title}`}
                              aria-pressed={project.favorite}
                              disabled={pending || Boolean(project.deleted_at)}
                              onClick={() =>
                                void mutateProject(project, 'update', {
                                  favorite: !project.favorite,
                                })
                              }
                            >
                              <Star size={18} fill={project.favorite ? 'currentColor' : 'none'} />
                            </button>
                          </td>
                          <td>
                            <div className="table-row-actions">
                              {renderContinueEditingButton(project)}
                              {!project.deleted_at && (
                                <button
                                  type="button"
                                  className="dash-icon-button"
                                  aria-label={`Actions for ${project.title}`}
                                  onClick={() => openProjectModal(project, 'menu')}
                                >
                                  <MoreHorizontal size={20} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* PAGINATION */}
            {projectsQuery.data && projectsQuery.data.count > 12 && (
              <div className="dash-pagination">
                <button
                  type="button"
                  className="dash-secondary"
                  disabled={!projectsQuery.data.previous}
                  onClick={() => updateParams({ page: String(page - 1) })}
                >
                  Previous
                </button>
                <span>
                  Page {page} · {projectsQuery.data.count} projects
                </span>
                <button
                  type="button"
                  className="dash-secondary"
                  disabled={!projectsQuery.data.next}
                  onClick={() => updateParams({ page: String(page + 1) })}
                >
                  Next
                </button>
              </div>
            )}
          </QueryState>
        </section>
      </div>

      {/* NEW PROJECT MODAL */}
      {newProjectOpen && (
        <NewProjectDialog workflows={workflows} onClose={() => setNewProjectOpen(false)} />
      )}

      {/* INDIVIDUAL PROJECT ACTION DIALOG */}
      {activeProjectModal && (
        <Dialog
          title={
            activeProjectModal.action === 'menu'
              ? activeProjectModal.project.title
              : activeProjectModal.action === 'rename'
              ? 'Rename project'
              : activeProjectModal.action === 'move'
              ? 'Move to folder'
              : activeProjectModal.action === 'versions'
              ? 'Version history'
              : activeProjectModal.action === 'share'
              ? 'Share project'
              : activeProjectModal.action === 'permanent-delete'
              ? 'Delete permanently?'
              : 'Move to Deleted Files?'
          }
          onClose={() => {
            if (!pending) setActiveProjectModal(null);
          }}
        >
          {error && (
            <p className="dash-error" role="alert">
              {error}
            </p>
          )}
          {activeProjectModal.action === 'menu' ? (
            <div className="project-action-menu">
              <button
                type="button"
                disabled={pending}
                onClick={() => openProjectModal(activeProjectModal.project, 'rename')}
              >
                <Pencil size={18} />
                Rename
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void mutateProject(activeProjectModal.project, 'duplicate')}
              >
                <Copy size={18} />
                Duplicate
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  void mutateProject(activeProjectModal.project, 'update', {
                    favorite: !activeProjectModal.project.favorite,
                  })
                }
              >
                <Star size={18} />
                {activeProjectModal.project.favorite ? 'Remove favorite' : 'Add to favorites'}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => openProjectModal(activeProjectModal.project, 'move')}
              >
                <FolderInput size={18} />
                Move to folder
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  void mutateProject(activeProjectModal.project, 'update', {
                    archived: !activeProjectModal.project.archived,
                  })
                }
              >
                <Archive size={18} />
                {activeProjectModal.project.archived ? 'Unarchive' : 'Archive'}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => openProjectModal(activeProjectModal.project, 'versions')}
              >
                <History size={18} />
                Version History
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => openProjectModal(activeProjectModal.project, 'share')}
              >
                <Share2 size={18} />
                Share
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => openProjectModal(activeProjectModal.project, 'delete')}
              >
                <Trash2 size={18} />
                Move to Deleted Files
              </button>
            </div>
          ) : activeProjectModal.action === 'versions' ? (
            <div className="dash-form">
              <p>
                Document version history for <strong>{activeProjectModal.project.title}</strong> is
                preserved in PostgreSQL and will be interactive once the document editor module is
                enabled.
              </p>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => setActiveProjectModal(null)}
                >
                  Close
                </button>
              </div>
            </div>
          ) : activeProjectModal.action === 'share' ? (
            <div className="dash-form">
              <p>
                <strong>{activeProjectModal.project.title}</strong> is private to your account.
                Revocable sharing links and permissions will unlock when the document collaboration
                service is enabled.
              </p>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => setActiveProjectModal(null)}
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form
              className="dash-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!pending) {
                  void mutateProject(
                    activeProjectModal.project,
                    activeProjectModal.action === 'delete' || activeProjectModal.action === 'permanent-delete'
                      ? activeProjectModal.action
                      : 'update',
                    activeProjectModal.action === 'rename'
                      ? { title: projectInput }
                      : activeProjectModal.action === 'move'
                      ? { folder: projectInput || null }
                      : undefined
                  );
                }
              }}
            >
              {activeProjectModal.action === 'rename' && (
                <label>
                  Project title
                  <input
                    required
                    maxLength={200}
                    value={projectInput}
                    onChange={(e) => setProjectInput(e.target.value)}
                    disabled={pending}
                  />
                </label>
              )}
              {activeProjectModal.action === 'move' && (
                <>
                  <label>
                    Folder
                    <select
                      value={projectInput}
                      onChange={(e) => setProjectInput(e.target.value)}
                      disabled={pending}
                    >
                      <option value="">No folder</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.parent_name ? `${f.parent_name} / ${f.name}` : f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    New folder name
                    <input
                      maxLength={120}
                      value={inlineFolderName}
                      onChange={(e) => setInlineFolderName(e.target.value)}
                      disabled={pending}
                    />
                  </label>
                  <button
                    type="button"
                    className="dash-secondary"
                    disabled={pending || !inlineFolderName.trim()}
                    onClick={() => void createInlineFolder()}
                  >
                    Create folder
                  </button>
                </>
              )}
              {activeProjectModal.action === 'delete' && (
                <p>
                  “{activeProjectModal.project.title}” will be soft-deleted and moved to Deleted
                  Files. Its document content and versions are preserved for recovery.
                </p>
              )}
              {activeProjectModal.action === 'permanent-delete' && (
                <p>
                  <strong>Warning:</strong> “{activeProjectModal.project.title}” will be
                  permanently deleted. This action cannot be undone. All document content,
                  versions, and associated data will be removed from the database.
                </p>
              )}
              <div className="dialog-actions">
                <button
                  type="button"
                  className="dash-secondary"
                  disabled={pending}
                  onClick={() => setActiveProjectModal(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="button button-primary" disabled={pending}>
                  {pending
                    ? 'Saving…'
                    : activeProjectModal.action === 'delete'
                    ? 'Move to Deleted Files'
                    : activeProjectModal.action === 'permanent-delete'
                    ? 'Delete Permanently'
                    : 'Save changes'}
                </button>
              </div>
            </form>
          )}
        </Dialog>
      )}

      {/* FOLDER CREATE / RENAME / MOVE / DELETE MODAL */}
      {folderModal && (
        <Dialog
          title={
            folderModal.mode === 'create'
              ? folderModal.parentId
                ? 'Create subfolder'
                : 'Create folder'
              : folderModal.mode === 'rename'
              ? 'Rename folder'
              : folderModal.mode === 'move'
              ? 'Move folder'
              : 'Remove folder?'
          }
          onClose={() => {
            if (!pending) setFolderModal(null);
          }}
        >
          {error && (
            <p className="dash-error" role="alert">
              {error}
            </p>
          )}
          <form className="dash-form" onSubmit={(e) => void submitFolderModal(e)}>
            {(folderModal.mode === 'create' || folderModal.mode === 'rename') && (
              <label>
                Folder name
                <input
                  required
                  maxLength={120}
                  value={folderNameInput}
                  onChange={(e) => setFolderNameInput(e.target.value)}
                  disabled={pending}
                />
              </label>
            )}
            {(folderModal.mode === 'create' || folderModal.mode === 'move') && (
              <label>
                Parent folder
                <select
                  value={folderParentInput}
                  onChange={(e) => setFolderParentInput(e.target.value)}
                  disabled={pending}
                >
                  <option value="">Top-level (No parent folder)</option>
                  {folders
                    .filter((candidate) => {
                      if (folderModal.mode !== 'move') return true;
                      const forbidden = getDescendantIds(folders, folderModal.folder.id);
                      return !forbidden.has(candidate.id);
                    })
                    .map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.parent_name
                          ? `${candidate.parent_name} / ${candidate.name}`
                          : candidate.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {folderModal.mode === 'delete' && (
              <p>
                Remove folder <strong>{folderModal.folder.name}</strong>? Any projects inside it
                will be kept safe and moved to {folderModal.folder.parent_name || 'Unfiled'}.
              </p>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="dash-secondary"
                disabled={pending}
                onClick={() => setFolderModal(null)}
              >
                Cancel
              </button>
              <button type="submit" className="button button-primary" disabled={pending}>
                {pending
                  ? 'Saving…'
                  : folderModal.mode === 'delete'
                  ? 'Remove folder'
                  : 'Save folder'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* BULK MOVE DIALOG */}
      {bulkMoveOpen && (
        <Dialog
          title="Move selected projects"
          onClose={() => {
            if (!pending) setBulkMoveOpen(false);
          }}
        >
          <form
            className="dash-form"
            onSubmit={(e) => {
              e.preventDefault();
              void runBulkAction('move', { folder: bulkTargetFolder || null });
            }}
          >
            <label>
              Destination folder
              <select
                value={bulkTargetFolder}
                onChange={(e) => setBulkTargetFolder(e.target.value)}
                disabled={pending}
              >
                <option value="">No folder (Unfiled)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.parent_name ? `${f.parent_name} / ${f.name}` : f.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="dialog-actions">
              <button
                type="button"
                className="dash-secondary"
                disabled={pending}
                onClick={() => setBulkMoveOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="button button-primary" disabled={pending}>
                {pending ? 'Moving…' : `Move ${selectedIds.length} project(s)`}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* BULK DELETE CONFIRMATION DIALOG */}
      {bulkDeleteOpen && (
        <Dialog
          title="Move selected projects to Deleted Files?"
          onClose={() => {
            if (!pending) setBulkDeleteOpen(false);
          }}
        >
          <div className="dash-form">
            <p>
              Are you sure you want to move <strong>{selectedIds.length}</strong> selected
              project(s) to Deleted Files? You can restore them anytime from Deleted Files.
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="dash-secondary"
                disabled={pending}
                onClick={() => setBulkDeleteOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={pending}
                onClick={() => void runBulkAction('delete')}
              >
                {pending ? 'Deleting…' : 'Move to Deleted Files'}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* BULK PERMANENT DELETE CONFIRMATION DIALOG */}
      {bulkPermanentDeleteOpen && (
        <Dialog
          title="Permanently delete selected projects?"
          onClose={() => {
            if (!pending) setBulkPermanentDeleteOpen(false);
          }}
        >
          <div className="dash-form">
            <p>
              <strong>Warning:</strong> You are about to permanently delete{' '}
              <strong>{selectedIds.length}</strong> project(s). This action cannot be undone.
              All document content, versions, and associated data will be removed from the
              database.
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="dash-secondary"
                disabled={pending}
                onClick={() => setBulkPermanentDeleteOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={pending}
                onClick={() => void runBulkAction('permanent-delete')}
              >
                {pending ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

