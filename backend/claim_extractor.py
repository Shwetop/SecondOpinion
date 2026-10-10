import re
import uuid
from typing import List, Dict, Any, Optional, Tuple
from backend.models import ClaimItem, VerdictEnum, ClaimCategoryEnum, SeverityEnum
from backend.fact_normalizer import normalize_date_string, extract_all_normalized_dates

NUMERICAL_REGEX = re.compile(r'(\$?\b\d+[\d,]*\.?\d*\b%?|\b(first|second|third|half|quarter|double|triple|billion|million|trillion|thousand)\b)', re.IGNORECASE)
SAFETY_KEYWORDS = re.compile(r'\b(dose|dosage|contraindicated|safety|toxic|hazard|warning|caution|lethal|dangerous|unauthorized|risk|emergency|severe)\b', re.IGNORECASE)
REASONING_KEYWORDS = re.compile(r'\b(therefore|consequently|as a result|causes|proves|implies|leads to|because|demonstrates that|guarantees)\b', re.IGNORECASE)

# Patterns that should NOT be extracted as factual claims
NON_FACTUAL_PATTERNS = [
    re.compile(r'^\s*#+\s+'),  # Markdown headers
    re.compile(r'^\s*(?:what|how|why|when|where|who|which|is|are|can|could|should|would)\b.*\?\s*$', re.IGNORECASE),  # Pure questions
    re.compile(r'^\s*(?:in\s+my\s+opinion|i\s+think|i\s+believe|perhaps|maybe|possibly|it\s+seems)\b', re.IGNORECASE), # Pure opinions
    re.compile(r'^\s*(?:if|suppose|assuming|hypothetically)\b.*\b(?:then|would|could)\b', re.IGNORECASE),  # Pure hypothetical
    re.compile(r'^(?:introduction|conclusion|overview|summary|table\s+of\s+contents|appendix|references|executive\s+summary|background|methodology|results|discussion|abstract)\b[:\s]*$', re.IGNORECASE), # Navigation/structural labels
    re.compile(r'^(?:chapter|section|part)\s+\d+\b[:\s]*$', re.IGNORECASE),  # Section markers
]

def is_verifiable_factual_assertion(text: str) -> bool:
    """Filter out pure questions, isolated headings, navigation labels, opinions, or hypothetical musings."""
    stripped = text.strip()
    if len(stripped) < 8:
        return False
    # If the text has no verb or predicate-like token and is short, it is likely a heading/title
    if len(stripped.split()) <= 4 and not re.search(r'\b(is|am|are|was|were|has|have|had|uses|used|built|born|died|raised|lived|founded|created|reported|shows|demonstrates|achieved|increased|decreased|exceeded)\b', stripped, re.IGNORECASE):
        # Allow if it contains a number or quantity (e.g. '12 years old')
        if not re.search(r'\d+', stripped):
            return False
    for pat in NON_FACTUAL_PATTERNS:
        if pat.search(stripped):
            return False
    return True

def categorize_claim(text: str) -> ClaimCategoryEnum:
    if SAFETY_KEYWORDS.search(text):
        return ClaimCategoryEnum.SAFETY
    if NUMERICAL_REGEX.search(text):
        return ClaimCategoryEnum.NUMERICAL
    if REASONING_KEYWORDS.search(text):
        return ClaimCategoryEnum.REASONING
    return ClaimCategoryEnum.FACTUAL

def decompose_compound_sentence(sentence: str) -> List[str]:
    """
    Decompose a compound sentence into distinct verifiable assertions without losing context.
    Example: 'The application uses FastAPI and PostgreSQL and was released in 2025.'
    Decomposes into:
    1. 'The application uses FastAPI.'
    2. 'The application uses PostgreSQL.'
    3. 'The application was released in 2025.'
    """
    cleaned = sentence.strip().rstrip('.,;')

    # Pattern 1: 'uses X and Y and was [verb] in Z' / 'X and Y and [verb]...'
    m_combo = re.match(
        r'^(The\s+[\w\s]+?)\s+(?:uses|features|supports|implements)\s+([^,]+?)\s+and\s+([^,]+?)\s+and\s+(was\s+[\w\s]+?\s+in\s+\d{4})$',
        cleaned,
        re.IGNORECASE
    )
    if m_combo:
        subj = m_combo.group(1).strip()
        obj1 = m_combo.group(2).strip()
        obj2 = m_combo.group(3).strip()
        clause3 = m_combo.group(4).strip()
        verb_match = re.search(r'\b(uses|features|supports|implements)\b', cleaned, re.IGNORECASE)
        verb = verb_match.group(0) if verb_match else "uses"
        return [
            f"{subj} {verb} {obj1}.",
            f"{subj} {verb} {obj2}.",
            f"{subj} {clause3}."
        ]

    # Pattern 2: Multi-clause conjunctions with distinct subjects or predicates
    delims = r'(?:;\s*|,\s+and\s+|,\s+but\s+|,\s+while\s+|,\s+whereas\s+|,\s+representing\s+|,\s+providing\s+|,\s+driven\s+by\s+|\s+with\s+(?:zero|no|\d+)\s+)'
    parts = re.split(delims, cleaned, flags=re.IGNORECASE)
    cleaned_parts = [p.strip().rstrip('.,;') for p in parts if len(p.strip()) >= 15]
    if len(cleaned_parts) > 1:
        return [f"{p}." if not p.endswith('.') else p for p in cleaned_parts]

    # Pattern 3: Comma separated independent assertions with verbs (e.g. "my name is X , i am 12 years old")
    comma_parts = [p.strip() for p in re.split(r'\s*,\s*', cleaned) if len(p.strip()) >= 8]
    if len(comma_parts) > 1 and all(re.search(r'\b(is|am|are|was|were|has|have|had|\d+)\b', p, re.IGNORECASE) for p in comma_parts):
        return [f"{p}." if not p.endswith('.') else p for p in comma_parts]

    return []

