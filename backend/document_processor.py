import os
import re
import uuid
from typing import List, Tuple
from backend.models import SourceDocument, Passage

INJECTION_PATTERNS = [
    re.compile(r'(?i)\bignore\s+(all\s+)?(previous|prior|above)\s+instructions\b'),
    re.compile(r'(?i)\b(system\s*prompt|you\s+are\s+now|disregard\s+all\s+prior)\b'),
    re.compile(r'(?i)\[/?(inst|sys|system)\]'),
    re.compile(r'(?i)<<sys>>.*?</<sys>>', re.DOTALL),
    re.compile(r'(?i)\b(output\s+only\s+"?true"?|mark\s+this\s+claim\s+as\s+supported)\b'),
]

def sanitize_source_text(text: str) -> str:
    """
    Remove or neutralize prompt injection sequences to ensure source content
    is strictly evaluated as raw reference data, not system instructions.
    """
    if not text:
        return ""
    # Normalize unicode and whitespace
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    # Filter out excessive zero-width chars or control characters
    text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', text)
    # Neutralize prompt injection attempts
    for pat in INJECTION_PATTERNS:
        text = pat.sub('[FILTERED_INSTRUCTION]', text)
    return text

def chunk_text_into_passages(source_id: str, filename: str, full_text: str, page_number: int = 1) -> List[Passage]:
    """
    Break text into cohesive passages (paragraphs or multi-sentence blocks)
    while recording exact character offsets and page locations.
    """
    passages: List[Passage] = []
    if not full_text.strip():
        return passages

    # Split by double newlines or paragraph breaks
    raw_paragraphs = [p for p in re.split(r'\n\s*\n', full_text) if p.strip()]
    
    current_char_start = 0
    passage_num = 1

    for para in raw_paragraphs:
        cleaned_para = para.strip()
        if not cleaned_para:
            continue
        
        # Locate exact position in full_text
        found_pos = full_text.find(cleaned_para, current_char_start)
        if found_pos != -1:
            start = found_pos
            end = found_pos + len(cleaned_para)
            current_char_start = end
        else:
            start = current_char_start
            end = current_char_start + len(cleaned_para)
            current_char_start = end

        # If a single paragraph is very long (> 1200 chars), subdivide into sentences
        if len(cleaned_para) > 1200:
            sentences = re.split(r'(?<=[.!?])\s+', cleaned_para)
            sub_chunk = ""
            sub_start = start
            for sentence in sentences:
                if len(sub_chunk) + len(sentence) > 800 and sub_chunk:
                    passages.append(Passage(
                        id=f"{source_id}_p{page_number}_{passage_num}",
                        source_id=source_id,
                        filename=filename,
                        page_number=page_number,
                        passage_number=passage_num,
                        text=sub_chunk.strip(),
                        char_start=sub_start,
                        char_end=sub_start + len(sub_chunk.strip())
                    ))
                    passage_num += 1
                    sub_start = sub_start + len(sub_chunk)
                    sub_chunk = sentence + " "
                else:
                    sub_chunk += sentence + " "
            if sub_chunk.strip():
                passages.append(Passage(
                    id=f"{source_id}_p{page_number}_{passage_num}",
                    source_id=source_id,
                    filename=filename,
                    page_number=page_number,
                    passage_number=passage_num,
                    text=sub_chunk.strip(),
                    char_start=sub_start,
                    char_end=sub_start + len(sub_chunk.strip())
                ))
                passage_num += 1
        else:
            passages.append(Passage(
                id=f"{source_id}_p{page_number}_{passage_num}",
                source_id=source_id,
                filename=filename,
                page_number=page_number,
                passage_number=passage_num,
                text=cleaned_para,
                char_start=start,
                char_end=end
            ))
            passage_num += 1

    return passages

def process_plain_text(content: str, filename: str = "Pasted_Source.txt") -> SourceDocument:
    """
    Process plain text source material.
    """
    source_id = str(uuid.uuid4())[:8]
    sanitized = sanitize_source_text(content)
    passages = chunk_text_into_passages(source_id, filename, sanitized, page_number=1)
    
    return SourceDocument(
        id=source_id,
        filename=filename,
        file_type="text/plain",
        size_bytes=len(content.encode('utf-8')),
        extracted_text=sanitized,
        page_count=1,
        passage_count=len(passages),
        passages=passages
    )

