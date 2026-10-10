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
from backend.relationship_classifier import (
    classify_assertion_relationship, FactRelationEnum
)
from backend.fact_normalizer import (
    normalize_date_string, extract_all_normalized_dates,
    normalize_quantity, NormalizedDate, NormalizedQuantity
)
from backend.relation_extractor import (
    extract_entity_facts, compare_entity_relationships
)
from backend.temporal_checker import (
    evaluate_claim_temporality, EventModalityEnum
)
from backend.gemini_client import gemini_semantic_entailment

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
    Guarantees:
    - Semantic equivalence in dates/units is never treated as a contradiction.
    - Year-only vs specific dates are recognized as consistent.
    - True contradictions in figures/years are captured.
    - Compatible statements about different events are recognized as neutral/consistent.
    """
    p_text = passage.text
    claim_tokens = set(tokenize(claim_text))
    p_tokens = set(tokenize(p_text))
    overlap = len(claim_tokens.intersection(p_tokens)) / max(len(claim_tokens), 1)

    # 1. First run relationship classifier on dates and normalized facts
    fact_rel, fact_expl = classify_assertion_relationship(claim_text, p_text)
    
    if fact_rel == FactRelationEnum.EQUIVALENT:
        # Recognized as equivalent meaning only if lexical overlap or topical relevance is high
        # to ensure dates aren't from unrelated facts
        if overlap >= 0.40:
            ev_quote = create_grounded_evidence_quote(
                passage=passage,
                claim_text=claim_text,
                similarity_score=top_score,
                relationship=EvidenceRelationshipEnum.ENTAILS
            )
            return EvidenceRelationshipEnum.ENTAILS, f"Corroborated: {fact_expl}", ev_quote, max(overlap, 0.6)


    if fact_rel == FactRelationEnum.CONTRADICTION:
        ev_quote = create_grounded_evidence_quote(
            passage=passage,
            claim_text=claim_text,
            similarity_score=top_score,
            relationship=EvidenceRelationshipEnum.CONTRADICTS
        )
        return EvidenceRelationshipEnum.CONTRADICTS, f"Contradiction identified: {fact_expl}", ev_quote, overlap

    # 1b. Predicate-Aware Entity & Location Relationship Check
    claim_facts = extract_entity_facts(claim_text)
    ev_facts = extract_entity_facts(p_text)
    if claim_facts and ev_facts:
        rel_type, rel_expl = compare_entity_relationships(claim_facts, ev_facts)
        if rel_type == "EQUIVALENT":
            ev_quote = create_grounded_evidence_quote(
                passage=passage,
                claim_text=claim_text,
                similarity_score=top_score,
                relationship=EvidenceRelationshipEnum.ENTAILS
            )
            return EvidenceRelationshipEnum.ENTAILS, f"Corroborated: {rel_expl}", ev_quote, max(overlap, 0.6)
        elif rel_type == "CONTRADICTION":
            ev_quote = create_grounded_evidence_quote(
                passage=passage,
                claim_text=claim_text,
                similarity_score=top_score,
                relationship=EvidenceRelationshipEnum.CONTRADICTS
            )
            return EvidenceRelationshipEnum.CONTRADICTS, f"Contradiction identified: {rel_expl}", ev_quote, overlap
        elif rel_type == "CONSISTENT":
            # Distinct predicates (e.g., born_in vs raised_in) are explicitly CONSISTENT
            fact_rel = FactRelationEnum.CONSISTENT

    # 2. Deterministic Numerical & Date Consistency Check (requires topical relevance)
    if overlap >= 0.20 or top_score >= 0.6:
        # Check numerical discrepancy
        num_analysis = check_numerical_consistency(claim_text, p_text)
        if num_analysis.has_discrepancy:
            # If the relationship classifier marked it CONSISTENT (e.g. different historical events), do not flag
            if fact_rel != FactRelationEnum.CONSISTENT:
                reason = f"Contradiction identified: {num_analysis.detail}"
                ev_quote = create_grounded_evidence_quote(
                    passage=passage,
                    claim_text=claim_text,
                    similarity_score=top_score,
                    relationship=EvidenceRelationshipEnum.CONTRADICTS
                )
                return EvidenceRelationshipEnum.CONTRADICTS, reason, ev_quote, overlap

        # 3. Polar Semantic Negation Check
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

    # 4. Grounded Entailment Check
    claim_nums = extract_numbers(claim_text)
    claim_dates = extract_dates(claim_text)

    # If claim has specific numbers, ensure they are present or semantically equivalent
    numbers_present = True
    if claim_nums:
        for _, c_raw, _ in claim_nums:
            if c_raw.lower() not in p_text.lower():
                numbers_present = False
                break

    dates_present = True
    if claim_dates:
        for cd in claim_dates:
            norm_cd = normalize_date_string(cd)
            if cd.lower() in p_text.lower():
                continue
            # Check if an equivalent date exists in passage
            p_dates = extract_all_normalized_dates(p_text)
            matched_equiv = False
            if norm_cd and p_dates:
                for pd in p_dates:
                    if norm_cd.iso_date and pd.iso_date and norm_cd.iso_date == pd.iso_date:
                        matched_equiv = True
                        break
                    elif norm_cd.year == pd.year and (norm_cd.is_year_only or pd.is_year_only):
                        matched_equiv = True
                        break
            if not matched_equiv:
                dates_present = False
                break

    # Check that named entities or key content words in claim exist in passage
    # For instance, if claim states 'Berlin' and passage states 'Paris', Berlin cannot be corroborated
    claim_words = [w for w in re.findall(r'\b[A-Za-z]{3,}\b', claim_text) if w.lower() not in {"the", "and", "was", "were", "located", "stands", "that", "this", "from", "with", "into", "year", "years"}]
    # Words with capital letter in claim:
    proper_nouns = [w for w in re.findall(r'\b[A-Z][a-z]+\b', claim_text) if w.lower() not in {"the", "this", "that", "these", "those"}]
    proper_nouns_present = True
    if proper_nouns:
        for pn in proper_nouns:
            if pn.lower() not in p_text.lower():
                proper_nouns_present = False
                break

    # Strictly grounded entailment criteria
    if overlap >= 0.40 and numbers_present and dates_present and proper_nouns_present and top_score >= 0.4:
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
    gemini_client = None,
    gemini_model: str = "gemini-3.8-flash",
) -> ClaimItem:
    """
    Verify a single atomic claim against indexed source passages using multi-passage analysis.
    Distinguishes SUPPORTED, CONTRADICTED, INSUFFICIENT_EVIDENCE, CONFLICTING_EVIDENCE, and MIXED.
    Populates normalized_claim and limitations fields.

    When ``gemini_client`` is provided, NEUTRAL passages are re-evaluated via Gemini's
    semantic entailment to reduce false INSUFFICIENT_EVIDENCE verdicts.
    Deterministic checks always run first; Gemini is a fallback layer only.
    Every definitive verdict still references evidence actually retrieved from the sources.
    """
    # Normalized representation of claim
    norm_dates = extract_all_normalized_dates(claim.text)
    if norm_dates:
        claim.normalized_claim = f"Normalized Dates: {[d.iso_date or str(d.year) for d in norm_dates]}"

    # 1. Retrieve candidates (top_k=3 balances multi-source conflict detection with fast latency)
    ranked_passages = retriever.retrieve(claim.text, top_k=3)

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

    # Temporal assessment
    temp_assessment = evaluate_claim_temporality(claim.text)
    claim.temporal_status = temp_assessment.modality.value
    if temp_assessment.is_time_sensitive:
        claim.limitations = f"Temporal context: {temp_assessment.status_detail}"

    # If claim describes a future scheduled event with completed-past phrasing (e.g. "The tournament took place in Dec 2026"), flag contradiction
    if temp_assessment.modality == EventModalityEnum.SCHEDULED_FUTURE and "took place" in claim.text.lower():
        claim.verdict = VerdictEnum.CONTRADICTED
        claim.explanation = f"Temporal inconsistency: {temp_assessment.status_detail}"
        claim.factual_verification_status = "TEMPORAL_CONTRADICTION"
        claim.internal_consistency_status = "INCONSISTENT_TIMELINE"
        claim.confidence_score = 0.90
        claim.confidence_basis = "Deterministic temporal timeline check."
        claim.severity = SeverityEnum.HIGH
        return claim

    # If no relevant passages found in source material
    if not ranked_passages or ranked_passages[0][1] < 0.20:
        claim.verdict = VerdictEnum.INSUFFICIENT_EVIDENCE
        if temp_assessment.modality in [EventModalityEnum.SCHEDULED_FUTURE, EventModalityEnum.ANNOUNCED_PLAN]:
            claim.explanation = f"Future milestone/schedule '{claim.text}' has no verified corroboration in the provided sources. Conservative abstention: not marked false."
        else:
            claim.explanation = "No sufficient supporting evidence found in the provided source material."
        claim.supporting_evidence = []
        claim.contradicting_evidence = []
        claim.suggested_correction = None
        claim.factual_verification_status = "INSUFFICIENT_EVIDENCE"
        claim.internal_consistency_status = "CONSISTENT"
        claim.limitations = "Evidence retrieval yielded zero candidate passages above relevance threshold."
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

        # ── Gemini semantic fallback for NEUTRAL passages ──────────────────────
        # Only query Gemini if the passage has topical relevance (score >= 0.30 or overlap >= 0.15)
        # to prevent wasteful external network calls on irrelevant passages.
        if rel == EvidenceRelationshipEnum.NEUTRAL and gemini_client is not None and (score >= 0.30 or overlap >= 0.15):
            g_rel, g_reason = gemini_semantic_entailment(
                claim_text=claim.text,
                passage_text=p.text,
                client=gemini_client,
                model=gemini_model,
            )
            if g_rel == "ENTAILS":
                rel = EvidenceRelationshipEnum.ENTAILS
                reason = g_reason
                quote = create_grounded_evidence_quote(
                    passage=p,
                    claim_text=claim.text,
                    similarity_score=score,
                    relationship=EvidenceRelationshipEnum.ENTAILS
                )
            elif g_rel == "CONTRADICTS":
                rel = EvidenceRelationshipEnum.CONTRADICTS
                reason = g_reason
                quote = create_grounded_evidence_quote(
                    passage=p,
                    claim_text=claim.text,
                    similarity_score=score,
                    relationship=EvidenceRelationshipEnum.CONTRADICTS
                )
        # ──────────────────────────────────────────────────────────────────────

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

                # Gemini fallback for NEUTRAL sub-claim passages
                if rel_sc == EvidenceRelationshipEnum.NEUTRAL and gemini_client is not None:
                    g_rel_sc, g_reason_sc = gemini_semantic_entailment(
                        claim_text=sc_text,
                        passage_text=p.text,
                        client=gemini_client,
                        model=gemini_model,
                    )
                    if g_rel_sc == "ENTAILS":
                        rel_sc = EvidenceRelationshipEnum.ENTAILS
                        reason_sc = g_reason_sc
                        quote_sc = create_grounded_evidence_quote(
                            passage=p, claim_text=sc_text, similarity_score=score,
                            relationship=EvidenceRelationshipEnum.ENTAILS
                        )
                    elif g_rel_sc == "CONTRADICTS":
                        rel_sc = EvidenceRelationshipEnum.CONTRADICTS
                        reason_sc = g_reason_sc
                        quote_sc = create_grounded_evidence_quote(
                            passage=p, claim_text=sc_text, similarity_score=score,
                            relationship=EvidenceRelationshipEnum.CONTRADICTS
                        )

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
        claim.limitations = "Sources materially diverge on this assertion; requires human editorial arbitration."
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
        claim.limitations = "Contradiction established against verified primary source passage."
        claim.factual_verification_status = "CONTRADICTED"
        claim.internal_consistency_status = "INCONSISTENT_WITH_SOURCE"
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
        if claim.sub_claims and len(claim.sub_claims) > 1:
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
                claim.limitations = "Corroborated across primary document text."
                claim.factual_verification_status = "SUPPORTED"
                claim.internal_consistency_status = "CONSISTENT"
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
                claim.limitations = "Compound assertion partially verified; unverified clauses require separate sourcing."
                claim.factual_verification_status = "PARTIALLY_SUPPORTED"
                claim.internal_consistency_status = "CONSISTENT"
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
            claim.limitations = "Corroborated by primary evidence passage."
            claim.factual_verification_status = "SUPPORTED"
            claim.internal_consistency_status = "CONSISTENT"

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
    claim.limitations = "Passages retrieved do not contain factual assertion needed to decide veracity."
    claim.confidence_score, claim.confidence_basis = calculate_confidence(
        verdict=VerdictEnum.INSUFFICIENT_EVIDENCE,
        retrieval_score=primary_score,
        lexical_overlap=best_overlap,
        numerical_analysis=claim.numerical_analysis,
        has_exact_quote=False
    )
    return claim
