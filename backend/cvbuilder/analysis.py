"""Explainable, deterministic CV checks. These are heuristics, not an ATS emulator.

The public entry point accepts source text and optional extraction evidence, never
executes source HTML/CSS, and returns only JSON-compatible values. Scoring
categories and weights are defined by WEIGHTS below.
"""
from collections import Counter
from math import isfinite
from numbers import Real
import re
import unicodedata

import html5lib


VERSION = "1.0"
WEIGHTS = {"compatibility": 25, "content": 25, "jobMatch": 25,
           "keywords": 10, "formatting": 10, "contact": 5}
SECTION_NAMES = {
    "summary": ("professional summary", "summary", "profile", "about me", "career objective", "objective"),
    "experience": ("work experience", "professional experience", "employment history", "experience", "employment"),
    "education": ("education", "academic qualifications", "qualifications", "academic background"),
    "skills": ("technical skills", "skills", "core competencies", "key skills", "technologies", "skills and expertise"),
    "projects": ("projects", "personal projects", "selected projects", "academic projects"),
    "certifications": ("certifications", "certificates", "licenses", "professional certifications"),
    "achievements": ("achievements", "awards", "honors", "honours", "awards and achievements"),
    "languages": ("languages", "language proficiency"),
}
SECTION_TITLES = {key: names[0].title() for key, names in SECTION_NAMES.items()}
BLOCKS = {"p", "div", "section", "article", "header", "footer", "address", "li", "tr", "td", "th",
          "h1", "h2", "h3", "h4", "h5", "h6", "br", "hr"}
EMAIL = re.compile(r"(?<![\w.+-])[\w.!#$%&'*+/=?^`{|}~-]+@[\w-]+(?:\.[\w-]+)+", re.I)
PHONE = re.compile(r"(?<!\w)\+?\d[\d ().-]{6,}\d(?!\w)")
URL = re.compile(r"(?:https?://|www\.)[^\s<>\"|]+|(?:linkedin\.com/in/|github\.com/)[^\s<>\"|]+", re.I)
WEAK = re.compile(r"\b(worked on|helped with|responsible for|participated in|involved in|assisted with)\b", re.I)
YEARS = re.compile(
    r"\b(\d+(?:\.\d+)?)\s*(?:[-–]\s*(\d+(?:\.\d+)?))?\s*\+?\s*years?\s+"
    r"(?:(?:of\s+)?(?:(?:relevant|professional|work|software|development|engineering|industry|related)\s+){0,4}experience\b"
    r"|(?:of\s+)?(?:developing|building|managing|leading|designing|testing|working)\b[^.!?;\n]{0,60})", re.I)

# Aliases mean equivalent names only. Related frameworks are handled separately.
ALIASES = {
    "Python": ("python",), "Java": ("java",), "JavaScript": ("javascript", "ecmascript", "js"),
    "TypeScript": ("typescript",), "C++": ("c++",), "C#": ("c#", "c sharp"),
    ".NET": (".net", "dotnet"), "PHP": ("php",), "Ruby": ("ruby",), "Go": ("golang", "go language"),
    "Rust": ("rust",), "Swift": ("swift",), "Kotlin": ("kotlin",), "Scala": ("scala",),
    "Django": ("django",), "Flask": ("flask",), "FastAPI": ("fastapi",),
    "React": ("react", "react.js", "reactjs"), "Angular": ("angular", "angularjs"),
    "Vue": ("vue", "vue.js", "vuejs"), "Node.js": ("node.js", "nodejs"),
    "Spring": ("spring", "spring boot"), "Laravel": ("laravel",),
    "HTML": ("html", "html5"), "CSS": ("css", "css3"), "Bootstrap": ("bootstrap",),
    "Tailwind CSS": ("tailwind", "tailwind css"), "SQL": ("sql", "structured query language"),
    "PostgreSQL": ("postgresql", "postgres"), "MySQL": ("mysql",), "SQLite": ("sqlite",),
    "MongoDB": ("mongodb", "mongo db"), "Redis": ("redis",), "Elasticsearch": ("elasticsearch",),
    "AWS": ("aws", "amazon web services"), "Azure": ("azure", "microsoft azure"),
    "Google Cloud": ("gcp", "google cloud", "google cloud platform"),
    "Docker": ("docker",), "Kubernetes": ("kubernetes", "k8s"), "Terraform": ("terraform",),
    "Linux": ("linux",), "Git": ("git",), "GitHub": ("github",), "GitLab": ("gitlab",),
    "CI/CD": ("ci/cd", "continuous integration", "continuous delivery"),
    "REST": ("rest", "restful", "rest api", "rest apis"), "GraphQL": ("graphql",),
    "Jest": ("jest",), "Pytest": ("pytest",), "Selenium": ("selenium",), "Cypress": ("cypress",),
    "Playwright": ("playwright",), "JUnit": ("junit",), "Testing": ("automated testing", "test automation"),
    "Machine Learning": ("machine learning", "ml"), "Deep Learning": ("deep learning",),
    "NLP": ("nlp", "natural language processing"), "TensorFlow": ("tensorflow",), "PyTorch": ("pytorch",),
    "Pandas": ("pandas",), "NumPy": ("numpy",), "Scikit-learn": ("scikit-learn", "sklearn"),
    "Excel": ("excel", "microsoft excel"), "Power BI": ("power bi", "powerbi"), "Tableau": ("tableau",),
    "Spark": ("apache spark", "spark"), "Hadoop": ("hadoop",), "Kafka": ("kafka",),
    "Agile": ("agile",), "Scrum": ("scrum",), "Jira": ("jira",), "Figma": ("figma",),
    "Communication": ("communication", "communication skills"), "Leadership": ("leadership",),
    "Teamwork": ("teamwork", "team collaboration", "team collaboration skills"),
    "Problem Solving": ("problem solving", "problem-solving"), "Time Management": ("time management",),
    "Stakeholder Management": ("stakeholder management",), "Project Management": ("project management",),
    "Business Analysis": ("business analysis",), "Requirements Gathering": ("requirements gathering",),
    "Data Analysis": ("data analysis", "data analytics"), "Cybersecurity": ("cybersecurity", "cyber security"),
    "Healthcare": ("healthcare", "health care"), "Financial Services": ("financial services",),
    "E-commerce": ("e-commerce", "ecommerce"), "GDPR": ("gdpr",), "HIPAA": ("hipaa",),
    "PMP": ("pmp", "project management professional"), "CISSP": ("cissp",), "CCNA": ("ccna",),
    "CPA": ("cpa", "certified public accountant"), "ISTQB": ("istqb",),
}
SOFT_SKILLS = {"Communication", "Leadership", "Teamwork", "Problem Solving", "Time Management", "Stakeholder Management"}
CERTIFICATIONS = {"PMP", "CISSP", "CCNA", "CPA", "ISTQB"}
INDUSTRY = {"Healthcare", "Financial Services", "E-commerce", "GDPR", "HIPAA"}
RELATED = {"Flask": ("Django", "FastAPI"), "Django": ("Flask", "FastAPI"),
           "FastAPI": ("Flask", "Django"), "React": ("Angular", "Vue"),
           "Angular": ("React", "Vue"), "Vue": ("React", "Angular"),
           "PostgreSQL": ("MySQL", "SQLite"), "MySQL": ("PostgreSQL", "SQLite"),
           "AWS": ("Azure", "Google Cloud"), "Azure": ("AWS", "Google Cloud"),
           "Google Cloud": ("AWS", "Azure")}
