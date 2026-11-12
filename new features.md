\# Project Enhancement Prompt — AI CV Builder \& ATS Checker



\## Your Role



Act as a \*\*Senior Full-Stack Software Engineer, UI/UX Designer, ATS Optimization Specialist, and AI Integration Engineer\*\*.



I already have an existing CV Builder and ATS Checker application.



Your task is to \*\*analyze my existing codebase and correctly implement the following new features and improvements\*\* without breaking any existing functionality.



\*\*IMPORTANT INSTRUCTIONS:\*\*



\- First, inspect and understand the existing project architecture, frontend, backend, database, APIs, and dependencies.

\- Reuse the current technology stack and existing components wherever possible.

\- Do not rebuild the entire application unnecessarily.

\- Do not remove existing features.

\- Do not change working functionality unless required for the improvements.

\- Write production-quality, maintainable, modular code.

\- Ensure all new features are fully integrated with the existing application.

\- Make all buttons, forms, uploads, downloads, previews, and editing functions work correctly.

\- Do not create dummy buttons, fake AI results, placeholder implementations, or hardcoded scores.

\- Test each feature after implementation.



\---



\# 1. Fix CV Builder Performance Issues



\## Existing Problem



After creating a new CV using HTML, CSS, and Bootstrap, the application becomes very slow.



The following operations experience significant delays:



\- Save CV

\- Download CV

\- Upload CV

\- Edit CV

\- Update CV

\- Preview CV

\- Switch between CV sections

\- Generate CV

\- Other CV-related buttons



\## Required Improvements



1\. Investigate the actual causes of slow performance.

2\. Optimize frontend rendering and component updates.

3\. Reduce unnecessary API calls.

4\. Optimize database queries and save operations.

5\. Avoid unnecessary CV preview regeneration.

6\. Implement debouncing for frequent editing events where appropriate.

7\. Use asynchronous operations for time-consuming tasks.

8\. Optimize HTML, CSS, and Bootstrap rendering.

9\. Use caching only where appropriate, with correct invalidation.

10\. Prevent repeated button clicks from triggering duplicate operations.

11\. Display appropriate loading indicators during processing.

12\. Fix memory leaks and unnecessary event listeners.

13\. Optimize PDF generation and download processing.

14\. Ensure uploaded files are processed efficiently.

15\. Measure performance before and after optimization.



\*\*Expected Result:\*\* All CV-related operations should be fast, responsive, reliable, and free from unnecessary delays.



\---



\# 2. Advanced ATS Compatibility Analysis



Upgrade the existing ATS Checker with a comprehensive ATS compatibility analysis module.



\## Required Features



\### 2.1 Complex Table Detection



\- Detect tables inside uploaded CVs.

\- Identify nested tables and complex layouts.

\- Warn when tables may create ATS parsing problems.

\- Suggest ATS-friendly alternatives.



\### 2.2 Multi-Column Layout Detection



\- Identify two-column and multi-column CV designs.

\- Detect potential reading-order problems.

\- Explain how multi-column layouts may affect ATS readability.

\- Recommend safer layout structures.



\### 2.3 Text Boxes, Graphics, and Icons



Identify:



\- Text boxes

\- Images containing text

\- Decorative graphics

\- Icons used instead of text labels

\- Important information embedded in images



Explain potential ATS compatibility issues and suggest corrections.



\### 2.4 Header and Footer Detection



\- Detect important information inside headers and footers.

\- Check whether contact information appears in these areas.

\- Warn when critical details may not be extracted correctly.

\- Recommend moving important details into the main document body when appropriate.



\### 2.5 Font and Character Readability



Check:



\- Unsupported or unusual fonts

\- Special symbols

\- Incorrect character encoding

\- Unreadable characters

\- Missing embedded text

\- Text extraction problems



\### 2.6 Section Heading Analysis



Identify unusual or unclear headings.



Check standard CV sections such as:



\- Professional Summary

\- Work Experience

\- Education

\- Technical Skills

\- Projects

