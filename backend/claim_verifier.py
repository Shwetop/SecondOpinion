import re
import uuid
import datetime
from typing import List, Optional, Tuple, Dict, Any
from backend.models import (
    ClaimItem, SourceDocument, Passage, EvidenceQuote, EvidenceRelationshipEnum,
    VerdictEnum, ClaimCategoryEnum, SeverityEnum, AuditOptions
)
from backend.evidence_retriever import (
    BM25Retriever, find_best_sentence_quote, tokenize,
    create_grounded_evidence_quote, extract_entities_and_numbers
)
from backend.numerical_checker import check_numerical_consistency, extract_numbers, extract_dates
from backend.reasoning_checker import check_reasoning_flaws
from backend.safety_checker import check_safety_concerns
from backend.confidence import calculate_confidence

NEGATION_PAIRS = [
    (re.compile(r'\b(increased|growth|rose|surged|expanded)\b', re.IGNORECASE),
     re.compile(r'\b(decreased|declined|fell|dropped|contracted|shrank)\b', re.IGNORECASE)),
    (re.compile(r'\b(approved|authorized|cleared|granted|priority\s+review)\b', re.IGNORECASE),
     re.compile(r'\b(rejected|denied|withdrawn|prohibited|failed|standard\s+review|not\s+requested)\b', re.IGNORECASE)),
    (re.compile(r'\b(effective|successful|proven|safe)\b', re.IGNORECASE),
     re.compile(r'\b(ineffective|unsuccessful|unproven|toxic|unsafe|hazardous)\b', re.IGNORECASE)),
    (re.compile(r'\b(mandatory|required|compulsory|strictly\s+prohibited)\b', re.IGNORECASE),
     re.compile(r'\b(optional|voluntary|discretionary|permitted|recommended)\b', re.IGNORECASE)),
    (re.compile(r'\b(no|none|never|zero)\b', re.IGNORECASE),
     re.compile(r'\b(frequent|numerous|multiple|significant|reported|observed\s+in)\b', re.IGNORECASE)),
    (re.compile(r'\b(guarantees?|definitively|without\s+requiring)\b', re.IGNORECASE),
     re.compile(r'\b(does\s+not\s+guarantee|subject\s+to|uncertain|requires?)\b', re.IGNORECASE)),
    (re.compile(r'\b(disabl(?:e|ing)|bypass(?:ing)?|skip(?:ping)?)\b', re.IGNORECASE),
     re.compile(r'\b(strictly\s+prohibited|under\s+no\s+circumstances|must\s+never)\b', re.IGNORECASE)),
    (re.compile(r'\b(chmod\s+777|open\s+permissions?)\b', re.IGNORECASE),
     re.compile(r'\b(least\s+privilege|strictly\s+prohibited|not\s+allowed)\b', re.IGNORECASE)),
]

def detect_semantic_contradiction(claim_text: str, evidence_text: str) -> Optional[str]:
    """Check for polar opposite claims between claim and evidence."""
    for pos_pat, neg_pat in NEGATION_PAIRS:
        if pos_pat.search(claim_text) and neg_pat.search(evidence_text):
            m_claim = pos_pat.search(claim_text).group(0)
            m_ev = neg_pat.search(evidence_text).group(0)
            return f"Claim indicates '{m_claim}', but source explicitly documents '{m_ev}'."
        if neg_pat.search(claim_text) and pos_pat.search(evidence_text):
            m_claim = neg_pat.search(claim_text).group(0)
            m_ev = pos_pat.search(evidence_text).group(0)
            return f"Claim indicates '{m_claim}', but source explicitly documents '{m_ev}'."
    return None