DEGREES = {
    "Doctorate": ("doctorate", "phd", "ph.d", "doctor of philosophy"),
    "Master's degree": ("master's", "masters", "master of", "msc", "m.sc", "mba", "m.s."),
    "Bachelor's degree": ("bachelor's", "bachelors", "bachelor of", "bsc", "b.sc", "b.s.", "b.eng"),
    "Associate degree": ("associate degree", "associate's", "associate of"),
    "Diploma": ("diploma",),
}


def _norm(value):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value or "")).strip().casefold()


def _validated_weights(weights):
    configured = WEIGHTS.copy()
    if weights is None:
        return configured
    if not isinstance(weights, dict):
        raise ValueError("Weights must be an object mapping category names to numeric values.")
    for category, value in weights.items():
        if category not in WEIGHTS:
            raise ValueError(f"Unknown score category: {category}.")
        if isinstance(value, bool) or not isinstance(value, Real):
            raise ValueError(f"Weight for {category} must be a finite nonnegative number.")
        try:
            number = float(value)
        except (OverflowError, ValueError) as error:
            raise ValueError(f"Weight for {category} must be a finite nonnegative number.") from error
        if not isfinite(number) or number < 0:
            raise ValueError(f"Weight for {category} must be a finite nonnegative number.")
        configured[category] = number
    return configured


def _term_pattern(phrase):
    # A dotted technology name (Node.js/React.js) is not an explicit JS claim.
    prefix = r"(?<![\w+#.])" if phrase.casefold() == "js" else r"(?<![\w+#])"
    return prefix + re.escape(phrase) + r"(?![\w+#])"


def _contains(text, phrase):
    return re.search(_term_pattern(phrase), text, re.I) is not None


def _hits(text, aliases):
    for line in re.split(r"\n|;|(?<=[.!?])\s+", text):
        for phrase in aliases:
            if not _contains(line, phrase):
                continue
            for match in re.finditer(_term_pattern(phrase), line, re.I):
                prefix = line[:match.start()]
                negated = re.search(
                    r"\b(?:no|without|lack(?:ing)?)\s+(?:(?:prior|professional|working|relevant)\s+)?"
                    r"(?:experience|knowledge|proficiency|familiarity)(?:\s+(?:of|in|with))?\b[^.!?;\n]{0,50}$"
                    r"|\bnot\s+(?:experienced|familiar|proficient|skilled)(?:\s+(?:in|with))?\b[^.!?;\n]{0,50}$"
                    r"|\b(?:no|without|lack(?:ing)?)\s*$"
                    r"|\b(?:do not|don't|does not|doesn't)\s+(?:know|have|use)\s*$", prefix, re.I)
                if not negated:
                    return True
    return False


def _tag(node):
    return node.tag if isinstance(node.tag, str) else ""


def _hidden(node):
    style = node.get("style", "")
    return (not isinstance(node.tag, str)
            or _tag(node) in {"script", "style", "head", "template", "noscript"}
            or "hidden" in node.attrib
            or bool(re.search(r"(?:display\s*:\s*none|visibility\s*:\s*hidden)", style, re.I)))