\- Certifications

\- Achievements

\- Languages



Suggest conventional ATS-friendly headings where beneficial.



\### 2.7 Contact Information Extraction



Extract and validate the readability of:



\- Full name

\- Email address

\- Phone number

\- Location

\- LinkedIn URL

\- GitHub URL

\- Portfolio URL



Report any missing or incorrectly extracted information.



\### 2.8 Reading Order Detection



\- Analyze the extracted reading order.

\- Identify incorrectly ordered text.

\- Detect layout structures that may confuse document parsers.

\- Compare extracted text with the visible CV structure where technically supported.

\- Suggest fixes.



\### ATS Compatibility Results



Display:



\- ATS compatibility score

\- Issues detected

\- Issue severity

\- Explanation

\- Affected CV section

\- Recommended solution

\- Priority for fixing



Distinguish confirmed extraction errors from potential compatibility risks.



Do not claim a CV will pass every ATS platform.



\---



\# 3. Advanced CV Content Analysis



Add a complete CV content analysis module.



\## 3.1 Professional Summary Analysis



Analyze:



\- Clarity

\- Relevance

\- Professional tone

\- Length

\- Role alignment

\- Important keywords

\- Specificity



Suggest improvements without inventing qualifications or experience.



\## 3.2 Missing Section Detection



Check for important missing CV sections based on the applicant's career stage and target role.



Identify missing sections and explain why they may be useful.



\## 3.3 Work Experience Analysis



Analyze experience descriptions for:



\- Clarity

\- Responsibilities

\- Achievements

\- Technical relevance

\- Business impact

\- Strong bullet-point structure



Provide specific improvement suggestions.



\## 3.4 Weak Action Verb Detection



Detect weak phrases such as:



\- Worked on

\- Helped with

\- Responsible for

\- Participated in

\- Involved in



Recommend stronger action verbs when factually appropriate.



\## 3.5 Measurable Achievement Analysis



Identify experience and project statements that could benefit from measurable results.



Examples:



\- Time saved

\- Cost reduction

\- Performance improvement

\- Number of users

\- Processing speed

\- Accuracy improvement



\*\*Never invent percentages, metrics, achievements, responsibilities, or experience.\*\*



If measurable information is unavailable, suggest what the user could add after verifying it.



\## 3.6 Grammar and Spelling Analysis



\- Detect grammatical errors.

\- Identify spelling mistakes.

\- Check punctuation.

\- Improve sentence clarity.

\- Maintain professional language.

\- Support consistent English spelling conventions.



\## 3.7 Repetition and Unnecessary Content



Detect:



\- Repeated words

\- Repeated responsibilities

\- Duplicate skill entries

\- Unnecessary phrases

\- Excessively long sentences

\- Irrelevant information



Provide clear recommendations.



\## 3.8 Skills Evaluation



Analyze:



\- Technical skills

\- Soft skills

\- Skill categorization

\- Relevance to target roles

\- Duplicate skills

\- Unclear descriptions

\- Unsupported claims



Do not automatically add skills the candidate does not possess.



\### CV Content Analysis Results



Show:



\- Content quality score

\- Section-by-section evaluation

\- Strengths

\- Weaknesses

\- Missing information

\- Recommended improvements

\- Suggested rewritten examples



\---



\# 4. Advanced Job Description Matching



Add a complete Job Description Matching module to the existing application.



\## 4.1 Job Description Input



Allow users to:



1\. Paste a job description.

2\. Upload a job description document.

3\. Edit the extracted job description.

4\. Replace or remove the uploaded document.

5\. Compare the job description against a selected CV.



Support appropriate document formats, including PDF, DOCX, and TXT.



\## 4.2 Job Requirement Extraction



Automatically extract:



\- Job title

\- Required technical skills

\- Preferred technical skills

\- Required soft skills

\- Education requirements

\- Experience requirements

\- Certifications

\- Tools and technologies

\- Industry-specific keywords

\- Responsibilities



Distinguish mandatory requirements from preferred qualifications.



