"""Behavioral coverage for the deterministic CV analysis contract."""
import json

from django.test import SimpleTestCase

from .analysis import analyze


GOOD_HTML = """<h1>Jane Doe</h1>
<p>jane@example.com | +94 77 123 4567 | Location: Colombo, Sri Lanka</p>
<h2>Professional Summary</h2><p>Software engineer building accessible web applications
with Python and Django. Delivers reliable services through automated testing and
collaboration with product teams to improve customer workflows.</p>
<h2>Work Experience</h2><p>Software Engineer, Acme, 2020–2024</p>
<ul><li>Developed Django APIs serving 500 users and reduced response time by 20%.</li></ul>
<h2>Education</h2><p>Bachelor of Science in Computer Science</p>
<h2>Technical Skills</h2><p>Python, Django, SQL, JavaScript</p>"""


class AnalysisTests(SimpleTestCase):
    def source(self, html=GOOD_HTML, css=""):
        return {"title": "Jane Doe CV", "html": html, "css": css}

    def issue_ids(self, result):
        return {issue["id"] for issue in result["issues"]}

    def test_absent_job_is_not_scored_or_penalized(self):
        result = analyze(self.source())
        self.assertIsNone(result["scores"]["jobMatch"])
        self.assertIsNone(result["scores"]["keywords"])
        self.assertIsNone(result["job"])
        self.assertEqual(result["methodology"]["applicableWeights"]["jobMatch"], 0)
        self.assertAlmostEqual(sum(result["methodology"]["applicableWeights"].values()), 1)
        self.assertEqual(result["overall"], round(sum(
            result["scores"][category] * weight
            for category, weight in result["methodology"]["applicableWeights"].items()
            if weight
        )))
        json.dumps(result, allow_nan=False)

    def test_image_only_cv_cannot_receive_good_scores(self):
        result = analyze(self.source('<img src="cv.png" alt="Jane Doe resume">'))
        self.assertEqual(result["overall"], 0)
        self.assertEqual(result["scores"]["compatibility"], 0)
        self.assertIn("no-text", self.issue_ids(result))
        self.assertEqual(next(i for i in result["issues"] if i["id"] == "no-text")["kind"], "confirmed")

    def test_hidden_and_script_text_does_not_match_contact_or_job(self):
        html = '<h1>Jane Doe</h1><script>java@example.com Java</script><p hidden>Java</p>'
        result = analyze(self.source(html), "Required: Java")
        self.assertIsNone(result["contacts"]["email"])
        self.assertEqual(result["job"]["missing"][0]["term"], "Java")

    def test_detects_nested_tables_and_layout_as_risks(self):
        html = GOOD_HTML + '<table><tr><td>A<table><tr><td>B</td></tr></table></td></tr></table>'
        result = analyze(self.source(html, ".cv {column-count: 2; display:grid; grid-template-columns:1fr 2fr}"))
        ids = self.issue_ids(result)
        self.assertTrue({"tables", "nested-tables", "multi-column", "reading-order"} <= ids)
        self.assertTrue(all(i["kind"] == "risk" for i in result["issues"] if i["id"] in ids - {"missing-location"}))
        self.assertLess(result["scores"]["compatibility"], analyze(self.source())["scores"]["compatibility"])

    def test_contact_header_images_fonts_and_encoding_are_explained(self):
        html = '<header><h1>Jane Doe</h1><p>jane@example.com</p></header><img src="x.png"><p>broken \ufffd text</p><i class="fa fa-phone"></i>'
        result = analyze(self.source(html, 'body {font-family: "My Strange Font"; font-size:7px} .box{position:absolute}'))
        self.assertTrue({"header-footer-contact", "images", "icons", "unusual-font", "encoding", "small-font", "text-boxes"} <= self.issue_ids(result))
        self.assertEqual(result["contacts"]["email"], "jane@example.com")
        encoding = next(i for i in result["issues"] if i["id"] == "encoding")
        self.assertEqual(encoding["kind"], "confirmed")

    def test_original_extraction_findings_remain_labeled_without_penalizing_working_source(self):
        evidence = {"text": "Jane Doe\njane@example.com\nPython", "issues": [
            {"id": "pdf-order", "kind": "confirmed", "severity": "high", "message": "Text blocks were interleaved.", "recommendation": "Use a single column."}
        ], "limitations": ["OCR confidence unavailable."]}
        result = analyze(self.source(), evidence=evidence)
        issue = next(i for i in result["issues"] if i["id"] == "pdf-order")
        self.assertEqual(issue["kind"], "confirmed")
        self.assertEqual(issue["origin"], "original-upload")
        self.assertEqual(issue["deductions"], {})
        self.assertIn("Original upload", issue["message"])
        self.assertEqual(result["scores"], analyze(self.source())["scores"])
        self.assertIn("OCR confidence unavailable.", result["limitations"])
        self.assertTrue(all({"id", "severity", "kind", "section", "message", "recommendation", "priority"} <= set(i) for i in result["issues"]))

    def test_repaired_working_source_is_scored_despite_original_empty_extraction(self):
        result = analyze(self.source(), "Required: Python", evidence={"text": ""})
        self.assertGreater(result["overall"], 0)
        self.assertEqual(result["job"]["matched"][0]["term"], "Python")

    def test_original_text_cannot_override_working_skills_or_contacts(self):
        result = analyze(self.source(), "Required: Python, Java", evidence={"text": "Old Person\nold@example.com\nJava"})
        self.assertEqual(result["contacts"]["email"], "jane@example.com")
        self.assertEqual(result["contacts"]["name"], "Jane Doe")
        self.assertEqual([item["term"] for item in result["job"]["matched"]], ["Python"])
        self.assertEqual([item["term"] for item in result["job"]["missing"]], ["Java"])

    def test_original_text_is_fallback_only_when_working_html_is_not_supplied(self):
        result = analyze({"title": "Extracted CV"}, "Required: Python", evidence={"text": "Jane Doe\njane@example.com\nPython"})
        self.assertEqual(result["contacts"]["email"], "jane@example.com")
        self.assertEqual(result["job"]["matched"][0]["term"], "Python")
        cleared = analyze(self.source(""), "Required: Python", evidence={"text": "Jane Doe\nPython"})
        self.assertEqual(cleared["overall"], 0)

    def test_contacts_extract_full_urls_and_do_not_require_optional_profiles(self):
        result = analyze(self.source(GOOD_HTML + '<p><a href="https://linkedin.com/in/jane">LinkedIn</a> <a href="https://github.com/jane">GitHub</a> <a href="https://jane.dev">Portfolio</a></p>'))
        self.assertEqual(result["contacts"]["name"], "Jane Doe")
        self.assertEqual(result["contacts"]["phone"], "+94 77 123 4567")
        self.assertEqual(result["contacts"]["linkedin"], "https://linkedin.com/in/jane")
        self.assertEqual(result["contacts"]["github"], "https://github.com/jane")
        self.assertEqual(result["contacts"]["portfolio"], "https://jane.dev")
        self.assertEqual(result["scores"]["contact"], 100)
        self.assertEqual(analyze(self.source())["scores"]["contact"], 100)

    def test_weak_verbs_metrics_repetition_and_duplicate_skills_have_specific_fixes(self):
        html = GOOD_HTML.replace("Developed Django APIs serving 500 users and reduced response time by 20%.", "Worked on web applications.")
        html = html.replace("Python, Django, SQL, JavaScript", "Python, python, Django, expert")
        html += "<p>Worked on web applications.</p><p>the the application</p>"
        result = analyze(self.source(html))
        self.assertTrue({"weak-verbs", "measurable-results", "duplicate-skills", "repeated-statements", "repeated-words", "unclear-skills"} <= self.issue_ids(result))
        measure = next(i for i in result["issues"] if i["id"] == "measurable-results")
        self.assertIn("verif", measure["recommendation"].lower())
        self.assertNotIn("20%", measure["recommendation"])
        self.assertLess(result["scores"]["content"], analyze(self.source())["scores"]["content"])

    def test_section_evaluations_identify_missing_and_unusual_headings(self):
        result = analyze(self.source("<h1>Jane Doe</h1><h2>My Journey</h2><p>Built reliable services.</p>"))
        self.assertIn("unusual-headings", self.issue_ids(result))
        self.assertIn("missing-education", self.issue_ids(result))
        self.assertTrue(any(s["id"] == "experience" and not s["present"] for s in result["sections"]))
        self.assertTrue(any("grammar" in limit.lower() for limit in result["limitations"]))

    def test_java_does_not_match_javascript_and_synonyms_match_with_boundaries(self):
        result = analyze(self.source(), "Required: Java and Structured Query Language. Preferred: Python.")
        self.assertEqual([r["term"] for r in result["job"]["missing"]], ["Java"])
        matched = {r["term"]: r for r in result["job"]["matched"]}
        self.assertEqual(matched["SQL"]["importance"], "required")
        self.assertEqual(matched["Python"]["importance"], "preferred")
        self.assertTrue(matched["SQL"]["evidence"])
        self.assertLess(result["scores"]["jobMatch"], 100)

    def test_required_gaps_cost_more_than_preferred_gaps(self):
        first = analyze(self.source(), "Required: Python. Preferred: Java.")
        second = analyze(self.source(), "Required: Java. Preferred: Python.")
        self.assertGreater(first["scores"]["jobMatch"], second["scores"]["jobMatch"])

    def test_education_and_experience_claims_are_compared_without_inventing_tenure(self):
        result = analyze(self.source(), "Requirements:\nBachelor's degree in Computer Science.\n5+ years of experience.\nRequired: Django.")
        self.assertTrue(any(r["category"] == "education" and r["status"] == "matched" for r in result["job"]["requirements"]))
        years = next(r for r in result["job"]["requirements"] if r["category"] == "experience")
        self.assertEqual(years["status"], "missing")
        self.assertIn("tenure", " ".join(result["limitations"]).lower())
        explicit = analyze(self.source(GOOD_HTML.replace("Software engineer building", "Software engineer with 6 years of experience building")), "Required: 5 years of experience.")
        self.assertEqual(explicit["job"]["requirements"][0]["status"], "matched")

    def test_related_terms_are_partial_evidence_not_equivalent(self):
        result = analyze(self.source(), "Required: Flask.")
        self.assertEqual(result["job"]["partial"][0]["term"], "Flask")
        self.assertEqual(result["job"]["matched"], [])
        self.assertEqual(result["scores"]["jobMatch"], 50)

    def test_unknown_requirement_stays_visible_without_guessing_equivalence(self):
        result = analyze(self.source(), "Required skills: QuantumWidget, Python")
        self.assertTrue(any(r["term"] == "QuantumWidget" and r["status"] == "missing" for r in result["job"]["requirements"]))

    def test_job_without_extractable_requirements_is_unscored(self):
        result = analyze(self.source(), "Welcome to our company!")
        self.assertIsNone(result["scores"]["jobMatch"])
        self.assertIsNone(result["scores"]["keywords"])
        self.assertIn("job-requirements-unclear", self.issue_ids(result))

    def test_analysis_is_deterministic_and_does_not_modify_input(self):
        source = self.source()
        original = dict(source)
        first = analyze(source, "Required: Python, SQL")
        self.assertEqual(first, analyze(source, "Required: Python, SQL"))
        self.assertEqual(source, original)

    def test_nodejs_does_not_claim_explicit_javascript_evidence(self):
        result = analyze(self.source("<h1>Jane Doe</h1><h2>Skills</h2><p>Node.js</p>"), "Required: JavaScript.")
        self.assertEqual(result["job"]["matched"], [])
        self.assertEqual(result["job"]["missing"][0]["term"], "JavaScript")

    def test_negated_experience_does_not_count_as_skill_evidence(self):
        result = analyze(self.source("<h1>Jane Doe</h1><p>No experience with Java.</p>"), "Required: Java.")
        self.assertEqual(result["job"]["matched"], [])
        self.assertEqual(result["job"]["missing"][0]["term"], "Java")

    def test_experience_range_is_not_counted_at_its_upper_bound(self):
        result = analyze(self.source(GOOD_HTML + "<p>3–5 years of experience.</p>"), "Required: 5 years of experience.")
        self.assertEqual(result["job"]["partial"][0]["category"], "experience")

    def test_css_repeat_columns_and_explicit_reorder_are_detected(self):
        result = analyze(self.source(css=".cv{display:grid;grid-template-columns:repeat(2,1fr)} .a{order:-1}"))
        self.assertIn("multi-column", self.issue_ids(result))
        self.assertIn("reading-order", self.issue_ids(result))

    def test_names_are_not_inferred_from_an_unknown_section_heading(self):
        result = analyze(self.source("<h2>Personal Details</h2><p>jane@example.com</p>"))
        self.assertIsNone(result["contacts"]["name"])

    def test_explicit_certification_list_preserves_unknown_certificates(self):
        result = analyze(self.source(), "Required certifications: Vendor Advanced Certificate")
        item = result["job"]["requirements"][0]
        self.assertEqual(item["category"], "certification")
        self.assertEqual(item["status"], "missing")

    def test_unrelated_prefix_cannot_bypass_negated_skill(self):
        result = analyze(self.source("<h1>Jane Doe</h1><p>JavaScript, no experience with Java.</p>"), "Required: Java.")
        self.assertEqual(result["job"]["matched"], [])

    def test_plain_job_title_is_extracted_without_becoming_a_requirement(self):
        result = analyze(self.source(), "Senior Software Engineer\nRequired: Python.")
        self.assertEqual(result["job"]["title"], "Senior Software Engineer")
        self.assertEqual(len(result["job"]["requirements"]), 1)

    def test_required_phrases_without_of_experience_support_year_requirements(self):
        result = analyze(self.source(GOOD_HTML + "<p>6 years developing software.</p>"), "Required: 5+ years of software development experience.")
        self.assertTrue(any(r["category"] == "experience" for r in result["job"]["requirements"]))
        self.assertEqual(result["job"]["matched"][0]["category"], "experience")

    def test_html_comments_cannot_supply_candidate_qualifications(self):
        result = analyze(self.source("<h1>Jane Doe</h1><!-- Java jane@example.com -->"), "Required: Java.")
        self.assertIsNone(result["contacts"]["email"])
        self.assertEqual(result["job"]["matched"], [])

    def test_custom_weights_merge_defaults_without_mutating_input(self):
        weights = {"contact": 65}
        result = analyze(self.source(), weights=weights)
        self.assertEqual(weights, {"contact": 65})
        self.assertEqual(result["methodology"]["baseWeights"]["compatibility"], 25)
        self.assertEqual(result["methodology"]["baseWeights"]["contact"], 65)
        self.assertEqual(result["methodology"]["applicableWeights"]["contact"], .52)
        self.assertEqual(result["methodology"]["applicableWeights"]["jobMatch"], 0)
        self.assertEqual(result["overall"], round(
            result["scores"]["compatibility"] * .2
            + result["scores"]["content"] * .2
            + result["scores"]["formatting"] * .08
            + result["scores"]["contact"] * .52
        ))
        self.assertEqual(analyze(self.source())["methodology"]["baseWeights"]["contact"], 5)

    def test_invalid_custom_weights_are_rejected(self):
        for weights in ({"content": -1}, {"contact": float("inf")},
                        {"contact": float("nan")}, {"contact": "5"},
                        {"contact": True}, {"unknown": 3}, []):
            with self.subTest(weights=weights), self.assertRaises(ValueError):
                analyze(self.source(), weights=weights)

    def test_zero_weights_are_allowed_but_zero_total_applicable_weight_is_rejected(self):
        all_zero = {"compatibility": 0, "content": 0, "formatting": 0, "contact": 0,
                    "keywords": 0, "jobMatch": 0}
        with self.assertRaises(ValueError):
            analyze(self.source(), weights=all_zero)
        with self.assertRaises(ValueError):
            analyze(self.source(), weights={**all_zero, "jobMatch": 1})
        result = analyze(self.source(), "Required: Python", weights={**all_zero, "jobMatch": 1})
        self.assertEqual(result["overall"], 100)
        self.assertEqual(result["methodology"]["applicableWeights"]["jobMatch"], 1)

    def test_explicit_early_career_context_uses_projects_as_experience(self):
        html = "<h1>Jane Doe</h1><h2>Summary</h2><p>Recent graduate seeking a first software engineering role.</p>"
        html += "<h2>Education</h2><p>Bachelor of Science in Computer Science</p>"
        html += "<h2>Projects</h2><p>Built a Python application serving 50 students.</p>"
        html += "<h2>Skills</h2><p>Python</p>"
        result = analyze(self.source(html))
        experience = next(i for i in result["issues"] if i["id"] == "missing-experience")
        self.assertEqual(experience["severity"], "low")
        self.assertEqual(experience["deductions"].get("content", 0), 0)
        self.assertIn("project", experience["recommendation"].lower())

    def test_early_career_is_not_inferred_just_from_a_degree(self):
        html = GOOD_HTML.replace("<h2>Work Experience</h2>", "<h2>Projects</h2>")
        result = analyze(self.source(html))
        experience = next(i for i in result["issues"] if i["id"] == "missing-experience")
        self.assertGreater(experience["deductions"].get("content", 0), 0)

    def test_subsection_headings_preserve_experience_education_and_projects(self):
        html = '<h1>Jane Doe</h1><h2>Work Experience</h2><h3>Engineer — Acme</h3><p>Built Python applications for 100 users.</p>'
        html += '<h2>Education</h2><h3>Bachelor of Science</h3><p>Computer Science, Acme University.</p>'
        html += '<h2>Projects</h2><h3>Profile Maker</h3><p>Developed Django APIs for 50 users.</p>'
        result = analyze(self.source(html))
        for section in ("experience", "education", "projects"):
            evaluation = next(item for item in result["sections"] if item["id"] == section)
            self.assertTrue(evaluation["present"])
            self.assertGreater(evaluation["wordCount"], 5)
            self.assertNotIn(f"missing-{section}", self.issue_ids(result))
        self.assertNotIn("unusual-headings", self.issue_ids(result))

    def test_unknown_h2_stops_previous_section_and_is_reported(self):
        html = '<h1>Jane Doe</h1><h2>Skills</h2><p>Python</p><h2>My Journey</h2><p>Other narrative content here.</p>'
        result = analyze(self.source(html))
        skills = next(section for section in result["sections"] if section["id"] == "skills")
        self.assertEqual(skills["wordCount"], 1)
        self.assertIn("unusual-headings", self.issue_ids(result))
        self.assertEqual(result["contacts"]["name"], "Jane Doe")

    def test_total_tenure_does_not_certify_unrelated_specialty_experience(self):
        result = analyze(self.source("<h1>Jane Doe</h1><p>I have 6 years of experience in retail.</p>"),
                         "Required: 5 years of software development experience.")
        experience = next(item for item in result["job"]["requirements"] if item["category"] == "experience")
        self.assertEqual(experience["status"], "partial")
        self.assertEqual(result["scores"]["jobMatch"], 50)
        self.assertIn("scope", experience["matchExplanation"].lower())

    def test_explicitly_negated_skill_is_not_positive_evidence(self):
        result = analyze(self.source("<h1>Jane Doe</h1><p>I have no Python skills.</p>"), "Required: Python")
        self.assertEqual(result["scores"]["jobMatch"], 0)
        self.assertEqual(result["job"]["matched"], [])
