import re
from enum import Enum
from typing import Optional, List, Dict, Any, Tuple
from pydantic import BaseModel

class LocationPredicateEnum(str, Enum):
    BORN_IN = "born_in"
    RAISED_IN = "raised_in"
    HOMETOWN = "hometown"
    LIVED_IN = "lived_in"
    CURRENTLY_LIVES_IN = "currently_lives_in"
    EDUCATED_IN = "educated_in"
    WORKED_IN = "worked_in"
    VISITED = "visited"
    LOCATED_IN = "located_in"
    HEADQUARTERED_IN = "headquartered_in"
    FOUNDED_IN = "founded_in"
    NAME_IS = "name_is"
    UNKNOWN = "unknown"

class EntityFact(BaseModel):
    subject: str
    predicate: LocationPredicateEnum
    object_value: str
    temporal_scope: Optional[str] = None  # e.g., "2020", "in childhood", "currently"
    qualifiers: Optional[str] = None
    raw_text: str

PREDICATE_PATTERNS = [
    (LocationPredicateEnum.BORN_IN, re.compile(r'\b(?:was\s+born\s+in|birthplace\s+(?:is|was)|birth\s+in)\s+([A-Z][a-zA-Z\s]+?)(?:[\.,;]|\s+in\s+\d{4}|\s+on\s+|\s+and|\s*$)', re.IGNORECASE)),
    (LocationPredicateEnum.RAISED_IN, re.compile(r'\b(?:was\s+raised\s+in|grew\s+up\s+in|brought\s+up\s+in)\s+([A-Z][a-zA-Z\s]+?)(?:[\.,;]|\s+in\s+\d{4}|\s+and|\s*$)', re.IGNORECASE)),
    (LocationPredicateEnum.HOMETOWN, re.compile(r'\b(?:hometown\s+(?:is|was)|hails\s+from)\s+([A-Z][a-zA-Z\s]+?)(?:[\.,;]|\s+and|\s*$)', re.IGNORECASE)),
    (LocationPredicateEnum.CURRENTLY_LIVES_IN, re.compile(r'\b(?:currently\s+lives?\s+in|resides?\s+in\s+presently|now\s+lives?\s+in)\s+([A-Z][a-zA-Z\s]+?)(?:[\.,;]|\s+and|\s*$)', re.IGNORECASE)),
    (LocationPredicateEnum.LIVED_IN, re.compile(r'\b(?:lived\s+in|resided\s+in|stayed\s+in)\s+([A-Z][a-zA-Z\s]+?)(?:[\.,;]|\s+in\s+\d{4}|\s+and|\s*$)', re.IGNORECASE)),
    (LocationPredicateEnum.EDUCATED_IN, re.compile(r'\b(?:studied\s+in|graduated\s+from|educated\s+at|attended\s+school\s+in)\s+([A-Z][a-zA-Z\s]+?)(?:[\.,;]|\s+and|\s*$)', re.IGNORECASE)),
    (LocationPredicateEnum.WORKED_IN, re.compile(r'\b(?:worked\s+in|employed\s+in|practiced\s+in)\s+([A-Z][a-zA-Z\s]+?)(?:[\.,;]|\s+in\s+\d{4}|\s+and|\s*$)', re.IGNORECASE)),
    (LocationPredicateEnum.VISITED, re.compile(r'\b(?:visited|travelled\s+to|traveled\s+to|journeyed\s+to)\s+([A-Z][a-zA-Z\s]+?)(?:[\.,;]|\s+in\s+\d{4}|\s+and|\s*$)', re.IGNORECASE)),
    (LocationPredicateEnum.LOCATED_IN, re.compile(r'\b(?:is\s+located\s+in|situated\s+in|based\s+in|found\s+in|tower\s+on\s+the\s+[\w\s]+?\s+in)\s+([A-Z][a-zA-Z\s]+?)(?:[\.,;]|\s+and|\s*$)', re.IGNORECASE)),
    (LocationPredicateEnum.HEADQUARTERED_IN, re.compile(r'\b(?:headquartered\s+in|hq\s+in)\s+([A-Z][a-zA-Z\s]+?)(?:[\.,;]|\s+and|\s*$)', re.IGNORECASE)),
    (LocationPredicateEnum.FOUNDED_IN, re.compile(r'\b(?:founded\s+in|established\s+in)\s+([A-Z][a-zA-Z\s]+?)(?:[\.,;]|\s+and|\s*$)', re.IGNORECASE)),
    (LocationPredicateEnum.NAME_IS, re.compile(r'\b(?:(?:my|his|her|its)\s+name\s+is|named)\s+([A-Za-z]+)', re.IGNORECASE)),
]

def extract_subject(text: str) -> str:
    """Extract primary subject entity candidate from sentence."""
    # Look for capitalized proper name at start or before verb
    m = re.match(r'^\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*|\bPerson\s+[A-Z]\b|\bChhatrapati\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b', text)
    if m:
        return m.group(1).strip()
    return "Entity"

