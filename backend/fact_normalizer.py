import re
import datetime
from typing import Optional, Dict, Any, Tuple
from pydantic import BaseModel

MONTH_MAP = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "september": 9, "sept": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

UNIT_CONVERSIONS = {
    # Length (base unit: meter)
    "m": ("meter", 1.0),
    "meter": ("meter", 1.0),
    "meters": ("meter", 1.0),
    "metre": ("meter", 1.0),
    "metres": ("meter", 1.0),
    "km": ("meter", 1000.0),
    "kilometer": ("meter", 1000.0),
    "kilometers": ("meter", 1000.0),
    "kilometre": ("meter", 1000.0),
    "kilometres": ("meter", 1000.0),
    "cm": ("meter", 0.01),
    "centimeter": ("meter", 0.01),
    "centimeters": ("meter", 0.01),
    "mm": ("meter", 0.001),
    "millimeter": ("meter", 0.001),
    "millimeters": ("meter", 0.001),
    "mi": ("meter", 1609.344),
    "mile": ("meter", 1609.344),
    "miles": ("meter", 1609.344),
    "ft": ("meter", 0.3048),
    "foot": ("meter", 0.3048),
    "feet": ("meter", 0.3048),
    "in": ("meter", 0.0254),
    "inch": ("meter", 0.0254),
    "inches": ("meter", 0.0254),

    # Mass / Weight (base unit: gram)
    "g": ("gram", 1.0),
    "gram": ("gram", 1.0),
    "grams": ("gram", 1.0),
    "kg": ("gram", 1000.0),
    "kilogram": ("gram", 1000.0),
    "kilograms": ("gram", 1000.0),
    "mg": ("gram", 0.001),
    "milligram": ("gram", 0.001),
    "milligrams": ("gram", 0.001),
    "lb": ("gram", 453.59237),
    "lbs": ("gram", 453.59237),
    "pound": ("gram", 453.59237),
    "pounds": ("gram", 453.59237),

    # Volume (base unit: liter)
    "l": ("liter", 1.0),
    "liter": ("liter", 1.0),
    "liters": ("liter", 1.0),
    "litre": ("liter", 1.0),
    "litres": ("liter", 1.0),
    "ml": ("liter", 0.001),
    "milliliter": ("liter", 0.001),
    "milliliters": ("liter", 0.001),

    # Time (base unit: day)
    "day": ("day", 1.0),
    "days": ("day", 1.0),
    "month": ("day", 30.4375),
    "months": ("day", 30.4375),
    "year": ("day", 365.25),
    "years": ("day", 365.25),
}

QUALIFIER_APPROX = re.compile(r'\b(approximately|approx\.?|about|around|roughly|nearly|circa|c\.)\b', re.IGNORECASE)
QUALIFIER_EXACT = re.compile(r'\b(exactly|precisely|strictly|specifically)\b', re.IGNORECASE)

class NormalizedDate(BaseModel):
    raw: str
    year: int
    month: Optional[int] = None
    day: Optional[int] = None
    iso_date: Optional[str] = None  # YYYY-MM-DD if complete, or None
    is_year_only: bool = False
    is_ambiguous: bool = False

class NormalizedQuantity(BaseModel):
    raw: str
    numeric_value: float
    base_unit: Optional[str] = None
    normalized_value: float
    scale: Optional[str] = None
    category: str  # CURRENCY, PERCENTAGE, QUANTITY, YEAR
    qualifier: str  # "EXACT", "APPROXIMATE", "UNSPECIFIED"


