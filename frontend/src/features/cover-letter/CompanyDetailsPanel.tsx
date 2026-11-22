import { Building2, Save, Sparkles, X } from 'lucide-react';
import type { CompanyDetails } from './companyDetails';

export function CompanyDetailsPanel({
  details,
  saving,
  onChange,
  onAutoFill,
  onSave,
  onClose,
}: {
  details: CompanyDetails;
  saving: boolean;
  onChange: (next: CompanyDetails) => void;
  onAutoFill: () => void;
  onSave: () => void;
  onClose: () => void;
}) {
  function updateField<K extends keyof CompanyDetails>(key: K, value: CompanyDetails[K]) {
    onChange({ ...details, [key]: value });
  }

  const hasAnyDetail = Boolean(
    details.companyName.trim() ||
      details.jobTitle.trim() ||
      details.hiringManager.trim() ||
      details.companyAddress.trim()
  );

  return (
    <section className="adv-cv-company-panel" aria-label="Company Details Panel">
      <div className="adv-cv-company-head">
        <div className="adv-cv-company-title">
          <Building2 size={18} />
          <div>
            <strong>Company Details</strong>
            <span>Stored with this cover letter project and used to auto-fill your letter.</span>
          </div>
        </div>
        <button
          type="button"
          className="dash-icon-button"
          aria-label="Close Company Details Panel"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      <div className="adv-cv-company-grid">
        <label>
          Company Name
          <input
            type="text"
            placeholder="e.g. Acme Corporation"
            value={details.companyName}
            onChange={(e) => updateField('companyName', e.target.value)}
          />
        </label>
        <label>
          Job Title
          <input
            type="text"
            placeholder="e.g. Senior Frontend Engineer"
            value={details.jobTitle}
            onChange={(e) => updateField('jobTitle', e.target.value)}
          />
        </label>
        <label>
          Hiring Manager (optional)
          <input
            type="text"
            placeholder="e.g. Jane Doe"
            value={details.hiringManager}
            onChange={(e) => updateField('hiringManager', e.target.value)}
          />
        </label>
        <label>
          Company Address (optional)
          <input
            type="text"
            placeholder="e.g. 123 Innovation Way, San Francisco, CA"
            value={details.companyAddress}
            onChange={(e) => updateField('companyAddress', e.target.value)}
          />
        </label>
        <label className="is-wide">
          Job Description
          <textarea
            rows={4}
            placeholder="Paste the job description and key requirements..."
            value={details.jobDescription}
            onChange={(e) => updateField('jobDescription', e.target.value)}
          />
        </label>
      </div>

      <div className="adv-cv-company-actions">
        <button
          type="button"
          className="button button-primary"
          disabled={!hasAnyDetail}
          onClick={onAutoFill}
        >
          <Sparkles size={15} />
          Auto-Fill Cover Letter
        </button>
        <button
          type="button"
          className="dash-secondary"
          disabled={saving}
          onClick={onSave}
        >
          <Save size={15} />
          {saving ? 'Saving…' : 'Save Details'}
        </button>
      </div>
    </section>
  );
}

