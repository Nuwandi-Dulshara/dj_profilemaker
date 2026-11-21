import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity as ActivityIcon,
  ArrowRight,
  Bell,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Code2,
  Database,
  FileSpreadsheet,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserRound,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { CoverLetterRoutes } from '../cover-letter/CoverLetterBuilder';
import { AdvancedCvRoutes } from '../cv/AdvancedCvBuilder';
import { ProfilePage } from '../profile/ProfilePage';
import { useSession } from '../auth/AuthProvider';
import {
  bytes,
  formatDate,
  useRefreshWorkspace,
  useWorkspace,
  type ActivityItem,
  type NotificationsResponse,
  type Page,
  type StorageInfo,
  type Summary,
} from './data';
import { NewProjectDialog } from './NewProjectDialog';
import { ProjectList } from './ProjectList';
import { ProjectsWorkspace } from './ProjectsWorkspace';
import { QueryState } from './QueryState';
import './dashboard.css';

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, exact: true },
  { label: 'Your Projects', path: '/dashboard/projects', icon: FolderKanban, exact: false },
  { label: 'Advanced CV Builder', path: '/dashboard/advanced-cv', icon: Code2, exact: false },
  { label: 'Cover Letter Builder', path: '/dashboard/cover-letters', icon: Mail, exact: false },
  { label: 'User Profile', path: '/dashboard/profile', icon: UserRound, exact: false },
  { label: 'Deleted Files', path: '/dashboard/deleted-files', icon: Trash2, exact: false },
] as const;

