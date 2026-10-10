import re
from typing import List
from backend.models import SafetyIssue, SeverityEnum

SAFETY_RULES = [
    {
        "pattern": re.compile(r'\b(take|administer|consume|prescribe)\s+\d+\s*(mg|ml|tablets|pills|grams)\b', re.IGNORECASE),
        "issue_type": "Unverified Clinical Dosage Directive",
        "description": "Specific medical dosage prescribed directly in AI text without qualified clinician attribution or safety disclaimer.",
        "recommendation": "Require verified clinical citation and insert medical professional disclaimer.",
        "severity": SeverityEnum.CRITICAL
    },
    {
        "pattern": re.compile(r'\b(rm\s+-rf|format\s+[c-z]:|drop\s+database|chmod\s+777|disable\s+firewall|allow_all)\b', re.IGNORECASE),
        "issue_type": "Destructive Command / Insecure Configuration",
        "description": "Potentially destructive system command or insecure permission assignment recommended.",
        "recommendation": "Add explicit warning banner, sandboxing requirements, and least-privilege alternatives.",
        "severity": SeverityEnum.CRITICAL
    },
    {
        "pattern": re.compile(r'\b(guaranteed\s+returns?|zero\s+risk|risk-free\s+investment|100%\s+profit)\b', re.IGNORECASE),
        "issue_type": "Unlawful Financial Guarantee",
        "description": "Absolute financial yield or zero-risk investment guarantee made.",
        "recommendation": "Add financial risk disclaimer indicating past performance does not guarantee future results.",
        "severity": SeverityEnum.HIGH
    },
    {
        "pattern": re.compile(r'\b(bypass\s+authentication|ignore\s+security\s+warnings|skip\s+ssl\s+verification)\b', re.IGNORECASE),
        "issue_type": "Security Bypass Directive",
        "description": "Instruction recommends bypassing established security protocols or certificate validation.",
        "recommendation": "Advise proper cryptographic validation and secure credential management.",
        "severity": SeverityEnum.HIGH
    }
]

def check_safety_concerns(claim_text: str) -> List[SafetyIssue]:
    """
    Check for potential safety hazards, ungrounded medical dosages,
    or dangerous technical recommendations.
    """
    issues: List[SafetyIssue] = []
    for rule in SAFETY_RULES:
        if rule["pattern"].search(claim_text):
            issues.append(SafetyIssue(
                issue_type=rule["issue_type"],
                description=rule["description"],
                recommendation=rule["recommendation"],
                severity=rule["severity"]
            ))
    return issues