\## 4.3 CV and Job Description Comparison



Compare the selected CV against extracted requirements.



Identify:



\- Matching skills

\- Missing skills

\- Partially matching skills

\- Relevant experience

\- Missing keywords

\- Matching qualifications

\- Potential gaps in requirements



Recognize reasonable skill synonyms and related terminology without incorrectly treating unrelated skills as equivalent.



\## 4.4 Job Match Score



Calculate an explainable job-description match score from 0–100.



Consider:



\- Technical skill alignment

\- Relevant experience

\- Education alignment

\- Required qualifications

\- Keyword coverage

\- Role relevance



Use configurable scoring weights and clearly explain the calculation.



Do not randomly generate scores.



\## 4.5 Relevant Experience Highlighting



Highlight CV sections and sentences that match the job description.



Show why each highlighted section is relevant.



\## 4.6 Targeted Improvement Suggestions



Suggest:



\- Relevant keywords supported by existing experience

\- Better professional summaries

\- Stronger experience descriptions

\- Improved project descriptions

\- Appropriate skill grouping

\- Missing information the candidate should verify



Do not invent professional experience to match a job.



\---



\# 5. Advanced ATS Scoring Dashboard



Upgrade the existing ATS scoring dashboard to display all new analysis results.



\## Required Dashboard Features



\### Overall ATS Score



Display a score from 0–100 based on a transparent and consistent scoring methodology.



\### Separate Score Categories



Include:



1\. ATS Compatibility Score

2\. CV Content Quality Score

3\. Job Description Match Score

4\. Keyword Optimization Score

5\. Formatting and Readability Score

6\. Contact Information Completeness Score



The job-description match score should only be calculated when a job description is supplied.



Do not penalize users for not providing an optional job description.



\### Dashboard Visualizations



Include:



\- Score cards

\- Progress indicators

\- Charts

\- Section-by-section results

\- Issue severity indicators

\- Keyword match summaries

\- Improvement recommendations

\- Before-and-after score comparisons



\### Interactive Dashboard



Allow users to:



\- Select a CV.

\- Run ATS analysis.

\- Upload or paste a job description.

\- View analysis details.

\- Navigate directly to relevant CV sections.

\- Apply supported corrections.

\- Reanalyze after editing.

\- Download analysis reports.

\- Compare previous analyses when saved history exists.



Ensure all dashboard values come from actual analysis results, not hardcoded demonstrations.



\---



\# 6. AI-Powered CV Improvement



Implement an intelligent AI CV improvement module.



\## 6.1 Professional Summary Generator



Generate ATS-friendly professional summaries based on:



\- Existing CV content

\- Target job title

\- Relevant skills

\- Work experience

\- Education

\- Target job description



Never create fake experience or qualifications.



\## 6.2 Experience Description Improvement



Automatically suggest clearer and stronger descriptions.



Improve:



\- Action verbs

\- Sentence structure

\- Professional wording

\- Technical terminology

\- Achievement presentation



Preserve the original meaning.



\## 6.3 Keyword Recommendations



Recommend relevant ATS keywords based on:



\- Existing CV

\- Actual skills

\- Verified experience

\- Target job description



Separate keywords already supported by the CV from those requiring user confirmation.



\## 6.4 Project Description Improvement



Analyze project descriptions and suggest improvements covering:



\- Technologies used

\- Project purpose

\- Features developed

\- Technical responsibilities

\- Actual outcomes

\- Relevant technical keywords



Never invent project features, results, or metrics.



\## 6.5 Grammar Correction



Provide intelligent grammar, spelling, and punctuation correction.



\## 6.6 Role-Specific CV Suggestions



Support role-specific improvements for positions such as:



\- Software Engineer

\- Full-Stack Developer

\- Frontend Developer

\- Backend Developer

\- Business Analyst

\- Data Analyst

\- QA Engineer

\- Other user-defined roles



\## 6.7 Original vs Improved Comparison



Create a comparison interface showing:



\*\*Original Version\*\*