def evaluate_passage_for_claim(
    claim_text: str,
    passage: Passage,
    top_score: float
) -> Tuple[EvidenceRelationshipEnum, Optional[str], Optional[EvidenceQuote], float]:
    """
    Evaluate whether a single passage ENTAILS, CONTRADICTS, or is NEUTRAL to the claim.
    Returns (relationship, reason, quote, lexical_overlap).
    """
    p_text = passage.text
    claim_tokens = set(tokenize(claim_text))
    p_tokens = set(tokenize(p_text))
    overlap = len(claim_tokens.intersection(p_tokens)) / max(len(claim_tokens), 1)

    # 1. Deterministic Numerical & Date Consistency Check (requires topical relevance)
    if overlap >= 0.20 or top_score >= 0.6:
        num_analysis = check_numerical_consistency(claim_text, p_text)
        if num_analysis.has_discrepancy:
            reason = f"Contradiction identified: {num_analysis.detail}"
            ev_quote = create_grounded_evidence_quote(
                passage=passage,
                claim_text=claim_text,
                similarity_score=top_score,
                relationship=EvidenceRelationshipEnum.CONTRADICTS
            )
            return EvidenceRelationshipEnum.CONTRADICTS, reason, ev_quote, overlap

        # 2. Polar Semantic Negation Check
        polarity_issue = detect_semantic_contradiction(claim_text, p_text)
        if polarity_issue:
            reason = f"Contradiction identified: {polarity_issue}"
            ev_quote = create_grounded_evidence_quote(
                passage=passage,
                claim_text=claim_text,
                similarity_score=top_score,
                relationship=EvidenceRelationshipEnum.CONTRADICTS
            )
            return EvidenceRelationshipEnum.CONTRADICTS, reason, ev_quote, overlap

    # 3. Grounded Entailment Check
    # A passage entails only if:
    # - It has substantial lexical/entity grounding (overlap >= 0.50 or high score >= 1.6)
    # - If claim contains numbers, ALL claim numbers must be present or corroborated in the passage
    # - If claim contains dates, dates must align
    claim_nums = extract_numbers(claim_text)
    p_nums = extract_numbers(p_text)
    claim_dates = extract_dates(claim_text)

    # If claim has specific numbers, ensure they are present in the passage
    numbers_present = True
    if claim_nums:
        for _, c_raw, _ in claim_nums:
            if c_raw.lower() not in p_text.lower():
                numbers_present = False
                break

    dates_present = True
    if claim_dates:
        for cd in claim_dates:
            if cd.lower() not in p_text.lower():
                dates_present = False
                break

    # Strictly grounded entailment criteria
    if overlap >= 0.45 and numbers_present and dates_present and top_score >= 0.5:
        reason = f"Corroborated by {passage.filename} (Page {passage.page_number or 1}). Passage directly matches key assertions."
        ev_quote = create_grounded_evidence_quote(
            passage=passage,
            claim_text=claim_text,
            similarity_score=top_score,
            relationship=EvidenceRelationshipEnum.ENTAILS
        )
        return EvidenceRelationshipEnum.ENTAILS, reason, ev_quote, overlap

    # Topic match but insufficient factual detail
    ev_quote = create_grounded_evidence_quote(
        passage=passage,
        claim_text=claim_text,
        similarity_score=top_score,
        relationship=EvidenceRelationshipEnum.NEUTRAL
    )
    return EvidenceRelationshipEnum.NEUTRAL, "Passage mentions related topic but lacks sufficient factual evidence to resolve assertion.", ev_quote, overlap

