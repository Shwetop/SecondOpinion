import re
from typing import List
from backend.models import ReasoningIssue, SeverityEnum

# Causal indicators that require explicit evidence of causality rather than mere correlation
CAUSAL_INDICATORS = [
    re.compile(r'\b(directly caused|is the sole cause of|guarantees that|proves definitively that)\b', re.IGNORECASE),
    re.compile(r'\b(without any doubt|always results in|impossible to fail)\b', re.IGNORECASE),
    re.compile(r'\b(as proven by the lack of|absence of evidence proves)\b', re.IGNORECASE)  # Argument from ignorance
]

FALLACY_PATTERNS = [
    (re.compile(r'\beveryone agrees that|it is common knowledge that\b', re.IGNORECASE), "Bandwagon Appeal", SeverityEnum.LOW),
    (re.compile(r'\bthe only two options are|either .+ or .+\b', re.IGNORECASE), "False Dilemma", SeverityEnum.MEDIUM),
    (re.compile(r'\bbecause .+ therefore .+\b', re.IGNORECASE), "Causal Assertion", SeverityEnum.LOW)
]

def check_reasoning_flaws(claim_text: str, evidence_text: str = "") -> List[ReasoningIssue]:
    """
    Detect logical overreaches, absolute causal assertions, or fallacies.
    """
    issues: List[ReasoningIssue] = []

    for pat in CAUSAL_INDICATORS:
        m = pat.search(claim_text)
        if m:
            # Check if evidence mentions correlation instead of direct causation
            if evidence_text and re.search(r'\b(correlated|associated|linked|suggests|trend)\b', evidence_text, re.IGNORECASE):
                issues.append(ReasoningIssue(
                    issue_type="Correlation Confused With Causation",
                    description=f"Claim asserts absolute causality ('{m.group(0)}') whereas source indicates correlation or association.",
                    severity=SeverityEnum.HIGH
                ))
            else:
                issues.append(ReasoningIssue(
                    issue_type="Unqualified Causal Leap",
                    description=f"Claim makes an absolute causal assertion ('{m.group(0)}') that requires rigorous empirical backing.",
                    severity=SeverityEnum.MEDIUM
                ))

    for pat, name, sev in FALLACY_PATTERNS:
        if pat.search(claim_text):
            issues.append(ReasoningIssue(
                issue_type=name,
                description=f"Structural reasoning pattern detected in claim: {name}.",
                severity=sev
            ))

    return issues
