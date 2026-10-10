import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Download,
  ArrowLeft,
  Search,
  BookOpen,
  Check,
  Clock,
  FileText,
  ChevronLeft,
  ChevronRight,
  Copy,
  Layers,
  GitCompare,
  Eye,
  Table,
  LayoutGrid,
  XCircle,
  Minus,
  Info,
  Shield,
} from 'lucide-react';
import type { AuditReport, ClaimCategory, EvidenceQuote, Verdict } from '../types';
import { fetchAudit } from '../services/api';

interface AuditResultsPageProps {
  auditId: string;
  navigate: (route: string) => void;
}

/* ─── Category labels ──────────────────────────────────────────────────────── */
const CATEGORY_LABELS: Record<ClaimCategory, { label: string; abbr: string }> = {
  FACTUAL:   { label: 'Factual assertion',       abbr: 'Fact'        },
  NUMERICAL: { label: 'Quantitative assertion',  abbr: 'Quantitative' },
  REASONING: { label: 'Reasoning',               abbr: 'Reasoning'    },
  SAFETY:    { label: 'Safety guidance',         abbr: 'Safety'       },
};

/* ─── Verdict config ──────────────────────────────────────────────────────── */
type VerdictKey = 'SUPPORTED' | 'CONTRADICTED' | 'INSUFFICIENT_EVIDENCE' | 'CONFLICTING_EVIDENCE' | 'MIXED' | 'AMBIGUOUS';
type VerdictFilter = 'ALL' | 'CONTRADICTED' | 'SUPPORTED' | 'INSUFFICIENT' | 'OTHER';
const FILTER_COLORS: Record<VerdictFilter, { text: string; background: string; border: string }> = {
  ALL: { text: '#1C211E', background: '#FFFFFF', border: '#E2E5E0' },
  CONTRADICTED: { text: '#9E2626', background: '#FDF2F2', border: '#F7C4C4' },
  SUPPORTED: { text: '#1E6040', background: '#EAF5EE', border: '#B7DEC5' },
  INSUFFICIENT: { text: '#8C560D', background: '#FFFBF0', border: '#F3DCAC' },
  OTHER: { text: '#3D485C', background: '#F4F5F7', border: '#D8DCE3' },
};

interface VerdictConfig {
  label: string;
  shortLabel: string;
  Icon: React.FC<{ className?: string }>;
  // pill = inline badge
  pillBg: string; pillText: string; pillBorder: string;
  // card states
  cardBg: string; cardBorder: string;
  cardSelBg: string; cardSelBorder: string; cardSelShadow: string;
  // highlight in answer text
  hlBg: string; hlBorder: string;
  // evidence block
  evBg: string; evBorder: string; evBarColor: string;
  // table row left border
  rowBarColor: string;
}

const VC: Record<VerdictKey, VerdictConfig> = {
  SUPPORTED: {
    label: 'Supported by source',
    shortLabel: 'Supported',
    Icon: CheckCircle2,
    pillBg: '#EAF5EE', pillText: '#1E6040', pillBorder: '#B7DEC5',
    cardBg: '#FFFFFF', cardBorder: '#E2E5E0',
    cardSelBg: '#F0FAF3', cardSelBorder: '#5DAA7A', cardSelShadow: '0 0 0 2px #B7DEC5',
    hlBg: 'rgba(30,96,64,0.08)', hlBorder: '#5DAA7A',
    evBg: '#F0FAF3', evBorder: '#B7DEC5', evBarColor: '#1E6040',
    rowBarColor: '#1E6040',
  },
  CONTRADICTED: {
    label: 'Contradicted by source',
    shortLabel: 'Contradicted',
    Icon: XCircle,
    pillBg: '#FDF2F2', pillText: '#9E2626', pillBorder: '#F7C4C4',
    cardBg: '#FFFFFF', cardBorder: '#E2E5E0',
    cardSelBg: '#FEF5F5', cardSelBorder: '#E06060', cardSelShadow: '0 0 0 2px #F7C4C4',
    hlBg: 'rgba(158,38,38,0.07)', hlBorder: '#E06060',
    evBg: '#FEF5F5', evBorder: '#F7C4C4', evBarColor: '#9E2626',
    rowBarColor: '#9E2626',
  },
  CONFLICTING_EVIDENCE: {
    label: 'Conflicting evidence',
    shortLabel: 'Conflicting',
    Icon: GitCompare,
    pillBg: '#FFF4EE', pillText: '#B44D12', pillBorder: '#FAD1B8',
    cardBg: '#FFFFFF', cardBorder: '#E2E5E0',
    cardSelBg: '#FFF6F0', cardSelBorder: '#D97706', cardSelShadow: '0 0 0 2px #FAD1B8',
    hlBg: 'rgba(180,77,18,0.07)', hlBorder: '#D97706',
    evBg: '#FFF6F0', evBorder: '#FAD1B8', evBarColor: '#B44D12',
    rowBarColor: '#B44D12',
  },
  INSUFFICIENT_EVIDENCE: {
    label: 'Insufficient evidence',
    shortLabel: 'No Evidence',
    Icon: HelpCircle,
    pillBg: '#FFFBF0', pillText: '#8C560D', pillBorder: '#F3DCAC',
    cardBg: '#FFFFFF', cardBorder: '#E2E5E0',
    cardSelBg: '#FFFCF2', cardSelBorder: '#D4A040', cardSelShadow: '0 0 0 2px #F3DCAC',
    hlBg: 'rgba(140,86,13,0.07)', hlBorder: '#D4A040',
    evBg: '#FFFCF2', evBorder: '#F3DCAC', evBarColor: '#8C560D',
    rowBarColor: '#8C560D',
  },
  MIXED: {
    label: 'Mixed evidence',
    shortLabel: 'Mixed',
    Icon: Minus,
    pillBg: '#F4F5F7', pillText: '#3D485C', pillBorder: '#D8DCE3',
    cardBg: '#FFFFFF', cardBorder: '#E2E5E0',
    cardSelBg: '#F5F6F8', cardSelBorder: '#8A9AB0', cardSelShadow: '0 0 0 2px #D8DCE3',
    hlBg: 'rgba(61,72,92,0.06)', hlBorder: '#8A9AB0',
    evBg: '#F5F6F8', evBorder: '#D8DCE3', evBarColor: '#3D485C',
    rowBarColor: '#3D485C',
  },
  AMBIGUOUS: {
    label: 'Ambiguous',
    shortLabel: 'Ambiguous',
    Icon: Minus,
    pillBg: '#F4F5F7', pillText: '#3D485C', pillBorder: '#D8DCE3',
    cardBg: '#FFFFFF', cardBorder: '#E2E5E0',
    cardSelBg: '#F5F6F8', cardSelBorder: '#8A9AB0', cardSelShadow: '0 0 0 2px #D8DCE3',
    hlBg: 'rgba(61,72,92,0.06)', hlBorder: '#8A9AB0',
    evBg: '#F5F6F8', evBorder: '#D8DCE3', evBarColor: '#3D485C',
    rowBarColor: '#3D485C',
  },
};