def normalize_date_string(text: str) -> Optional[NormalizedDate]:
    """
    Parse and normalize date expressions deterministically:
    - Complete dates like "19 February 1630", "February 19, 1630", "1630-02-19" -> ISO 8601 "1630-02-19"
    - Ambiguous numeric dates like "03/04/1630" -> flagged as ambiguous without guessing
    - Year-only mentions like "1630" -> year only, is_year_only=True, no complete ISO date
    """
    text_clean = text.strip().rstrip('.,;')

    # 1. Ambiguous slash/dot format: e.g. 03/04/1630 or 04-03-1630 where both numbers <= 12
    ambig_match = re.match(r'^(\d{1,2})[/\.-](\d{1,2})[/\.-](\d{4})$', text_clean)
    if ambig_match:
        n1 = int(ambig_match.group(1))
        n2 = int(ambig_match.group(2))
        yr = int(ambig_match.group(3))
        if 1 <= n1 <= 12 and 1 <= n2 <= 12 and n1 != n2:
            return NormalizedDate(
                raw=text_clean,
                year=yr,
                month=None,
                day=None,
                iso_date=None,
                is_year_only=False,
                is_ambiguous=True
            )
        elif n1 > 12 and 1 <= n2 <= 12:
            # Day first: DD/MM/YYYY
            try:
                dt = datetime.date(yr, n2, n1)
                return NormalizedDate(raw=text_clean, year=yr, month=n2, day=n1, iso_date=dt.isoformat(), is_year_only=False)
            except ValueError:
                pass
        elif n2 > 12 and 1 <= n1 <= 12:
            # Month first: MM/DD/YYYY
            try:
                dt = datetime.date(yr, n1, n2)
                return NormalizedDate(raw=text_clean, year=yr, month=n1, day=n2, iso_date=dt.isoformat(), is_year_only=False)
            except ValueError:
                pass

    # 2. ISO 8601 format: YYYY-MM-DD
    iso_match = re.match(r'^(\d{4})-(\d{2})-(\d{2})$', text_clean)
    if iso_match:
        yr = int(iso_match.group(1))
        mo = int(iso_match.group(2))
        day = int(iso_match.group(3))
        try:
            dt = datetime.date(yr, mo, day)
            return NormalizedDate(raw=text_clean, year=yr, month=mo, day=day, iso_date=dt.isoformat(), is_year_only=False)
        except ValueError:
            pass

    # 3. Day Month Year: e.g. "19 February 1630" or "19th February 1630"
    dmy_match = re.match(r'^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})$', text_clean, re.IGNORECASE)
    if dmy_match:
        day = int(dmy_match.group(1))
        m_name = dmy_match.group(2).lower()
        yr = int(dmy_match.group(3))
        if m_name in MONTH_MAP:
            mo = MONTH_MAP[m_name]
            try:
                dt = datetime.date(yr, mo, day)
                return NormalizedDate(raw=text_clean, year=yr, month=mo, day=day, iso_date=dt.isoformat(), is_year_only=False)
            except ValueError:
                pass

    # 4. Month Day Year: e.g. "February 19, 1630" or "February 19th 1630"
    mdy_match = re.match(r'^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$', text_clean, re.IGNORECASE)
    if mdy_match:
        m_name = mdy_match.group(1).lower()
        day = int(mdy_match.group(2))
        yr = int(mdy_match.group(3))
        if m_name in MONTH_MAP:
            mo = MONTH_MAP[m_name]
            try:
                dt = datetime.date(yr, mo, day)
                return NormalizedDate(raw=text_clean, year=yr, month=mo, day=day, iso_date=dt.isoformat(), is_year_only=False)
            except ValueError:
                pass

    # 5. Month Year: e.g. "February 1630"
    my_match = re.match(r'^([A-Za-z]+),?\s+(\d{4})$', text_clean, re.IGNORECASE)
    if my_match:
        m_name = my_match.group(1).lower()
        yr = int(my_match.group(2))
        if m_name in MONTH_MAP:
            return NormalizedDate(raw=text_clean, year=yr, month=MONTH_MAP[m_name], day=None, iso_date=None, is_year_only=False)

    # 6. Year only: e.g. "1630"
    yr_match = re.match(r'^(1\d{3}|20\d{2})$', text_clean)
    if yr_match:
        yr = int(yr_match.group(1))
        return NormalizedDate(raw=text_clean, year=yr, month=None, day=None, iso_date=None, is_year_only=True)

    return None


