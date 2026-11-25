import { useEffect, useState } from 'react';
import { Check, Lightbulb, Sparkles, Wand2 } from 'lucide-react';
import { Dialog } from '../../components/Dialog';
import type { CareerProfileData } from './careerProfile';
import { buildSmartSkillSuggestions, improveSelectedWriting } from './writingAssistant';

export function WritingAssistantDialog({
  selectedText,
  renderedHtml,
  careerProfile,
  onApplySelection,
  onClose,
}: {
  selectedText: string;
  renderedHtml: string;
  careerProfile: CareerProfileData | null | undefined;
  onApplySelection?: (improvedText: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(selectedText);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDraft(selectedText);
  }, [selectedText]);

  const suggestion = improveSelectedWriting(draft);
  const skillSuggestions = buildSmartSkillSuggestions(renderedHtml, careerProfile);

  async function handleCopy() {
    if (!suggestion.improvedText) return;
    try {
      await navigator.clipboard.writeText(suggestion.improvedText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard may be restricted in headless/test environments.
    }
  }

  return (
    <Dialog title="AI Writing Assistant & Smart Skill Suggestions" onClose={onClose}>
      <div className="dash-form adv-cv-assistant">
        <section className="adv-cv-assistant-section" aria-label="Text Selection Improvement">
          <div className="adv-cv-assistant-head">
            <Wand2 size={16} />
            <strong>Text Selection Improvement</strong>
          </div>
          <p className="dash-caption">
            Select text in the code editor (or paste a bullet/sentence below) to strengthen weak verbs and standardize technical phrasing.
          </p>
          <label>
            Selected / Draft Text
            <textarea
              rows={3}
              placeholder="e.g. responsible for javascript backend and worked on postgresql queries"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>

          {draft.trim() && (
            <div className="adv-cv-assistant-output" aria-label="Improved Text Suggestion">
              <strong>Suggested Improvement</strong>
              <p className="adv-cv-assistant-preview">{suggestion.improvedText}</p>
              <ul className="adv-cv-assistant-notes">
                {suggestion.changes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
              <div className="adv-cv-company-actions">
                {onApplySelection && selectedText.trim() && (
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => {
                      onApplySelection(suggestion.improvedText);
                      onClose();
                    }}
                  >
                    <Sparkles size={15} />
                    Replace Selection in Editor
                  </button>
                )}
                <button type="button" className="dash-secondary" onClick={() => void handleCopy()}>
                  <Check size={15} />
                  {copied ? 'Copied!' : 'Copy Improved Text'}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="adv-cv-assistant-section" aria-label="Smart Skill Suggestions">
          <div className="adv-cv-assistant-head">
            <Lightbulb size={16} />
            <strong>Smart Skill Suggestions</strong>
          </div>
          <p className="dash-caption">
            Based strictly on skills saved in your Career Profile Vault — never adds unverified qualifications.
          </p>
          {skillSuggestions.length === 0 ? (
            <p className="dash-caption">
              All skills from your Career Profile are already represented in this document (or add skills in User Profile → Career Profile Vault).
            </p>
          ) : (
            <ul className="adv-cv-skill-suggestions">
              {skillSuggestions.map((item) => (
                <li key={item.skill}>
                  <strong>{item.skill}</strong>
                  <span>{item.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Dialog>
  );
}

