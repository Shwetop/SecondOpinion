"""
backend/gemini_client.py
------------------------
Factory and utilities for the google-genai (v2) Client.

Usage:
    from backend.gemini_client import build_gemini_client, gemini_semantic_entailment

The client is initialised once in main.py and passed through the pipeline.
All Gemini calls are isolated here so they can be mocked in unit tests.
"""

import json
import logging
import os
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# ── 1. Client factory ────────────────────────────────────────────────────────

def build_gemini_client(api_key: Optional[str] = None):
    """
    Build and return a google.genai.Client.

    Priority:
        1. ``api_key`` argument (e.g. from per-request AuditOptions)
        2. GEMINI_API_KEY environment variable
        3. GOOGLE_API_KEY environment variable
        4. Application Default Credentials (ADC) — used when running on GCP

    Returns None if no credential is available so the caller can fall back
    gracefully to the deterministic pipeline.
    """
    try:
        from google import genai  # google-genai v2
    except ImportError:
        logger.warning("google-genai package not installed. Gemini API calls are disabled.")
        return None

    resolved_key = (
        api_key
        or os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
    )

    try:
        if resolved_key:
            client = genai.Client(api_key=resolved_key)
        else:
            # Attempt Application Default Credentials (GCP environments)
            client = genai.Client()
        return client
    except Exception as exc:
        logger.error("Failed to build Gemini client: %s", exc)
        return None


# ── 2. Semantic entailment helper ─────────────────────────────────────────────

_ENTAILMENT_PROMPT = """\
You are a precise fact-checking assistant. Your task is to determine whether a SOURCE PASSAGE entails, contradicts, or is neutral toward a CLAIM.

RULES:
- Output ONLY a valid JSON object with exactly two keys: "relationship" and "reason".
- "relationship" must be exactly one of: "ENTAILS", "CONTRADICTS", "NEUTRAL".
- "reason" must be a single concise sentence (under 30 words).
- Do NOT add explanation outside the JSON.
- Do NOT infer information not present in the passage.
- Equivalent dates, units, or entity aliases count as ENTAILS.
- Different predicates (e.g. birthplace vs residence) must NOT be treated as CONTRADICTS.

CLAIM:
{claim}

SOURCE PASSAGE:
{passage}

Respond with JSON only:
"""

_VALID_RELATIONSHIPS = {"ENTAILS", "CONTRADICTS", "NEUTRAL"}


def gemini_semantic_entailment(
    claim_text: str,
    passage_text: str,
    client,
    model: str = "gemini-3.8-flash",
) -> Tuple[str, str]:
    """
    Ask Gemini to classify the relationship between a claim and a passage.

    Returns:
        (relationship, reason) where relationship ∈ {ENTAILS, CONTRADICTS, NEUTRAL}
        Falls back to ("NEUTRAL", "Gemini unavailable or parse error.") on any failure.
    """
    if client is None:
        return "NEUTRAL", "Gemini client not available."

    prompt = _ENTAILMENT_PROMPT.format(
        claim=claim_text.strip(),
        passage=passage_text.strip()[:2000],  # guard against very long passages
    )

    try:
        response = client.models.generate_content(
            model=model,
            contents=prompt,
        )
        raw = response.text.strip() if response.text else ""

        # Strip markdown code fences if present
        if raw.startswith("```"):
            lines = raw.splitlines()
            raw = "\n".join(
                line for line in lines if not line.startswith("```")
            ).strip()

        data = json.loads(raw)
        relationship = str(data.get("relationship", "NEUTRAL")).upper()
        reason = str(data.get("reason", "No reason provided."))

        if relationship not in _VALID_RELATIONSHIPS:
            logger.warning("Gemini returned unexpected relationship '%s'; defaulting to NEUTRAL.", relationship)
            relationship = "NEUTRAL"

        return relationship, reason

    except json.JSONDecodeError as exc:
        logger.warning("Gemini response was not valid JSON: %s | raw=%s", exc, raw[:200])
        return "NEUTRAL", "Gemini response parse error."
    except Exception as exc:
        logger.error("Gemini entailment call failed: %s", exc)
        return "NEUTRAL", f"Gemini API error: {type(exc).__name__}."