const getVC = (v: Verdict): VerdictConfig =>
  VC[v as VerdictKey] ?? VC.AMBIGUOUS;

/* ─── VerdictPill ─────────────────────────────────────────────────────────── */
const VerdictPill: React.FC<{ verdict: Verdict; size?: 'sm' | 'md' }> = ({ verdict, size = 'sm' }) => {
  const cfg = getVC(verdict);
  const Icon = cfg.Icon;
  const px = size === 'md' ? '10px 12px' : '3px 8px';
  const fs = size === 'md' ? '12px' : '10.5px';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: px, fontSize: fs, fontWeight: 600, lineHeight: 1.4,
      background: cfg.pillBg, color: cfg.pillText,
      border: `1px solid ${cfg.pillBorder}`, borderRadius: 4,
      whiteSpace: 'nowrap',
    }}>
      <Icon className="w-3 h-3" />
      {cfg.shortLabel}
    </span>
  );
};

/* ─── SectionLabel ────────────────────────────────────────────────────────── */
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{
    fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.07em', color: '#8A928A', fontFamily: 'monospace',
    margin: '0 0 6px',
  }}>
    {children}
  </p>
);

/* ─── EvidenceBlock ───────────────────────────────────────────────────────── */
const EvidenceBlock: React.FC<{
  ev: EvidenceQuote;
  type: 'supporting' | 'contradicting';
  onSourceClick: (sourceId: string) => void;
}> = ({ ev, type, onSourceClick }) => {
  const cfg = type === 'supporting' ? VC.SUPPORTED : VC.CONTRADICTED;
  return (
    <div style={{
      border: `1px solid ${cfg.evBorder}`,
      borderRadius: 6,
      overflow: 'hidden',
      background: cfg.evBg,
    }}>
      <div style={{ display: 'flex' }}>
        <div style={{ width: 3, flexShrink: 0, background: cfg.evBarColor }} />
        <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* The quoted passage */}
          <blockquote style={{
            margin: 0, padding: 0,
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 13, lineHeight: 1.7,
            color: '#1C211E',
            fontStyle: 'italic',
          }}>
            "{ev.text}"
          </blockquote>

          {/* Surrounding context if available */}
          {(ev.context_before || ev.context_after) && (
            <div style={{
              fontSize: 11, fontFamily: 'monospace', lineHeight: 1.6,
              color: '#707770', background: 'rgba(255,255,255,0.7)',
              borderRadius: 4, padding: '8px 10px',
              border: '1px solid rgba(255,255,255,0.9)',
            }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.6, display: 'block', marginBottom: 4 }}>Surrounding passage</span>
              {ev.context_before && <span style={{ opacity: 0.55 }}>…{ev.context_before} </span>}
              <strong style={{ color: '#1C211E', fontStyle: 'normal', background: type === 'contradicting' ? 'rgba(240,180,180,0.3)' : 'rgba(180,220,190,0.3)', borderRadius: 2, padding: '0 2px' }}>{ev.text}</strong>
              {ev.context_after && <span style={{ opacity: 0.55 }}> {ev.context_after}…</span>}
            </div>
          )}

          {/* Similarity is a lexical match metric, not evidence of entailment. */}
          {ev.similarity_score > 0 && (
            <p style={{ margin: 0, fontSize: 10.5, color: '#707770', fontFamily: 'monospace' }}>
              <span title="Lexical similarity between the claim and passage. This score does not determine whether the passage supports the claim.">
                Evidence match: {Math.round(ev.similarity_score * 100)}
              </span>
              {ev.exact_match_verified ? ' · Exact phrase verified' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Footer: source provenance */}
      <div style={{
        borderTop: `1px solid ${cfg.evBorder}`,
        background: 'rgba(255,255,255,0.5)',
        padding: '7px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button type="button" onClick={() => onSourceClick(ev.source_id)}
          title="Open this source in the source viewer"
          style={{ fontSize: 11, fontWeight: 600, color: '#326B55', fontFamily: 'monospace', background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }}>
          {ev.filename}
        </button>
        <span style={{ fontSize: 10.5, color: '#8A928A', fontFamily: 'monospace' }}>
          {ev.page_number ? `Page ${ev.page_number} · ` : ''}Passage&nbsp;{ev.passage_id}
        </span>
      </div>
    </div>
  );
};

/* ─── Component ──────────────────────────────────────────────────────────── */
export const AuditResultsPage: React.FC<AuditResultsPageProps> = ({ auditId, navigate }) => {
  const [report, setReport]            = useState<AuditReport | null>(null);
  const [loading, setLoading]          = useState(true);
  const [error, setError]              = useState<string | null>(null);
  const [selectedId, setSelectedId]    = useState<string | null>(null);
  const [verdictFilter, setFilter]     = useState<VerdictFilter>('ALL');
  const [searchQ, setSearch]           = useState('');
  const [sortOrder, setSortOrder]      = useState<'claim' | 'evidence-desc' | 'evidence-asc'>('claim');
  const [documentWidth, setDocumentWidth] = useState(55);
  const [isNarrow, setIsNarrow]        = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const [layout, setLayout]            = useState<'deck' | 'table'>('deck');
  const [viewMode, setViewMode]        = useState<'standard' | 'diff'>('standard');
  const [rightTab, setRightTab]        = useState<'inspector' | 'source'>('inspector');
  const [selectedSrcId, setSelSrc]     = useState('');
  const [copied, setCopied]            = useState(false);

  // Refs for scroll-into-view on claim card selection
  const claimRailRef   = useRef<HTMLDivElement>(null);
  const claimCardRefs  = useRef<Record<string, HTMLButtonElement | null>>({});
  const answerRef      = useRef<HTMLDivElement>(null);
  const highlightRefs  = useRef<Record<string, HTMLElement | null>>({});
  const splitRef       = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await fetchAudit(auditId);
        if (!alive) return;
        setReport(d);
        if (d.claims.length)           setSelectedId(d.claims[0].id);
        if (d.source_documents.length) setSelSrc(d.source_documents[0].id);
      } catch (e: any) {
        if (alive) setError(e.message ?? 'Failed to load audit');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [auditId]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const updateLayout = (event: MediaQueryListEvent) => setIsNarrow(event.matches);
    media.addEventListener('change', updateLayout);
    return () => media.removeEventListener('change', updateLayout);
  }, []);

  // Scroll selected card into view in the rail
  useEffect(() => {
    if (!selectedId) return;
    const el = claimCardRefs.current[selectedId];
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedId]);

  // Scroll selected highlight into view in the answer panel
  useEffect(() => {
    if (!selectedId) return;
    const el = highlightRefs.current[selectedId];
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedId]);

  const claim = useMemo(() =>
    report?.claims.find(c => c.id === selectedId) ?? report?.claims[0] ?? null,
    [report, selectedId]);

  const srcDoc = useMemo(() =>
    report?.source_documents.find(d => d.id === selectedSrcId) ?? report?.source_documents[0] ?? null,
    [report, selectedSrcId]);

  const filtered = useMemo(() => {
    if (!report) return [];
    const matches = report.claims.filter(c => {
      if (searchQ.trim()) {
        const q = searchQ.toLowerCase();
        const evidenceText = [...c.supporting_evidence, ...c.contradicting_evidence]
          .map(e => `${e.text} ${e.filename}`).join(' ').toLowerCase();
        if (!c.text.toLowerCase().includes(q) && !c.explanation.toLowerCase().includes(q) && !evidenceText.includes(q)) return false;
      }
      if (verdictFilter === 'CONTRADICTED') return c.verdict === 'CONTRADICTED';
      if (verdictFilter === 'SUPPORTED')    return c.verdict === 'SUPPORTED';
      if (verdictFilter === 'INSUFFICIENT') return c.verdict === 'INSUFFICIENT_EVIDENCE';
      if (verdictFilter === 'OTHER') return c.verdict === 'MIXED' || c.verdict === 'AMBIGUOUS';
      return true;
    });
    return matches.sort((a, b) => {
      if (sortOrder === 'evidence-desc' || sortOrder === 'evidence-asc') {
        const countA = a.supporting_evidence.length + a.contradicting_evidence.length;
        const countB = b.supporting_evidence.length + b.contradicting_evidence.length;
        const delta = countB - countA;
        return (sortOrder === 'evidence-desc' ? delta : -delta) || a.claim_number - b.claim_number;
      }
      return a.claim_number - b.claim_number;
    });
  }, [report, searchQ, verdictFilter, sortOrder]);

  // Derive counts from actual claims, not summary (summary may lag)
  const counts = useMemo(() => {
    if (!report) return { total: 0, supported: 0, contradicted: 0, insufficient: 0, other: 0 };
    const total        = report.claims.length;
    const supported    = report.claims.filter(c => c.verdict === 'SUPPORTED').length;
    const contradicted = report.claims.filter(c => c.verdict === 'CONTRADICTED').length;
    const insufficient = report.claims.filter(c => c.verdict === 'INSUFFICIENT_EVIDENCE').length;
    return { total, supported, contradicted, insufficient, other: total - supported - contradicted - insufficient };
  }, [report]);

  const jump = useCallback((dir: 'prev' | 'next') => {
    if (!report?.claims.length) return;
    const i = report.claims.findIndex(c => c.id === selectedId);
    const n = dir === 'next'
      ? (i < report.claims.length - 1 ? i + 1 : 0)
      : (i > 0 ? i - 1 : report.claims.length - 1);
    setSelectedId(report.claims[n].id);
  }, [report, selectedId]);

  const openSource = (sourceId: string) => {
    setSelSrc(sourceId);
    setRightTab('source');
  };

  const resizePanels = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = splitRef.current?.getBoundingClientRect();
    if (!bounds || (isNarrow ? bounds.height === 0 : bounds.width === 0)) return;
    const position = isNarrow
      ? ((event.clientY - bounds.top) / bounds.height) * 100
      : ((event.clientX - bounds.left) / bounds.width) * 100;
    setDocumentWidth(Math.min(70, Math.max(35, position)));
  };

  const copyCitation = () => {
    if (!claim) return;
    navigator.clipboard.writeText(
      `Claim #${claim.claim_number} [${claim.verdict}]: "${claim.text}"\n\nVerdict: ${getVC(claim.verdict).label}\nFinding: ${claim.explanation}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ─── Highlighted answer text ─────────────────────────────────────────── */
  const renderAnswer = () => {
    if (!report?.answer_text) return null;
    const txt = report.answer_text;
    const sorted = [...report.claims]
      .filter(c => Number.isFinite(c.start_offset) && Number.isFinite(c.end_offset)
        && c.start_offset >= 0 && c.end_offset > c.start_offset && c.start_offset < txt.length)
      .sort((a, b) => a.start_offset - b.start_offset);
    const nodes: React.ReactNode[] = [];
    let cur = 0;

    sorted.forEach(c => {
      const start = Math.max(cur, c.start_offset);
      const end = Math.min(txt.length, c.end_offset);
      if (end <= start) return;
      if (c.start_offset > cur) {
        nodes.push(<span key={`t${cur}`}>{txt.slice(cur, c.start_offset)}</span>);
      }
      const cfg = getVC(c.verdict);
      const isSel = c.id === selectedId;
      const snip = txt.slice(start, end);

      const handleClick = () => {
        setSelectedId(c.id);
        setRightTab('inspector');
      };

      if (viewMode === 'diff' && c.verdict === 'CONTRADICTED') {
        nodes.push(
          <span key={c.id}
            ref={el => { highlightRefs.current[c.id] = el; }}
            onClick={handleClick}
            role="button" tabIndex={0} aria-label={`Claim ${c.claim_number}: contradicted`}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <span style={{
              textDecoration: 'line-through', color: '#9E2626',
              background: 'rgba(158,38,38,0.07)', padding: '1px 4px',
              borderRadius: 3,
              outline: isSel ? '2px solid #326B55' : undefined,
              outlineOffset: isSel ? 2 : undefined,
            }}>{snip}</span>
            {c.contradicting_evidence[0] && (
              <span style={{
                marginLeft: 4, color: '#1E6040',
                background: '#EAF5EE', padding: '1px 6px', borderRadius: 3,
                border: '1px solid #B7DEC5', fontSize: 11,
              }}>
                ↳ "{c.contradicting_evidence[0].text.slice(0, 60)}…"
              </span>
            )}
          </span>
        );
      } else {
        nodes.push(
          <mark key={c.id}
            ref={el => { highlightRefs.current[c.id] = el as HTMLElement; }}
            onClick={handleClick}
            role="button" tabIndex={0}
            aria-label={`Claim ${c.claim_number}: ${cfg.shortLabel}. Click to inspect.`}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
              }
            }}
            title={`Claim #${c.claim_number} — ${cfg.label}`}
            style={{
              cursor: 'pointer',
              background: cfg.hlBg,
              borderBottom: `2px solid ${cfg.hlBorder}`,
              borderRadius: '2px 2px 0 0',
              padding: '1px 2px',
              outline: isSel ? `2px solid ${cfg.hlBorder}` : undefined,
              outlineOffset: isSel ? 2 : undefined,
              transition: 'outline 0.1s',
            }}
          >
            {snip}
            <sup style={{ fontSize: 9, fontWeight: 700, fontFamily: 'monospace', marginLeft: 1, opacity: 0.65 }}>
              {c.claim_number}
            </sup>
          </mark>
        );
      }
      cur = end;
    });

    if (cur < txt.length) nodes.push(<span key="end">{txt.slice(cur)}</span>);

    return (
      <div style={{
        whiteSpace: 'pre-wrap', lineHeight: 1.85, fontSize: 14,
        color: '#1C211E', letterSpacing: '-0.01em',
      }}>
        {nodes}
      </div>
    );
  };

  /* ─── Loading ─────────────────────────────────────────────────────────── */
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        <Clock className="w-5 h-5 mx-auto animate-spin text-[#326B55]" />
        <p style={{ marginTop: 10, fontSize: 13, color: '#707770' }}>Loading audit…</p>
      </div>
    </div>
  );

  if (error || !report) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <AlertCircle className="w-8 h-8 text-[#9E2626] mx-auto" />
        <p style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: '#1C211E' }}>Unable to load audit</p>
        <p style={{ marginTop: 4, fontSize: 13, color: '#707770' }}>{error}</p>
        <button onClick={() => navigate('/')} style={{
          marginTop: 16, padding: '7px 16px', border: '1px solid #E2E5E0',
          borderRadius: 6, fontSize: 13, cursor: 'pointer', background: '#FFFFFF',
        }}>
          Back to Workspace
        </button>
      </div>
    </div>
  );

  /* ─── RENDER ─────────────────────────────────────────────────────────── */
  return (
    <div className="audit-results-page" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 3.5rem)', background: '#F7F8F6', overflow: 'hidden' }}>

      {/* ══ HEADER ════════════════════════════════════════════════════════ */}
      <header style={{
        background: '#FFFFFF', borderBottom: '1px solid #E2E5E0',
        padding: '10px 20px', flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {/* Row 1: navigation + title + controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          {/* Left: back + title block */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <button onClick={() => navigate('/')} title="Back to workspace"
              aria-label="Back to workspace"
              style={{ padding: '5px 7px', border: '1px solid #E2E5E0', borderRadius: 6, background: '#FFFFFF', cursor: 'pointer', color: '#707770', display: 'flex', alignItems: 'center' }}>
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1C211E', lineHeight: 1.3 }}>{report.title}</h1>
                <span style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                  color: report.status === 'COMPLETED' ? '#1E6040' : report.status === 'FAILED' ? '#9E2626' : '#8C560D',
                  background: report.status === 'COMPLETED' ? '#EAF5EE' : report.status === 'FAILED' ? '#FDF2F2' : '#FFFBF0',
                  border: `1px solid ${report.status === 'COMPLETED' ? '#B7DEC5' : report.status === 'FAILED' ? '#F7C4C4' : '#F3DCAC'}`,
                  borderRadius: 4, padding: '2px 6px',
                }}>
                  {report.status.replaceAll('_', ' ')}
                </span>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#8A928A', background: '#F7F8F6', border: '1px solid #E2E5E0', padding: '1px 6px', borderRadius: 4 }}>
                  {report.id}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: '#8A928A', fontFamily: 'monospace', marginTop: 2 }}>
                {report.created_at} · {report.source_documents.length} source{report.source_documents.length !== 1 ? 's' : ''} · {counts.total} claims
              </p>
            </div>
          </div>

          {/* Right: controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Verdict summary */}
            <div className="audit-summary" aria-label="Claim verdict summary">
              {[
                { value: counts.supported, label: 'Supported', color: '#1E6040', bg: '#EAF5EE', border: '#B7DEC5' },
                { value: counts.contradicted, label: 'Contradicted', color: '#9E2626', bg: '#FDF2F2', border: '#F7C4C4' },
                { value: counts.insufficient, label: 'Insufficient evidence', color: '#8C560D', bg: '#FFFBF0', border: '#F3DCAC' },
              ].map(item => (
                <div key={item.label} className="audit-summary-item" style={{ color: item.color, background: item.bg, borderColor: item.border }}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            {/* Layout toggle */}
            <div style={{ display: 'flex', border: '1px solid #E2E5E0', borderRadius: 6, overflow: 'hidden', background: '#F7F8F6' }}>
              {[
                { key: 'deck',  label: 'Deck',  Icon: LayoutGrid },
                { key: 'table', label: 'Table', Icon: Table },
              ].map(({ key, label, Icon: Ic }) => (
                <button key={key} onClick={() => setLayout(key as 'deck' | 'table')}
                  aria-pressed={layout === key}
                  aria-label={`${label} view`}
                  title={key === 'deck' ? 'Claim rail + evidence panels' : 'Full-width comparison table'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 10px', fontSize: 11, fontWeight: layout === key ? 700 : 500,
                    background: layout === key ? '#FFFFFF' : 'transparent',
                    color: layout === key ? '#1C211E' : '#707770',
                    border: 'none', cursor: 'pointer',
                    boxShadow: layout === key ? 'inset 0 0 0 1px #E2E5E0' : 'none',
                  }}>
                  <Ic className="w-3.5 h-3.5" style={{ color: '#326B55' }} />
                  {label}
                </button>
              ))}
            </div>

            {/* Export */}
            <a href={`/api/audits/${report.id}/export/markdown`} download
              title="Download full audit as Markdown"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', fontSize: 11, fontWeight: 500,
                background: '#FFFFFF', border: '1px solid #E2E5E0', borderRadius: 6,
                color: '#1C211E', textDecoration: 'none', cursor: 'pointer',
              }}>
              <Download className="w-3.5 h-3.5" style={{ color: '#326B55' }} />
              Export
            </a>
          </div>
        </div>

        {/* Row 2: assessment — subordinate */}
        {report.summary.overall_assessment && (
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 6,
            fontSize: 11.5, background: '#F7F8F6', border: '1px solid #E2E5E0',
            borderRadius: 5, padding: '5px 10px', color: '#5A625A',
          }}>
            <span style={{ fontWeight: 600, color: '#484F49', flexShrink: 0 }}>Assessment:</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {report.summary.overall_assessment}
            </span>
          </div>
        )}
      </header>

      {/* ══ DECK VIEW ════════════════════════════════════════════════════ */}
      {layout === 'deck' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

          {/* ─ Claim rail ──────────────────────────────────────────────── */}
          <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E5E0', flexShrink: 0 }}>

            {/* Rail header */}
            <div className="audit-rail-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 20px 8px' }}>
              <div className="audit-ledger-controls" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Layers className="w-3.5 h-3.5" style={{ color: '#326B55' }} />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1C211E', letterSpacing: '0.02em' }}>
                  Claim Ledger
                </span>
                <span style={{ fontSize: 11, color: '#8A928A' }}>
                  — select a claim to inspect evidence
                </span>
              </div>

              <div className="audit-rail-controls" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {/* Search */}
                <div style={{ position: 'relative' }}>
                  <Search style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#A5ABA4' }} />
                  <input
                    type="search" placeholder="Search claims or evidence" value={searchQ}
                    onChange={e => setSearch(e.target.value)}
                    aria-label="Search claims"
                    style={{
                      paddingLeft: 26, paddingRight: 10, paddingTop: 5, paddingBottom: 5,
                      fontSize: 11.5, background: '#F7F8F6', border: '1px solid #E2E5E0',
                      borderRadius: 6, outline: 'none', width: 140, color: '#1C211E',
                    }}
                  />
                </div>

                {/* Verdict filter tabs */}
                <div role="group" aria-label="Filter by verdict"
                  style={{ display: 'flex', border: '1px solid #E2E5E0', borderRadius: 6, overflow: 'hidden', background: '#F7F8F6' }}>
                  {[
                    { k: 'ALL',          label: `All · ${counts.total}` },
                    { k: 'CONTRADICTED', label: `✗ ${counts.contradicted}` },
                    { k: 'SUPPORTED',    label: `✓ ${counts.supported}` },
                    { k: 'INSUFFICIENT', label: `? ${counts.insufficient}` },
                    { k: 'OTHER',        label: `Other · ${counts.other}` },
                    { k: 'OTHER',        label: `Other · ${counts.other}` },
                  ].map(t => (
                    <button key={t.k} onClick={() => setFilter(t.k as VerdictFilter)}
                      aria-pressed={verdictFilter === t.k}
                      style={{
                        padding: '5px 10px', fontSize: 11, fontWeight: verdictFilter === t.k ? 700 : 500,
                        background: verdictFilter === t.k ? FILTER_COLORS[t.k as VerdictFilter].background : 'transparent',
                        color: verdictFilter === t.k ? FILTER_COLORS[t.k as VerdictFilter].text : '#707770',
                        border: 'none', cursor: 'pointer',
                        boxShadow: verdictFilter === t.k ? `inset 0 0 0 1px ${FILTER_COLORS[t.k as VerdictFilter].border}` : 'none',
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: '#707770', whiteSpace: 'nowrap' }}>
                  Sort
                  <select value={sortOrder} onChange={e => setSortOrder(e.target.value as typeof sortOrder)}
                    aria-label="Sort claims"
                    style={{ padding: '5px 7px', fontSize: 11, color: '#1C211E', background: '#FFFFFF', border: '1px solid #E2E5E0', borderRadius: 5 }}>
                    <option value="claim">Claim order</option>
                    <option value="evidence-desc">Most evidence</option>
                    <option value="evidence-asc">Least evidence</option>
                  </select>
                </label>

                {/* Prev / Next */}
                <div style={{ display: 'flex', gap: 2 }}>
                  {[
                    { dir: 'prev' as const, Icon: ChevronLeft, label: 'Previous claim' },
                    { dir: 'next' as const, Icon: ChevronRight, label: 'Next claim' },
                  ].map(({ dir, Icon: Ic, label }) => (
                    <button key={dir} onClick={() => jump(dir)} aria-label={label}
                      style={{ padding: '4px 6px', border: '1px solid #E2E5E0', borderRadius: 5, background: '#FFFFFF', cursor: 'pointer', color: '#8A928A', display: 'flex', alignItems: 'center' }}>
                      <Ic className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Claim cards */}
            <div ref={claimRailRef}
              style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 20px 12px', scrollSnapType: 'x mandatory' }}>
              {filtered.length === 0 ? (
                <p style={{ padding: '12px 0', fontSize: 12, color: '#707770' }}>No claims match the current search and filters.</p>
              ) : filtered.map(c => {
                const cfg = getVC(c.verdict);
                const isSel = c.id === selectedId;
                const evCount = c.supporting_evidence.length + c.contradicting_evidence.length;
                const catLabel = CATEGORY_LABELS[c.category]?.abbr ?? c.category;
                const sourceCount = new Set([...c.supporting_evidence, ...c.contradicting_evidence].map(e => e.source_id)).size;

                return (
                  <button
                    key={c.id}
                    ref={el => { claimCardRefs.current[c.id] = el; }}
                    onClick={() => { setSelectedId(c.id); setRightTab('inspector'); }}
                    aria-pressed={isSel}
                    aria-label={`Claim ${c.claim_number}, ${CATEGORY_LABELS[c.category]?.label ?? c.category}, ${cfg.shortLabel}, ${evCount} evidence excerpts from ${sourceCount} sources. ${c.text}`}
                    className={`audit-claim-card${isSel ? ' is-selected' : ''}`}
                    style={{
                      minWidth: 240, maxWidth: 240,
                      scrollSnapAlign: 'start',
                      display: 'flex', flexDirection: 'column', gap: 8,
                      padding: '12px 14px',
                      borderRadius: 7,
                      border: `1px solid ${isSel ? cfg.cardSelBorder : cfg.cardBorder}`,
                      background: isSel ? cfg.cardSelBg : cfg.cardBg,
                      boxShadow: isSel ? cfg.cardSelShadow : '0 1px 2px rgba(0,0,0,0.04)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'border-color 0.12s, box-shadow 0.12s',
                      flexShrink: 0,
                    }}
                  >
                    {/* Row 1: number + verdict */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10.5, fontFamily: 'monospace', fontWeight: 700, color: '#8A928A' }}>
                        #{c.claim_number}
                      </span>
                      <VerdictPill verdict={c.verdict} />
                    </div>

                    {/* Row 2: claim text */}
                    <p style={{
                      margin: 0, fontSize: 12.5, lineHeight: 1.55, color: '#1C211E',
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden', flex: 1,
                    }}>
                      {c.text}
                    </p>

                    {/* Row 3: meta */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontFamily: 'monospace', color: '#8A928A' }}>
                      <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{catLabel}</span>
                      <span>{evCount} evidence · {sourceCount} source{sourceCount !== 1 ? 's' : ''}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─ Two panels ────────────────────────────────────────────────── */}
          <div ref={splitRef} className={`audit-workspace-split${isNarrow ? ' is-narrow' : ''}`} style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

            {/* Panel A — Answer text (55%) */}
            <div className="audit-document-panel" style={{
              width: isNarrow ? '100%' : `${documentWidth}%`,
              height: isNarrow ? `${documentWidth}%` : '100%',
              flex: `0 0 ${documentWidth}%`, minWidth: 0, minHeight: 0,
              display: 'flex', flexDirection: 'column',
              borderRight: isNarrow ? 'none' : '1px solid #E2E5E0',
              borderBottom: isNarrow ? '1px solid #E2E5E0' : 'none',
              background: '#FFFFFF', overflow: 'hidden',
            }}>
              {/* Panel header */}
              <div style={{
                padding: '8px 16px', borderBottom: '1px solid #E2E5E0', background: '#FAFAF9',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText className="w-3.5 h-3.5" style={{ color: '#8A928A' }} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1C211E', letterSpacing: '0.02em' }}>Original Answer</span>
                  <span style={{ fontSize: 11, color: '#8A928A' }}>— click highlighted text to select claim</span>
                </div>
                {/* Standard / Diff toggle */}
                <div style={{ display: 'flex', border: '1px solid #E2E5E0', borderRadius: 5, overflow: 'hidden', background: '#F7F8F6' }}>
                  {[
                    { key: 'standard', label: 'View', Icon: Eye },
                    { key: 'diff',     label: 'Diff', Icon: GitCompare },
                  ].map(({ key, label, Icon: Ic }) => (
                    <button key={key} onClick={() => setViewMode(key as 'standard' | 'diff')}
                      aria-pressed={viewMode === key}
                      aria-label={`${label} document view`}
                      title={key === 'diff' ? 'Show contradictions with source corrections inline' : 'Standard highlighted view'}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 9px', fontSize: 11, fontWeight: viewMode === key ? 700 : 500,
                        background: viewMode === key ? '#FFFFFF' : 'transparent',
                        color: viewMode === key ? '#1C211E' : '#707770',
                        border: 'none', cursor: 'pointer',
                      }}>
                      <Ic className="w-3 h-3" style={{ color: '#326B55' }} />{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Answer content */}
              <div ref={answerRef} className="audit-document-scroll" style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
                <div style={{ padding: '18px 20px', background: '#FAFAF9', border: '1px solid #E2E5E0', borderRadius: 6 }}>
                  {renderAnswer()}
                </div>
                {/* Legend */}
                <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 10.5, color: '#707770', flexWrap: 'wrap' }}>
                  {[
                    { color: '#1E6040', label: 'Supported' },
                    { color: '#9E2626', label: 'Contradicted' },
                    { color: '#8C560D', label: 'No Evidence' },
                  ].map(({ color, label }) => (
                    <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 12, height: 3, borderRadius: 2, background: color, display: 'inline-block' }} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div
              className="audit-panel-divider"
              role="separator"
              aria-label="Resize document and evidence panels"
              aria-orientation={isNarrow ? 'horizontal' : 'vertical'}
              aria-valuemin={35}
              aria-valuemax={70}
              aria-valuenow={Math.round(documentWidth)}
              tabIndex={0}
              onPointerDown={e => {
                e.currentTarget.setPointerCapture(e.pointerId);
                resizePanels(e);
              }}
              onPointerMove={e => {
                if (e.buttons === 1) resizePanels(e);
              }}
              onKeyDown={e => {
                const decreaseKey = isNarrow ? 'ArrowUp' : 'ArrowLeft';
                const increaseKey = isNarrow ? 'ArrowDown' : 'ArrowRight';
                if (e.key === decreaseKey || e.key === increaseKey) {
                  e.preventDefault();
                  setDocumentWidth(width => Math.min(70, Math.max(35, width + (e.key === increaseKey ? 2 : -2))));
                }
              }}
              title={`Drag to resize panels; use ${isNarrow ? 'up and down' : 'left and right'} arrow keys`}
            />

            {/* Panel B — Evidence inspector (45%) */}
            <div className="audit-evidence-panel" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#FFFFFF', overflow: 'hidden' }}>
              {/* Panel header */}
              <div style={{
                padding: '8px 16px', borderBottom: '1px solid #E2E5E0', background: '#FAFAF9',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BookOpen className="w-3.5 h-3.5" style={{ color: '#326B55' }} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1C211E', letterSpacing: '0.02em' }}>Evidence Inspector</span>
                  {claim && (
                    <span style={{ fontSize: 10.5, fontFamily: 'monospace', background: '#F7F8F6', border: '1px solid #E2E5E0', padding: '1px 6px', borderRadius: 3, color: '#5A625A' }}>
                      Claim #{claim.claim_number}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', border: '1px solid #E2E5E0', borderRadius: 5, overflow: 'hidden', background: '#F7F8F6' }}>
                  {[
                    { key: 'inspector', label: 'Breakdown' },
                    { key: 'source',    label: 'Source File' },
                  ].map(({ key, label }) => (
                    <button key={key} onClick={() => setRightTab(key as 'inspector' | 'source')}
                      aria-pressed={rightTab === key}
                      aria-label={`Show ${label.toLowerCase()}`}
                      style={{
                        padding: '4px 10px', fontSize: 11, fontWeight: rightTab === key ? 700 : 500,
                        background: rightTab === key ? '#FFFFFF' : 'transparent',
                        color: rightTab === key ? '#1C211E' : '#707770',
                        border: 'none', cursor: 'pointer',
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inspector content */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {rightTab === 'source' ? (
                  /* Source file viewer */
                  <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: '#8A928A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Source:</span>
                      <select value={selectedSrcId} onChange={e => setSelSrc(e.target.value)}
                        aria-label="Select source document"
                        style={{ fontSize: 12, background: '#F7F8F6', border: '1px solid #E2E5E0', borderRadius: 6, padding: '5px 8px', color: '#1C211E' }}>
                        {report.source_documents.map(d => <option key={d.id} value={d.id}>{d.filename}</option>)}
                      </select>
                    </div>
                    {srcDoc && (
                      <>
                        <div style={{ display: 'flex', gap: 12, fontSize: 11, fontFamily: 'monospace', color: '#8A928A', background: '#F7F8F6', border: '1px solid #E2E5E0', borderRadius: 5, padding: '6px 12px' }}>
                          <span>{srcDoc.page_count} page{srcDoc.page_count !== 1 ? 's' : ''}</span>
                          <span>·</span>
                          <span>{srcDoc.passage_count} passages</span>
                          <span>·</span>
                          <span>{Math.round(srcDoc.size_bytes / 1024)} KB</span>
                        </div>
                        <div style={{
                          border: '1px solid #E2E5E0', borderRadius: 6, padding: '14px 16px',
                          background: '#FAFAF9', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 13,
                          lineHeight: 1.75, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: '#1C211E',
                        }}>
                          {srcDoc.extracted_text}
                        </div>
                      </>
                    )}
                  </div>
                ) : claim ? (
                  /* Forensic breakdown */
                  <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>

                    {/* ① Claim being verified */}
                    <section>
                      <SectionLabel>① Claim being verified</SectionLabel>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: '#8A928A' }}>
                          #{claim.claim_number} · {CATEGORY_LABELS[claim.category]?.label ?? claim.category}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <VerdictPill verdict={claim.verdict} size="md" />
                          <button onClick={copyCitation} title="Copy claim and finding to clipboard"
                            style={{ fontSize: 11, color: '#326B55', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, padding: '2px 0' }}>
                            <Copy className="w-3 h-3" />{copied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>
                      <div style={{
                        background: '#FAFAF9', border: '1px solid #E2E5E0', borderRadius: 6,
                        padding: '12px 14px', fontSize: 13.5, lineHeight: 1.65, color: '#1C211E', fontWeight: 500,
                      }}>
                        "{claim.text}"
                      </div>
                    </section>

                    {/* ② Verdict and explanation */}
                    <section>
                      <SectionLabel>② Verdict and finding</SectionLabel>
                      <div style={{ background: '#FFFFFF', border: '1px solid #E2E5E0', borderRadius: 6, padding: '12px 14px', fontSize: 13, lineHeight: 1.7, color: '#1C211E' }}>
                        {claim.explanation}
                      </div>

                      {/* Suggested correction */}
                      {claim.suggested_correction && (
                        <div style={{ marginTop: 8, background: '#EAF5EE', border: '1px solid #B7DEC5', borderRadius: 6, padding: '10px 14px' }}>
                          <p style={{ margin: '0 0 4px', fontSize: 10.5, fontWeight: 700, color: '#1E6040', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Check className="w-3.5 h-3.5" /> Suggested correction
                          </p>
                          <p style={{ margin: 0, fontSize: 12.5, color: '#244E36', lineHeight: 1.65 }}>
                            {claim.suggested_correction}
                          </p>
                        </div>
                      )}
                    </section>

                    {/* ③ Relevant evidence */}
                    {(claim.contradicting_evidence.length > 0 || claim.supporting_evidence.length > 0) && (
                      <section>
                        <SectionLabel>③ Source evidence</SectionLabel>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {claim.contradicting_evidence.map(ev => (
                            <div key={ev.id}>
                              <p style={{ margin: '0 0 6px', fontSize: 10.5, fontFamily: 'monospace', fontWeight: 700, color: '#9E2626', display: 'flex', alignItems: 'center', gap: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                <XCircle className="w-3 h-3" /> Contradicts this claim
                              </p>
                              <EvidenceBlock ev={ev} type="contradicting" onSourceClick={openSource} />
                            </div>
                          ))}
                          {claim.supporting_evidence.map(ev => (
                            <div key={ev.id}>
                              <p style={{ margin: '0 0 6px', fontSize: 10.5, fontFamily: 'monospace', fontWeight: 700, color: '#1E6040', display: 'flex', alignItems: 'center', gap: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                <CheckCircle2 className="w-3 h-3" /> Supports this claim
                              </p>
                              <EvidenceBlock ev={ev} type="supporting" onSourceClick={openSource} />
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* No evidence */}
                    {claim.supporting_evidence.length === 0 && claim.contradicting_evidence.length === 0 && (
                      <section>
                        <SectionLabel>③ Source evidence</SectionLabel>
                        <div style={{ background: '#FFFBF0', border: '1px solid #F3DCAC', borderRadius: 6, padding: '12px 14px' }}>
                          <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#8C560D', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <HelpCircle className="w-3.5 h-3.5" /> No matching passages located
                          </p>
                          <p style={{ margin: 0, fontSize: 12.5, color: '#65491C', lineHeight: 1.65 }}>
                            Retrieval across all supplied source documents found no passages that verify or contradict this assertion. This is recorded as insufficient evidence — it does not mean the claim is false.
                          </p>
                        </div>
                      </section>
                    )}

                    {/* ④ Reasoning issues */}
                    {claim.reasoning_issues.length > 0 && (
                      <section>
                        <SectionLabel>④ Reasoning issues</SectionLabel>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {claim.reasoning_issues.map((ri, idx) => (
                            <div key={idx} style={{ background: '#F7F8F6', border: '1px solid #E2E5E0', borderRadius: 5, padding: '8px 12px' }}>
                              <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 600, color: '#3D485C' }}>{ri.issue_type}</p>
                              <p style={{ margin: 0, fontSize: 12, color: '#5A625A', lineHeight: 1.55 }}>{ri.description}</p>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* ⑤ Safety issues */}
                    {claim.safety_issues.length > 0 && (
                      <section>
                        <SectionLabel>⑤ Safety concerns</SectionLabel>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {claim.safety_issues.map((si, idx) => (
                            <div key={idx} style={{ background: '#FDF6F0', border: '1px solid #EDD3B8', borderRadius: 5, padding: '8px 12px' }}>
                              <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 600, color: '#7A3A10', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Shield className="w-3 h-3" />{si.issue_type}
                              </p>
                              <p style={{ margin: '0 0 4px', fontSize: 12, color: '#5A4030', lineHeight: 1.55 }}>{si.description}</p>
                              {si.recommendation && (
                                <p style={{ margin: 0, fontSize: 11, color: '#7A3A10', fontWeight: 500 }}>
                                  Recommendation: {si.recommendation}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Verdict confidence is distinct from passage-level lexical similarity. */}
                    <section style={{ borderTop: '1px solid #E2E5E0', paddingTop: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <SectionLabel>Verdict confidence score</SectionLabel>
                          <span title="Backend estimate of confidence in this verdict based on the stated evidence basis. It is not a calibrated probability.">
                            <Info className="w-3 h-3" style={{ color: '#8A928A', cursor: 'help', marginBottom: 6 }} />
                          </span>
                        </div>
                        <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#1C211E', fontVariantNumeric: 'tabular-nums' }}>
                          {Math.round(claim.confidence_score * 100)} / 100
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 11.5, color: '#5A625A', lineHeight: 1.6 }}>
                        {claim.confidence_basis} This score is a model assessment, not a calibrated probability. Passage-level evidence match scores above measure lexical similarity separately.
                      </p>
                    </section>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ TABLE VIEW ════════════════════════════════════════════════════ */}
      {layout === 'table' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: '#F7F8F6' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E5E0', borderRadius: 8, overflow: 'hidden' }}>

            {/* Table header */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #E2E5E0', background: '#FAFAF9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: '#1C211E', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Audit Matrix — {filtered.length} of {counts.total} claims
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#8A928A' }}>Click any row to open full breakdown in Deck view</p>
              </div>
              <div style={{ display: 'flex', border: '1px solid #E2E5E0', borderRadius: 6, overflow: 'hidden', background: '#F7F8F6' }}>
                {[
                  { k: 'ALL',          l: `All (${counts.total})` },
                  { k: 'CONTRADICTED', l: `✗ Contradicted` },
                  { k: 'SUPPORTED',    l: `✓ Supported` },
                  { k: 'INSUFFICIENT', l: `? No Evidence` },
                  { k: 'OTHER',        l: `Other (${counts.other})` },
                ].map(t => (
                  <button key={t.k} onClick={() => setFilter(t.k as VerdictFilter)}
                    aria-pressed={verdictFilter === t.k}
                    style={{
                      padding: '5px 12px', fontSize: 11, fontWeight: verdictFilter === t.k ? 700 : 500,
                      background: verdictFilter === t.k ? FILTER_COLORS[t.k as VerdictFilter].background : 'transparent',
                      color: verdictFilter === t.k ? FILTER_COLORS[t.k as VerdictFilter].text : '#707770',
                      border: 'none', cursor: 'pointer',
                      boxShadow: verdictFilter === t.k ? `inset 0 0 0 1px ${FILTER_COLORS[t.k as VerdictFilter].border}` : 'none',
                    }}>
                    {t.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="audit-table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F7F8F6', borderBottom: '1px solid #E2E5E0' }}>
                  {['#', 'Assertion', 'Verdict', 'Primary Evidence', 'Finding', 'Verdict confidence'].map((h, i) => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: i === 0 || i === 5 ? 'center' : 'left',
                      fontSize: 10.5, fontWeight: 700, color: '#8A928A',
                      textTransform: 'uppercase', letterSpacing: '0.07em',
                      width: i === 0 ? 48 : i === 2 ? 120 : i === 5 ? 60 : undefined,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, idx) => {
                  const cfg = getVC(c.verdict);
                  const ev  = c.contradicting_evidence[0] ?? c.supporting_evidence[0];
                  return (
                    <tr key={c.id}
                      onClick={() => { setSelectedId(c.id); setLayout('deck'); setRightTab('inspector'); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedId(c.id);
                          setLayout('deck');
                          setRightTab('inspector');
                        }
                      }}
                      tabIndex={0}
                      aria-label={`Open claim ${c.claim_number}: ${getVC(c.verdict).shortLabel}`}
                      className="audit-table-row"
                      style={{
                        borderBottom: '1px solid #F2F4F1',
                        borderLeft: `3px solid ${cfg.rowBarColor}`,
                        background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAF9',
                        cursor: 'pointer', transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F3F7F4')}
                      onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#FFFFFF' : '#FAFAF9')}
                    >
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'monospace', fontSize: 11.5, fontWeight: 700, color: '#8A928A', verticalAlign: 'top' }}>
                        #{c.claim_number}
                      </td>
                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        <p style={{ margin: '0 0 4px', fontSize: 12.5, color: '#1C211E', lineHeight: 1.5, fontWeight: 500 }}>{c.text}</p>
                        <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#8A928A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {CATEGORY_LABELS[c.category]?.abbr ?? c.category}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        <VerdictPill verdict={c.verdict} />
                      </td>
                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        {ev ? (
                          <div style={{ background: cfg.evBg, border: `1px solid ${cfg.evBorder}`, borderRadius: 5, padding: '8px 10px' }}>
                            <p style={{ margin: '0 0 5px', fontSize: 12, fontStyle: 'italic', color: '#1C211E', lineHeight: 1.5, fontFamily: 'Georgia, serif' }}>
                              "{ev.text.length > 180 ? ev.text.slice(0, 180) + '…' : ev.text}"
                            </p>
                            <p style={{ margin: 0, fontSize: 10, fontFamily: 'monospace', color: '#8A928A' }}>
                              {ev.filename}{ev.page_number ? ` · Pg ${ev.page_number}` : ''}
                            </p>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: '#8C560D', fontStyle: 'italic' }}>No source passage found</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12, verticalAlign: 'top' }}>
                        <span style={{ color: c.suggested_correction ? '#1E6040' : '#5A625A', lineHeight: 1.55, display: 'block', fontWeight: c.suggested_correction ? 500 : 400 }}>
                          {(c.suggested_correction || c.explanation).slice(0, 200)}
                          {(c.suggested_correction || c.explanation).length > 200 && '…'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#484F49', verticalAlign: 'top' }}>
                        <span title="Backend estimate of confidence in this verdict; not a calibrated probability.">
                          {Math.round(c.confidence_score * 100)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
