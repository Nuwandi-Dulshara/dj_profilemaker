import { useState } from 'react';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import {
  Plus,
  Trash2,
  Upload,
  Briefcase,
  GraduationCap,
  FolderGit2,
  Globe,
  Sparkles,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import toast from 'react-hot-toast';

import type { Profile, Experience, Education, Project } from '../data/templates';
import SortableItem from './SortableItem';
import ImageCropperModal from './ImageCropperModal';

interface Props {
  profile: Profile;
  setProfile: Dispatch<SetStateAction<Profile>>;
}

type TextField = 'name' | 'title' | 'email' | 'phone' | 'location' | 'bio' | 'photo' | 'slug';

export default function ProfileForm({ profile, setProfile }: Props) {
  // Image crop modal state
  const [tempImageForCrop, setTempImageForCrop] = useState<string | null>(null);

  // Skill state
  const [skillName, setSkillName] = useState('');
  const [skillLevel, setSkillLevel] = useState(80);

  // Social link state
  const [platform, setPlatform] = useState('GitHub');
  const [linkUrl, setLinkUrl] = useState('');

  // Experience state
  const [expRole, setExpRole] = useState('');
  const [expCompany, setExpCompany] = useState('');
  const [expDates, setExpDates] = useState('');
  const [expDesc, setExpDesc] = useState('');

  // Education state
  const [eduDegree, setEduDegree] = useState('');
  const [eduSchool, setEduSchool] = useState('');
  const [eduDates, setEduDates] = useState('');

  // Project state
  const [projTitle, setProjTitle] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projDemo, setProjDemo] = useState('');
  const [projGithub, setProjGithub] = useState('');
  const [projTags, setProjTags] = useState('');

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const updateField = (field: TextField, value: string) =>
    setProfile((prev) => ({ ...prev, [field]: value }));

  // Custom slug generator / sanitizer
  const handleSlugChange = (raw: string) => {
    const sanitized = raw.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
    updateField('slug', sanitized);
  };

  // Image upload & crop
  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Please select a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be smaller than 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setTempImageForCrop(reader.result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleCropComplete = (croppedBase64: string) => {
    updateField('photo', croppedBase64);
    toast.success('Profile photo updated & cropped!');
  };

  // Skill management
  const addSkill = () => {
    if (!skillName.trim()) {
      toast.error('Enter skill name');
      return;
    }
    setProfile((prev) => ({
      ...prev,
      skills: [
        ...prev.skills,
        { id: crypto.randomUUID(), name: skillName.trim(), level: skillLevel },
      ],
    }));
    setSkillName('');
    setSkillLevel(80);
    toast.success('Skill added!');
  };

  const removeSkill = (id: string) =>
    setProfile((prev) => ({ ...prev, skills: prev.skills.filter((s) => s.id !== id) }));

  const updateSkill = (id: string, level: number) =>
    setProfile((prev) => ({
      ...prev,
      skills: prev.skills.map((s) => (s.id === id ? { ...s, level } : s)),
    }));

  const handleSkillDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setProfile((prev) => {
        const oldIndex = prev.skills.findIndex((item) => item.id === active.id);
        const newIndex = prev.skills.findIndex((item) => item.id === over.id);
        return { ...prev, skills: arrayMove(prev.skills, oldIndex, newIndex) };
      });
    }
  };

  // Social link management
  const addLink = () => {
    let url: URL;
    try {
      url = new URL(linkUrl.trim());
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    } catch {
      toast.error('Please enter a valid HTTP or HTTPS URL.');
      return;
    }
    setProfile((prev) => ({
      ...prev,
      links: [...prev.links, { id: crypto.randomUUID(), platform, url: url.href }],
    }));
    setLinkUrl('');
    toast.success('Social link added!');
  };

  const removeLink = (id: string) =>
    setProfile((prev) => ({ ...prev, links: prev.links.filter((l) => l.id !== id) }));

  // Experience management
  const addExperience = () => {
    if (!expRole.trim() || !expCompany.trim()) {
      toast.error('Role and Company are required.');
      return;
    }
    const newExp: Experience = {
      id: crypto.randomUUID(),
      role: expRole.trim(),
      company: expCompany.trim(),
      startDate: expDates.trim() || '2023 - Present',
      endDate: '',
      description: expDesc.trim(),
    };
    setProfile((prev) => ({
      ...prev,
      experiences: [...(prev.experiences || []), newExp],
    }));
    setExpRole('');
    setExpCompany('');
    setExpDates('');
    setExpDesc('');
    toast.success('Experience added!');
  };

  const removeExperience = (id: string) =>
    setProfile((prev) => ({
      ...prev,
      experiences: (prev.experiences || []).filter((e) => e.id !== id),
    }));

  const handleExpDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setProfile((prev) => {
        const list = prev.experiences || [];
        const oldIndex = list.findIndex((item) => item.id === active.id);
        const newIndex = list.findIndex((item) => item.id === over.id);
        return { ...prev, experiences: arrayMove(list, oldIndex, newIndex) };
      });
    }
  };

  // Education management
  const addEducation = () => {
    if (!eduDegree.trim() || !eduSchool.trim()) {
      toast.error('Degree and School are required.');
      return;
    }
    const newEdu: Education = {
      id: crypto.randomUUID(),
      degree: eduDegree.trim(),
      institution: eduSchool.trim(),
      startDate: eduDates.trim() || '2020 - 2024',
      endDate: '',
    };
    setProfile((prev) => ({
      ...prev,
      education: [...(prev.education || []), newEdu],
    }));
    setEduDegree('');
    setEduSchool('');
    setEduDates('');
    toast.success('Education added!');
  };

  const removeEducation = (id: string) =>
    setProfile((prev) => ({
      ...prev,
      education: (prev.education || []).filter((e) => e.id !== id),
    }));

  // Project management
  const addProject = () => {
    if (!projTitle.trim()) {
      toast.error('Project title is required.');
      return;
    }
    const newProj: Project = {
      id: crypto.randomUUID(),
      title: projTitle.trim(),
      description: projDesc.trim(),
      demoUrl: projDemo.trim(),
      githubUrl: projGithub.trim(),
      tags: projTags.trim(),
    };
    setProfile((prev) => ({
      ...prev,
      projects: [...(prev.projects || []), newProj],
    }));
    setProjTitle('');
    setProjDesc('');
    setProjDemo('');
    setProjGithub('');
    setProjTags('');
    toast.success('Project added!');
  };

  const removeProject = (id: string) =>
    setProfile((prev) => ({
      ...prev,
      projects: (prev.projects || []).filter((p) => p.id !== id),
    }));

  const fields: {
    label: string;
    name: Exclude<TextField, 'bio' | 'photo' | 'slug'>;
    placeholder: string;
    type?: string;
  }[] = [
    { label: 'Full Name', name: 'name', placeholder: 'Alex Morgan' },
    { label: 'Professional Title', name: 'title', placeholder: 'Full Stack Developer' },
    { label: 'Email', name: 'email', placeholder: 'alex@example.com', type: 'email' },
    { label: 'Phone', name: 'phone', placeholder: '+94 77 123 4567' },
    { label: 'Location', name: 'location', placeholder: 'Colombo, Sri Lanka' },
  ];

  return (
    <div className="editor-form">
      {/* CROP MODAL */}
      {tempImageForCrop && (
        <ImageCropperModal
          imageSrc={tempImageForCrop}
          onCropComplete={handleCropComplete}
          onClose={() => setTempImageForCrop(null)}
        />
      )}

      {/* SECTION 1: PERSONAL INFO */}
      <div className="panel-heading">
        <h2>Personal Information</h2>
        <p>Introduce yourself to your visitors.</p>
      </div>
      <div className="form-section">
        {fields.map((field) => (
          <label className="field" key={field.name}>
            <span>{field.label}</span>
            <input
              type={field.type ?? 'text'}
              value={profile[field.name]}
              placeholder={field.placeholder}
              onChange={(e) => updateField(field.name, e.target.value)}
            />
          </label>
        ))}

        {/* CUSTOM SLUG EDITOR */}
        <label className="field">
          <span>Custom Profile URL Slug</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>/p/</span>
            <input
              type="text"
              placeholder="alex-morgan"
              value={profile.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
          <small style={{ color: '#64748b', fontSize: '11px', marginTop: '4px', display: 'block' }}>
            Your unique vanity URL: {window.location.origin}/p/{profile.slug || 'your-slug'}
          </small>
        </label>

        <label className="field">
          <span>Biography</span>
          <textarea
            rows={4}
            placeholder="Tell us about yourself..."
            value={profile.bio}
            onChange={(e) => updateField('bio', e.target.value)}
          />
        </label>

        {/* PHOTO WITH CROPPER */}
        <label className="field">
          <span>Profile Photo</span>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {profile.photo ? (
              <img
                src={profile.photo}
                alt="Profile Preview"
                style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : null}
            <span className="upload-box" style={{ flex: 1, margin: 0 }}>
              <Upload size={18} />
              <span>{profile.photo ? 'Change & Crop Photo' : 'Upload & Crop Photo'}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handlePhoto}
                hidden
              />
            </span>
          </div>
        </label>
      </div>

      {/* SECTION 2: SKILLS WITH DND */}
      <div className="panel-heading section-spacing">
        <h2>
          <Sparkles size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Skills & Expertise
        </h2>
        <p>Add technical and professional skills (Drag to reorder).</p>
      </div>
      <div className="form-section">
        <div className="add-item-card">
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label className="field" style={{ flex: '1', minWidth: '180px' }}>
              <span>Skill Name</span>
              <input
                aria-label="Skill name"
                placeholder="e.g. React, Python, Cloud Architecture"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
              />
            </label>
            <label className="field" style={{ width: '130px' }}>
              <span>Proficiency ({skillLevel}%)</span>
              <input
                aria-label="Skill level"
                className="level-input"
                type="number"
                min={0}
                max={100}
                value={skillLevel}
                onChange={(e) =>
                  setSkillLevel(Math.max(0, Math.min(100, Number(e.target.value))))
                }
              />
            </label>
            <button
              type="button"
              className="btn btn-primary"
              onClick={addSkill}
              style={{ height: '43px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} /> Add Skill
            </button>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleSkillDragEnd}
        >
          <SortableContext
            items={profile.skills.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {profile.skills.map((skill) => (
              <SortableItem key={skill.id} id={skill.id}>
                <div className="skill-editor" style={{ margin: 0 }}>
                  <div className="skill-row">
                    <strong>{skill.name}</strong>
                    <span>{skill.level}%</span>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => removeSkill(skill.id)}
                      aria-label={`Remove ${skill.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <input
                    aria-label={`${skill.name} proficiency`}
                    type="range"
                    min={0}
                    max={100}
                    value={skill.level}
                    onChange={(e) => updateSkill(skill.id, Number(e.target.value))}
                  />
                </div>
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* SECTION 3: WORK EXPERIENCE */}
      <div className="panel-heading section-spacing">
        <h2>
          <Briefcase size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Work Experience
        </h2>
        <p>Highlight your professional roles and accomplishments.</p>
      </div>
      <div className="form-section">
        <div className="add-item-card">
          <div className="form-grid-2">
            <label className="field">
              <span>Job Title / Role</span>
              <input
                placeholder="e.g. Senior Frontend Developer"
                value={expRole}
                onChange={(e) => setExpRole(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Company / Organization</span>
              <input
                placeholder="e.g. Acme Corporation"
                value={expCompany}
                onChange={(e) => setExpCompany(e.target.value)}
              />
            </label>
          </div>

          <label className="field">
            <span>Employment Period</span>
            <input
              placeholder="e.g. 2022 - Present"
              value={expDates}
              onChange={(e) => setExpDates(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Responsibilities & Achievements</span>
            <textarea
              rows={3}
              placeholder="Describe your core contributions, tech stack, and achievements..."
              value={expDesc}
              onChange={(e) => setExpDesc(e.target.value)}
            />
          </label>

          <button
            type="button"
            className="btn btn-outline full-width"
            onClick={addExperience}
          >
            <Plus size={16} /> Add Experience
          </button>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleExpDragEnd}
        >
          <SortableContext
            items={(profile.experiences || []).map((e) => e.id)}
            strategy={verticalListSortingStrategy}
          >
            {(profile.experiences || []).map((exp) => (
              <SortableItem key={exp.id} id={exp.id}>
                <div className="saved-item-box">
                  <div>
                    <strong>{exp.role}</strong> · <span>{exp.company}</span>
                    <small style={{ display: 'block', color: '#64748b' }}>{exp.startDate}</small>
                    {exp.description && (
                      <p style={{ margin: '4px 0 0', fontSize: '12px' }}>{exp.description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => removeExperience(exp.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* SECTION 4: EDUCATION */}
      <div className="panel-heading section-spacing">
        <h2>
          <GraduationCap size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Education
        </h2>
        <p>Add degrees, diplomas, or certifications.</p>
      </div>
      <div className="form-section">
        <div className="add-item-card">
          <div className="form-grid-2">
            <label className="field">
              <span>Degree / Qualification</span>
              <input
                placeholder="e.g. B.Sc. (Hons) in Computer Science"
                value={eduDegree}
                onChange={(e) => setEduDegree(e.target.value)}
              />
            </label>
            <label className="field">
              <span>School / Institution</span>
              <input
                placeholder="e.g. University of Colombo"
                value={eduSchool}
                onChange={(e) => setEduSchool(e.target.value)}
              />
            </label>
          </div>

          <label className="field">
            <span>Graduation Period / Years</span>
            <input
              placeholder="e.g. 2018 - 2022"
              value={eduDates}
              onChange={(e) => setEduDates(e.target.value)}
            />
          </label>

          <button
            type="button"
            className="btn btn-outline full-width"
            onClick={addEducation}
          >
            <Plus size={16} /> Add Education
          </button>
        </div>

        {(profile.education || []).map((edu) => (
          <div className="saved-item-box" key={edu.id}>
            <div>
              <strong>{edu.degree}</strong>
              <small style={{ display: 'block', color: '#64748b' }}>
                {edu.institution} ({edu.startDate})
              </small>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => removeEducation(edu.id)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {/* SECTION 5: PROJECTS / PORTFOLIO */}
      <div className="panel-heading section-spacing">
        <h2>
          <FolderGit2 size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Projects & Portfolio
        </h2>
        <p>Showcase key projects, links, and technology stacks.</p>
      </div>
      <div className="form-section">
        <div className="add-item-card">
          <label className="field">
            <span>Project Title</span>
            <input
              placeholder="e.g. Profile Studio Pro"
              value={projTitle}
              onChange={(e) => setProjTitle(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Project Summary & Impact</span>
            <textarea
              rows={3}
              placeholder="Explain what the project does, key features, and problem it solved..."
              value={projDesc}
              onChange={(e) => setProjDesc(e.target.value)}
            />
          </label>

          <div className="form-grid-2">
            <label className="field">
              <span>Live Demo URL</span>
              <input
                type="url"
                placeholder="https://example.com"
                value={projDemo}
                onChange={(e) => setProjDemo(e.target.value)}
              />
            </label>
            <label className="field">
              <span>GitHub Repository URL</span>
              <input
                type="url"
                placeholder="https://github.com/username/project"
                value={projGithub}
                onChange={(e) => setProjGithub(e.target.value)}
              />
            </label>
          </div>

          <label className="field">
            <span>Technologies Used</span>
            <input
              placeholder="e.g. React, TypeScript, Django, MySQL"
              value={projTags}
              onChange={(e) => setProjTags(e.target.value)}
            />
          </label>

          <button
            type="button"
            className="btn btn-outline full-width"
            onClick={addProject}
          >
            <Plus size={16} /> Add Project
          </button>
        </div>

        {(profile.projects || []).map((p) => (
          <div className="saved-item-box" key={p.id}>
            <div>
              <strong>{p.title}</strong>
              {p.tags && <span className="tag-badge">{p.tags}</span>}
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>{p.description}</p>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => removeProject(p.id)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {/* SECTION 6: SOCIAL LINKS */}
      <div className="panel-heading section-spacing">
        <h2>
          <Globe size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Social & Web Links
        </h2>
        <p>Add platforms where visitors can connect with you.</p>
      </div>
      <div className="form-section">
        <label className="field">
          <span>Platform</span>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option>GitHub</option>
            <option>LinkedIn</option>
            <option>Portfolio</option>
            <option>Twitter / X</option>
            <option>Instagram</option>
            <option>YouTube</option>
            <option>Other</option>
          </select>
        </label>
        <label className="field">
          <span>Profile URL</span>
          <input
            type="url"
            placeholder="https://example.com"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn btn-outline full-width"
          onClick={addLink}
        >
          <Plus size={16} /> Add Link
        </button>
        {profile.links.map((link) => (
          <div className="saved-link" key={link.id}>
            <div>
              <strong>{link.platform}</strong>
              <small>{link.url}</small>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => removeLink(link.id)}
              aria-label={`Remove ${link.platform}`}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
