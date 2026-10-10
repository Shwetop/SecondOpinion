import re
import uuid
from typing import List, Dict, Any, Optional
from backend.models import ClaimItem, VerdictEnum, ClaimCategoryEnum, SeverityEnum

NUMERICAL_REGEX = re.compile(r'(\$?\b\d+[\d,]*\.?\d*\b%?|\b(first|second|third|half|quarter|double|triple|billion|million|trillion|thousand)\b)', re.IGNORECASE)
SAFETY_KEYWORDS = re.compile(r'\b(dose|dosage|contraindicated|safety|toxic|hazard|warning|caution|lethal|dangerous|unauthorized|risk|emergency|severe)\b', re.IGNORECASE)
REASONING_KEYWORDS = re.compile(r'\b(therefore|consequently|as a result|causes|proves|implies|leads to|because|demonstrates that|guarantees)\b', re.IGNORECASE)

def categorize_claim(text: str) -> ClaimCategoryEnum:
    if SAFETY_KEYWORDS.search(text):
        return ClaimCategoryEnum.SAFETY
    if NUMERICAL_REGEX.search(text):
        return ClaimCategoryEnum.NUMERICAL
    if REASONING_KEYWORDS.search(text):
        return ClaimCategoryEnum.REASONING
    return ClaimCategoryEnum.FACTUAL

def decompose_sub_claims(text: str) -> List[str]:
    """
    Decompose a compound or multi-part claim into distinct verifiable sub-assertions.
    """
    delims = r'(?:;\s*|,\s+and\s+|,\s+but\s+|,\s+while\s+|,\s+whereas\s+|,\s+representing\s+|,\s+providing\s+|,\s+driven\s+by\s+|\s+with\s+(?:zero|no|\d+)\s+)'
    parts = re.split(delims, text, flags=re.IGNORECASE)
    cleaned_parts = [p.strip().rstrip('.,;') for p in parts if len(p.strip()) >= 15]
    if len(cleaned_parts) > 1:
        return cleaned_parts
    return []

def extract_claims_deterministic(answer_text: str) -> List[ClaimItem]:
    """
    Extract atomic claims deterministically from answer text, preserving
    exact start_offset and end_offset character positions.
    """
    claims: List[ClaimItem] = []
    if not answer_text.strip():
        return claims

    # Sentence boundary tokenizer that preserves spans
    # Matches sentence endings: . ! ? followed by whitespace or end of string,
    # as well as markdown list item markers.
    sentence_pattern = re.compile(r'(?:^|\n)\s*(?:[-*•]|\d+\.)\s*([^\n]+)|([^\n.!?]+(?:[.!?]+|$))', re.MULTILINE)
    
    current_search_pos = 0
    claim_idx = 1
    
    # We can also iterate by paragraphs and split sentences accurately
    lines = answer_text.splitlines(keepends=True)
    char_cursor = 0

    for line in lines:
        line_len = len(line)
        stripped = line.strip()
        
        # Skip empty lines, headers without assertions, or trivial greetings
        if not stripped or stripped.startswith('#') and len(stripped.split()) < 3:
            char_cursor += line_len
            continue
            
        # Check for bullet point
        bullet_match = re.match(r'^\s*([-*•]|\d+\.)\s*(.+)$', line)
        if bullet_match:
            bullet_content = bullet_match.group(2).strip()
            # Split bullet into sentences if long
            sentences = re.split(r'(?<=[.!?])\s+', bullet_content)
            for s in sentences:
                s_clean = s.strip()
                if len(s_clean) < 10:  # skip too short fragments
                    continue
                # Locate in answer_text
                pos = answer_text.find(s_clean, char_cursor)
                if pos != -1:
                    start_off = pos
                    end_off = pos + len(s_clean)
                else:
                    start_off = char_cursor
                    end_off = char_cursor + len(s_clean)
                
                cat = categorize_claim(s_clean)
                sub_parts = decompose_sub_claims(s_clean)
                sub_claims_list = [{"part_number": i + 1, "text": p, "verdict": None, "explanation": None} for i, p in enumerate(sub_parts)]
                claims.append(ClaimItem(
                    id=f"clm_{claim_idx}",
                    claim_number=claim_idx,
                    text=s_clean,
                    start_offset=start_off,
                    end_offset=end_off,
                    verdict=VerdictEnum.INSUFFICIENT_EVIDENCE,  # initial state
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
        else:
            # Regular prose paragraph: split into sentences
            # Regex splits on punctuation followed by space or capital
            raw_sentences = re.split(r'(?<=[.!?])\s+', stripped)
            for s in raw_sentences:
                s_clean = s.strip()
                if len(s_clean) < 12:
                    continue
                pos = answer_text.find(s_clean, char_cursor)
                if pos != -1:
                    start_off = pos
                    end_off = pos + len(s_clean)
                else:
                    start_off = char_cursor
                    end_off = char_cursor + len(s_clean)

                cat = categorize_claim(s_clean)
                sub_parts = decompose_sub_claims(s_clean)
                sub_claims_list = [{"part_number": i + 1, "text": p, "verdict": None, "explanation": None} for i, p in enumerate(sub_parts)]
                claims.append(ClaimItem(
                    id=f"clm_{claim_idx}",
                    claim_number=claim_idx,
                    text=s_clean,
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

    # If no claims parsed (e.g. single sentence without standard punctuation), use full text
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
