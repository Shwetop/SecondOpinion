# Second Opinion — AI Auditing Platform

**Second Opinion** is a production-quality AI auditing platform designed to audit AI-generated answers against primary source material. It detects unsupported assertions, hallucinations, factual contradictions, numerical discrepancies, logical fallacies, ambiguous statements, and potentially unsafe recommendations—with traceable, verbatim evidence for every finding.

The product adheres strictly to an **evidence first, verdict second** philosophy.

---

## 1. Key Architectural Principles

- **No Fabricated Evidence**: Every evidence quote is validated against the stored source passages. If no evidence exists in the supplied material, the system explicitly reports `INSUFFICIENT_EVIDENCE`.
- **Deterministic Verification**: Incorporates deterministic Python arithmetic checkers (percentages, currency, orders of magnitude, dates) alongside BM25 passage retrieval and semantic polarity detection.
- **Span-Preserving Inline Highlighting**: Dissects AI answers into discrete atomic claims and maps each claim to exact character offsets (`start_offset`, `end_offset`) within the preserved text.
- **Three-Panel Coordinated Review Workspace**:
  - **Left Panel (Claims Ledger)**: Searchable, filterable list of discrete claims with verdict pills and severity badges.
  - **Center Panel (Original Answer)**: Formatting-preserved original text with subtle inline highlight spans. Clicking any span focuses the claim and loads its evidence.
  - **Right Panel (Evidence Inspector)**: Shows assertion, verdict, finding explanation, verbatim primary evidence quotes with page and passage IDs, suggested corrections, and transparent confidence basis.
- **Persistent SQLite Ledger**: All audits, source documents, and claim ledgers are stored in `second_opinion.db` and persist across browser refreshes and server restarts.

---

## 2. Technology Stack

- **Frontend**:
  - React 19 + TypeScript + Vite
  - Tailwind CSS (Tailwind v4 with `@tailwindcss/vite`)
  - Lucide React icons
  - Curated research palette: `#F7F8F6` background, `#FFFFFF` surfaces, `#202522` text, `#326B55` primary accent, restrained green, muted red, warm amber
- **Backend**:
  - FastAPI + Python 3.12
  - Pydantic v2 data models
  - `pypdf` & `pymupdf` for PDF page and text extraction
  - `python-docx` for Word document processing
  - SQLite database for persistent audit history
  - BM25 text retrieval with entity and numerical boosting
  - Asynchronous background pipeline with live progress tracking

---

## 3. Getting Started

### Prerequisites
- Python 3.12+
- Node.js v18+ (tested on Node v24)
- npm 10+

### Setup Instructions

#### 1. Backend Setup

```bash
# In repository root:
python -m venv venv

# Activate virtual environment (Windows PowerShell):
.\venv\Scripts\Activate.ps1

# Install backend dependencies:
pip install fastapi uvicorn pydantic python-multipart aiofiles requests python-dotenv pypdf python-docx

# Start the FastAPI backend server:
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

#### 2. Frontend Setup

```bash
# In frontend directory:
cd frontend

# Install frontend dependencies:
npm install

# Start Vite development server:
npm run dev
```

The application will be live at: **http://127.0.0.1:5173/**  
The backend API documentation is available at: **http://127.0.0.1:8000/docs**

---

## 4. Verification Pipeline

The auditing engine executes a 5-stage pipeline:
1. **Source Processing (15%)**: Ingests PDFs, DOCX, or plain text, sanitizes prompt injections, and chunks into traceable passages with page numbers and passage IDs.
2. **Claim Extraction (35%)**: Tokenizes the AI output into atomic assertive statements while preserving exact start and end character offsets.
3. **Evidence Retrieval (55%)**: Indexes source passages with BM25 keyword scoring, entity matching, and numerical proximity boosts.
4. **Claim Verification (70–90%)**:
   - Deterministic numerical comparison (percentage differences, order of magnitude, currency).
   - Polar semantic negation detection.
   - Lexical overlap and verbatim sentence matching.
   - Reasoning flaw checks (unsupported causal leaps, false dilemmas).
   - Safety checks (unverified clinical dosages, destructive shell directives).
   - Generates suggested corrections strictly grounded in source passages.
   - Calculates transparent confidence score and evidentiary basis.
5. **Ledger Assembly (95–100%)**: Generates the final audit summary, persists the report to SQLite, and transitions to completed state.

---

## 5. API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check and engine version diagnostics |
| `GET` | `/api/settings` | Retrieve active settings and provider status |
| `POST` | `/api/settings` | Update configuration, Gemini API key, or defaults |
| `POST` | `/api/sources/upload` | Upload source file (PDF, DOCX, TXT) and extract passages |
| `POST` | `/api/sources/paste` | Submit pasted ground-truth source text |
| `POST` | `/api/audits` | Queue a new audit with background execution |
| `GET` | `/api/audits` | List all historical audits from SQLite |
| `GET` | `/api/audits/{id}` | Retrieve complete audit report and claim ledger |
| `DELETE` | `/api/audits/{id}` | Delete an audit from the SQLite database |
| `GET` | `/api/audits/{id}/export/{format}` | Export audit as `markdown`, `json`, or `html` |
| `GET` | `/api/demo/{demo_id}` | Load pre-configured sample datasets (`earnings`, `cybersecurity`) |

---

## 6. Verification Statuses

- **SUPPORTED**: All key assertions corroborated by traceable, verbatim source text.
- **CONTRADICTED**: Source passage directly refutes the claim via polar semantic conflict or deterministic mathematical discrepancy.
- **INSUFFICIENT EVIDENCE**: The supplied material does not contain enough text or data to evaluate the assertion.
- **AMBIGUOUS / MIXED**: Partial corroboration, mixed sub-clauses, or qualified approximations.

---

*Second Opinion — Evidence First, Verdict Second.*
