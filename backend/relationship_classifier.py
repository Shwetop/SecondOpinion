from enum import Enum
import re
from typing import Optional, Tuple
from backend.fact_normalizer import (
    normalize_date_string, extract_all_normalized_dates,
    normalize_quantity, NormalizedDate, NormalizedQuantity
)

class FactRelationEnum(str, Enum):
    EQUIVALENT = "EQUIVALENT"
    CONTRADICTION = "CONTRADICTION"
    CONSISTENT = "CONSISTENT"
    POSSIBLE_CONFLICT = "POSSIBLE_CONFLICT"
    INSUFFICIENT_INFORMATION = "INSUFFICIENT_INFORMATION"

def classify_date_relationship(claim_date: NormalizedDate, evidence_date: NormalizedDate) -> Tuple[FactRelationEnum, str]:
    """
    Classify the relationship between two normalized dates.
    - EQUIVALENT: Both represent the same date (e.g. 19 February 1630 and February 19, 1630).
    - CONSISTENT: One specifies year 1630, the other specifies complete date in 1630.
    - CONTRADICTION: Different years (1630 vs 1631) or different months/days for the same year.
    - POSSIBLE_CONFLICT: Ambiguous format (e.g. 03/04/1630).
    """
    if claim_date.is_ambiguous or evidence_date.is_ambiguous:
        return (
            FactRelationEnum.POSSIBLE_CONFLICT,
            f"Ambiguous numeric date format ({claim_date.raw} vs {evidence_date.raw}); cannot reliably resolve day/month ordering without locale context."
        )

    # 1. Both complete dates with ISO representation
    if claim_date.iso_date and evidence_date.iso_date:
        if claim_date.iso_date == evidence_date.iso_date:
            return (
                FactRelationEnum.EQUIVALENT,
                f"Normalized dates are semantically equivalent ({claim_date.iso_date})."
            )
        else:
            return (
                FactRelationEnum.CONTRADICTION,
                f"Contradicting calendar dates: '{claim_date.raw}' ({claim_date.iso_date}) vs '{evidence_date.raw}' ({evidence_date.iso_date})."
            )

    # 2. Year-only vs complete date or year-only vs year-only
    if claim_date.year != evidence_date.year:
        return (
            FactRelationEnum.CONTRADICTION,
            f"Contradicting dates/years: '{claim_date.raw}' ({claim_date.year}) vs '{evidence_date.raw}' ({evidence_date.year})."
        )

    # Same year:
    if claim_date.is_year_only or evidence_date.is_year_only:
        # One is year-only ("in 1630"), the other is more specific ("19 February 1630")
        return (
            FactRelationEnum.CONSISTENT,
            f"Consistent: Year matches ({claim_date.year}), with one source providing more specific calendar detail."
        )

    # Both have month
    if claim_date.month and evidence_date.month:
        if claim_date.month != evidence_date.month:
            return (
                FactRelationEnum.CONTRADICTION,
                f"Contradicting months: month {claim_date.month} vs month {evidence_date.month} in year {claim_date.year}."
            )
        if claim_date.day and evidence_date.day and claim_date.day != evidence_date.day:
            return (
                FactRelationEnum.CONTRADICTION,
                f"Contradicting days: day {claim_date.day} vs day {evidence_date.day}."
            )
        if bool(claim_date.day) != bool(evidence_date.day):
            return (FactRelationEnum.CONSISTENT, "Dates are consistent: month and year match with one source providing specific day detail.")
        return (FactRelationEnum.EQUIVALENT, "Dates are consistent and semantically equivalent.")

    return (FactRelationEnum.CONSISTENT, "Dates are consistent within available granularity.")