def _text(node):
    if _hidden(node):
        return ""
    parts = [node.text or ""]
    for child in node:
        value = _text(child)
        parts.append(("\n" + value + "\n") if _tag(child) in BLOCKS else value)
        parts.append(child.tail or "")
    return "".join(parts)


def _visible_nodes(node):
    if not _hidden(node):
        yield node
        for child in node:
            yield from _visible_nodes(child)


def _clean_lines(text):
    return [re.sub(r"[\t \xa0]+", " ", line).strip() for line in text.splitlines() if line.strip()]


def _section_id(line):
    label = _norm(line).strip(": –—-•")
    return next((key for key, aliases in SECTION_NAMES.items() if label in aliases), None)


def _sections(lines, heading_levels):
    result = {key: [] for key in SECTION_NAMES}
    active = None
    for line in lines:
        recognized = _section_id(line)
        if recognized:
            active = recognized
        elif line in heading_levels and heading_levels[line] <= 2:
            active = None
        elif active:
            result[active].append(line)
    return result


def _snippet(text, aliases):
    for line in _clean_lines(text):
        if _hits(line, aliases):
            return line[:350]
    return ""


def _experience_scopes(match, text):
    """Return scope explicitly attached to this numeric experience claim."""
    suffix = text[match.end():match.end() + 100]
    scoped_tail = re.match(r"\s+(?:in|with|of)\s+([^.!?;\n]+)", suffix, re.I)
    claim = match.group() + (" " + scoped_tail.group(1) if scoped_tail else "")
    scopes = {term for term, aliases in ALIASES.items() if _hits(claim, aliases)}
    domains = {"software development": ("software",), "retail": ("retail",),
               "project management": ("project management",), "data analysis": ("data analysis", "data analytics"),
               "accounting": ("accounting",), "nursing": ("nursing",)}
    scopes.update(term for term, aliases in domains.items() if _hits(claim, aliases))
    if not scopes:
        qualifier = re.search(r"years?\s+(?:of\s+)?(.+?)\s+experience\b", match.group(), re.I)
        raw = qualifier.group(1) if qualifier else scoped_tail.group(1) if scoped_tail else ""
        raw = re.sub(r"\b(?:relevant|professional|work|related|total|commercial|practical|prior|previous)\b", "", raw, flags=re.I)
        raw = _norm(raw).strip(" .,")
        if raw:
            scopes.add(raw)
    return scopes


def _contacts(lines, nodes, text):
    non_name_headings = {re.sub(r"\s+", " ", _text(n)).strip() for n in nodes if _tag(n) in {"h2", "h3", "h4", "h5", "h6"}}
    candidates = [re.sub(r"\s+", " ", _text(n)).strip() for n in nodes if _tag(n) == "h1"] + [line for line in lines[:3] if line not in non_name_headings]
    name = next((line for line in candidates if 2 <= len(line.split()) <= 6
                 and all(c.isalpha() or c in " .'-’" for c in line)
                 and not _section_id(line)
                 and not re.search(r"\b(engineer|developer|resume|curriculum|vitae|cv|analyst|manager|designer)\b", line, re.I)), None)
    email = EMAIL.search(text)
    phones = [m.group().strip() for m in PHONE.finditer(text)
              if 7 <= sum(c.isdigit() for c in m.group()) <= 15
              and not re.fullmatch(r"\d{4}\s*[-–]\s*\d{4}", m.group().strip())]
    location = None
    for line in lines:
        match = re.search(r"\b(?:location|address|based in)\s*:\s*([^|;]+)", line, re.I)
        if match:
            location = match.group(1).strip()
            break
    if not location:
        location = next((re.sub(r"\s+", " ", _text(n)).strip() for n in nodes
                         if n.get("itemprop") in {"address", "addressLocality"} or _tag(n) == "address"), None)
    urls = URL.findall(text)
    urls += [n.get("href", "") for n in nodes if _tag(n) == "a" and re.match(r"https?://", n.get("href", ""), re.I)]
    urls = list(dict.fromkeys(url.rstrip(".,;)") for url in urls))
    linkedin = next((url for url in urls if re.search(r"(?:^|//|www\.)linkedin\.com/in/", url, re.I)), None)
    github = next((url for url in urls if re.search(r"(?:^|//|www\.)github\.com/", url, re.I)), None)
    portfolio = next((url for url in urls if url not in {linkedin, github}
                      and not re.search(r"(?:linkedin|github)\.com", url, re.I)), None)
    return {"name": name, "email": email.group() if email else None, "phone": phones[0] if phones else None,
            "location": location, "linkedin": linkedin, "github": github, "portfolio": portfolio,
            "validation": {"name": "heuristic" if name else "not-detected",
                           "email": "syntax-only" if email else "not-detected",
                           "phone": "digit-count-only" if phones else "not-detected",
                           "location": "explicit-label-or-address-only" if location else "not-detected"}}


