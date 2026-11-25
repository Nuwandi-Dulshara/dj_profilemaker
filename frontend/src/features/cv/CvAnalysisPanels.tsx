import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  FileSearch,
  Info,
  Save,
  ShieldCheck,
  SpellCheck,
  X,
} from 'lucide-react';
import {
  runAtsCheck,
  runCoverLetterAtsCheck,
  runGrammarCheck,
  runJobMatchAnalysis,
  type GrammarIssueType,
  type JobMatchAnalysisResult,
} from './cvAnalysis';

export type ActiveAnalysisTool = 'ats' | 'job-matcher' | 'grammar' | null;

export function CvAnalysisToolbar({
  canAnalyze,
  hasUnsavedChanges,
  activeTool,
  onSelectTool,
  onSaveNow,
  documentLabel = 'CV',
}: {
  canAnalyze: boolean;
  hasUnsavedChanges: boolean;
  activeTool: ActiveAnalysisTool;
  onSelectTool: (tool: ActiveAnalysisTool) => void;
  onSaveNow: () => void;
  documentLabel?: 'CV' | 'Cover Letter';
}) {
  return (
    <section className="adv-cv-analysis-bar" aria-label={`${documentLabel} Analysis Tools`}>
      <div className="adv-cv-analysis-bar-left">
        <span className="adv-cv-analysis-label">{documentLabel} Analysis Tools</span>
        <span className="adv-cv-analysis-hint">
          {!canAnalyze
            ? `Save your ${documentLabel} with rendered content to enable ATS Checker, Job Matcher, and Grammar Checker.`
            : hasUnsavedChanges
            ? `Analysis runs on your saved, rendered ${documentLabel}. Save to include recent edits.`
            : `Ready — analyzing your saved, rendered ${documentLabel} without downloading.`}
        </span>
      </div>

      <div className="adv-cv-analysis-btns" role="group" aria-label="Independent analysis tools">
        <button
          type="button"
          className={`adv-cv-ribbon-btn ${activeTool === 'ats' ? 'is-active' : ''}`}
          disabled={!canAnalyze}
          aria-pressed={activeTool === 'ats'}
          onClick={() => onSelectTool(activeTool === 'ats' ? null : 'ats')}
        >
          <ShieldCheck size={16} />
          ATS Checker
        </button>

        <button
          type="button"
          className={`adv-cv-ribbon-btn ${activeTool === 'job-matcher' ? 'is-active' : ''}`}
          disabled={!canAnalyze}
          aria-pressed={activeTool === 'job-matcher'}
          onClick={() => onSelectTool(activeTool === 'job-matcher' ? null : 'job-matcher')}
        >
          <Briefcase size={16} />
          Job Matcher
        </button>

        <button
          type="button"
          className={`adv-cv-ribbon-btn ${activeTool === 'grammar' ? 'is-active' : ''}`}
          disabled={!canAnalyze}
          aria-pressed={activeTool === 'grammar'}
          onClick={() => onSelectTool(activeTool === 'grammar' ? null : 'grammar')}
        >
          <SpellCheck size={16} />
          Grammar Checker
        </button>

        {(!canAnalyze || hasUnsavedChanges) && (
          <button type="button" className="dash-secondary" onClick={onSaveNow}>
            <Save size={14} />
            Save {documentLabel} to Analyze
          </button>
        )}
      </div>
    </section>
  );
}

