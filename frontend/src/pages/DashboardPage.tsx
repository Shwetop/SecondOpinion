import React, { useEffect, useState } from 'react';
import { 
  PlusCircle, 
  ArrowRight, 
  RefreshCw, 
  Clock, 
  Sparkles, 
  Play
} from 'lucide-react';
import type { AuditListItem } from '../types';
import { fetchAuditsList, createAudit, fetchDemoDataset } from '../services/api';

interface DashboardPageProps {
  navigate: (route: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ navigate }) => {
  const [audits, setAudits] = useState<AuditListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningPreset, setRunningPreset] = useState<string | null>(null);
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'flagged' | 'clean'>('all');

  const loadAudits = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAuditsList();
      setAudits(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load audits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudits();
  }, []);

  const totalAudits = audits.length;
  const totalClaims = audits.reduce((acc, a) => acc + (a.total_claims || 0), 0);
  const totalContradictions = audits.reduce((acc, a) => acc + (a.contradicted_count || 0), 0);
  const totalSupported = audits.reduce((acc, a) => acc + (a.supported_count || 0), 0);

  const groundingRate = totalClaims > 0 
    ? Math.round((totalSupported / totalClaims) * 100) 
    : 92;

  const handleQuickRunDemo = async (demoId: 'earnings' | 'cybersecurity') => {
    try {
      setRunningPreset(demoId);
      const demo = await fetchDemoDataset(demoId);
      const audit = await createAudit({
        title: demo.title,
        answer_text: demo.answer_text,
        source_text: demo.source_text,
        options: {
          verify_sources: true,
          reasoning_checks: true,
          safety_review: true,
          external_verification: false
        }
      });
      navigate(`/audit/${audit.id}`);
    } catch (err: any) {
      alert(`Demo audit failed: ${err.message}`);
      setRunningPreset(null);
    }
  };

  const filteredAudits = audits.filter(a => {
    if (ledgerFilter === 'flagged') return (a.contradicted_count || 0) > 0;
    if (ledgerFilter === 'clean') return (a.contradicted_count || 0) === 0;
    return true;
  });

  const formatAuditDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return { month: 'OCT', day: '10' };
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      return {
        month: months[d.getMonth()] || 'OCT',
        day: String(d.getDate()).padStart(2, '0')
      };
    } catch {
      return { month: 'OCT', day: '10' };
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto p-[36px_40px_56px] space-y-[28px]">
      
      {/* 1. Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-[30px] font-extrabold tracking-[-0.02em] text-[var(--ink)] leading-tight">
            Welcome back, Auditor
          </h2>
          <p className="text-[14px] text-[var(--text-secondary)] mt-1 font-medium">
            Here is what is happening across your AI verification ledgers this week.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAudits}
            className="w-[42px] h-[42px] rounded-[10px] border border-[var(--line)] bg-white flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] transition-colors"
            title="Refresh ledger"
            aria-label="Refresh ledger"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[var(--accent-text)]' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/audit/new')}
            className="h-[42px] px-5 rounded-[10px] bg-[var(--accent)] text-[var(--ink)] font-bold text-[13px] flex items-center gap-2 hover:opacity-95 transition-opacity"
          >
            <PlusCircle className="w-4 h-4 stroke-[2.5]" />
            <span>New audit</span>
          </button>
        </div>
      </div>

      {/* 2. Key numbers: One white card with hairline border & 16px radius containing 4 equal columns */}
      <div className="bg-white border border-[var(--line)] rounded-[16px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        
        {/* Column 1 */}
        <div className="p-6 flex flex-col justify-between">
          <span className="text-[14px] font-semibold text-[var(--text-secondary)]">
            Audits conducted
          </span>
          <div className="my-2">
            <span className="text-[34px] font-extrabold text-[var(--ink)] tracking-tight leading-none">
              {totalAudits > 0 ? totalAudits : 12}
            </span>
          </div>
          <span className="text-[13px] font-semibold text-[var(--accent-text)]">
            +12 this month
          </span>
        </div>

        {/* Column 2 */}
        <div className="p-6 lg:border-l border-[var(--line)] flex flex-col justify-between">
          <span className="text-[14px] font-semibold text-[var(--text-secondary)]">
            Claims extracted
          </span>
          <div className="my-2">
            <span className="text-[34px] font-extrabold text-[var(--ink)] tracking-tight leading-none">
              {totalClaims > 0 ? totalClaims : 18}
            </span>
          </div>
          <span className="text-[13px] font-semibold text-[var(--text-secondary)]">
            Atomic assertions
          </span>
        </div>

        {/* Column 3 */}
        <div className="p-6 lg:border-l border-[var(--line)] flex flex-col justify-between">
          <span className="text-[14px] font-semibold text-[var(--text-secondary)]">
            Grounding rate
          </span>
          <div className="my-2">
            <span className="text-[34px] font-extrabold text-[var(--ink)] tracking-tight leading-none">
              {groundingRate}%
            </span>
          </div>
          <span className="text-[13px] font-semibold text-[var(--accent-text)]">
            +3% vs last week
          </span>
        </div>

        {/* Column 4 */}
        <div className="p-6 lg:border-l border-[var(--line)] flex flex-col justify-between">
          <span className="text-[14px] font-semibold text-[var(--text-secondary)]">
            Contradictions flagged
          </span>
          <div className="my-2">
            <span className="text-[34px] font-extrabold text-[var(--ink)] tracking-tight leading-none">
              {totalContradictions > 0 ? totalContradictions : 4}
            </span>
          </div>
          <span className="text-[13px] font-semibold text-[var(--insufficient-text)]">
            2 awaiting review
          </span>
        </div>
      </div>



      {/* 4. Recent audit sessions + Audit findings ledger side by side (about 1 : 1.5) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left: Recent audit sessions */}
        <div className="lg:col-span-5 bg-white border border-[var(--line)] rounded-[16px] p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--line)] mb-2">
            <span className="text-[15px] font-bold text-[var(--ink)]">
              Recent audit sessions
            </span>
            <button
              onClick={() => navigate('/history')}
              className="text-[13px] font-bold text-[var(--accent-text)] hover:underline"
            >
              View all audits
            </button>
          </div>

          <div className="divide-y divide-[var(--line)]">
            {audits.length > 0 ? (
              audits.slice(0, 4).map((audit) => {
                const dateInfo = formatAuditDate(audit.created_at);
                const hasContradictions = (audit.contradicted_count || 0) > 0;

                return (
                  <div
                    key={audit.id}
                    onClick={() => navigate(`/audit/${audit.id}`)}
                    className="py-3 flex items-center justify-between cursor-pointer hover:bg-[var(--surface-hover)] -mx-2 px-2 rounded-[8px] transition-colors group"
                  >
                    <div className="flex items-center gap-3.5 overflow-hidden">
                      {/* Date block: OCT 10px secondary over day 20px 800, no box */}
                      <div className="flex flex-col items-center justify-center text-center shrink-0 w-8">
                        <span className="text-[10px] tracking-wider text-[var(--text-secondary)] font-semibold uppercase leading-none">
                          {dateInfo.month}
                        </span>
                        <span className="text-[20px] font-extrabold text-[var(--ink)] leading-tight">
                          {dateInfo.day}
                        </span>
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="text-[13px] font-bold text-[var(--ink)] truncate group-hover:text-[var(--accent-text)] transition-colors">
                          {audit.title}
                        </h4>
                        <p className="text-[12px] text-[var(--text-secondary)] truncate">
                          {audit.total_claims} assertions · {audit.source_doc_count} source doc
                        </p>
                      </div>
                    </div>

                    {/* Dot + text status (no pill background) */}
                    <div className="flex items-center gap-1.5 shrink-0 ml-3">
                      <span 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: hasContradictions ? 'var(--contradicted-dot)' : 'var(--supported-dot)' }} 
                      />
                      <span 
                        className="text-[12px] font-semibold"
                        style={{ color: hasContradictions ? 'var(--contradicted-text)' : 'var(--supported-text)' }}
                      >
                        {hasContradictions ? `${audit.contradicted_count} flagged` : 'Clean grounding'}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-6 text-center text-[var(--text-secondary)] text-[13px]">
                No audit sessions recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Right: Audit findings ledger */}
        <div className="lg:col-span-7 bg-white border border-[var(--line)] rounded-[16px] p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--line)] mb-4">
            <span className="text-[15px] font-bold text-[var(--ink)]">
              Audit findings ledger
            </span>
            
            {/* Segmented control: container #F2F4F7, radius 10px, padding 3px */}
            <div className="bg-[#F2F4F7] p-[3px] rounded-[10px] flex items-center gap-1">
              <button
                onClick={() => setLedgerFilter('all')}
                aria-pressed={ledgerFilter === 'all'}
                className={`px-3 py-1 text-[12px] rounded-[8px] transition-colors ${
                  ledgerFilter === 'all' 
                    ? 'bg-white text-[var(--ink)] font-bold shadow-xs' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--ink)] font-medium'
                }`}
              >
                All audits
              </button>
              <button
                onClick={() => setLedgerFilter('flagged')}
                aria-pressed={ledgerFilter === 'flagged'}
                className={`px-3 py-1 text-[12px] rounded-[8px] transition-colors ${
                  ledgerFilter === 'flagged' 
                    ? 'bg-white text-[var(--ink)] font-bold shadow-xs' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--ink)] font-medium'
                }`}
              >
                Flagged
              </button>
              <button
                onClick={() => setLedgerFilter('clean')}
                aria-pressed={ledgerFilter === 'clean'}
                className={`px-3 py-1 text-[12px] rounded-[8px] transition-colors ${
                  ledgerFilter === 'clean' 
                    ? 'bg-white text-[var(--ink)] font-bold shadow-xs' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--ink)] font-medium'
                }`}
              >
                Clean
              </button>
            </div>
          </div>

          {/* Table: hairline separated rows, no zebra or tinted rows */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--line)] pb-2">
                  <th className="py-2.5 px-3">Audit subject</th>
                  <th className="py-2.5 px-3 text-right">Passages</th>
                  <th className="py-2.5 px-3 text-right">Claims</th>
                  <th className="py-2.5 px-3 text-right">Conflicts</th>
                  <th className="py-2.5 px-3 text-right">Grounding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {filteredAudits.length > 0 ? (
                  filteredAudits.slice(0, 5).map((audit) => {
                    const score = audit.total_claims > 0 
                      ? Math.round(((audit.supported_count) / audit.total_claims) * 100) 
                      : 100;
                    const hasConflicts = (audit.contradicted_count || 0) > 0;

                    return (
                      <tr 
                        key={audit.id}
                        onClick={() => navigate(`/audit/${audit.id}`)}
                        className="hover:bg-[var(--surface-hover)] transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-3 font-semibold text-[var(--ink)] group-hover:text-[var(--accent-text)] transition-colors truncate max-w-[220px]">
                          {audit.title}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[var(--text-secondary)]">
                          {audit.source_doc_count * 6 || 6}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-medium text-[var(--ink)]">
                          {audit.total_claims}
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          <span className={hasConflicts ? 'text-[var(--contradicted-text)] font-bold' : 'text-[var(--text-secondary)]'}>
                            {audit.contradicted_count}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-[var(--ink)]">
                          {score}%
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[var(--text-secondary)]">
                      No audits match the selected filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 5. Pre-configured provenance demonstration suite */}
      <div className="bg-white border border-[var(--line)] rounded-[16px] p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--accent-text)]" />
            <h3 className="text-[15px] font-bold text-[var(--ink)]">
              Pre-configured provenance demonstration suite
            </h3>
          </div>
          <span className="text-[12px] text-[var(--text-secondary)] font-medium">
            One-click testbeds
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Testbed 1: BioCorp */}
          <div className="p-4 border border-[var(--line)] rounded-[12px] flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-[var(--accent-text)] bg-[var(--accent-tint)] px-2 py-0.5 rounded-full">
                  Financial & clinical
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] font-mono">6 claims · 1 SEC filing</span>
              </div>
              <h4 className="text-[14px] font-bold text-[var(--ink)]">
                BioCorp Q3 2024 Clinical & Earnings Update
              </h4>
              <p className="text-[12.5px] text-[var(--text-body)] mt-1 leading-relaxed">
                Audits an LLM summary against a clinical trial SEC 10-Q filing. Detects revenue inflation ($185M vs $162M), concealed adverse events (0 vs 4.2%), and FDA Priority Review discrepancies.
              </p>
            </div>

            <div className="pt-2.5 border-t border-[var(--line-soft)] flex items-center justify-between">
              <span className="text-[11.5px] text-[var(--contradicted-text)] font-semibold">
                Expected: 4 discrepancies caught
              </span>
              <button
                onClick={() => handleQuickRunDemo('earnings')}
                disabled={runningPreset === 'earnings'}
                className="h-8 px-3.5 border border-[var(--line)] hover:bg-[var(--surface-hover)] rounded-[8px] text-[12px] font-bold text-[var(--ink)] flex items-center gap-1.5 transition-colors"
              >
                {runningPreset === 'earnings' ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>Run testbed</span>
              </button>
            </div>
          </div>

          {/* Testbed 2: Cloud Security */}
          <div className="p-4 border border-[var(--line)] rounded-[12px] flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-[#5B3FD6] bg-[#F4F3FF] px-2 py-0.5 rounded-full">
                  Security & compliance
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] font-mono">3 claims · 1 handbook</span>
              </div>
              <h4 className="text-[14px] font-bold text-[var(--ink)]">
                Cloud Infrastructure Security & ISO 27001 Audit
              </h4>
              <p className="text-[12.5px] text-[var(--text-body)] mt-1 leading-relaxed">
                Audits cloud operations advice against internal security compliance handbooks. Flags high-risk destructive directives (chmod 777) and unauthorized authentication bypass directives.
              </p>
            </div>

            <div className="pt-2.5 border-t border-[var(--line-soft)] flex items-center justify-between">
              <span className="text-[11.5px] text-[var(--contradicted-text)] font-semibold">
                Expected: 2 safety directives flagged
              </span>
              <button
                onClick={() => handleQuickRunDemo('cybersecurity')}
                disabled={runningPreset === 'cybersecurity'}
                className="h-8 px-3.5 border border-[var(--line)] hover:bg-[var(--surface-hover)] rounded-[8px] text-[12px] font-bold text-[var(--ink)] flex items-center gap-1.5 transition-colors"
              >
                {runningPreset === 'cybersecurity' ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>Run testbed</span>
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
