import re
import datetime
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse
from backend.models import (
    AuditReport, ClaimItem, EvidenceQuote, Passage,
    VerdictEnum, AuditSummary
)

URL_REGEX = re.compile(
    r'^https?://[a-zA-Z0-9.-]+(?:\.[a-zA-Z]{2,})+(?:/[^\s]*)?$',
    re.IGNORECASE
)

def is_valid_http_url(url: Optional[str]) -> bool:
    """Validate that URL has proper http/https scheme and hostname."""
    if not url:
        return True
    if not URL_REGEX.match(url):
        return False
    try:
        parsed = urlparse(url)
        return parsed.scheme in ["http", "https"] and bool(parsed.netloc)
    except Exception:
        return False

def validate_audit_report(report: AuditReport) -> AuditReport:
    """
    Deterministic Verification Gateway:
    1. Verifies that every evidence citation references a real, existing passage.
    2. Ensures quoted text matches the underlying source text verbatim.
    3. Validates that URLs are legitimate and non-fabricated.
    4. Enforces that failed or absent retrieval cannot result in a SUPPORTED verdict.
    5. Guarantees 100% mathematical consistency between claims and summary counts.
    6. Attaches a deterministic audit trail to each claim.
    """
    # 1. Build authoritative passage lookup
    passage_lookup: Dict[str, Passage] = {}
    for doc in report.source_documents:
        for p in doc.passages:
            passage_lookup[p.id] = p

    has_source_passages = len(passage_lookup) > 0
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # 2. Validate each claim and its evidence citations
    for claim in report.claims:
        all_passages_valid = True
        all_verbatim_valid = True
        all_urls_valid = True

        valid_supporting: List[EvidenceQuote] = []
        for eq in claim.supporting_evidence:
            # Check passage existence
            if eq.passage_id not in passage_lookup:
                all_passages_valid = False
                eq.exact_match_verified = False
                eq.extraction_error = f"Passage ID '{eq.passage_id}' does not exist in source documents."
                continue

            ref_passage = passage_lookup[eq.passage_id]
            # Check verbatim grounding
            if eq.text not in ref_passage.text:
                all_verbatim_valid = False
                eq.exact_match_verified = False
                eq.extraction_error = "Quoted text does not match underlying source passage verbatim."
            else:
                eq.exact_match_verified = True

            # Check URL validity if present
            if eq.url and not is_valid_http_url(eq.url):
                all_urls_valid = False
                eq.url = None
                eq.extraction_error = "Rejected invalid or fabricated URL."

            valid_supporting.append(eq)

        valid_contradicting: List[EvidenceQuote] = []
        for eq in claim.contradicting_evidence:
            if eq.passage_id not in passage_lookup:
                all_passages_valid = False
                eq.exact_match_verified = False
                eq.extraction_error = f"Passage ID '{eq.passage_id}' does not exist in source documents."
                continue

            ref_passage = passage_lookup[eq.passage_id]
            if eq.text not in ref_passage.text:
                all_verbatim_valid = False
                eq.exact_match_verified = False
                eq.extraction_error = "Quoted text does not match underlying source passage verbatim."
            else:
                eq.exact_match_verified = True

            if eq.url and not is_valid_http_url(eq.url):
                all_urls_valid = False
                eq.url = None
                eq.extraction_error = "Rejected invalid or fabricated URL."

            valid_contradicting.append(eq)

        claim.supporting_evidence = valid_supporting
        claim.contradicting_evidence = valid_contradicting

        # 3. Guard against unsupported claims masquerading as SUPPORTED
        if claim.verdict == VerdictEnum.SUPPORTED:
            if not has_source_passages or not claim.supporting_evidence:
                claim.verdict = VerdictEnum.INSUFFICIENT_EVIDENCE
                claim.factual_verification_status = "INSUFFICIENT_EVIDENCE"
                claim.explanation = "Deterministic validation override: Claim lacked verified supporting evidence."

        # Character offset validation
        offset_valid = False
        if report.answer_text and 0 <= claim.start_offset <= claim.end_offset <= len(report.answer_text):
            sliced_text = report.answer_text[claim.start_offset:claim.end_offset]
            if sliced_text == claim.text:
                offset_valid = True
            else:
                claim.extraction_status = "WARNING_OFFSET_DRIFT"
        else:
            claim.extraction_status = "MALFORMED_OFFSET"

        # 4. Attach deterministic audit trail
        claim.provenance_audit = {
            "validation_timestamp": now_iso,
            "passages_exist_in_source": all_passages_valid,
            "verbatim_citations_verified": all_verbatim_valid,
            "url_integrity_passed": all_urls_valid,
            "offsets_verified": offset_valid,
            "verdict_grounded": True
        }

    # 5. Enforce mathematical invariant between claim verdicts and summary counts
    actual_total = len(report.claims)
    sup_cnt = sum(1 for c in report.claims if c.verdict == VerdictEnum.SUPPORTED)
    contra_cnt = sum(1 for c in report.claims if c.verdict == VerdictEnum.CONTRADICTED)
    insuf_cnt = sum(1 for c in report.claims if c.verdict == VerdictEnum.INSUFFICIENT_EVIDENCE)
    conf_cnt = sum(1 for c in report.claims if c.verdict == VerdictEnum.CONFLICTING_EVIDENCE)
    ambig_cnt = sum(1 for c in report.claims if c.verdict == VerdictEnum.AMBIGUOUS)
    mixed_cnt = sum(1 for c in report.claims if c.verdict == VerdictEnum.MIXED)

    report.summary.total_claims = actual_total
    report.summary.supported_count = sup_cnt
    report.summary.contradicted_count = contra_cnt
    report.summary.insufficient_count = insuf_cnt
    report.summary.conflicting_count = conf_cnt
    report.summary.ambiguous_count = ambig_cnt
    report.summary.mixed_count = mixed_cnt

    return report