The user's existing CV content.



\*\*AI-Improved Version\*\*



The suggested improved content.



Highlight differences clearly.



Include the following actions:



\- Accept Suggestion

\- Reject Suggestion

\- Edit Suggestion

\- Apply Selected Suggestions

\- Restore Original

\- Save Updated CV

\- Recheck ATS Score



Never overwrite the original CV without user approval.



Use an appropriate AI integration based on the existing project architecture, available services, security requirements, and configured credentials.



Do not hardcode AI responses.



\---



\# 7. CV Image Upload and Processing



Add support for uploading CVs as image files.



\## Supported Formats



\- JPG

\- JPEG

\- PNG

\- WEBP



\## Required Features



1\. Upload a CV image.

2\. Display the uploaded image correctly.

3\. Extract text using OCR.

4\. Identify CV sections from extracted content.

5\. Detect layout and formatting where possible.

6\. Convert extracted content into an editable CV.

7\. Allow users to correct OCR mistakes.

8\. Generate an editable HTML/CSS/Bootstrap-based CV.

9\. Preview the converted CV.

10\. Save the converted CV.

11\. Download the converted CV.



Do not assume OCR extraction is perfect.



Display uncertain extraction results and allow manual corrections.



Preserve the original image for reference where authorized.



\---



\# 8. Google Drive Integration for Uploaded Images



Currently, uploaded images may be stored locally.



Change the image upload storage workflow to use Google Drive.



\## Required Implementation



\- Integrate Google Drive API using the appropriate OAuth 2.0 authorization flow.

\- Allow users to securely connect their Google account.

\- Upload CV images to an authorized Google Drive folder.

\- Store the Google Drive file ID and necessary metadata in the existing database.

\- Do not store permanent uploaded image copies in local application storage.

\- Use temporary processing files or memory only when needed.

\- Delete temporary files after processing.

\- Display uploaded images securely through authorized access.

\- Allow users to replace or delete uploaded images.

\- Support Google Drive connection errors, expired tokens, and permission failures.

\- Never expose OAuth credentials or sensitive access tokens in frontend code.

\- Follow least-privilege permissions.

\- Prevent users from accessing each other's uploaded files.

\- Ensure deleted or replaced files are handled consistently in Google Drive and the application database.



\*\*Important:\*\* Implement a real Google Drive integration, not a fake upload simulation.



Existing non-image storage should remain unchanged unless necessary or explicitly configured.



\---



\# 9. Existing CV Upload and Editable HTML/CSS/Bootstrap Source Code



Add a dedicated section called:



\*\*Upload Existing CV \& Edit Source Code\*\*



\## Upload Functionality



Provide an \*\*Upload Existing CV\*\* button.



Allow users to upload:



\- PDF

\- DOCX

\- HTML

\- Supported CV images



\## After Uploading



Display:



1\. Original uploaded CV preview

2\. Extracted CV content

3\. Editable HTML code

4\. Editable CSS code

5\. Editable Bootstrap-based layout

6\. Live CV preview



\## Source Code Accuracy



This is a critical requirement.



\### For HTML CV Uploads



\- Preserve the original HTML source.

\- Preserve CSS styles.

\- Preserve Bootstrap classes.

\- Preserve layout structure.

\- Preserve text content.

\- Preserve supported design elements.

\- Avoid unnecessary code rewriting or reformatting.



Store the original source separately from the editable working version.



\### For PDF, DOCX, and Image Uploads



Generate an equivalent editable HTML/CSS/Bootstrap version as accurately as technically possible.



\*\*Do not claim generated HTML is identical to the original PDF, DOCX, or image source.\*\* These formats do not necessarily contain recoverable HTML or Bootstrap code.



Maintain the original uploaded file as a reference.



\## Code Editor Features



Include:



\- HTML editor

\- CSS editor

\- Bootstrap-compatible editing

\- Syntax highlighting

\- Line numbers

\- Code validation

\- Live preview

\- Undo and redo

\- Save changes