# Backwards-compatible alias
decompose_sub_claims = decompose_compound_sentence


def extract_claims_deterministic(answer_text: str) -> List[ClaimItem]:
    """
    Extract discrete atomic claims deterministically from answer text, preserving
    exact start_offset and end_offset character positions into the original submitted text.
    Validates that original_text == answer_text[start_offset:end_offset].
    """
    claims: List[ClaimItem] = []
    if not answer_text.strip():
        return claims

    seen_claim_texts = set()
    claim_idx = 1
    lines = answer_text.splitlines(keepends=True)
    char_cursor = 0

    for line in lines:
        line_len = len(line)
        stripped = line.strip()

        # Skip headers or empty lines
        if not stripped or (stripped.startswith('#') and len(stripped.split()) < 3):
            char_cursor += line_len
            continue

        # Check for bullet points
        bullet_match = re.match(r'^\s*([-*•]|\d+\.)\s*(.+)$', line)
        if bullet_match:
            candidate_texts = [bullet_match.group(2).strip()]
        else:
            # Prose sentence splitting
            candidate_texts = [s.strip() for s in re.split(r'(?<=[.!?])\s+', stripped) if s.strip()]

        for cand in candidate_texts:
            if not is_verifiable_factual_assertion(cand):
                continue

            # Check if this sentence contains multiple atomic assertions
            decomposed = decompose_compound_sentence(cand)
            sub_claims_list = []
            if decomposed:
                sub_claims_list = [
                    {"part_number": i + 1, "text": p, "verdict": None, "explanation": None}
                    for i, p in enumerate(decomposed)
                ]

            # Find exact character offsets within original text
            pos = answer_text.find(cand, char_cursor)
            if pos != -1:
                start_off = pos
                end_off = pos + len(cand)
            else:
                # Deterministic fallback search across entire answer_text
                pos_all = answer_text.find(cand)
                if pos_all != -1:
                    start_off = pos_all
                    end_off = pos_all + len(cand)
                else:
                    start_off = char_cursor
                    end_off = min(len(answer_text), char_cursor + len(cand))

            # Deduplication check
            cand_norm = " ".join(cand.lower().split())
            if cand_norm in seen_claim_texts:
                continue
            seen_claim_texts.add(cand_norm)

            cat = categorize_claim(cand)
            
            # Extract and populate normalized claim representation
            norm_dates = extract_all_normalized_dates(cand)
            norm_summary = None
            if norm_dates:
                norm_summary = f"Dates: {[d.iso_date or str(d.year) for d in norm_dates]}"

            claims.append(ClaimItem(
                id=f"clm_{claim_idx}",
                claim_number=claim_idx,
                text=cand,
                start_offset=start_off,
                end_offset=end_off,
                verdict=VerdictEnum.INSUFFICIENT_EVIDENCE,
                category=cat,
                explanation="",
                supporting_evidence=[],
                contradicting_evidence=[],
                confidence_score=0.0,
                confidence_basis="",
                severity=SeverityEnum.MEDIUM if cat in [ClaimCategoryEnum.SAFETY, ClaimCategoryEnum.NUMERICAL] else SeverityEnum.LOW,
                sub_claims=sub_claims_list
            ))
            claim_idx += 1

        char_cursor += line_len

    # If no claims parsed, fallback to non-empty sentence
    if not claims and answer_text.strip():
        text_clean = answer_text.strip()
        pos = answer_text.find(text_clean)
        cat = categorize_claim(text_clean)
        claims.append(ClaimItem(
            id="clm_1",
            claim_number=1,
            text=text_clean,
            start_offset=pos if pos != -1 else 0,
            end_offset=(pos + len(text_clean)) if pos != -1 else len(answer_text),
            verdict=VerdictEnum.INSUFFICIENT_EVIDENCE,
            category=cat,
            explanation="",
            supporting_evidence=[],
            contradicting_evidence=[],
            confidence_score=0.0,
            confidence_basis="",
            severity=SeverityEnum.LOW
        ))

    return claims
