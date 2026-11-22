import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { useRefreshWorkspace } from '../dashboard/data';
import type {
  CareerProfileData,
  CertificationItem,
  EducationItem,
  ExperienceItem,
  ProjectItem,
} from '../cv/careerProfile';

type FieldDef = { key: string; label: string; multiline?: boolean; placeholder?: string; checkbox?: boolean };

const EXPERIENCE_FIELDS: FieldDef[] = [
  { key: 'company', label: 'Company' },
  { key: 'role', label: 'Role / job title' },
  { key: 'location', label: 'Location' },
  { key: 'start_date', label: 'Start date', placeholder: 'e.g. Jan 2024' },
  { key: 'end_date', label: 'End date', placeholder: 'e.g. Jun 2026' },
  { key: 'current', label: 'I currently work here', checkbox: true },
  { key: 'description', label: 'What you did (one achievement per line)', multiline: true },
];
const EDUCATION_FIELDS: FieldDef[] = [
  { key: 'institution', label: 'Institution' },
  { key: 'degree', label: 'Degree / qualification' },
  { key: 'field', label: 'Field of study' },
  { key: 'start_date', label: 'Start' },
  { key: 'end_date', label: 'End' },
  { key: 'details', label: 'Details (optional)', multiline: true },
];
const PROJECT_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Project name' },
  { key: 'link', label: 'Link (optional)' },
  { key: 'technologies', label: 'Technologies (comma separated)' },
  { key: 'description', label: 'Description (one point per line)', multiline: true },
];
const CERTIFICATION_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Certification' },
  { key: 'issuer', label: 'Issuer' },
  { key: 'date', label: 'Date' },
];

function ListSection<T extends Record<string, any>>({
  title,
  addLabel,
  items,
  fields,
  blank,
  onChange,
}: {
  title: string;
  addLabel: string;
  items: T[];
  fields: FieldDef[];
  blank: T;
  onChange: (next: T[]) => void;
}) {
  return (
    <section className="career-editor-section" aria-label={title}>
      <div className="career-editor-heading">
        <h3>{title}</h3>
        <button type="button" className="dash-secondary" onClick={() => onChange([...items, { ...blank }])}>
          <Plus size={15} />
          {addLabel}
        </button>
      </div>
      {items.length === 0 && <p className="dash-caption">Nothing added yet.</p>}
      {items.map((item, index) => (
        <fieldset className="career-editor-entry" key={index}>
          <legend>
            {title} {index + 1}
          </legend>
          <div className="career-editor-grid">
            {fields.map((field) =>
              field.checkbox ? (
                <label key={field.key} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={Boolean(item[field.key])}
                    onChange={(e) => onChange(items.map((it, i) => (i === index ? { ...it, [field.key]: e.target.checked } : it)))}
                  />
                  {field.label}
                </label>
              ) : (
                <label key={field.key} className={field.multiline ? 'is-wide' : ''}>
                  {field.label}
                  {field.multiline ? (
                    <textarea
                      rows={4}
                      value={String(item[field.key] ?? '')}
                      placeholder={field.placeholder}
                      onChange={(e) => onChange(items.map((it, i) => (i === index ? { ...it, [field.key]: e.target.value } : it)))}
                    />
                  ) : (
                    <input
                      value={String(item[field.key] ?? '')}
                      placeholder={field.placeholder}
                      onChange={(e) => onChange(items.map((it, i) => (i === index ? { ...it, [field.key]: e.target.value } : it)))}
                    />
                  )}
                </label>
              )
            )}
          </div>
          <button type="button" className="dash-secondary dash-danger-btn" onClick={() => onChange(items.filter((_, i) => i !== index))}>
            <Trash2 size={15} />
            Remove
          </button>
        </fieldset>
      ))}
    </section>
  );
}

/** Edits the shared Career Profile (summary, experience, education, skills, projects, certifications). */
export function CareerProfileEditor({ profile }: { profile: CareerProfileData }) {
  const refresh = useRefreshWorkspace();
  const [summary, setSummary] = useState(profile.summary ?? '');
  const [experience, setExperience] = useState<ExperienceItem[]>(profile.experience ?? []);
  const [education, setEducation] = useState<EducationItem[]>(profile.education ?? []);
  const [skills, setSkills] = useState((profile.skills ?? []).join(', '));
  const [projects, setProjects] = useState<ProjectItem[]>(profile.projects ?? []);
  const [certifications, setCertifications] = useState<CertificationItem[]>(profile.certifications ?? []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  // Re-sync when the server copy changes (for example after saving the Personal tab).
  useEffect(() => {
    setSummary(profile.summary ?? '');
    setExperience(profile.experience ?? []);
    setEducation(profile.education ?? []);
    setSkills((profile.skills ?? []).join(', '));
    setProjects(profile.projects ?? []);
    setCertifications(profile.certifications ?? []);
  }, [profile.revision]);

  async function save() {
    setPending(true);
    setError('');
    setSaved('');
    try {
      await api('/career-profile/', {
        method: 'PUT',
        body: JSON.stringify({ summary, experience, education, skills, projects, certifications }),
      });
      await refresh();
      setSaved('Career Profile saved. Existing CVs and cover letters are not changed until you refresh them.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="career-editor">
      {error && (
        <p className="dash-error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="dash-success" role="status">
          {saved}
        </p>
      )}

      <section className="career-editor-section" aria-label="Professional summary">
        <h3>Professional summary</h3>
        <label>
          Summary
          <textarea rows={5} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </label>
      </section>

      <ListSection<ExperienceItem>
        title="Work experience"
        addLabel="Add experience"
        items={experience}
        fields={EXPERIENCE_FIELDS}
        blank={{ company: '', role: '', location: '', start_date: '', end_date: '', current: false, description: '' }}
        onChange={setExperience}
      />
      <ListSection<EducationItem>
        title="Education"
        addLabel="Add education"
        items={education}
        fields={EDUCATION_FIELDS}
        blank={{ institution: '', degree: '', field: '', start_date: '', end_date: '', details: '' }}
        onChange={setEducation}
      />

      <section className="career-editor-section" aria-label="Skills">
        <h3>Skills</h3>
        <label>
          Skills (comma separated or one per line)
          <textarea rows={3} value={skills} onChange={(e) => setSkills(e.target.value)} />
        </label>
      </section>

      <ListSection<ProjectItem>
        title="Projects"
        addLabel="Add project"
        items={projects}
        fields={PROJECT_FIELDS}
        blank={{ name: '', link: '', technologies: '', description: '' }}
        onChange={setProjects}
      />
      <ListSection<CertificationItem>
        title="Certifications"
        addLabel="Add certification"
        items={certifications}
        fields={CERTIFICATION_FIELDS}
        blank={{ name: '', issuer: '', date: '' }}
        onChange={setCertifications}
      />

      <div className="form-actions">
        <button type="button" className="button button-primary" disabled={pending} onClick={() => void save()}>
          <Save size={16} />
          {pending ? 'Saving…' : 'Save Career Profile'}
        </button>
      </div>
    </div>
  );
}