def extract_all_normalized_dates(text: str) -> list[NormalizedDate]:
    """Find and normalize all dates within an arbitrary string."""
    dates: list[NormalizedDate] = []
    seen_spans = []

    # 1. Full dates (DMY, MDY, ISO, ambiguous slashes)
    full_pattern = re.compile(
        r'\b(?:(?:1\d{3}|20\d{2})-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])|'
        r'\d{1,2}[/\.-]\d{1,2}[/\.-](?:1\d{3}|20\d{2})|'
        r'\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+(?:1\d{3}|20\d{2})|'
        r'[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+(?:1\d{3}|20\d{2})|'
        r'[A-Za-z]+,?\s+(?:1\d{3}|20\d{2}))\b',
        re.IGNORECASE
    )

    for m in full_pattern.finditer(text):
        cand = m.group(0).strip()
        parsed = normalize_date_string(cand)
        if parsed:
            dates.append(parsed)
            seen_spans.append(m.span())

    # 2. Standalone years (excluding years attached to standards or product codes like ISO 27001:2022)
    id_pattern = re.compile(r'[a-zA-Z0-9_\-\.]+:(?:1\d{3}|20\d{2})|[a-zA-Z]+-(?:1\d{3}|20\d{2})')
    for m in id_pattern.finditer(text):
        seen_spans.append(m.span())

    year_pattern = re.compile(r'\b(1\d{3}|20\d{2})\b')
    for m in year_pattern.finditer(text):
        m_start, m_end = m.span()
        if any(s_start <= m_start and m_end <= s_end for s_start, s_end in seen_spans):
            continue
        cand = m.group(1).strip()
        parsed = normalize_date_string(cand)
        if parsed:
            dates.append(parsed)

    return dates


def normalize_quantity(raw_str: str, context: str = "") -> Optional[NormalizedQuantity]:
    """
    Parse a numeric string with optional unit and qualifier into a canonical NormalizedQuantity.
    Handles units like km -> 1000m, qualifier detection ('approximately' vs 'exactly').
    """
    cleaned = raw_str.strip()
    
    # Determine qualifier from context surrounding the quantity
    qualifier = "UNSPECIFIED"
    if context:
        if QUALIFIER_APPROX.search(context):
            qualifier = "APPROXIMATE"
        elif QUALIFIER_EXACT.search(context):
            qualifier = "EXACT"

    # Match number, scale, unit, percent, currency
    pat = re.compile(
        r'^(?P<currency>[\$\€\£\¥])?\s*(?P<num>\d+(?:,\d{3})*(?:\.\d+)?)\s*(?P<scale>billion|million|trillion|thousand)?\s*(?P<unit>[a-zA-Z]+)?\s*(?P<percent>%)?$',
        re.IGNORECASE
    )
    m = pat.match(cleaned)
    if not m:
        return None

    raw_num = m.group('num').replace(',', '')
    val = float(raw_num)
    scale = (m.group('scale') or '').lower() or None

    if scale == 'billion':
        val *= 1e9
    elif scale == 'million':
        val *= 1e6
    elif scale == 'thousand':
        val *= 1e3
    elif scale == 'trillion':
        val *= 1e12

    unit_raw = (m.group('unit') or '').lower()
    base_unit = None
    normalized_val = val

    if unit_raw in UNIT_CONVERSIONS:
        base_unit, factor = UNIT_CONVERSIONS[unit_raw]
        normalized_val = val * factor
    elif unit_raw:
        base_unit = unit_raw

    category = "QUANTITY"
    if m.group('currency') or cleaned.startswith(('$', '€', '£', '¥')):
        category = "CURRENCY"
    elif m.group('percent') or '%' in cleaned:
        category = "PERCENTAGE"

    return NormalizedQuantity(
        raw=raw_str,
        numeric_value=val,
        base_unit=base_unit,
        normalized_value=normalized_val,
        scale=scale,
        category=category,
        qualifier=qualifier
    )