\- Restore original code

\- Download HTML

\- Download CSS

\- Export PDF



Use a suitable code editor component compatible with the existing frontend stack.



\## Important Editing Requirements



\- HTML changes must update the preview.

\- CSS changes must update the preview.

\- Supported Bootstrap classes must render correctly.

\- Editing must not unexpectedly delete CV information.

\- Changes must persist after saving.

\- Users must be able to reopen saved CVs.

\- Avoid silently modifying source code.

\- Show validation errors without overwriting user content.

\- Keep uploaded source files and generated versions clearly distinguishable.



Ensure uploaded HTML is sanitized or securely isolated during rendering to prevent malicious script execution.



\---



\# 10. Fix CV Rendering in the Profile Maker



\## Existing Problem



After creating a CV in the Profile Maker, the generated content does not always appear correctly as a professional CV.



\## Required Improvements



After the user completes their profile and generates a CV:



1\. Create a properly structured CV document.

2\. Display the CV in a realistic document layout.

3\. Use appropriate A4 page dimensions.

4\. Apply consistent margins and spacing.

5\. Display section headings professionally.

6\. Format personal details correctly.

7\. Format skills, education, experience, and projects correctly.

8\. Preserve user-entered data.

9\. Prevent overlapping text.

10\. Avoid unexpected empty spaces.

11\. Support multi-page CVs.

12\. Prevent important content from being cut off between pages.

13\. Ensure the preview accurately represents the generated document.

14\. Maintain consistent formatting between preview and exported PDF.

15\. Support responsive editing on desktop, tablet, and mobile.



\## CV Generation Workflow



\*\*Step 1:\*\* User enters profile information.



\*\*Step 2:\*\* User chooses a CV template.



\*\*Step 3:\*\* Application generates a properly formatted CV.



\*\*Step 4:\*\* Application displays the complete CV preview.



\*\*Step 5:\*\* User edits information or source code.



\*\*Step 6:\*\* Application updates the preview.



\*\*Step 7:\*\* User saves the CV.



\*\*Step 8:\*\* User downloads or exports the CV.



Ensure the final result looks like a real, professional, ATS-friendly CV rather than a normal webpage or unstructured profile.



\---



\# 11. System Integration Requirements



All new modules must work together correctly.



The application should support the following workflows.



\## Workflow A — Create a New CV



Profile Maker → Select Template → Generate CV → Preview → Edit → Save → Download → ATS Check → AI Improve



\## Workflow B — Upload an Existing CV



Upload CV → Extract Content → Preview Original → Generate Editable Version → Edit HTML/CSS/Bootstrap → Save → ATS Check



\## Workflow C — ATS Checking



Select CV → Analyze ATS Compatibility → Analyze CV Content → Calculate Applicable Scores → Display Dashboard → Suggest Improvements



\## Workflow D — Job Description Matching



Select CV → Paste/Upload Job Description → Extract Requirements → Compare CV → Calculate Match Score → Highlight Gaps → Suggest Improvements



\## Workflow E — AI Improvement



Select CV → Run AI Analysis → Show Original vs Improved → Review Suggestions → Apply Approved Changes → Save → Recheck ATS



\## Workflow F — CV Image Processing



Upload CV Image → Securely Store in Google Drive → Extract Text → Review OCR → Generate Editable CV → Preview → Save



\---



\# 12. UI/UX Requirements



Create a modern, clean, professional, and responsive interface.



Maintain the application's existing design system and visual identity.



Include:



\- Clear navigation

\- Responsive layouts

\- Professional CV previews

\- Easy-to-understand ATS scores

\- Interactive analysis results

\- User-friendly code editors

\- Loading indicators

\- Error messages

\- Save confirmation messages

\- Accessible buttons

\- Clear upload progress indicators

\- Mobile-friendly interfaces



Avoid unnecessary animations and heavy components that slow down the application.



\---



\# 13. Backend, Database, and Security Requirements



Inspect the existing backend and database before implementing changes.