def classify_quantity_relationship(q1: NormalizedQuantity, q2: NormalizedQuantity) -> Tuple[FactRelationEnum, str]:
    """
    Classify the relationship between two normalized quantities/measurements:
    - EQUIVALENT: 1 km vs 1000 m (same base unit and converted numeric value).
    - CONTRADICTION: Different values for same metric/base unit (e.g. 1 km vs 2000 m, or $185M vs $162M).
    - POSSIBLE_CONFLICT: One is 'approximately 100' and the other is 'exactly 100' or slightly different.
    - CONSISTENT: Non-conflicting.
    """
    if q1.category != q2.category:
        return (FactRelationEnum.CONSISTENT, "Different metric categories.")

    # Check qualifier differences: "approximately 100" vs "exactly 100" must not be treated as identical
    if (q1.qualifier == "APPROXIMATE" and q2.qualifier == "EXACT") or (q1.qualifier == "EXACT" and q2.qualifier == "APPROXIMATE"):
        if abs(q1.normalized_value - q2.normalized_value) < 1e-5:
            return (
                FactRelationEnum.POSSIBLE_CONFLICT,
                f"Qualifier distinction: one source asserts an approximation ('{q1.raw}') while the other asserts exact precision ('{q2.raw}')."
            )

    # If base units are comparable
    if q1.base_unit and q2.base_unit:
        if q1.base_unit == q2.base_unit:
            diff = abs(q1.normalized_value - q2.normalized_value)
            rel_err = diff / max(abs(q2.normalized_value), 1e-9)
            if diff < 1e-5:
                return (FactRelationEnum.EQUIVALENT, f"Equivalent measurements: {q1.raw} == {q2.raw} ({q1.normalized_value} {q1.base_unit}).")
            elif rel_err > 0.005:  # > 0.5% difference
                return (
                    FactRelationEnum.CONTRADICTION,
                    f"Contradicting quantities: {q1.raw} ({q1.normalized_value} {q1.base_unit}) vs {q2.raw} ({q2.normalized_value} {q2.base_unit})."
                )
            else:
                return (FactRelationEnum.CONSISTENT, "Minor rounding difference within tolerance.")
        else:
            return (FactRelationEnum.CONSISTENT, "Different unit dimensions.")

    # Unitless or currency/percent
    diff = abs(q1.normalized_value - q2.normalized_value)
    rel_err = diff / max(abs(q2.normalized_value), 1e-9)
    if diff < 1e-5:
        return (FactRelationEnum.EQUIVALENT, f"Values match: {q1.raw} == {q2.raw}.")
    elif rel_err > 0.005:
        return (FactRelationEnum.CONTRADICTION, f"Contradicting values: {q1.raw} vs {q2.raw}.")

    return (FactRelationEnum.CONSISTENT, "Consistent values.")


def classify_assertion_relationship(
    claim_text: str,
    evidence_text: str
) -> Tuple[FactRelationEnum, str]:
    """
    Main factual relationship classifier between claim and evidence passage.
    Returns (FactRelationEnum, explanation).
    Handles:
    - Semantic equivalence in dates ("19 February 1630" vs "February 19, 1630")
    - Year vs complete date consistency ("1630" vs "19 February 1630")
    - Year contradiction ("1630" vs "1631")
    - Different events occurring at different times ("visited Agra in 1666" vs "captured a fort in 1667") -> CONSISTENT
    - Absence of mention -> INSUFFICIENT_INFORMATION
    - Measurement equivalence ("1 km" vs "1000 m")
    - Polar contradiction
    """
    claim_clean = claim_text.strip()
    ev_clean = evidence_text.strip()

    if not ev_clean:
        return (FactRelationEnum.INSUFFICIENT_INFORMATION, "No evidence text provided to determine relationship.")

    # 1. Check Date Relationships
    claim_dates = extract_all_normalized_dates(claim_clean)
    ev_dates = extract_all_normalized_dates(ev_clean)

    if claim_dates and ev_dates:
        # Check if they discuss birth / founding / single point-in-time events
        birth_related = any(k in claim_clean.lower() for k in ["born", "birth", "founded", "established", "released", "inception"]) and \
                        any(k in ev_clean.lower() for k in ["born", "birth", "founded", "established", "released", "inception"])

        # Check for different events occurring at different dates
        # E.g., "visited Agra in 1666" vs "captured a fort in 1667"
        action_words_claim = set(re.findall(r'\b(visited|captured|signed|died|crowned|met|built|arrived|departed|founded)\b', claim_clean.lower()))
        action_words_ev = set(re.findall(r'\b(visited|captured|signed|died|crowned|met|built|arrived|departed|founded)\b', ev_clean.lower()))

        different_actions = bool(action_words_claim and action_words_ev and action_words_claim != action_words_ev)

        for cd in claim_dates:
            for ed in ev_dates:
                rel, expl = classify_date_relationship(cd, ed)
                if rel == FactRelationEnum.EQUIVALENT:
                    return FactRelationEnum.EQUIVALENT, expl
                elif rel == FactRelationEnum.CONTRADICTION:
                    if different_actions and not birth_related:
                        # Actions are different (e.g. visited Agra vs captured fort) -> statements can both be true simultaneously!
                        return (
                            FactRelationEnum.CONSISTENT,
                            f"Consistent: Different historical/operational actions occurred at different dates ({cd.raw} vs {ed.raw}). Both statements can be true simultaneously."
                        )
                    return FactRelationEnum.CONTRADICTION, expl
                elif rel == FactRelationEnum.POSSIBLE_CONFLICT:
                    return FactRelationEnum.POSSIBLE_CONFLICT, expl
                elif rel == FactRelationEnum.CONSISTENT and (birth_related or cd.year == ed.year):
                    return FactRelationEnum.CONSISTENT, expl

    return (FactRelationEnum.INSUFFICIENT_INFORMATION, "Relationship cannot be deterministically resolved from date/numeric layer alone.")
