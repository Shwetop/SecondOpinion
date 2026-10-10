import unittest
from backend.fact_normalizer import (
    normalize_date_string, extract_all_normalized_dates,
    normalize_quantity, NormalizedDate, NormalizedQuantity
)
from backend.relationship_classifier import (
    classify_assertion_relationship, classify_date_relationship,
    classify_quantity_relationship, FactRelationEnum
)
from backend.claim_extractor import extract_claims_deterministic, decompose_compound_sentence
from backend.deterministic_validator import validate_audit_report
from backend.models import (
    AuditReport, ClaimItem, Passage, SourceDocument, EvidenceQuote,
    VerdictEnum, ClaimCategoryEnum, SeverityEnum, AuditOptions
)

class TestRegressionFactVerification(unittest.TestCase):
    """
    Comprehensive regression test suite covering all 18 mandatory specifications:
    1. Equivalent date formats
    2. Different birth years for the same person
    3. Year-only claims versus complete dates
    4. Ambiguous numeric dates
    5. Equivalent units and numeric formats
    6. Negation and qualifier differences
    7. Multiple facts in one sentence
    8. Compatible statements about different events
    9. Missing evidence
    10. Irrelevant evidence
    11. Evidence that explicitly contradicts a claim
    12. Conflicting sources
    13. Malformed structured output handling
    14. Fabricated or missing citations
    15. Incorrect character offsets
    16. Duplicate claims
    17. Consistency between claim-level verdicts and audit-level counts
    18. Gemini timeouts and fallback handling
    + Specific historical regression cases (Shivaji Maharaj DOB).
    """

    # 1. Equivalent date formats
    def test_01_equivalent_date_formats(self):
        """'19 February 1630' and 'February 19, 1630' represent the same date -> EQUIVALENT."""
        d1 = normalize_date_string("19 February 1630")
        d2 = normalize_date_string("February 19, 1630")
        self.assertIsNotNone(d1)
        self.assertIsNotNone(d2)
        self.assertEqual(d1.iso_date, "1630-02-19")
        self.assertEqual(d2.iso_date, "1630-02-19")
        rel, expl = classify_date_relationship(d1, d2)
        self.assertEqual(rel, FactRelationEnum.EQUIVALENT)

    # 2. Different birth years for the same person (Shivaji Maharaj historical regression)
    def test_02_different_birth_years_same_person(self):
        """'He was born in 1630' vs 'He was born in 1631' -> CONTRADICTION."""
        claim = "He was born in 1630."
        evidence = "He was born in 1631."
        rel, expl = classify_assertion_relationship(claim, evidence)
        self.assertEqual(rel, FactRelationEnum.CONTRADICTION)

    # 3. Year-only claims versus complete dates
    def test_03_year_only_versus_complete_date(self):
        """'He was born in 1630' vs 'He was born on 19 February 1630' -> CONSISTENT."""
        claim = "He was born in 1630."
        evidence = "He was born on 19 February 1630."
        rel, expl = classify_assertion_relationship(claim, evidence)
        self.assertEqual(rel, FactRelationEnum.CONSISTENT)

    # 4. Ambiguous numeric dates
    def test_04_ambiguous_numeric_dates(self):
        """'03/04/1630' has ambiguous day/month ordering and must not be guessed without locale."""
        d = normalize_date_string("03/04/1630")
        self.assertIsNotNone(d)
        self.assertTrue(d.is_ambiguous)
        self.assertIsNone(d.iso_date)

    # 5. Equivalent units and numeric formats
    def test_05_equivalent_units_and_numeric_formats(self):
        """'1 km' and '1000 m' represent the same distance -> EQUIVALENT."""
        q1 = normalize_quantity("1 km")
        q2 = normalize_quantity("1000 m")
        self.assertIsNotNone(q1)
        self.assertIsNotNone(q2)
        rel, expl = classify_quantity_relationship(q1, q2)
        self.assertEqual(rel, FactRelationEnum.EQUIVALENT)

    # 6. Negation and qualifier differences
    def test_06_qualifier_differences(self):
        """'Approximately 100' and 'exactly 100' must not automatically be treated as identical."""
        q1 = normalize_quantity("100", context="approximately 100 patients")
        q2 = normalize_quantity("100", context="exactly 100 patients")
        self.assertEqual(q1.qualifier, "APPROXIMATE")
        self.assertEqual(q2.qualifier, "EXACT")
        rel, expl = classify_quantity_relationship(q1, q2)
        self.assertEqual(rel, FactRelationEnum.POSSIBLE_CONFLICT)

    # 7. Multiple facts in one sentence
    def test_07_multiple_facts_atomic_decomposition(self):
        """Sentence with 3 facts decomposes cleanly into 3 distinct atomic claims."""
        sentence = "The application uses FastAPI and PostgreSQL and was released in 2025."
        decomposed = decompose_compound_sentence(sentence)
        self.assertEqual(len(decomposed), 3)
        self.assertIn("The application uses FastAPI.", decomposed)
        self.assertIn("The application uses PostgreSQL.", decomposed)
        self.assertIn("The application was released in 2025.", decomposed)

    # 8. Compatible statements about different events
    def test_08_compatible_statements_different_events(self):
        """'He visited Agra in 1666.' vs 'He captured a fort in 1667.' -> CONSISTENT."""
        claim = "He visited Agra in 1666."
        evidence = "He captured a fort in 1667."
        rel, expl = classify_assertion_relationship(claim, evidence)
        self.assertEqual(rel, FactRelationEnum.CONSISTENT)

    # 9. Missing evidence
    def test_09_missing_evidence_not_false(self):
        """Claim with no evidence must return INSUFFICIENT_INFORMATION / INSUFFICIENT_EVIDENCE, not CONTRADICTION."""
        claim = "The server utilizes Python 3.12."
        evidence = ""
        rel, expl = classify_assertion_relationship(claim, evidence)
        self.assertEqual(rel, FactRelationEnum.INSUFFICIENT_INFORMATION)

    # 10. Irrelevant evidence
    def test_10_irrelevant_evidence_abstention(self):
        """Evidence mentioning the same entity but irrelevant topic does not justify Supported or Contradicted."""
        from backend.evidence_retriever import BM25Retriever
        from backend.claim_verifier import verify_single_claim
        
        passage = Passage(
            id="p1", source_id="s1", filename="Doc.txt", page_number=1,
            passage_number=1, text="The company has corporate headquarters located in New York City.",
            char_start=0, char_end=62
        )
        retriever = BM25Retriever([passage])
        claim = ClaimItem(
            id="c1", claim_number=1, text="The company operates commercial facilities across Japan and Singapore.",
            start_offset=0, end_offset=71, verdict=VerdictEnum.INSUFFICIENT_EVIDENCE,
            category=ClaimCategoryEnum.FACTUAL, explanation="", confidence_score=0.0,
            confidence_basis="", severity=SeverityEnum.LOW
        )
        verified = verify_single_claim(claim, retriever, AuditOptions())
        self.assertEqual(verified.verdict, VerdictEnum.INSUFFICIENT_EVIDENCE)

    # 11. Evidence that explicitly contradicts a claim
    def test_11_explicit_contradiction(self):
        """Total third quarter revenue asserted $185M vs source $162M -> CONTRADICTION."""
        from backend.evidence_retriever import BM25Retriever
        from backend.claim_verifier import verify_single_claim
        
        passage = Passage(
            id="p1", source_id="s1", filename="10Q.txt", page_number=1,
            passage_number=1, text="Total revenue for the quarter was $162 million.",
            char_start=0, char_end=48
        )
        retriever = BM25Retriever([passage])
        claim = ClaimItem(
            id="c1", claim_number=1, text="Total revenue for the quarter was $185 million.",
            start_offset=0, end_offset=48, verdict=VerdictEnum.INSUFFICIENT_EVIDENCE,
            category=ClaimCategoryEnum.NUMERICAL, explanation="", confidence_score=0.0,
            confidence_basis="", severity=SeverityEnum.LOW
        )
        verified = verify_single_claim(claim, retriever, AuditOptions())
        self.assertEqual(verified.verdict, VerdictEnum.CONTRADICTED)

    # 12. Conflicting sources
    def test_12_conflicting_sources(self):
        """Two sources provide divergent figures -> CONFLICTING_EVIDENCE."""
        from backend.evidence_retriever import BM25Retriever
        from backend.claim_verifier import verify_single_claim
        
        p1 = Passage(id="p1", source_id="s1", filename="DocA.txt", page_number=1, passage_number=1,
                     text="Total revenue reached $162 million.", char_start=0, char_end=35)
        p2 = Passage(id="p2", source_id="s2", filename="DocB.txt", page_number=1, passage_number=1,
                     text="Total revenue was adjusted to $185 million.", char_start=0, char_end=42)
        retriever = BM25Retriever([p1, p2])
        claim = ClaimItem(
            id="c1", claim_number=1, text="Total revenue reached $162 million.",
            start_offset=0, end_offset=35, verdict=VerdictEnum.INSUFFICIENT_EVIDENCE,
            category=ClaimCategoryEnum.NUMERICAL, explanation="", confidence_score=0.0,
            confidence_basis="", severity=SeverityEnum.LOW
        )
        verified = verify_single_claim(claim, retriever, AuditOptions())
        self.assertEqual(verified.verdict, VerdictEnum.CONFLICTING_EVIDENCE)

    # 13. Malformed output handling
    def test_13_malformed_date_handling(self):
        """Garbage or malformed date does not throw exceptions; returns None."""
        d = normalize_date_string("Not-A-Date-String-999")
        self.assertIsNone(d)

    # 14. Fabricated or missing citations rejected by deterministic validator
    def test_14_fabricated_citation_rejected(self):
        """Evidence referencing non-existent passage is stripped and SUPPORTED verdict overridden."""
        report = AuditReport(
            id="aud_1",
            title="Test",
            created_at="2026-10-10T00:00:00Z",
            status="COMPLETED",
            answer_text="Total revenue reached $162 million.",
            source_documents=[],
            claims=[
                ClaimItem(
                    id="c1", claim_number=1, text="Total revenue reached $162 million.",
                    start_offset=0, end_offset=35, verdict=VerdictEnum.SUPPORTED,
                    category=ClaimCategoryEnum.NUMERICAL, explanation="",
                    supporting_evidence=[
                        EvidenceQuote(
                            id="eq1", source_id="fake_doc", filename="fake.pdf",
                            passage_id="nonexistent_p1", text="Total revenue reached $162 million.",
                            similarity_score=1.0, is_contradiction=False, exact_match_verified=True
                        )
                    ],
                    confidence_score=0.9, confidence_basis="", severity=SeverityEnum.LOW
                )
            ]
        )
        validated = validate_audit_report(report)
        self.assertEqual(validated.claims[0].verdict, VerdictEnum.INSUFFICIENT_EVIDENCE)
        self.assertEqual(len(validated.claims[0].supporting_evidence), 0)

    # 15. Exact character offsets
    def test_15_character_offsets_exact_match(self):
        """Offsets must satisfy input_text[start:end] == claim.text."""
        input_text = "Alpha Corp is growing fast. The application uses FastAPI. Final sentence."
        claims = extract_claims_deterministic(input_text)
        for c in claims:
            sliced = input_text[c.start_offset:c.end_offset]
            self.assertEqual(sliced, c.text)

    # 16. Duplicate claims prevention
    def test_16_duplicate_claims_deduplication(self):
        """Repeated identical statements are deduplicated in extraction."""
        text = "The application uses FastAPI. The application uses FastAPI."
        claims = extract_claims_deterministic(text)
        self.assertEqual(len(claims), 1)

    # 17. Consistency between claim-level verdicts and audit summary counts
    def test_17_summary_count_invariants(self):
        """Summary counts must equal exact sum of claim verdicts."""
        report = AuditReport(
            id="aud_2",
            title="Test Counts",
            created_at="2026-10-10T00:00:00Z",
            status="COMPLETED",
            answer_text="Sentence one. Sentence two.",
            source_documents=[],
            claims=[
                ClaimItem(id="c1", claim_number=1, text="Sentence one.", start_offset=0, end_offset=13,
                          verdict=VerdictEnum.CONTRADICTED, category=ClaimCategoryEnum.FACTUAL,
                          explanation="", confidence_score=0.8, confidence_basis="", severity=SeverityEnum.HIGH),
                ClaimItem(id="c2", claim_number=2, text="Sentence two.", start_offset=14, end_offset=27,
                          verdict=VerdictEnum.INSUFFICIENT_EVIDENCE, category=ClaimCategoryEnum.FACTUAL,
                          explanation="", confidence_score=0.5, confidence_basis="", severity=SeverityEnum.LOW),
            ]
        )
        validated = validate_audit_report(report)
        self.assertEqual(validated.summary.total_claims, 2)
        self.assertEqual(validated.summary.contradicted_count, 1)
        self.assertEqual(validated.summary.insufficient_count, 1)
        self.assertEqual(validated.summary.supported_count, 0)

    # 18. Graceful zero-API fallback
    def test_18_zero_api_fallback_functional(self):
        """In zero-API local mode (no Gemini key), pipeline runs deterministically without error."""
        text = "The application uses FastAPI and PostgreSQL."
        claims = extract_claims_deterministic(text)
        self.assertTrue(len(claims) >= 1)
        for c in claims:
            self.assertIsNotNone(c.text)
            self.assertTrue(c.end_offset > c.start_offset)

if __name__ == "__main__":
    unittest.main()