def _job_analysis(description, text):
    """Extract auditable literal requirements; never infer candidate qualifications."""
    requirements = {}
    present_skills = {term for term, aliases in ALIASES.items() if _hits(text, aliases)}
    importance = "unspecified"
    title = None
    first_line = _clean_lines(description)[0] if description.strip() else ""
    if (len(first_line.split()) <= 10
            and re.search(r"\b(engineer|developer|analyst|manager|designer|consultant|accountant|nurse|specialist|director|architect|scientist|administrator)\b", first_line, re.I)
            and not re.search(r"\b(required|preferred|experience|must|skills|requirements)\b|:", first_line, re.I)):
        title = first_line
    experience = [(float(m.group(1)), _experience_scopes(m, text), m.group()) for m in YEARS.finditer(text)]

    def add(term, category, source, aliases=None, status=None, evidence=None, note=None):
        key = (category, _norm(term))
        if key in requirements:
            if importance == "required":
                requirements[key]["importance"] = "required"
            return
        aliases = aliases or (term,)
        if status is None:
            if _hits(text, aliases):
                status, evidence = "matched", [_snippet(text, aliases)]
            else:
                related = [skill for skill in RELATED.get(term, ()) if skill in present_skills]
                status = "partial" if related else "missing"
                evidence = [_snippet(text, ALIASES[skill]) for skill in related]
        requirements[key] = {"id": f"requirement-{len(requirements) + 1}", "term": term,
                             "category": category, "importance": importance, "status": status,
                             "source": source[:500], "evidence": evidence or [],
                             "requiresConfirmation": status != "matched", "matchExplanation": note}

    pieces = re.split(r"\n+|;|(?<=[.!?])\s+(?=[A-Z])|(?=\b[Pp]referred\s*:)", description)
    for raw in pieces:
        line = raw.strip(" \t\r•-*.")
        if not line:
            continue
        if line == title:
            continue
        if re.match(r"(?:job title|position|role)\s*:", line, re.I):
            title = line.split(":", 1)[1].strip()
            continue
        if re.search(r"\b(preferred|desirable|nice.to.have|bonus|a plus)\b", line, re.I):
            importance = "preferred"
        elif re.search(r"\b(required|requirements|must|mandatory|essential|minimum)\b", line, re.I):
            importance = "required"
        elif re.fullmatch(r"(?:responsibilities|duties|what you.ll do|qualifications)\s*:?", line, re.I):
            importance = "unspecified"
        recognized = []
        for term, aliases in ALIASES.items():
            if _hits(line, aliases):
                category = "softSkill" if term in SOFT_SKILLS else "certification" if term in CERTIFICATIONS else "industry" if term in INDUSTRY else "technicalSkill"
                add(term, category, line, aliases)
                recognized.extend(alias for alias in aliases if _contains(line, alias))
        for degree, aliases in DEGREES.items():
            if _hits(line, aliases):
                # Degree subjects are separate evidence; a degree level alone is insufficient.
                subject_match = re.search(r"\b(?:in|of)\s+((?:computer science|software engineering|information technology|business administration|engineering|mathematics|statistics|accounting|finance|nursing))\b", line, re.I)
                subject = subject_match.group(1) if subject_match else None
                degree_found = _hits(text, aliases)
                subject_found = not subject or _contains(text, subject)
                state = "matched" if degree_found and subject_found else "partial" if degree_found else "missing"
                add(degree + (f" in {subject}" if subject else ""), "education", line,
                    status=state, evidence=[_snippet(text, aliases)] if degree_found else [])
        for years_match in YEARS.finditer(line):
            minimum = float(years_match.group(1))
            required_scopes = _experience_scopes(years_match, line)
            enough_scoped = any(years >= minimum and required_scopes <= scopes for years, scopes, _ in experience)
            state = "matched" if enough_scoped else "partial" if experience else "missing"
            note = ("Explicit duration and requested scope are supported by a candidate claim."
                    if enough_scoped else "Duration or requested experience scope is not fully supported; confirm relevant specialty tenure."
                    if experience else "No supported explicit years-of-experience claim was found.")
            add(f"{minimum:g}+ years of experience", "experience", line, status=state,
                evidence=[_snippet(text, (claim,)) for _, _, claim in experience], note=note)
        # Explicit short skill lists preserve vocabulary not in the curated aliases.
        skill_list = re.match(r"(?:required|preferred|technical|essential)?\s*(?:skills|tools|technologies|certifications)\s*:\s*(.+)", line, re.I)
        if skill_list:
            for item in re.split(r",|\band\b|\|", skill_list.group(1), flags=re.I):
                item = item.strip(" .")
                if item and len(item.split()) <= 6 and not any(_hits(item, aliases) for aliases in ALIASES.values()):
                    add(item, "certification" if re.search(r"certifications\s*:", line, re.I) else "technicalSkill", line)
        # Capture concrete responsibility clauses without pretending semantic understanding.
        if re.match(r"(?:design|develop|build|maintain|manage|lead|analy[sz]e|test|implement|deliver|support|collaborate)\b", line, re.I) and len(line.split()) >= 4:
            tokens = [word for word in re.findall(r"\w+", _norm(line)) if word not in {"and", "the", "with", "for", "our", "you", "will", "to", "a", "of"}]
            coverage = sum(_contains(text, token) for token in tokens) / max(len(tokens), 1)
            state = "matched" if _contains(text, line) else "partial" if coverage >= .6 else "missing"
            add(line, "responsibility", line, status=state, evidence=["Shared terms: " + ", ".join(token for token in tokens if _contains(text, token))] if coverage else [])
    items = list(requirements.values())
    weights = {"required": 2, "preferred": 1, "unspecified": 1}

    def score(selected, partial_credit):
        denominator = sum(weights[item["importance"]] for item in selected)
        if not denominator:
            return None
        numerator = sum(weights[item["importance"]] * (1 if item["status"] == "matched" else partial_credit if item["status"] == "partial" else 0) for item in selected)
        return round(100 * numerator / denominator)

    keyword_items = [item for item in items if item["category"] in {"technicalSkill", "softSkill", "certification", "industry"}]
    return {"title": title, "requirements": items,
            "matched": [item for item in items if item["status"] == "matched"],
            "missing": [item for item in items if item["status"] == "missing"],
            "partial": [item for item in items if item["status"] == "partial"],
            "evidence": [{"requirementId": item["id"], "text": item["evidence"]} for item in items if item["evidence"]],
            "score": score(items, .5), "keywordScore": score(keyword_items, 0),
            "recommendations": [f"Confirm whether you have {item['term']}; add truthful supporting evidence only if applicable."
                                for item in items if item["status"] != "matched"]}


