from typing import Tuple
from backend.models import VerdictEnum, NumericalDiscrepancy

def calculate_confidence(
    verdict: VerdictEnum,
    retrieval_score: float,
    lexical_overlap: float,
    numerical_analysis: NumericalDiscrepancy,
    has_exact_quote: bool
) -> Tuple[float, str]:
    """
    Calculate confidence level (0.0 - 1.0) and explain its basis transparently.
    Confidence reflects evidentiary grounding strength, not infallible truth.
    """
    if verdict == VerdictEnum.CONTRADICTED:
        if numerical_analysis.has_discrepancy:
            score = 0.94
            basis = f"High confidence: Deterministic mathematical mismatch verified against source passage ({numerical_analysis.detail})."
        elif has_exact_quote and lexical_overlap > 0.6:
            score = 0.88
            basis = "High confidence: Direct conflicting factual assertion verified in primary source text."
        else:
            score = 0.76
            basis = "Moderate confidence: Contextual negation detected across retrieved source passages."
        return score, basis

    if verdict == VerdictEnum.SUPPORTED:
        if has_exact_quote and lexical_overlap > 0.75:
            score = 0.95
            basis = "High confidence: Verbatim or near-verbatim source passage alignment with confirmed entity matches."
        elif lexical_overlap > 0.5:
            score = 0.82
            basis = "High confidence: Strong thematic and entity grounding across retrieved source passages."
        else:
            score = 0.68
            basis = "Moderate confidence: Partial lexical grounding in source material without direct verbatim phrasing."
        return score, basis

    if verdict == VerdictEnum.CONFLICTING_EVIDENCE:
        score = 0.85
        basis = "High confidence: Divergent evidence identified across source passages; one or more passages corroborate while others contradict."
        return score, basis

    if verdict == VerdictEnum.MIXED:
        score = 0.75
        basis = "Moderate confidence: Claim contains both corroborated components and unverified or conflicting sub-clauses."
        return score, basis

    if verdict == VerdictEnum.AMBIGUOUS:
        score = 0.65
        basis = "Moderate confidence: Source passages contain conflicting interpretations or indeterminate metrics."
        return score, basis

    # INSUFFICIENT_EVIDENCE
    if retrieval_score < 0.2:
        score = 0.90
        basis = "High confidence: Exhaustive lexical and semantic retrieval yielded no relevant source passages."
    else:
        score = 0.70
        basis = "Moderate confidence: Distant thematic matches found, but none corroborate the specific assertion."

    return score, basis