def extract_entity_facts(text: str) -> List[EntityFact]:
    """
    Extract structured (subject, predicate, object, temporal_scope) facts
    from text regarding geographical/location relationships.
    """
    facts: List[EntityFact] = []
    subj = extract_subject(text)
    
    # Extract temporal scope if present (e.g., 'in 2020', 'currently')
    time_m = re.search(r'\b(in\s+\d{4}|currently|now|presently|in\s+childhood|during\s+college)\b', text, re.IGNORECASE)
    temporal = time_m.group(0).strip() if time_m else None

    for pred, pattern in PREDICATE_PATTERNS:
        for m in pattern.finditer(text):
            loc_candidate = m.group(1).strip()
            # Clean trailing punctuation and common words
            loc_clean = re.sub(r'\b(and|or|in|at|on|with|from)\b.*$', '', loc_candidate, flags=re.IGNORECASE).strip().rstrip('.,;')
            if loc_clean and len(loc_clean) >= 2:
                facts.append(EntityFact(
                    subject=subj,
                    predicate=pred,
                    object_value=loc_clean,
                    temporal_scope=temporal,
                    raw_text=text
                ))

    return facts

def compare_entity_relationships(
    claim_facts: List[EntityFact],
    evidence_facts: List[EntityFact]
) -> Tuple[Optional[str], Optional[str]]:
    """
    Compare facts strictly respecting predicates and temporal scopes.
    Returns (relationship_result, explanation):
    - 'EQUIVALENT': Same subject, same predicate, same location.
    - 'CONSISTENT': Different predicates (e.g. born_in vs raised_in, or currently_lives_in vs lived_in 2020),
      or compatible scopes.
    - 'CONTRADICTION': Same subject, same predicate requiring uniqueness (e.g. born_in), but different locations.
    - 'POSSIBLE_CONFLICT': Same predicate, potentially different locations with uncertain context.
    - None: No location facts to compare.
    """
    if not claim_facts or not evidence_facts:
        return None, None

    for cf in claim_facts:
        for ef in evidence_facts:
            # Check subject compatibility
            subj_match = (
                cf.subject.lower() in ef.subject.lower() or 
                ef.subject.lower() in cf.subject.lower() or
                cf.subject.lower() in ["he", "she", "they", "entity", "person x"] or
                ef.subject.lower() in ["he", "she", "they", "entity", "person x"]
            )
            if not subj_match:
                continue

            # 1. Identical predicate and identical location -> EQUIVALENT
            if cf.predicate == ef.predicate and cf.object_value.lower() == ef.object_value.lower():
                return (
                    "EQUIVALENT",
                    f"Facts agree: {cf.subject} {cf.predicate.value} {cf.object_value} matches source."
                )

            # 2. Identical predicate requiring unique single value (BORN_IN, HOMETOWN) with different location -> CONTRADICTION
            if cf.predicate == ef.predicate:
                if cf.predicate in [
                    LocationPredicateEnum.BORN_IN,
                    LocationPredicateEnum.HOMETOWN,
                    LocationPredicateEnum.LOCATED_IN,
                    LocationPredicateEnum.HEADQUARTERED_IN,
                    LocationPredicateEnum.FOUNDED_IN,
                    LocationPredicateEnum.NAME_IS,
                ]:
                    # For LOCATED_IN, check if one contains the other (e.g. "Paris" vs "Paris, France" is equivalent, not contradiction)
                    val_c = cf.object_value.strip().lower()
                    val_e = ef.object_value.strip().lower()
                    if val_c in val_e or val_e in val_c:
                        return (
                            "EQUIVALENT",
                            f"Facts agree: {cf.subject} {cf.predicate.value} '{cf.object_value}' matches source '{ef.object_value}'."
                        )
                    return (
                        "CONTRADICTION",
                        f"Contradiction on attribute '{cf.predicate.value}': Claim asserts '{cf.object_value}', but source establishes '{ef.object_value}'."
                    )
                elif cf.predicate == LocationPredicateEnum.CURRENTLY_LIVES_IN:
                    return (
                        "CONTRADICTION",
                        f"Contradiction on current residency: Claim asserts '{cf.object_value}', but source documents current residence in '{ef.object_value}'."
                    )
                elif cf.predicate == LocationPredicateEnum.LIVED_IN:
                    # Check if temporal scopes differ
                    if cf.temporal_scope and ef.temporal_scope and cf.temporal_scope != ef.temporal_scope:
                        return (
                            "CONSISTENT",
                            f"Consistent: Different residency periods ({cf.temporal_scope} in {cf.object_value} vs {ef.temporal_scope} in {ef.object_value})."
                        )
                    else:
                        return (
                            "POSSIBLE_CONFLICT",
                            f"Possible discrepancy in residency: '{cf.object_value}' vs '{ef.object_value}'."
                        )

            # 3. DIFFERENT PREDICATES: Never treat different relationships as contradictory!
            # E.g., born_in vs raised_in, born_in vs lived_in, currently_lives_in vs lived_in in 2020
            if cf.predicate != ef.predicate:
                # Example: currently lives in X vs lived in Y in 2020 -> CONSISTENT
                if (cf.predicate == LocationPredicateEnum.CURRENTLY_LIVES_IN and ef.predicate == LocationPredicateEnum.LIVED_IN) or \
                   (cf.predicate == LocationPredicateEnum.LIVED_IN and ef.predicate == LocationPredicateEnum.CURRENTLY_LIVES_IN):
                    return (
                        "CONSISTENT",
                        f"Consistent: Current residence in '{cf.object_value}' does not conflict with historical residence in '{ef.object_value}' ({ef.temporal_scope or 'past'})."
                    )

                # Example: born_in vs raised_in -> CONSISTENT
                return (
                    "CONSISTENT",
                    f"Consistent: Distinct predicates. '{cf.predicate.value}' ('{cf.object_value}') and '{ef.predicate.value}' ('{ef.object_value}') can both be true simultaneously."
                )

    return None, None