def verify_single_claim(
    claim: ClaimItem,
    retriever: BM25Retriever,
    options: AuditOptions,
    gemini_client = None
) -> ClaimItem:
    """
    Verify a single atomic claim against indexed source passages using multi-passage analysis.
    Distinguishes SUPPORTED, CONTRADICTED, INSUFFICIENT_EVIDENCE, CONFLICTING_EVIDENCE, and MIXED.
    """
    # 1. Retrieve candidates
    ranked_passages = retriever.retrieve(claim.text, top_k=5)

    # Reasoning and Safety checks
    if options.reasoning_checks:
        claim.reasoning_issues = check_reasoning_flaws(
            claim.text,
            ranked_passages[0][0].text if ranked_passages else ""
        )
    if options.safety_review:
        claim.safety_issues = check_safety_concerns(claim.text)
        if claim.safety_issues:
            highest_sev = max(
                (issue.severity for issue in claim.safety_issues),
                key=lambda s: [SeverityEnum.LOW, SeverityEnum.MEDIUM, SeverityEnum.HIGH, SeverityEnum.CRITICAL].index(s)
            )
            claim.severity = highest_sev

    # If no relevant passages found in source material
    if not ranked_passages or ranked_passages[0][1] < 0.20:
        claim.verdict = VerdictEnum.INSUFFICIENT_EVIDENCE
        claim.explanation = "No sufficient supporting evidence found in the provided source material."
        claim.supporting_evidence = []
        claim.contradicting_evidence = []
        claim.suggested_correction = None
        claim.confidence_score, claim.confidence_basis = calculate_confidence(
            verdict=VerdictEnum.INSUFFICIENT_EVIDENCE,
            retrieval_score=ranked_passages[0][1] if ranked_passages else 0.0,
            lexical_overlap=0.0,
            numerical_analysis=check_numerical_consistency(claim.text, ""),
            has_exact_quote=False
        )
        return claim

    # 2. Evaluate each retrieved candidate passage
    supporting_quotes: List[EvidenceQuote] = []
    contradicting_quotes: List[EvidenceQuote] = []
    contradiction_reasons: List[str] = []
    support_reasons: List[str] = []
    best_overlap = 0.0
    primary_passage = ranked_passages[0][0]
    primary_score = ranked_passages[0][1]

    for p, score in ranked_passages:
        rel, reason, quote, overlap = evaluate_passage_for_claim(claim.text, p, score)
        best_overlap = max(best_overlap, overlap)

        if rel == EvidenceRelationshipEnum.CONTRADICTS:
            contradicting_quotes.append(quote)
            if reason:
                contradiction_reasons.append(reason)
        elif rel == EvidenceRelationshipEnum.ENTAILS:
            supporting_quotes.append(quote)
            if reason:
                support_reasons.append(reason)

    # If full claim did not yield direct supporting quote, evaluate individual sub-clauses
    if not supporting_quotes and claim.sub_claims and len(claim.sub_claims) > 1:
        for sc in claim.sub_claims:
            sc_text = sc["text"]
            for p, score in ranked_passages:
                rel_sc, reason_sc, quote_sc, overlap_sc = evaluate_passage_for_claim(sc_text, p, score)
                best_overlap = max(best_overlap, overlap_sc)
                if rel_sc == EvidenceRelationshipEnum.ENTAILS:
                    sc["verdict"] = "SUPPORTED"
                    sc["quote"] = quote_sc.text
                    supporting_quotes.append(quote_sc)
                    support_reasons.append(f"Sub-clause '{sc_text}' corroborated by {p.filename}.")
                    break
                elif rel_sc == EvidenceRelationshipEnum.CONTRADICTS:
                    sc["verdict"] = "CONTRADICTED"
                    contradicting_quotes.append(quote_sc)
                    if reason_sc:
                        contradiction_reasons.append(reason_sc)
                    break
            if "verdict" not in sc or not sc["verdict"]:
                sc["verdict"] = "INSUFFICIENT_EVIDENCE"

    # Update numerical analysis on claim from primary candidate
    claim.numerical_analysis = check_numerical_consistency(claim.text, primary_passage.text)

    # 3. Decision Matrix
    # Case A: CONFLICTING_EVIDENCE (both supporting and contradicting sources exist)
    if supporting_quotes and contradicting_quotes:
        claim.verdict = VerdictEnum.CONFLICTING_EVIDENCE
        claim.explanation = (
            f"Conflicting evidence found across sources: {contradiction_reasons[0]} "
            f"However, other passages corroborate aspects of the claim."
        )
        claim.supporting_evidence = [supporting_quotes[0]]
        claim.contradicting_evidence = [contradicting_quotes[0]]
        claim.severity = SeverityEnum.HIGH
        claim.suggested_correction = f"Reconcile divergent source accounts: compare {contradicting_quotes[0].filename} and {supporting_quotes[0].filename}."
        claim.confidence_score, claim.confidence_basis = calculate_confidence(
            verdict=VerdictEnum.CONFLICTING_EVIDENCE,
            retrieval_score=primary_score,
            lexical_overlap=best_overlap,
            numerical_analysis=claim.numerical_analysis,
            has_exact_quote=True
        )
        return claim

    # Case B: CONTRADICTED (at least one direct contradiction, zero entailment)
    if contradicting_quotes:
        claim.verdict = VerdictEnum.CONTRADICTED
        if claim.numerical_analysis and claim.numerical_analysis.has_discrepancy:
            claim.category = ClaimCategoryEnum.NUMERICAL
        claim.explanation = contradiction_reasons[0]
        claim.severity = SeverityEnum.HIGH
        claim.contradicting_evidence = [contradicting_quotes[0]]
        claim.supporting_evidence = []
        
        contra_ev = contradicting_quotes[0]
        claim.suggested_correction = f"Revise statement according to {contra_ev.filename} (Page {contra_ev.page_number or 1}): '{contra_ev.text}'."
        claim.confidence_score, claim.confidence_basis = calculate_confidence(
            verdict=VerdictEnum.CONTRADICTED,
            retrieval_score=primary_score,
            lexical_overlap=best_overlap,
            numerical_analysis=claim.numerical_analysis,
            has_exact_quote=True
        )
        return claim

    # Case C: SUPPORTED or MIXED (supporting quotes present, zero contradictions)
    if supporting_quotes:
        # Check if multi-part claim needs decomposition
        if claim.sub_claims and len(claim.sub_claims) > 1:
            # Check each sub-part
            part_evals = []
            for part in claim.sub_claims:
                part_text = part["text"]
                part_supported = False
                for p, score in ranked_passages:
                    rel_p, _, _, _ = evaluate_passage_for_claim(part_text, p, score)
                    if rel_p == EvidenceRelationshipEnum.ENTAILS:
                        part_supported = True
                        break
                part["verdict"] = "SUPPORTED" if part_supported else "INSUFFICIENT_EVIDENCE"
                part_evals.append(part_supported)

            if all(part_evals):
                claim.verdict = VerdictEnum.SUPPORTED
                claim.explanation = f"All sub-assertions corroborated by {supporting_quotes[0].filename} (Page {supporting_quotes[0].page_number or 1})."
                claim.supporting_evidence = [supporting_quotes[0]]
                claim.contradicting_evidence = []
                claim.suggested_correction = None
            else:
                claim.verdict = VerdictEnum.MIXED
                sup_count = sum(1 for e in part_evals if e)
                claim.explanation = (
                    f"Partially supported: {sup_count} of {len(claim.sub_claims)} sub-assertions corroborated by source passages, "
                    f"while remaining clauses lack sufficient evidentiary backing."
                )
                claim.supporting_evidence = [supporting_quotes[0]]
                claim.contradicting_evidence = []
                claim.suggested_correction = f"Qualify assertion: align specifically with documented passage '{supporting_quotes[0].text}'."
                claim.confidence_score, claim.confidence_basis = calculate_confidence(
                    verdict=VerdictEnum.MIXED,
                    retrieval_score=primary_score,
                    lexical_overlap=best_overlap,
                    numerical_analysis=claim.numerical_analysis,
                    has_exact_quote=True
                )
                return claim
        else:
            claim.verdict = VerdictEnum.SUPPORTED
            claim.explanation = support_reasons[0] if support_reasons else f"Corroborated by {supporting_quotes[0].filename} (Page {supporting_quotes[0].page_number or 1})."
            claim.supporting_evidence = [supporting_quotes[0]]
            claim.contradicting_evidence = []
            claim.suggested_correction = None

        claim.confidence_score, claim.confidence_basis = calculate_confidence(
            verdict=VerdictEnum.SUPPORTED,
            retrieval_score=primary_score,
            lexical_overlap=best_overlap,
            numerical_analysis=claim.numerical_analysis,
            has_exact_quote=True
        )
        return claim

    # Case D: INSUFFICIENT_EVIDENCE (sources discuss related topic but don't resolve the claim)
    # Important: Do not infer that a claim is false simply because evidence was not found!
    claim.verdict = VerdictEnum.INSUFFICIENT_EVIDENCE
    claim.explanation = "Retrieved source passages discuss related terminology but provide insufficient evidence to corroborate or refute the specific claim."
    claim.supporting_evidence = []
    claim.contradicting_evidence = []
    claim.suggested_correction = None
    claim.confidence_score, claim.confidence_basis = calculate_confidence(
        verdict=VerdictEnum.INSUFFICIENT_EVIDENCE,
        retrieval_score=primary_score,
        lexical_overlap=best_overlap,
        numerical_analysis=claim.numerical_analysis,
        has_exact_quote=False
    )
    return claim