def analyze(source: dict, job_description: str = "", evidence: dict | None = None,
            weights: dict | None = None) -> dict:
    """Return source-derived checks and optional job matching without changing input."""
    source = source or {}
    configured_weights = _validated_weights(weights)
    evidence = evidence or {}
    html = str(source.get("html") or "")
    root = html5lib.parse(html, treebuilder="etree", namespaceHTMLElements=False)
    nodes = list(_visible_nodes(root))
    source_text = _text(root)
    # Saved extraction belongs to the original upload. Current HTML includes user
    # edits/OCR repairs and must own current scores, including deliberately empty HTML.
    has_working_source = "html" in source
    text = source_text if has_working_source else str(evidence.get("text") or "")
    lines = _clean_lines(text)
    text = "\n".join(lines)
    has_text = bool(re.search(r"\w", text, re.UNICODE))
    headings = [re.sub(r"\s+", " ", _text(node)).strip() for node in nodes if re.fullmatch(r"h[1-6]", _tag(node))]
    heading_levels = {}
    for node in nodes:
        if re.fullmatch(r"h[1-6]", _tag(node)):
            heading = re.sub(r"\s+", " ", _text(node)).strip()
            heading_levels[heading] = min(heading_levels.get(heading, 6), int(_tag(node)[1]))
    section_text = _sections(lines, heading_levels)
    career_text = " ".join(section_text["summary"] or lines[:4])
    early_career = bool(re.search(r"\b(?:recent graduate|entry[- ]level|seeking (?:my |a |the )?first (?:job|role|position)|currently (?:a )?student)\b", career_text, re.I))
    contacts = _contacts(lines, nodes if has_working_source else [], text)
    css = "\n".join([str(source.get("css") or "")] + [node.text or "" for node in root.iter() if _tag(node) == "style"] + [node.get("style", "") for node in nodes])
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    issues = []

    def issue(identifier, message, recommendation, *, section="document", severity="medium", kind="risk", deductions=None, origin="current-source"):
        if any(item["id"] == identifier for item in issues):
            return
        issues.append({"id": identifier, "severity": severity, "kind": kind,
                       "section": section, "message": message, "recommendation": recommendation,
                       "origin": origin,
                       "priority": {"high": 1, "medium": 2, "low": 3}[severity],
                       "deductions": deductions or {}})

    limitations = [
        "Heuristic scores describe this document and the disclosed rules, not acceptance by any ATS or a hiring probability.",
        "HTML structure and CSS declarations indicate layout risks; rendered geometry, page breaks, actual font embedding and visual reading order are not verified.",
        "Image text is not read by this analyzer. OCR or document extraction must supply text and its uncertainty separately.",
        "Contact checks validate detectable syntax only, not identity, deliverability, phone ownership or profile URLs.",
        "Grammar, spelling, professional tone and semantic relevance require the configured AI review or human review; these scores do not certify them.",
        "Missing sections are suggestions: career stage and the target employer may make some sections unnecessary.",
    ]
    for limit in evidence.get("limitations", []):
        if isinstance(limit, str) and limit not in limitations:
            limitations.append(limit)
    for index, finding in enumerate(evidence.get("issues", [])):
        if not isinstance(finding, dict):
            continue
        severity = finding.get("severity", "medium")
        severity = severity if severity in {"high", "medium", "low"} else "medium"
        kind = "confirmed" if finding.get("kind") == "confirmed" else "risk"
        message = str(finding.get("message") or "Extraction uncertainty reported.")
        issue(str(finding.get("id") or f"extraction-{index + 1}"), "Original upload: " + message if has_working_source else message,
              str(finding.get("recommendation") or "Compare the original with extracted text and correct any differences."),
              severity=severity, kind=kind, section=str(finding.get("section") or "document"),
              deductions={} if has_working_source else {"compatibility": {"high": 20, "medium": 10, "low": 3}[severity]},
              origin="original-upload" if has_working_source else "extracted-document")
    if not has_text:
        issue("no-text", "No readable embedded or extracted text was found.", "Extract text with OCR or add selectable text, then review it before analysis.", severity="high", kind="confirmed")
    tables = [node for node in nodes if _tag(node) == "table"]
    if tables:
        issue("tables", f"Detected {len(tables)} table(s); some parsers flatten cells in an unexpected order.", "Use ordinary headings and paragraphs for layout; retain tables only for genuine tabular data.", deductions={"compatibility": 8})
    if any(any(_tag(child) == "table" for child in list(table.iter())[1:]) for table in tables):
        issue("nested-tables", "A table contains another table, increasing reading-order complexity.", "Flatten nested tables into a single linear text flow.", severity="high", deductions={"compatibility": 15})
    class_text = " ".join(node.get("class", "") for node in nodes)
    columns = bool(re.search(r"(?:column-count\s*:\s*(?:[2-9]|\d{2,})\b|grid-template-columns\s*:\s*(?!none\b)[^;}]+\s+[^;}]+|columns\s*:\s*(?:[2-9]|\d{2,})\b)", css, re.I)
                   or re.search(r"grid-template-columns\s*:\s*repeat\(\s*(?:[2-9]|\d{2,}|auto-fit|auto-fill)\s*,", css, re.I)
                   or re.search(r"\bcol-(?:(?:sm|md|lg|xl|xxl)-)?(?:[1-9]|1[01])\b", class_text)
                   or (re.search(r"display\s*:\s*flex", css, re.I) and not re.search(r"flex-direction\s*:\s*column", css, re.I)))
    if columns:
        issue("multi-column", "CSS or Bootstrap classes suggest multiple side-by-side text regions.", "Check the extracted text order and consider a single-column application copy.", deductions={"compatibility": 12, "formatting": 8})
    absolute = bool(re.search(r"position\s*:\s*(absolute|fixed)|float\s*:\s*(left|right)", css, re.I))
    if absolute or re.search(r"\b(?:textbox|text-box)\b", class_text, re.I):
        issue("text-boxes", "Positioned or floating text regions may be treated as separate text boxes.", "Keep essential text in normal document flow and verify exported extraction order.", deductions={"compatibility": 8})
    if columns or absolute or tables or re.search(r"(?:\border\s*:\s*-?\d|flex-direction\s*:\s*(?:row|column)-reverse)", css, re.I):
        issue("reading-order", "Layout structures may cause extracted reading order to differ from visual order; no rendered comparison was performed.", "Copy extracted text into a plain-text view and verify heading, employer, date and bullet order.", deductions={"compatibility": 5})
    if any(_tag(node) in {"img", "svg", "canvas"} for node in nodes) or re.search(r"background(?:-image)?\s*:[^;}]*url\(", css, re.I):
        issue("images", "Graphics are present; text inside them cannot be verified from HTML text alone.", "Repeat any essential image content as selectable body text; verify OCR against the image.", deductions={"compatibility": 5})
    if any(_tag(node) == "i" or re.search(r"\b(?:fa[srbl]?|bi|material-icons|icon[-\w]*)\b", node.get("class", "")) for node in nodes):
        issue("icons", "Icon markup was detected; icons used instead of labels may be lost in extraction.", "Use plain text labels such as Email and Phone alongside icons.", severity="low", deductions={"compatibility": 3})
    if any(_tag(node) in {"header", "footer"} and (EMAIL.search(_text(node)) or PHONE.search(_text(node))) for node in nodes):
        issue("header-footer-contact", "Contact details appear in header/footer markup, which can become export header/footer content.", "Keep a selectable copy of essential contact details in the main document body and check the export.", section="contact", deductions={"compatibility": 8})
    fonts = re.findall(r"font-family\s*:\s*([^;}]+)", css, re.I)
    common_fonts = {"arial", "helvetica", "calibri", "cambria", "times new roman", "georgia", "verdana", "tahoma", "trebuchet ms", "sans-serif", "serif", "system-ui", "inherit", "initial"}
    unusual_fonts = [font for declaration in fonts for font in [declaration.split(",")[0].strip(" '\"").casefold()] if font not in common_fonts]
    if unusual_fonts:
        issue("unusual-font", "Unverified primary font(s): " + ", ".join(dict.fromkeys(unusual_fonts)) + ". Font support and embedding are unknown.", "Use a familiar readable font with a generic fallback, and verify selectable text in the exported file.", severity="low", deductions={"compatibility": 3, "formatting": 5})
    if any(float(size) < (10 if unit.lower() == "pt" else 12) for size, unit in re.findall(r"font-size\s*:\s*(\d+(?:\.\d+)?)\s*(px|pt)", css, re.I)):
        issue("small-font", "A CSS font size below 10pt / 12px was declared.", "Review the rendered CV and use readable body text, usually at least 10pt.", deductions={"formatting": 12})
    if "\ufffd" in text or re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f]|Ã[\x80-\xbf]|Â[\xa0-\xbf]|â€", text):
        issue("encoding", "Replacement characters, control characters or common encoding corruption were detected.", "Correct the text encoding and compare the extracted text with the original.", severity="high", kind="confirmed", deductions={"compatibility": 20, "formatting": 10})
    if any(unicodedata.category(char) == "Co" for char in text):
        issue("special-symbols", "Private-use characters may depend on a font-specific icon mapping.", "Replace essential symbols with ordinary Unicode text labels.", deductions={"compatibility": 8})
    unfamiliar = [heading for heading in headings if heading and not _section_id(heading) and heading != contacts["name"]
                  and heading_levels[heading] <= 2
                  and not any(_tag(n) == "h1" and re.sub(r"\s+", " ", _text(n)).strip() == heading for n in nodes)]
    if unfamiliar:
        issue("unusual-headings", "Unrecognized headings: " + ", ".join(unfamiliar[:6]) + ".", "Use familiar headings such as Work Experience, Education and Skills when they describe the content.", severity="low", deductions={"compatibility": 4, "formatting": 5})
    if has_text and not any(_section_id(line) for line in lines):
        issue("section-structure", "No conventional CV section headings were detected.", "Add descriptive headings to separate experience, education and skills.", deductions={"formatting": 15})
    for section, penalty in (("summary", 6), ("experience", 12), ("education", 8), ("skills", 10)):
        if not section_text[section]:
            recommendation = "Add this section if it is relevant to your career stage; use only information you can verify."
            severity = "low" if section == "summary" else "medium"
            if section == "experience" and section_text["projects"]:
                recommendation = "Projects may demonstrate early-career experience; add employment or volunteering only when applicable."
                penalty = 0 if early_career else 4
                severity = "low" if early_career else "medium"
            elif section == "experience" and early_career:
                recommendation = "For your stated early-career context, consider relevant academic projects, volunteering or placements when applicable; formal employment is not required."
                penalty = 6
            issue(f"missing-{section}", f"No populated {SECTION_TITLES[section]} section was detected.", recommendation,
                  section=section, severity=severity, deductions={"content": penalty})
    summary = " ".join(section_text["summary"])
    if summary and not 25 <= len(summary.split()) <= 100:
        issue("summary-length", f"The summary has {len(summary.split())} words; the suggested review range is 25–100.", "Make the summary concise and specific to your actual role, relevant strengths and supported experience.", section="summary", severity="low", deductions={"content": 5})
    if summary and re.search(r"\b(hard.?working|results.?driven|dynamic individual|go.getter|highly motivated)\b", summary, re.I):
        issue("summary-specificity", "The summary includes broad claims that lack specific supporting detail.", "Replace generic adjectives with a supported specialty, responsibility or outcome; do not invent evidence.", section="summary", severity="low", deductions={"content": 5})
    weak_phrases = list(dict.fromkeys(match.group().lower() for match in WEAK.finditer(text)))
    if weak_phrases:
        issue("weak-verbs", "Vague action phrases found: " + ", ".join(weak_phrases) + ".", "State your actual contribution with a precise verb such as developed, analyzed or coordinated, only where factually accurate.", section="experience", deductions={"content": 8})
    achievement_lines = section_text["experience"] + section_text["projects"]
    action_lines = [line for line in achievement_lines if len(line.split()) >= 4 and not re.search(r"\b(?:19|20)\d{2}\b", line)]
    unmeasured = [line for line in action_lines if not re.search(r"\d+(?:[.,]\d+)?\s*(?:%|users?|customers?|clients?|seconds?|minutes?|hours?|days?|projects?|requests?|records?|teams?|employees?|million|thousand|ms\b)|(?:[$€£]|\bUSD\b)\s*\d", line, re.I)]
    if unmeasured:
        issue("measurable-results", f"{len(unmeasured)} experience/project statement(s) lack a detected measurable outcome.", "If available, add verified scope, time saved, cost, usage or performance evidence. Qualitative outcomes are valid; never invent numbers.", section="experience" if section_text["experience"] else "projects", severity="low", deductions={"content": 6})
    statements = [_norm(line).strip(".•- ") for line in lines if len(line.split()) >= 4 and not _section_id(line)]
    if any(count > 1 for count in Counter(statements).values()):
        issue("repeated-statements", "At least one statement appears more than once.", "Remove accidental duplicates or distinguish the actual contribution in each role.", severity="low", deductions={"content": 5})
    if re.search(r"\b(\w+)\s+\1\b", text, re.I):
        issue("repeated-words", "Adjacent repeated words were detected.", "Review repeated words in context and remove accidental duplication.", severity="low", deductions={"content": 3})
    if any(len(sentence.split()) > 40 for sentence in re.split(r"[.!?\n]+", text)):
        issue("long-sentences", "A statement longer than 40 words was detected.", "Split long statements into focused bullets while preserving the meaning.", severity="low", deductions={"content": 4, "formatting": 5})
    if re.search(r"\b(references available (?:on|upon) request|curriculum vitae|duties included)\b", text, re.I):
        issue("unnecessary-phrases", "Potentially redundant CV wording was detected.", "Review phrases such as references available on request and keep only information useful for this application.", severity="low", deductions={"content": 2})
    skill_entries = [entry.strip(" •.-") for line in section_text["skills"] for entry in re.split(r"[,;|•\n]", line) if entry.strip(" •.-")]
    canonical_skills = [next((term.casefold() for term, aliases in ALIASES.items() if _norm(entry) in map(_norm, aliases)), _norm(entry)) for entry in skill_entries]
    duplicate_skills = [term for term, count in Counter(canonical_skills).items() if count > 1]
    if duplicate_skills:
        issue("duplicate-skills", "Duplicate skill entries: " + ", ".join(duplicate_skills) + ".", "List each skill once and group related skills where helpful.", section="skills", severity="low", deductions={"content": 5})
    if any(re.fullmatch(r"(?:expert|advanced|intermediate|beginner|proficient|excellent|various|etc)", entry, re.I) for entry in skill_entries):
        issue("unclear-skills", "A skill entry contains only a proficiency adjective or vague description.", "Name the specific skill and support proficiency claims with a truthful example.", section="skills", severity="low", deductions={"content": 4})
    if len(skill_entries) > 15 and not any(":" in line for line in section_text["skills"]):
        issue("skill-categories", "A long skills list has no detected category labels.", "Group related tools, languages and interpersonal skills into clear categories.", section="skills", severity="low", deductions={"content": 3})
    skill_text = " ".join(section_text["skills"])
    other_evidence = " ".join(section_text["experience"] + section_text["projects"] + section_text["certifications"])
    unsupported = [term for term, aliases in ALIASES.items() if _hits(skill_text, aliases) and not _hits(other_evidence, aliases)]
    if unsupported:
        issue("skill-evidence", "Skills without detected experience/project/certification examples: " + ", ".join(unsupported[:12]) + ". This does not establish that the claim is false.", "Where useful, connect key skills to a truthful project or role. Confirm every claim before including it.", section="skills", severity="low")
    contact_weights = {"name": 25, "email": 35, "phone": 25, "location": 15}
    for key in contact_weights:
        if not contacts[key]:
            issue(f"missing-{key}", f"No readable {key} was confidently detected.", f"Check that your {key} is present as selectable text; correct the extraction if it was missed.",
                  section="contact", severity="medium" if key in {"email", "phone"} else "low")
    job_description = str(job_description or "").strip()
    job = _job_analysis(job_description, text) if job_description else None
    if job is not None:
        limitations.extend([
            "Job requirements use a disclosed vocabulary, explicit skill lists, degree labels, experience phrases and responsibility clauses; extraction is not exhaustive or semantic understanding.",
            "Experience matching uses explicit years-of-experience claims only; date ranges are not added into tenure because roles may overlap or be part-time.",
            "Equivalent aliases match; related frameworks/clouds are partial evidence only. Requirements, qualifications and evidence need human confirmation.",
        ])
        if not job["requirements"]:
            issue("job-requirements-unclear", "No assessable requirements were extracted from the supplied job description.", "Add explicit requirements or a clearly labeled skills list, then review the extracted requirements.", section="job", severity="low")
        elif job["missing"] or job["partial"]:
            issue("job-gaps", f"Found {len(job['missing'])} missing and {len(job['partial'])} partially supported requirements.", "Review each requirement and its evidence. Add only skills and qualifications you actually possess, and acknowledge genuine gaps.", section="job", severity="medium")
    scores = {category: max(0, 100 - sum(item["deductions"].get(category, 0) for item in issues)) for category in ("compatibility", "content", "formatting")}
    scores["contact"] = sum(weight for key, weight in contact_weights.items() if contacts[key])
    scores["jobMatch"] = job["score"] if job else None
    scores["keywords"] = job["keywordScore"] if job else None
    if not has_text:
        scores = {key: 0 if value is not None else None for key, value in scores.items()}
    applicable_max = max(weight for key, weight in configured_weights.items() if scores[key] is not None)
    if applicable_max == 0:
        raise ValueError("At least one applicable score category must have a positive weight.")
    # Scale first so multiple very large finite weights cannot overflow their sum.
    applicable_total = sum(weight / applicable_max for key, weight in configured_weights.items() if scores[key] is not None)
    applicable_weights = {key: (weight / applicable_max) / applicable_total if scores[key] is not None else 0
                          for key, weight in configured_weights.items()}
    overall = round(sum(scores[key] * weight for key, weight in applicable_weights.items() if weight))
    evaluations = []
    for key, title in SECTION_TITLES.items():
        relevant = [finding for finding in issues if finding["section"] == key]
        present = bool(section_text[key])
        evaluations.append({"id": key, "title": title, "present": present,
                            "wordCount": len(" ".join(section_text[key]).split()),
                            "strengths": ["Readable text under a conventional section heading."] if present else [],
                            "weaknesses": [finding["message"] for finding in relevant],
                            "recommendations": [finding["recommendation"] for finding in relevant],
                            "issues": [finding["id"] for finding in relevant]})
    issues.sort(key=lambda item: (item["priority"], item["id"]))
    return {"version": VERSION, "overall": overall, "scores": scores, "issues": issues,
            "sections": evaluations, "contacts": contacts, "job": job,
            "methodology": {"version": VERSION, "type": "deterministic-heuristic", "baseWeights": configured_weights,
                            "defaultWeights": WEIGHTS.copy(),
                            "applicableWeights": applicable_weights,
                            "careerContext": {"earlyCareerExplicit": early_career,
                                              "basis": "Explicit early-career phrases in the summary or opening lines; not inferred from age, dates or degree."},
                            "overall": "Rounded weighted mean of applicable categories; null categories have zero weight.",
                            "rules": "Compatibility, content and formatting start at 100 and subtract the disclosed issue deductions, floored at 0. No readable text forces applicable scores to 0.",
                            "contact": "Name 25, email 35, phone 25, explicit location 15; optional profile URLs do not affect the score.",
                            "jobMatch": "Required requirements weigh 2; preferred and unspecified weigh 1. Matched evidence earns 1, related/partial evidence 0.5, missing evidence 0.",
                            "keywords": "Weighted exact/alias coverage of extracted skill, certification and industry requirements; partial terms earn no keyword credit."},
            "statistics": {"wordCount": len(text.split()), "tableCount": len(tables), "headingCount": len(headings),
                           "detectedSkills": [term for term, aliases in ALIASES.items() if _hits(text, aliases)]},
            "limitations": limitations}