export function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const refresh = useRefreshWorkspace();
  const session = useSession();
  const user = session.data?.user ?? null;

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [recentState, setRecentState] = useState<'active' | 'archived' | 'deleted'>('active');

  const [headerSearch, setHeaderSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [noticeBusy, setNoticeBusy] = useState(false);

  const summary = useWorkspace<Summary>('summary', '/dashboard/summary/');
  const activity = useWorkspace<Page<ActivityItem>>('activity', '/dashboard/activity/');
  const storage = useWorkspace<StorageInfo>('storage', '/dashboard/storage/');
  const notifications = useWorkspace<NotificationsResponse>('notifications', '/notifications/');

  const pathname = location.pathname.replace(/\/+$/, '') || '/dashboard';
  const isProjectsRoute = pathname.endsWith('/projects');
  const isDeletedRoute = pathname.endsWith('/deleted-files');
  const isDeferredModuleRoute = pathname.includes('/profile');
  const isAdvancedCvRoute = pathname.includes('/advanced-cv');
  const isCoverLetterRoute = pathname.includes('/cover-letters');

  useEffect(() => {
    setMobileDrawerOpen(false);
    setNotificationsOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = headerSearch.trim();
      setDebouncedSearch(trimmed);
      if (isProjectsRoute || isDeletedRoute) {
        const next = new URLSearchParams(searchParams);
        if (trimmed) next.set('search', trimmed);
        else next.delete('search');
        next.delete('page');
        setSearchParams(next, { replace: true });
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [headerSearch]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMobileDrawerOpen(false);
        setNotificationsOpen(false);
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  async function handleLogout() {
    setLogoutPending(true);
    setLogoutError('');
    try {
      await api('/auth/logout/', { method: 'POST' });
      queryClient.clear();
      queryClient.setQueryData(['session'], { user: null });
      navigate('/login', { replace: true });
    } catch (err) {
      setLogoutError((err as Error).message);
    } finally {
      setLogoutPending(false);
    }
  }

  async function markNotificationRead(id: string) {
    setNoticeBusy(true);
    try {
      await api(`/notifications/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ is_read: true }),
      });
      await notifications.refetch();
    } finally {
      setNoticeBusy(false);
    }
  }

  async function markAllNotificationsRead() {
    setNoticeBusy(true);
    try {
      await api('/notifications/read-all/', { method: 'POST' });
      await notifications.refetch();
      await refresh();
    } finally {
      setNoticeBusy(false);
    }
  }

  const displayName = user
    ? `${user.first_name} ${user.last_name}`.trim() || user.email
    : 'Professional';
  const firstName = user?.first_name?.trim() || displayName;
  const initials =
    ((user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')).toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    'U';

  const currentPageTitle = isProjectsRoute
    ? 'Your Projects'
    : isDeletedRoute
    ? 'Deleted Files'
    : pathname.includes('/advanced-cv')
    ? (pathname.endsWith('/advanced-cv') ? 'Advanced CV Builder' : 'Advanced CV')
    : pathname.includes('/cover-letters')
    ? 'Cover Letter Builder'
    : pathname.includes('/profile')
    ? 'User Profile'
    : 'Dashboard';

  const unreadCount = notifications.data?.unread_count ?? 0;

  return (
    <div className={`dash-shell ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
      {/* MOBILE DRAWER BACKDROP */}
      {mobileDrawerOpen && (
        <div
          className="dash-drawer-backdrop"
          onClick={() => setMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* SIDEBAR NAVIGATION */}
      <aside
        className={`dash-sidebar ${mobileDrawerOpen ? 'is-mobile-open' : ''}`}
        aria-label="Workspace navigation"
      >
        <div className="dash-sidebar-top">
          <Link to="/" className="dash-brand">
            <span className="brand-mark">CV</span>
            {!sidebarCollapsed && (
              <span className="dash-brand-text">
                <strong>CV & Letter Studio</strong>
                <small>Career Workspace</small>
              </span>
            )}
          </Link>
          <button
            type="button"
            className="dash-icon-button desktop-collapse-btn"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed}
            onClick={() => setSidebarCollapsed((prev) => !prev)}
          >
            {sidebarCollapsed ? <ChevronRight size={19} /> : <ChevronLeft size={19} />}
          </button>
          <button
            type="button"
            className="dash-icon-button mobile-close-btn"
            aria-label="Close navigation menu"
            onClick={() => setMobileDrawerOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="dash-sidebar-nav" aria-label="Main workspace menu">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === '/dashboard' || pathname === ''
              : pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`dash-nav-link ${isActive ? 'is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon size={20} />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="dash-sidebar-footer">
          <button
            type="button"
            className="dash-nav-link dash-logout-btn"
            disabled={logoutPending}
            onClick={() => void handleLogout()}
            title={sidebarCollapsed ? 'Logout' : undefined}
          >
            <LogOut size={20} />
            {!sidebarCollapsed && <span>{logoutPending ? 'Signing out…' : 'Logout'}</span>}
          </button>
        </div>
      </aside>

      {/* MAIN WORKSPACE CONTENT */}
      <div className="dash-main-area">
        {/* TOP HEADER */}
        <header className="dash-topbar">
          <div className="dash-topbar-left">
            <button
              type="button"
              className="dash-icon-button mobile-menu-trigger"
              aria-label="Open navigation menu"
              aria-expanded={mobileDrawerOpen}
              onClick={() => setMobileDrawerOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span className="dash-topbar-title">{currentPageTitle}</span>
          </div>

          <div className="dash-topbar-right">
            <label className="dash-header-search">
              <Search size={16} />
              <input
                type="search"
                placeholder="Search projects…"
                aria-label="Search projects in workspace"
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
              />
            </label>

            {/* NOTIFICATIONS DROPDOWN */}
            <div className="dash-dropdown-anchor">
              <button
                type="button"
                className="dash-icon-button dash-notification-trigger"
                aria-label={
                  unreadCount > 0
                    ? `Notifications (${unreadCount} unread)`
                    : 'Notifications'
                }
                aria-expanded={notificationsOpen}
                onClick={() => {
                  setNotificationsOpen((prev) => !prev);
                  setUserMenuOpen(false);
                }}
              >
                <Bell size={20} />
                {unreadCount > 0 && <span className="dash-unread-badge">{unreadCount}</span>}
              </button>

              {notificationsOpen && (
                <div
                  className="dash-popover notifications-popover"
                  role="region"
                  aria-label="Notifications panel"
                >
                  <div className="dash-popover-header">
                    <strong>Notifications</strong>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        className="dash-link"
                        disabled={noticeBusy}
                        onClick={() => void markAllNotificationsRead()}
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <QueryState
                    pending={notifications.isPending}
                    error={notifications.error}
                    retry={notifications.refetch}
                  >
                    {notifications.data?.results.length === 0 ? (
                      <p className="dash-popover-empty">No notifications yet.</p>
                    ) : (
                      <ul className="dash-notification-list">
                        {notifications.data?.results.map((item) => (
                          <li
                            key={item.id}
                            className={`dash-notification-item ${item.is_read ? '' : 'is-unread'}`}
                          >
                            <div>
                              <strong>{item.title}</strong>
                              <p>{item.message}</p>
                              <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
                            </div>
                            {!item.is_read && (
                              <button
                                type="button"
                                className="dash-link"
                                disabled={noticeBusy}
                                onClick={() => void markNotificationRead(item.id)}
                              >
                                Mark as read
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </QueryState>
                </div>
              )}
            </div>

            {/* USER PROFILE DROPDOWN */}
            <div className="dash-dropdown-anchor">
              <button
                type="button"
                className="dash-user-trigger"
                aria-label={`Account menu for ${displayName}`}
                aria-expanded={userMenuOpen}
                onClick={() => {
                  setUserMenuOpen((prev) => !prev);
                  setNotificationsOpen(false);
                }}
              >
                <span className="dash-avatar" aria-hidden="true">
                  {initials}
                </span>
                <span className="dash-user-name">{displayName}</span>
              </button>

              {userMenuOpen && (
                <div className="dash-popover user-popover" role="menu" aria-label="Account options">
                  <div className="user-popover-summary">
                    <strong>{displayName}</strong>
                    {user?.email && <span>{user.email}</span>}
                  </div>
                  <Link
                    to="/dashboard/profile"
                    role="menuitem"
                    className="user-popover-item"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <UserRound size={16} />
                    User Profile
                  </Link>
                  <Link
                    to="/dashboard/projects"
                    role="menuitem"
                    className="user-popover-item"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <FolderKanban size={16} />
                    Your Projects
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    className="user-popover-item"
                    disabled={logoutPending}
                    onClick={() => void handleLogout()}
                  >
                    <LogOut size={16} />
                    {logoutPending ? 'Signing out…' : 'Sign out'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {logoutError && (
          <p className="dash-error" role="alert" style={{ margin: '16px 28px 0' }}>
            {logoutError}
          </p>
        )}

        {/* MAIN ROUTE CONTENT */}
        <main className="dash-content">
          {isProjectsRoute ? (
            <ProjectsWorkspace mode="projects" workflows={summary.data?.workflows} />
          ) : isDeletedRoute ? (
            <ProjectsWorkspace mode="deleted" workflows={summary.data?.workflows} />
          ) : isAdvancedCvRoute ? (
            <AdvancedCvRoutes />
          ) : isCoverLetterRoute ? (
            <CoverLetterRoutes />
          ) : isDeferredModuleRoute ? (
            <ProfilePage />
          ) : pathname === '/dashboard' ? (
            /* DASHBOARD OVERVIEW (/dashboard) */
            <div className="dash-overview">
              {/* WELCOME BANNER */}
              <section className="dash-welcome-card" aria-label="Welcome">
                <div>
                  <span className="eyebrow">YOUR CAREER WORKSPACE</span>
                  <h1>Welcome back, {firstName}!</h1>
                  <p className="dash-subtitle">
                    Your career documents, projects, and opportunities — all in one place.
                  </p>
                </div>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => setNewProjectOpen(true)}
                >
                  <Plus size={18} />
                  New Project
                </button>
              </section>

              {/* STATISTICS CARDS */}
              <section aria-label="Document statistics">
                <QueryState
                  pending={summary.isPending}
                  error={summary.error}
                  retry={summary.refetch}
                >
                  {summary.data && (
                    <div className="stats-grid">
                      {[
                        { label: 'Total Projects', value: summary.data.counts.total },
                        { label: 'Advanced CVs', value: summary.data.counts.advanced_cv },
                        { label: 'Cover Letters', value: summary.data.counts.cover_letter },
                        { label: 'Deleted Files', value: summary.data.counts.deleted },
                      ].map((stat) => (
                        <article
                          key={stat.label}
                          className="stat-card"
                          aria-label={`${stat.label}: ${stat.value}`}
                        >
                          <span className="stat-label">{stat.label}</span>
                          <strong className="stat-value">{stat.value}</strong>
                        </article>
                      ))}
                    </div>
                  )}
                </QueryState>
              </section>

              {/* QUICK ACTIONS */}
              <section className="dash-panel" aria-label="Quick actions">
                <div className="dash-panel-header">
                  <div>
                    <h2>Quick Actions</h2>
                    <p>Start a new document or explore templates.</p>
                  </div>
                </div>
                <div className="quick-actions-grid">
                  <button
                    type="button"
                    className="quick-action-card"
                    onClick={() => setNewProjectOpen(true)}
                  >
                    <span className="quick-action-icon">
                      <Code2 size={22} />
                    </span>
                    <div>
                      <strong>Create Advanced CV</strong>
                      <span>React component & visual CV workspace</span>
                    </div>
                    <ArrowRight size={18} />
                  </button>
                  <button
                    type="button"
                    className="quick-action-card"
                    onClick={() => setNewProjectOpen(true)}
                  >
                    <span className="quick-action-icon">
                      <Mail size={22} />
                    </span>
                    <div>
                      <strong>Create Cover Letter</strong>
                      <span>Job-specific letters matched to your CV</span>
                    </div>
                    <ArrowRight size={18} />
                  </button>
                </div>
              </section>

              {/* MAIN TWO-COLUMN DASHBOARD GRID */}
              <div className="dash-main-grid">
                {/* LEFT COLUMN: RECENT PROJECTS & RECENT ACTIVITY */}
                <div className="dash-col-primary">
                  <section className="dash-panel" aria-label="Recent projects">
                    <div className="dash-panel-header">
                      <div>
                        <h2>Recent Projects</h2>
                        <p>Manage, organize, or recover your recently updated documents.</p>
                      </div>
                      <div className="dash-panel-controls">
                        <div className="projects-filter-pills" role="group" aria-label="Project state filter">
                          {(['active', 'archived', 'deleted'] as const).map((tab) => (
                            <button
                              key={tab}
                              type="button"
                              className={`filter-pill ${recentState === tab ? 'is-active' : ''}`}
                              aria-pressed={recentState === tab}
                              onClick={() => setRecentState(tab)}
                            >
                              {tab === 'active'
                                ? 'Active'
                                : tab === 'archived'
                                ? 'Archived'
                                : 'Deleted'}
                            </button>
                          ))}
                        </div>
                        <Link className="dash-link" to="/dashboard/projects">
                          View All Projects
                        </Link>
                      </div>
                    </div>

                    <ProjectList search={debouncedSearch} state={recentState} workflows={summary.data?.workflows} />
                  </section>

                  {/* RECENT ACTIVITY */}
                  <section className="dash-panel" aria-label="Recent activity">
                    <div className="dash-panel-header">
                      <div>
                        <h2>
                          <ActivityIcon size={19} />
                          Recent Activity
                        </h2>
                        <p>Latest actions across your projects and documents.</p>
                      </div>
                    </div>
                    <QueryState
                      pending={activity.isPending}
                      error={activity.error}
                      retry={activity.refetch}
                    >
                      {activity.data?.results.length === 0 ? (
                        <div className="dash-empty">
                          <ActivityIcon size={30} />
                          <h3>No recent activity</h3>
                          <p>Project updates, duplications, and folder moves will be recorded here.</p>
                        </div>
                      ) : (
                        <ul className="activity-list">
                          {activity.data?.results.map((item) => (
                            <li key={item.id} className="activity-row">
                              <span className="activity-dot" aria-hidden="true" />
                              <div className="activity-body">
                                <strong>{item.title}</strong>
                                <span>Project {item.action}</span>
                              </div>
                              <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
                            </li>
                          ))}
                        </ul>
                      )}
                    </QueryState>
                  </section>
                </div>

                {/* RIGHT COLUMN: CAREER PROFILE VAULT & STORAGE */}
                <div className="dash-col-secondary">
                  {/* CAREER PROFILE VAULT */}
                  <section className="dash-panel" aria-label="Career Profile Vault">
                    <div className="dash-panel-header">
                      <div>
                        <h2>
                          <Briefcase size={19} />
                          Career Profile Vault
                        </h2>
                        <p>Reusable master career profile across your CVs and cover letters.</p>
                      </div>
                    </div>

                    {summary.isPending ? (
                      <div className="dash-skeleton" role="status" aria-label="Loading career profile">
                        <span />
                        <span />
                      </div>
                    ) : summary.data ? (
                      <div className="vault-summary">
                        <div className="vault-progress-header">
                          <strong>
                            {summary.data.profile.completed} of {summary.data.profile.total}{' '}
                            sections complete
                          </strong>
                          <span>{summary.data.profile.percent}%</span>
                        </div>
                        <div
                          className="vault-progress-track"
                          role="progressbar"
                          aria-valuenow={summary.data.profile.percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label="Career profile completion"
                        >
                          <span
                            className="vault-progress-fill"
                            style={{ width: `${summary.data.profile.percent}%` }}
                          />
                        </div>

                        {summary.data.profile.sections.length > 0 && (
                          <ul className="vault-section-list">
                            {summary.data.profile.sections.map((sec) => (
                              <li key={sec.key} className="vault-section-item">
                                {sec.complete ? (
                                  <CheckCircle2 size={17} className="vault-check-done" />
                                ) : (
                                  <Circle size={17} className="vault-check-pending" />
                                )}
                                <span>{sec.label}</span>
                                <small>{sec.complete ? 'Saved' : 'Incomplete'}</small>
                              </li>
                            ))}
                          </ul>
                        )}

                        <p className="vault-protection-note">
                          Updating your master Career Profile never overwrites existing CVs or
                          cover letters automatically.
                        </p>

                        {summary.data.workflows?.profile ? (
                          <Link className="dash-secondary" to="/dashboard/profile">
                            <UserCheck size={17} />
                            Edit Career Profile
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="dash-secondary"
                            disabled
                            title="Career Profile editor is not available yet"
                          >
                            <UserCheck size={17} />
                            Edit Career Profile (Not available yet)
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="vault-protection-note">
                        Career profile completion will load when the workspace summary is available.
                      </p>
                    )}
                  </section>

                  {/* STORAGE OVERVIEW */}
                  <section className="dash-panel" aria-label="Workspace storage">
                    <div className="dash-panel-header">
                      <div>
                        <h2>
                          <Database size={19} />
                          Document Storage
                        </h2>
                        <p>Stored structured document data in your workspace.</p>
                      </div>
                    </div>

                    <QueryState
                      pending={storage.isPending}
                      error={storage.error}
                      retry={storage.refetch}
                    >
                      {storage.data && (
                        <div className="storage-summary">
                          <div className="storage-Numbers">
                            <strong>{bytes(storage.data.used_bytes)}</strong>
                            <span>
                              {storage.data.quota_bytes
                                ? `of ${bytes(storage.data.quota_bytes)} quota`
                                : 'used · No hard quota limit configured'}
                            </span>
                          </div>
                          {storage.data.quota_bytes && storage.data.quota_bytes > 0 && (
                            <div className="vault-progress-track">
                              <span
                                className="vault-progress-fill"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.round(
                                      (storage.data.used_bytes / storage.data.quota_bytes) * 100
                                    )
                                  )}%`,
                                }}
                              />
                            </div>
                          )}
                          <p className="storage-scope-note">{storage.data.scope}</p>
                        </div>
                      )}
                    </QueryState>
                  </section>
                </div>
              </div>

              {newProjectOpen && (
                <NewProjectDialog
                  workflows={summary.data?.workflows}
                  onClose={() => setNewProjectOpen(false)}
                />
              )}
            </div>
          ) : (
            <section className="dash-panel" style={{ maxWidth: '720px', margin: '24px auto' }}>
              <span className="eyebrow">WORKSPACE MODULE STATUS</span>
              <h1 style={{ fontSize: '28px', color: 'var(--navy)', marginBlock: '12px' }}>
                {currentPageTitle}
              </h1>
              <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>
                This workspace module is queued in the sequential delivery plan and is not enabled
                yet. Your projects, folders, and recovery tools are available now in the Dashboard
                and Your Projects pages.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Link className="button button-primary" to="/dashboard">
                  Back to Dashboard
                </Link>
                <Link className="dash-secondary" to="/dashboard/projects">
                  Open Your Projects
                </Link>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