export function CvAnalysisDrawer({
  activeTool,
  savedRenderedHtml,
  savedRenderedCss,
  hasUnsavedChanges,
  onClose,
  onSaveNow,
  documentLabel = 'CV',
  defaultJobDescription = '',
}: {
  activeTool: Exclude<ActiveAnalysisTool, null>;
  savedRenderedHtml: string;
  savedRenderedCss: string;
  hasUnsavedChanges: boolean;
  onClose: () => void;
  onSaveNow: () => void;
  documentLabel?: 'CV' | 'Cover Letter';
  defaultJobDescription?: string;
}) {
  const [jobDescription, setJobDescription] = useState(defaultJobDescription);
  const [jobResult, setJobResult] = useState<JobMatchAnalysisResult | null>(null);
  const [grammarFilter, setGrammarFilter] = useState<string>('ALL');

  useEffect(() => {
    if (defaultJobDescription && !jobDescription.trim()) {
      setJobDescription(defaultJobDescription);
    }
  }, [defaultJobDescription, jobDescription]);

  const atsResult = useMemo(
    () =>
      activeTool === 'ats'
        ? documentLabel === 'Cover Letter'
          ? runCoverLetterAtsCheck(savedRenderedHtml, savedRenderedCss)
          : runAtsCheck(savedRenderedHtml, savedRenderedCss)
        : null,
    [activeTool, documentLabel, savedRenderedHtml, savedRenderedCss]
  );

  const grammarResult = useMemo(
    () => (activeTool === 'grammar' ? runGrammarCheck(savedRenderedHtml) : null),
    [activeTool, savedRenderedHtml]
  );

  function handleRunJobMatcher(e: React.FormEvent) {
    e.preventDefault();
    if (!jobDescription.trim()) return;
    setJobResult(runJobMatchAnalysis(savedRenderedHtml, jobDescription));
  }

  return (
    <section
      className="adv-cv-analysis-panel"
      aria-label={
        activeTool === 'ats'
          ? 'ATS Checker Results'
          : activeTool === 'job-matcher'
          ? 'Job Matcher Workspace'
          : 'Grammar Checker Results'
      }
    >
      <header className="adv-cv-analysis-panel-head">
        <div>
          <h2>
            {activeTool === 'ats'
              ? 'ATS Checker'
              : activeTool === 'job-matcher'
              ? 'Job Matcher'
              : 'Grammar Checker'}
          </h2>
          <p>
            {activeTool === 'ats'
              ? 'Evaluates your saved, rendered CV for Applicant Tracking System readability, structure, and text extraction.'
              : activeTool === 'job-matcher'
              ? 'Compare a pasted job description against your saved, rendered CV requirement-by-requirement.'
              : 'Review spelling, grammar, sentence structure, action verbs, and wording in your saved, rendered CV.'}
          </p>
        </div>
        <div className="adv-cv-analysis-head-actions">
          {hasUnsavedChanges && (
            <button type="button" className="dash-secondary" onClick={onSaveNow}>
              <Save size={14} />
              Save Latest Edits &amp; Refresh Analysis
            </button>
          )}
          <button
            type="button"
            className="dash-icon-button"
            aria-label="Close analysis tool"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* ATS CHECKER */}
      {activeTool === 'ats' && atsResult && (
        <div className="adv-cv-analysis-body">
          <div className="adv-cv-stats-row">
            <div className="adv-cv-stat-box">
              <span className="adv-cv-stat-label">Estimated ATS Readiness</span>
              <strong className="adv-cv-stat-val">{atsResult.score}%</strong>
              <small>{atsResult.wordCount} extractable words in saved CV</small>
            </div>
            <div className="adv-cv-stat-box">
              <span className="adv-cv-stat-label">Detected Sections</span>
              <strong className="adv-cv-stat-val">{atsResult.detectedSections.length}</strong>
              <small>
                {atsResult.detectedSections.length > 0
                  ? atsResult.detectedSections.join(', ')
                  : 'None detected'}
              </small>
            </div>
            <div className="adv-cv-stat-box">
              <span className="adv-cv-stat-label">Contact Fields</span>
              <strong className="adv-cv-stat-val">
                {Object.values(atsResult.contactInfo).filter(Boolean).length} / 4
              </strong>
              <small>
                Email: {atsResult.contactInfo.email ? 'Yes' : 'Missing'} · Phone:{' '}
                {atsResult.contactInfo.phone ? 'Yes' : 'Missing'}
              </small>
            </div>
          </div>

          <div className="adv-cv-ats-grid">
            {atsResult.items.map((item) => (
              <article
                key={item.id}
                className={`adv-cv-ats-card is-${item.status.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="adv-cv-ats-card-top">
                  <strong>{item.category}</strong>
                  <span
                    className={`adv-cv-badge is-${item.status.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="adv-cv-ats-issue">
                  <strong>Finding:</strong> {item.issue}
                </p>
                <p className="adv-cv-ats-exp">
                  <strong>Explanation:</strong> {item.explanation}
                </p>
                <p className="adv-cv-ats-rec">
                  <strong>Recommendation:</strong> {item.recommendation}
                </p>
              </article>
            ))}
          </div>

          <p className="adv-cv-disclaimer" role="note">
            <Info size={15} />
            <span>{atsResult.disclaimer}</span>
          </p>
        </div>
      )}

      {/* JOB MATCHER */}
      {activeTool === 'job-matcher' && (
        <div className="adv-cv-analysis-body">
          <form className="adv-cv-job-form" onSubmit={handleRunJobMatcher}>
            <label htmlFor="job-description-input">
              <strong>Paste Job Description</strong>
              <span>
                Paste the target job requirements, qualifications, and technical stack to compare with your saved CV.
              </span>
            </label>
            <textarea
              id="job-description-input"
              aria-label="Job description"
              rows={5}
              placeholder="Paste the job description here (e.g., Bachelor's degree in Computing, 3+ years in SDET or test automation, Strong Java and OOP, Selenium and Appium, REST Assured...)"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
            <div className="adv-cv-job-form-actions">
              <button
                type="submit"
                className="button button-primary"
                disabled={!jobDescription.trim()}
              >
                <FileSearch size={16} />
                Analyze Job Match
              </button>
              {jobResult && (
                <button
                  type="button"
                  className="dash-secondary"
                  onClick={() => {
                    setJobDescription('');
                    setJobResult(null);
                  }}
                >
                  Clear Results
                </button>
              )}
            </div>
          </form>

          {jobResult && (
            <div className="adv-cv-job-results" aria-label="Job Matcher Results">
              {/* Summary Metrics */}
              <div className="adv-cv-stats-row">
                <div className="adv-cv-stat-box">
                  <span className="adv-cv-stat-label">Estimated Job Match</span>
                  <strong className="adv-cv-stat-val">{jobResult.matchPercentage}%</strong>
                  <small>{jobResult.comparisons.length} unique requirement(s) analyzed</small>
                </div>
                <div className="adv-cv-stat-box">
                  <span className="adv-cv-stat-label">Matched Requirements</span>
                  <strong className="adv-cv-stat-val is-matched">{jobResult.matchedCount}</strong>
                  <small>Clearly demonstrated in saved CV</small>
                </div>
                <div className="adv-cv-stat-box">
                  <span className="adv-cv-stat-label">Partially Matched</span>
                  <strong className="adv-cv-stat-val is-partial">{jobResult.partialCount}</strong>
                  <small>Subset of skills or depth found</small>
                </div>
                <div className="adv-cv-stat-box">
                  <span className="adv-cv-stat-label">Missing Requirements</span>
                  <strong className="adv-cv-stat-val is-missing">{jobResult.missingCount}</strong>
                  <small>
                    {jobResult.duplicateCount > 0
                      ? `${jobResult.duplicateCount} duplicate requirement(s) merged`
                      : 'Not mentioned in saved CV'}
                  </small>
                </div>
              </div>

              {/* Detailed Requirement-by-Requirement Comparison Table */}
              <div className="projects-table-wrap">
                <table className="projects-table" aria-label="Job Requirement Comparison">
                  <thead>
                    <tr>
                      <th scope="col">Job Requirement</th>
                      <th scope="col">CV Information</th>
                      <th scope="col">Match Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobResult.comparisons.map((row, idx) => (
                      <tr key={`${row.requirement}-${idx}`}>
                        <td>
                          <strong>{row.requirement}</strong>
                          {row.duplicateCount > 1 && (
                            <span className="adv-cv-dup-pill">
                              Repeated {row.duplicateCount}× in job post
                            </span>
                          )}
                        </td>
                        <td>{row.cvInformation}</td>
                        <td>
                          <span
                            className={`adv-cv-badge is-${row.status
                              .toLowerCase()
                              .replace(/\s+/g, '-')}`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Missing Keywords and Technical Skills */}
              <div className="adv-cv-subpanel">
                <h3>Missing Keywords &amp; Technical Skills</h3>
                {jobResult.missingKeywords.length === 0 ? (
                  <p>All specific technical keywords detected in the job description appear in your saved CV.</p>
                ) : (
                  <div className="adv-cv-keyword-list" aria-label="Missing keywords">
                    {jobResult.missingKeywords.map((kw) => (
                      <span key={kw} className="adv-cv-keyword-chip">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actionable Recommendations */}
              <div className="adv-cv-subpanel">
                <h3>Recommendations for Improving Your CV</h3>
                <ul className="adv-cv-rec-list">
                  {jobResult.recommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GRAMMAR CHECKER */}
      {activeTool === 'grammar' && grammarResult && (
        <div className="adv-cv-analysis-body">
          <div className="adv-cv-stats-row">
            <div className="adv-cv-stat-box">
              <span className="adv-cv-stat-label">Writing &amp; Grammar Issues</span>
              <strong className="adv-cv-stat-val">{grammarResult.totalIssues}</strong>
              <small>Across {grammarResult.checkedSentences} text block(s) in saved CV</small>
            </div>
            <div className="adv-cv-stat-box">
              <span className="adv-cv-stat-label">Review Mode</span>
              <strong className="adv-cv-stat-val">Read-Only Suggestions</strong>
              <small>Your React JSX code is never modified automatically</small>
            </div>
          </div>

          {grammarResult.issues.length > 0 && (
            <div className="adv-cv-grammar-filter">
              <label>
                <span>Filter by issue type:</span>
                <select
                  aria-label="Filter grammar issues"
                  value={grammarFilter}
                  onChange={(e) => setGrammarFilter(e.target.value)}
                >
                  <option value="ALL">All Issues ({grammarResult.issues.length})</option>
                  {(
                    [
                      'Spelling Mistake',
                      'Grammar Mistake',
                      'Sentence Structure',
                      'Repeated Words',
                      'Unclear Description',
                      'Capitalization & Punctuation',
                      'Weak Action Verb',
                      'Unprofessional Wording',
                    ] as GrammarIssueType[]
                  ).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {grammarResult.issues.length === 0 ? (
            <div className="adv-cv-grammar-clean">
              <CheckCircle2 size={28} />
              <div>
                <strong>No spelling, grammar, or wording issues detected</strong>
                <p>
                  Your saved CV text uses clean spelling, strong action verbs, and consistent capitalization.
                </p>
              </div>
            </div>
          ) : (
            <div className="projects-table-wrap">
              <table className="projects-table" aria-label="Grammar Checker Suggestions">
                <thead>
                  <tr>
                    <th scope="col">Original Text</th>
                    <th scope="col">Issue Type</th>
                    <th scope="col">Suggested Correction</th>
                    <th scope="col">Short Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {grammarResult.issues
                    .filter((item) => grammarFilter === 'ALL' || item.issueType === grammarFilter)
                    .map((item) => (
                      <tr key={item.id}>
                        <td>
                          <code className="adv-cv-grammar-orig">{item.originalText}</code>
                        </td>
                        <td>
                          <span className="adv-cv-badge is-warning">{item.issueType}</span>
                        </td>
                        <td>
                          <strong className="adv-cv-grammar-fix">{item.suggestedCorrection}</strong>
                        </td>
                        <td>{item.explanation}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="adv-cv-disclaimer" role="note">
            <AlertTriangle size={15} />
            <span>
              Review each suggestion above and update your React JSX files directly if appropriate. The Grammar Checker never modifies your React source code automatically.
            </span>
          </p>
        </div>
      )}
    </section>
  );
}

