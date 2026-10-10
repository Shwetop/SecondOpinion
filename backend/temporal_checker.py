import re
import datetime
from enum import Enum
from typing import Optional, Dict, Any, Tuple
from pydantic import BaseModel
from backend.fact_normalizer import normalize_date_string, extract_all_normalized_dates

class EventModalityEnum(str, Enum):
    HISTORICAL = "HISTORICAL"             # Completed event in the past
    SCHEDULED_FUTURE = "SCHEDULED_FUTURE" # Future date or milestone
    ANNOUNCED_PLAN = "ANNOUNCED_PLAN"     # Formally announced schedule / roadmap
    CANCELLED = "CANCELLED"               # Postponed or cancelled
    ONGOING = "ONGOING"                   # Currently happening
    STATIC = "STATIC"                     # Timeless fact or principle

class TemporalAssessment(BaseModel):
    is_time_sensitive: bool = False
    modality: EventModalityEnum = EventModalityEnum.STATIC
    event_date_str: Optional[str] = None
    event_year: Optional[int] = None
    as_of_date_utc: str
    is_future_relative_to_audit: bool = False
    status_detail: str

FUTURE_KEYWORDS = re.compile(r'\b(scheduled\s+for|planned\s+for|set\s+for|to\s+take\s+place\s+in|slated\s+for|upcoming|will\s+take\s+place|projected\s+for|expected\s+in)\b', re.IGNORECASE)
ANNOUNCEMENT_KEYWORDS = re.compile(r'\b(announced|stated|reported|disclosed|confirmed\s+that|released\s+plans|statement)\b', re.IGNORECASE)
COMPLETED_PAST_KEYWORDS = re.compile(r'\b(took\s+place|occurred|concluded|completed|was\s+held|finished|achieved)\b', re.IGNORECASE)
CANCELLATION_KEYWORDS = re.compile(r'\b(cancelled|canceled|postponed|deferred|suspended|called\s+off)\b', re.IGNORECASE)

def evaluate_claim_temporality(
    claim_text: str,
    audit_timestamp_utc: Optional[str] = None
) -> TemporalAssessment:
    """
    Time-aware assessment of claims.
    Determines if a claim describes a completed past event, a future scheduled event,
    an announced plan, or a static assertion.
    Never hardcodes the current date: uses injected audit_timestamp_utc.
    """
    now_dt = datetime.datetime.fromisoformat(audit_timestamp_utc.replace("Z", "+00:00")) if audit_timestamp_utc else datetime.datetime.now(datetime.timezone.utc)
    now_year = now_dt.year
    now_month = now_dt.month

    # 1. Extract dates in claim
    dates = extract_all_normalized_dates(claim_text)
    event_date_str = None
    event_year = None
    is_future = False

    if dates:
        d = dates[0]
        event_year = d.year
        event_date_str = d.iso_date or d.raw
        if d.year > now_year or (d.year == now_year and d.month and d.month > now_month):
            is_future = True

    # 2. Determine Modality
    is_time_sensitive = bool(dates or FUTURE_KEYWORDS.search(claim_text) or COMPLETED_PAST_KEYWORDS.search(claim_text))

    if CANCELLATION_KEYWORDS.search(claim_text):
        return TemporalAssessment(
            is_time_sensitive=True,
            modality=EventModalityEnum.CANCELLED,
            event_date_str=event_date_str,
            event_year=event_year,
            as_of_date_utc=now_dt.isoformat(),
            is_future_relative_to_audit=is_future,
            status_detail="Claim describes a cancelled or postponed event."
        )

    if ANNOUNCEMENT_KEYWORDS.search(claim_text) and (FUTURE_KEYWORDS.search(claim_text) or is_future):
        return TemporalAssessment(
            is_time_sensitive=True,
            modality=EventModalityEnum.ANNOUNCED_PLAN,
            event_date_str=event_date_str,
            event_year=event_year,
            as_of_date_utc=now_dt.isoformat(),
            is_future_relative_to_audit=is_future,
            status_detail="Claim represents an announced plan or schedule, verifiable as an announcement."
        )

    if is_future:
        if COMPLETED_PAST_KEYWORDS.search(claim_text):
            # Asserting that a future event already took place! E.g. "The tournament took place in December 2026" audited in Oct 2026.
            return TemporalAssessment(
                is_time_sensitive=True,
                modality=EventModalityEnum.SCHEDULED_FUTURE,
                event_date_str=event_date_str,
                event_year=event_year,
                as_of_date_utc=now_dt.isoformat(),
                is_future_relative_to_audit=True,
                status_detail="Temporal discrepancy: Claim asserts a future-dated milestone has already completed prior to the event date."
            )
        else:
            return TemporalAssessment(
                is_time_sensitive=True,
                modality=EventModalityEnum.SCHEDULED_FUTURE,
                event_date_str=event_date_str,
                event_year=event_year,
                as_of_date_utc=now_dt.isoformat(),
                is_future_relative_to_audit=True,
                status_detail="Claim describes a future-dated scheduled event or milestone."
            )

    if event_year and event_year <= now_year:
        return TemporalAssessment(
            is_time_sensitive=True,
            modality=EventModalityEnum.HISTORICAL,
            event_date_str=event_date_str,
            event_year=event_year,
            as_of_date_utc=now_dt.isoformat(),
            is_future_relative_to_audit=False,
            status_detail="Claim describes a historical or past event."
        )

    return TemporalAssessment(
        is_time_sensitive=is_time_sensitive,
        modality=EventModalityEnum.STATIC,
        event_date_str=event_date_str,
        event_year=event_year,
        as_of_date_utc=now_dt.isoformat(),
        is_future_relative_to_audit=False,
        status_detail="Static or non-time-critical factual statement."
    )
