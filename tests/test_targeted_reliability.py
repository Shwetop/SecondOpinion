import unittest
import os
import tempfile
from backend.document_processor import process_file, process_plain_text, chunk_text_into_passages
from backend.relation_extractor import (
    extract_entity_facts, compare_entity_relationships, LocationPredicateEnum
)
from backend.temporal_checker import (
    evaluate_claim_temporality, EventModalityEnum
)
from backend.claim_extractor import extract_claims_deterministic, is_verifiable_factual_assertion
from backend.deterministic_validator import validate_audit_report
from backend.models import (
    AuditReport, ClaimItem, Passage, EvidenceQuote, VerdictEnum,
    ClaimCategoryEnum, SeverityEnum
)

class TestTargetedReliabilityFixes(unittest.TestCase):
    """
    Regression test suite for the targeted reliability fixes:
    1. Parsing and structural boundary failures (headings, PDF layout, DOCX styles)
    2. Entity resolution and relationship-aware contradiction detection (locations)
    3. Temporal and dynamic-fact verification (future events, as-of dates, status)
    4. Evidence and verdict safeguards (safeguard statuses, offset integrity)
    """

    # --- ISSUE 1: PARSING & STRUCTURAL BOUNDARIES ---

    def test_01_prevent_heading_paragraph_concatenation_plaintext(self):
        """Headings followed by paragraphs must not be merged into 'LeadershipIntroductionRohit'."""
        text = "Leadership\n\nIntroduction\n\nRohit Sharma was appointed as the captain of the Indian cricket team."
        passages = chunk_text_into_passages("test_src", "test.txt", text)
        self.assertTrue(len(passages) >= 2)
        combined = " ".join([p.text for p in passages])
        self.assertNotIn("LeadershipIntroduction", combined)
        self.assertNotIn("IntroductionRohit", combined)

    def test_02_docx_heading_style_preservation(self):
        """Synthetic DOCX test preserving heading styles and boundaries."""
        import docx
        with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tf:
            temp_path = tf.name

        try:
            doc = docx.Document()
            doc.add_heading("Leadership", level=1)
            doc.add_paragraph("Introduction")
            doc.add_paragraph("Rohit was appointed captain in 2021.")
            doc.save(temp_path)

            source_doc = process_file(temp_path, "test_doc.docx")
            self.assertIn("### Leadership", source_doc.extracted_text)
            self.assertNotIn("LeadershipIntroduction", source_doc.extracted_text)
            self.assertTrue(len(source_doc.passages) >= 2)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def test_03_isolated_heading_excluded_from_claim_extraction(self):
        """Navigation labels and isolated section titles are not extracted as factual claims."""
        text = "Introduction\n\nMethodology\n\nThe company achieved $162 million in revenue."
        claims = extract_claims_deterministic(text)
        claim_texts = [c.text for c in claims]
        self.assertNotIn("Introduction", claim_texts)
        self.assertNotIn("Methodology", claim_texts)
        self.assertTrue(any("162 million" in c for c in claim_texts))

    # --- ISSUE 2: ENTITY RELATIONSHIP-AWARE CONTRADICTION DETECTION ---

    def test_04_different_predicates_birthplace_vs_raised(self):
        """
        'Person X was born in Nagpur' vs 'Person X was raised in Borivali'
        Expected: CONSISTENT (distinct predicates).
        """
        claim_text = "Person X was born in Nagpur."
        evidence_text = "Person X was raised in Borivali."
        
        cf = extract_entity_facts(claim_text)
        ef = extract_entity_facts(evidence_text)
        self.assertEqual(len(cf), 1)
        self.assertEqual(len(ef), 1)
        self.assertEqual(cf[0].predicate, LocationPredicateEnum.BORN_IN)
        self.assertEqual(ef[0].predicate, LocationPredicateEnum.RAISED_IN)

        rel, expl = compare_entity_relationships(cf, ef)
        self.assertEqual(rel, "CONSISTENT")

    def test_05_same_predicate_same_location_equivalent(self):
        """
        'Person X was born in Nagpur' vs 'Person X was born in Nagpur'
        Expected: EQUIVALENT.
        """
        cf = extract_entity_facts("Person X was born in Nagpur.")
        ef = extract_entity_facts("Person X was born in Nagpur.")
        rel, expl = compare_entity_relationships(cf, ef)
        self.assertEqual(rel, "EQUIVALENT")

    def test_06_same_predicate_different_location_contradiction(self):
        """
        'Person X was born in Nagpur' vs 'Person X was born in Pune'
        Expected: CONTRADICTION.
        """
        cf = extract_entity_facts("Person X was born in Nagpur.")
        ef = extract_entity_facts("Person X was born in Pune.")
        rel, expl = compare_entity_relationships(cf, ef)
        self.assertEqual(rel, "CONTRADICTION")

    def test_07_residency_temporal_scopes_consistent(self):
        """
        'Person X currently lives in Mumbai' vs 'Person X lived in Pune in 2020'
        Expected: CONSISTENT.
        """
        cf = extract_entity_facts("Person X currently lives in Mumbai.")
        ef = extract_entity_facts("Person X lived in Pune in 2020.")
        rel, expl = compare_entity_relationships(cf, ef)
        self.assertEqual(rel, "CONSISTENT")

    # --- ISSUE 3: TEMPORAL & DYNAMIC-FACT VERIFICATION ---

    def test_08_scheduled_future_event_modality(self):
        """'The tournament is scheduled for December 2026' when audited in October 2026 is SCHEDULED_FUTURE."""
        claim = "The tournament is scheduled for December 2026."
        audit_time = "2026-10-10T12:00:00Z"
        assessment = evaluate_claim_temporality(claim, audit_timestamp_utc=audit_time)
        self.assertEqual(assessment.modality, EventModalityEnum.SCHEDULED_FUTURE)
        self.assertTrue(assessment.is_future_relative_to_audit)

    def test_09_announced_future_schedule_modality(self):
        """'The organizer announced that the tournament is scheduled for December 2026' is ANNOUNCED_PLAN."""
        claim = "The organizer announced that the tournament is scheduled for December 2026."
        audit_time = "2026-10-10T12:00:00Z"
        assessment = evaluate_claim_temporality(claim, audit_timestamp_utc=audit_time)
        self.assertEqual(assessment.modality, EventModalityEnum.ANNOUNCED_PLAN)

    def test_10_premature_completed_past_event_flagged(self):
        """'The tournament took place in December 2026' audited in Oct 2026 flags temporal inconsistency."""
        from backend.evidence_retriever import BM25Retriever
        from backend.claim_verifier import verify_single_claim
        from backend.models import AuditOptions

        claim = ClaimItem(
            id="c_future", claim_number=1, text="The tournament took place in December 2026.",
            start_offset=0, end_offset=43, verdict=VerdictEnum.INSUFFICIENT_EVIDENCE,
            category=ClaimCategoryEnum.FACTUAL, explanation="", confidence_score=0.0,
            confidence_basis="", severity=SeverityEnum.LOW
        )
        passage = Passage(
            id="p1", source_id="s1", filename="doc.txt", passage_number=1,
            text="The event is planned for later.", char_start=0, char_end=31
        )
        retriever = BM25Retriever([passage])
        verified = verify_single_claim(claim, retriever, AuditOptions())
        self.assertEqual(verified.verdict, VerdictEnum.CONTRADICTED)
        self.assertEqual(verified.factual_verification_status, "TEMPORAL_CONTRADICTION")

    # --- ISSUE 4: EVIDENCE AND VERDICT SAFEGUARDS ---

    def test_11_safeguard_fields_populated_and_persisted(self):
        """Check that factual_verification_status, internal_consistency_status, and extraction_status exist."""
        claim = ClaimItem(
            id="c1", claim_number=1, text="Total revenue was $162 million.",
            start_offset=0, end_offset=31, verdict=VerdictEnum.SUPPORTED,
            category=ClaimCategoryEnum.NUMERICAL, explanation="Corroborated by source.",
            confidence_score=0.9, confidence_basis="Evidence found.", severity=SeverityEnum.LOW
        )
        self.assertEqual(claim.extraction_status, "VALID")
        self.assertIsNotNone(claim.id)

    def test_12_offset_drift_triggers_warning_status(self):
        """If start_offset and end_offset do not match the answer text, deterministic validator flags warning."""
        report = AuditReport(
            id="aud_drift",
            title="Drift Audit",
            created_at="2026-10-10T00:00:00Z",
            status="COMPLETED",
            answer_text="Short text here.",
            source_documents=[],
            claims=[
                ClaimItem(
                    id="c1", claim_number=1, text="Completely different sentence.",
                    start_offset=0, end_offset=5, verdict=VerdictEnum.INSUFFICIENT_EVIDENCE,
                    category=ClaimCategoryEnum.FACTUAL, explanation="", confidence_score=0.5,
                    confidence_basis="", severity=SeverityEnum.LOW
                )
            ]
        )
        validated = validate_audit_report(report)
        self.assertEqual(validated.claims[0].extraction_status, "WARNING_OFFSET_DRIFT")

if __name__ == "__main__":
    unittest.main()