Extend the existing architecture rather than introducing an unrelated system.



Add or update appropriate data structures for:



\- Saved CVs

\- CV templates

\- Original uploaded files

\- Generated source code

\- CV revisions

\- ATS analysis results

\- Content analysis results

\- Job description comparisons

\- AI-generated suggestions

\- Google Drive file metadata



Requirements:



\- Use appropriate authentication and authorization.

\- Validate uploaded files and enforce size limits.

\- Protect sensitive CV and contact information.

\- Prevent unauthorized CV access.

\- Secure Google OAuth credentials.

\- Avoid exposing sensitive files through public URLs.

\- Use reliable error handling.

\- Prevent duplicate save requests.

\- Maintain data consistency.

\- Apply database migrations safely.

\- Preserve existing user data.



\---



\# 14. Testing and Quality Assurance



Before completing the implementation, test the following:



\- New CV creation

\- Profile Maker CV generation

\- Save CV

\- Update CV

\- Download CV

\- PDF export

\- Upload existing CV

\- Upload CV image

\- Google Drive upload

\- Google Drive image retrieval

\- OCR extraction

\- HTML editor

\- CSS editor

\- Bootstrap rendering

\- Live preview

\- ATS compatibility checking

\- CV content analysis

\- Job description matching

\- ATS scoring dashboard

\- AI improvements

\- Original vs improved comparison

\- Multi-page CV rendering

\- Mobile responsiveness

\- Error handling

\- Authentication and authorization



Test both successful and unsuccessful scenarios.



Include regression tests to ensure existing functionality continues working.



\---



\# 15. Implementation Instructions



Follow this implementation order:



\*\*Phase 1 — Project Analysis\*\*



Inspect the current application and identify its architecture, existing features, performance issues, and reusable components.



\*\*Phase 2 — Performance Optimization\*\*



Fix slow saving, downloading, uploading, previewing, and editing.



\*\*Phase 3 — CV Rendering and Editing\*\*



Fix Profile Maker rendering and implement accurate editable HTML/CSS/Bootstrap functionality.



\*\*Phase 4 — Image Upload and Google Drive\*\*



Implement secure image uploads, Google Drive storage, and OCR processing.



\*\*Phase 5 — ATS Compatibility and Content Analysis\*\*



Implement the advanced analysis functions.



\*\*Phase 6 — Job Description Matching\*\*



Implement document input, requirement extraction, comparison, and scoring.



\*\*Phase 7 — ATS Dashboard\*\*



Integrate all scoring results into the existing dashboard.



\*\*Phase 8 — AI Improvements\*\*



Implement AI-powered suggestions and the before-and-after comparison interface.



\*\*Phase 9 — Integration and Testing\*\*



Connect every module and perform complete testing.



\---



\# 16. Final Expected Deliverables



After implementation, provide:



1\. A summary of all completed features.

2\. A list of modified and newly created files.

3\. Database changes and migrations.

4\. New dependencies and their purposes.

5\. Environment variables and configuration requirements.

6\. Google Drive API setup instructions.

7\. AI provider configuration instructions, if required.

8\. Performance improvements and measured results.

9\. Testing results.

10\. Any remaining limitations or manual setup steps.



\## Final Critical Requirements



\- Preserve the existing project architecture.

\- Do not break existing features.

\- Do not remove working components unnecessarily.

\- Do not generate fake ATS scores or dummy AI suggestions.

\- Do not fabricate CV experience, achievements, or qualifications.

\- Do not unnecessarily modify original HTML/CSS/Bootstrap source code.

\- Do not claim perfect conversion from PDF, DOCX, or image formats.

\- Do not permanently store uploaded CV images locally.

\- Use secure Google Drive storage for uploaded images.

\- Make CV creation, editing, saving, uploading, and downloading fast.

\- Ensure Profile Maker generates and displays a proper professional CV.

\- Make all new features fully functional and interconnected.



\*\*Start by examining the existing codebase. Then implement the improvements in the specified order. Do not replace the project with a new application.\*\*