def process_file(file_path: str, original_filename: str) -> SourceDocument:
    """
    Extract text and passages from a physical file (PDF, DOCX, TXT/MD).
    """
    ext = os.path.splitext(original_filename)[1].lower()
    source_id = str(uuid.uuid4())[:8]
    size_bytes = os.path.getsize(file_path) if os.path.exists(file_path) else 0

    if ext == ".pdf":
        full_text_parts = []
        all_passages = []
        page_count = 1
        
        # Try PyMuPDF first, then fall back to pypdf
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(file_path)
            page_count = len(doc)
            for page_idx in range(page_count):
                page = doc[page_idx]
                page_text = page.get_text("text")
                sanitized_page = sanitize_source_text(page_text)
                if sanitized_page.strip():
                    full_text_parts.append(f"--- [Page {page_idx + 1}] ---\n" + sanitized_page)
                    page_passages = chunk_text_into_passages(
                        source_id=source_id,
                        filename=original_filename,
                        full_text=sanitized_page,
                        page_number=page_idx + 1
                    )
                    all_passages.extend(page_passages)
            doc.close()
        except ImportError:
            try:
                import pypdf
                reader = pypdf.PdfReader(file_path)
                page_count = len(reader.pages)
                for page_idx in range(page_count):
                    page = reader.pages[page_idx]
                    page_text = page.extract_text() or ""
                    sanitized_page = sanitize_source_text(page_text)
                    if sanitized_page.strip():
                        full_text_parts.append(f"--- [Page {page_idx + 1}] ---\n" + sanitized_page)
                        page_passages = chunk_text_into_passages(
                            source_id=source_id,
                            filename=original_filename,
                            full_text=sanitized_page,
                            page_number=page_idx + 1
                        )
                        all_passages.extend(page_passages)
            except Exception as e_pdf:
                raise RuntimeError(f"Failed to extract PDF '{original_filename}': {str(e_pdf)}")
        except Exception as e:
            raise RuntimeError(f"Failed to extract PDF '{original_filename}': {str(e)}")

        combined_text = "\n\n".join(full_text_parts)
        return SourceDocument(
            id=source_id,
            filename=original_filename,
            file_type="application/pdf",
            size_bytes=size_bytes,
            extracted_text=combined_text,
            page_count=max(1, page_count),
            passage_count=len(all_passages),
            passages=all_passages
        )

    elif ext in [".docx", ".doc"]:
        try:
            import docx
            doc = docx.Document(file_path)
            paragraphs_text = []
            for p in doc.paragraphs:
                if p.text.strip():
                    paragraphs_text.append(sanitize_source_text(p.text))
            
            # Also extract tables if present
            for table in doc.tables:
                for row in table.rows:
                    row_data = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                    if row_data:
                        paragraphs_text.append(" | ".join(row_data))

            combined_text = "\n\n".join(paragraphs_text)
            all_passages = chunk_text_into_passages(
                source_id=source_id,
                filename=original_filename,
                full_text=combined_text,
                page_number=1
            )

            return SourceDocument(
                id=source_id,
                filename=original_filename,
                file_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                size_bytes=size_bytes,
                extracted_text=combined_text,
                page_count=1,
                passage_count=len(all_passages),
                passages=all_passages
            )
        except Exception as e:
            raise RuntimeError(f"Failed to extract DOCX '{original_filename}': {str(e)}")

    elif ext == ".pptx":
        return extract_pptx_slides(file_path, source_id, original_filename, size_bytes)

    elif ext in [".txt", ".md", ".json", ".csv"]:
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            return process_plain_text(content, original_filename)
        except Exception as e:
            raise RuntimeError(f"Failed to read text file '{original_filename}': {str(e)}")
    else:
        # Default try utf-8
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            return process_plain_text(content, original_filename)
        except Exception as e:
            raise RuntimeError(f"Unsupported file format '{original_filename}'. Please upload PDF, DOCX, PPTX, or TXT.")

def extract_pptx_slides(file_path: str, source_id: str, original_filename: str, size_bytes: int) -> SourceDocument:
    """
    Extract slides and text from a Microsoft PowerPoint presentation (.pptx).
    Uses standard library zipfile and xml.etree.ElementTree for robust zero-dependency extraction.
    """
    import zipfile
    import xml.etree.ElementTree as ET

    try:
        if not zipfile.is_zipfile(file_path):
            raise ValueError(f"File '{original_filename}' is not a valid PowerPoint (.pptx) zip archive.")

        full_text_parts: List[str] = []
        all_passages: List[Passage] = []

        with zipfile.ZipFile(file_path, 'r') as z:
            slide_entries = [
                name for name in z.namelist()
                if re.match(r'^ppt/slides/slide\d+\.xml$', name)
            ]

            def slide_sort_key(name: str) -> int:
                m = re.search(r'slide(\d+)\.xml$', name)
                return int(m.group(1)) if m else 999999

            slide_entries.sort(key=slide_sort_key)
            page_count = max(1, len(slide_entries))

            if not slide_entries:
                raise ValueError(f"No slide XML structures found inside presentation '{original_filename}'.")

            for page_idx, slide_name in enumerate(slide_entries):
                slide_num = page_idx + 1
                try:
                    xml_content = z.read(slide_name)
                    text_runs: List[str] = []
                    try:
                        root = ET.fromstring(xml_content)
                        for elem in root.iter():
                            if elem.tag.endswith('}t') or elem.tag == 't':
                                if elem.text and elem.text.strip():
                                    text_runs.append(elem.text.strip())
                    except ET.ParseError:
                        # Resilient fallback regex extraction for XML with unescaped entities
                        raw_str = xml_content.decode('utf-8', errors='replace')
                        matched_runs = re.findall(r'<(?:\w+:)?t[^>]*>(.*?)</(?:\w+:)?t>', raw_str, flags=re.DOTALL)
                        for mr in matched_runs:
                            clean_t = re.sub(r'<[^>]+>', '', mr).strip()
                            if clean_t:
                                text_runs.append(clean_t)

                    slide_text = " ".join(text_runs)
                    sanitized_slide = sanitize_source_text(slide_text)

                    if sanitized_slide.strip():
                        full_text_parts.append(f"--- [Slide {slide_num}] ---\n" + sanitized_slide)
                        slide_passages = chunk_text_into_passages(
                            source_id=source_id,
                            filename=original_filename,
                            full_text=sanitized_slide,
                            page_number=slide_num
                        )
                        all_passages.extend(slide_passages)
                except Exception as e_slide:
                    raise ValueError(f"Could not read slide {slide_num} in '{original_filename}': {str(e_slide)}")

        combined_text = "\n\n".join(full_text_parts)
        if not combined_text.strip():
            combined_text = "[No text found on presentation slides]"

        return SourceDocument(
            id=source_id,
            filename=original_filename,
            file_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            size_bytes=size_bytes,
            extracted_text=combined_text,
            page_count=page_count,
            passage_count=len(all_passages),
            passages=all_passages
        )
    except Exception as e:
        raise RuntimeError(f"Failed to extract PowerPoint (.pptx) '{original_filename}': {str(e)}")
