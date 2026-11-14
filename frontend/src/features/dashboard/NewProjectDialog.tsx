import { useNavigate } from 'react-router-dom';
import { Code2, FileSpreadsheet, Mail } from 'lucide-react';
import { Dialog } from '../../components/Dialog';

const workflowsList = [
  {
    key: 'advanced_cv',
    title: 'Advanced CV Builder',
    description: 'Build and customize React-based CVs with code, visual, and guided editing.',
    path: '/dashboard/advanced-cv/new',
    icon: Code2,
  },
  {
    key: 'template_cv',
    title: 'CV Templates',
    description: 'Browse ATS-friendly, modern, and creative React CV templates.',
    path: '/dashboard/cv-templates',
    icon: FileSpreadsheet,
  },
  {
    key: 'cover_letter',
    title: 'Cover Letter Builder',
    description: 'Create job-targeted cover letters aligned with your CV.',
    path: '/dashboard/cover-letters/new',
    icon: Mail,
  },
] as const;

export function NewProjectDialog({
  workflows,
  onClose,
}: {
  workflows?: Record<string, boolean>;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const anyEnabled = Boolean(
    workflows && (workflows.advanced_cv || workflows.template_cv || workflows.cover_letter)
  );

  return (
    <Dialog title="New project" onClose={onClose}>
      <p className="dash-dialog-lead">
        {anyEnabled
          ? 'Select a document workflow to start a new project.'
          : 'Document creation is not available yet. These creation workflows will unlock as their editors are enabled.'}
      </p>
      <div className="workflow-option-list">
        {workflowsList.map((item) => {
          const Icon = item.icon;
          const enabled = Boolean(workflows?.[item.key]);
          return (
            <button
              key={item.key}
              type="button"
              className="workflow-option-card"
              disabled={!enabled}
              onClick={() => {
                onClose();
                navigate(item.path);
              }}
            >
              <span className="workflow-option-icon">
                <Icon size={22} />
              </span>
              <span className="workflow-option-body">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
                <small className="workflow-option-status">
                  {enabled ? 'Open builder' : 'Not available yet'}
                </small>
              </span>
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}

