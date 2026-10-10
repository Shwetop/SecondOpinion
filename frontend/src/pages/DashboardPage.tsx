import React, { useEffect, useState } from 'react';
import { 
  PlusCircle, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileText, 
  RefreshCw,
  Scale,
  ShieldCheck,
  BookOpen,
  FileSearch,
  Sparkles,
  Layers,
  BarChart3,
  Play,
  FileSpreadsheet,
  ShieldAlert,
  Download
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
      // Navigate to new audit to see live progress or results
      navigate(`/audit/${audit.id}`);
    } catch (err: any) {
      alert(`Demo audit failed: ${err.message}`);
      setRunningPreset(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#EAF5EE] text-[#1E6040] border border-[#B7DEC5]">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#FDF2F2] text-[#9E2626] border border-[#F7C4C4]">
            <AlertCircle className="w-3 h-3" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#FFFBF0] text-[#8C560D] border border-[#F3DCAC]">
            <Clock className="w-3 h-3 animate-spin" />
            Auditing
          </span>
        );
    }
  };

  return (
    <div className="w-full px-8 py-6 space-y-7">
      
      {/* Top Banner (Full Width) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E2E5E0]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[20px] font-bold text-[#1C211E] tracking-tight">
              Audit Workspace
            </h2>
            <span className="text-[11px] font-mono text-[#326B55] bg-[#EAF5EE] px-2 py-0.5 rounded border border-[#B7DEC5] font-semibold">
              Live Ledger
            </span>
          </div>
          <p className="text-[13px] text-[#707770] mt-0.5">
            Operational verification workspace for auditing AI-generated assertions against primary reference documents.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadAudits}
            className="p-2 text-[#707770] hover:text-[#1C211E] hover:bg-[#FFFFFF] border border-[#E2E5E0] rounded transition-colors shadow-2xs"
            title="Refresh ledger"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/audit/new')}
            className="flex items-center gap-2 px-4 py-2 bg-[#326B55] hover:bg-[#265442] text-[#FFFFFF] rounded text-[13px] font-semibold transition-colors shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Audit</span>
          </button>
        </div>
      </div>

      {/* KPI & Activity Metric Cards (Occupies full horizontal space) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] border border-[#E2E5E0] rounded-md p-4 flex items-center justify-between shadow-surface">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#707770] block font-semibold">
              Audits Conducted
            </span>
            <span className="text-[24px] font-bold text-[#1C211E] font-mono mt-0.5 block">
              {totalAudits}
            </span>
            <span className="text-[11px] text-[#707770]">Persisted in SQLite</span>
          </div>
          <div className="w-10 h-10 rounded bg-[#F7F8F6] border border-[#E2E5E0] flex items-center justify-center text-[#326B55]">
            <FileSearch className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E2E5E0] rounded-md p-4 flex items-center justify-between shadow-surface">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#707770] block font-semibold">
              Claims Extracted
            </span>
            <span className="text-[24px] font-bold text-[#1C211E] font-mono mt-0.5 block">
              {totalClaims}
            </span>
            <span className="text-[11px] text-[#707770]">Atomic Assertions</span>
          </div>
          <div className="w-10 h-10 rounded bg-[#F7F8F6] border border-[#E2E5E0] flex items-center justify-center text-[#3D485C]">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E2E5E0] rounded-md p-4 flex items-center justify-between shadow-surface">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#9E2626] block font-bold">
              Contradictions Flagged
            </span>
            <span className="text-[24px] font-bold text-[#9E2626] font-mono mt-0.5 block">
              {totalContradictions}
            </span>
            <span className="text-[11px] text-[#707770]">Factual & Numerical</span>
          </div>
          <div className="w-10 h-10 rounded bg-[#FDF2F2] border border-[#F7C4C4] flex items-center justify-center text-[#9E2626]">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E2E5E0] rounded-md p-4 flex items-center justify-between shadow-surface">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#1E6040] block font-bold">
              Corroborated Assertions
            </span>
            <span className="text-[24px] font-bold text-[#1E6040] font-mono mt-0.5 block">
              {totalSupported}
            </span>
            <span className="text-[11px] text-[#707770]">Verbatim Grounding</span>
          </div>
          <div className="w-10 h-10 rounded bg-[#EAF5EE] border border-[#B7DEC5] flex items-center justify-center text-[#1E6040]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Curated Pre-Configured Audits Showcase (Occupies full horizontal space) */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E0] rounded-md p-5 shadow-surface space-y-3">
        <div className="flex items-center justify-between border-b border-[#E2E5E0] pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#326B55]" />
            <h3 className="text-[13px] font-bold text-[#1C211E] uppercase tracking-wider">
              Quick Audit Demonstration Suite
            </h3>
          </div>
          <span className="text-[11px] text-[#707770] font-mono">
            Ground-Truth Provenance Testbeds
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Preset 1 */}
          <div className="p-4 rounded-md border border-[#E2E5E0] bg-[#FAFAF9] hover:border-[#326B55] transition-all flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono font-bold text-[#326B55] bg-[#EAF5EE] px-2 py-0.2 rounded border border-[#B7DEC5]">
                  FINANCIAL & CLINICAL
                </span>
                <span className="text-[11px] text-[#707770] font-mono">6 Claims · 1 Source</span>
              </div>
              <h4 className="text-[14px] font-bold text-[#1C211E]">
                BioCorp Q3 2024 Clinical & Earnings Update
              </h4>
              <p className="text-[12px] text-[#5A625A] mt-1 leading-relaxed">
                Audits an LLM summary against a clinical trial SEC 10-Q filing. Detects revenue inflation ($185M vs $162M), concealed adverse events (0 vs 4.2%), and FDA Priority Review discrepancies.
              </p>
            </div>

            <div className="pt-2 border-t border-[#E2E5E0] flex items-center justify-between">
              <span className="text-[11px] text-[#9E2626] font-semibold">
                Expected: 5 Contradictions Caught
              </span>
              <button
                onClick={() => handleQuickRunDemo('earnings')}
                disabled={runningPreset === 'earnings'}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#326B55] hover:bg-[#265442] text-white rounded text-[12px] font-medium transition-colors shadow-2xs"
              >
                {runningPreset === 'earnings' ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>Run Demonstration</span>
              </button>
            </div>
          </div>

          {/* Preset 2 */}
          <div className="p-4 rounded-md border border-[#E2E5E0] bg-[#FAFAF9] hover:border-[#326B55] transition-all flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono font-bold text-[#3D485C] bg-[#F4F5F7] px-2 py-0.2 rounded border border-[#D8DCE3]">
                  SECURITY COMPLIANCE
                </span>
                <span className="text-[11px] text-[#707770] font-mono">3 Claims · 1 Source</span>
              </div>
              <h4 className="text-[14px] font-bold text-[#1C211E]">
                Cloud Infrastructure Security & ISO 27001 Audit
              </h4>
              <p className="text-[12px] text-[#5A625A] mt-1 leading-relaxed">
                Audits cloud operations advice against internal security compliance handbooks. Flags high-risk destructive directives (chmod 777) and unauthorized authentication bypass directives.
              </p>
            </div>

            <div className="pt-2 border-t border-[#E2E5E0] flex items-center justify-between">
              <span className="text-[11px] text-[#9E2626] font-semibold">
                Expected: 2 Critical Safety Flags
              </span>
              <button
                onClick={() => handleQuickRunDemo('cybersecurity')}
                disabled={runningPreset === 'cybersecurity'}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#326B55] hover:bg-[#265442] text-white rounded text-[12px] font-medium transition-colors shadow-2xs"
              >
                {runningPreset === 'cybersecurity' ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>Run Demonstration</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Full-Width Audits Table */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E0] rounded-md overflow-hidden shadow-surface">
        <div className="px-5 py-3 border-b border-[#E2E5E0] flex items-center justify-between bg-[#FCFCFA]">
          <h3 className="text-[13px] font-bold text-[#1C211E] tracking-wide uppercase flex items-center gap-2">
            <span>Recent Audits Ledger</span>
            <span className="text-[11px] font-mono font-semibold text-[#5A625A] bg-[#F7F8F6] px-2 py-0.5 rounded border border-[#E2E5E0]">
              {audits.length} Records
            </span>
          </h3>
          <span className="text-[11px] text-[#707770] font-mono">
            Persistent SQLite Ledger (second_opinion.db)
          </span>
        </div>

        {loading ? (
          <div className="py-20 text-center text-[#707770] text-[13px]">
            <Clock className="w-5 h-5 mx-auto mb-2 animate-spin text-[#326B55]" />
            Loading audit records...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-[#9E2626] text-[13px]">
            <AlertCircle className="w-5 h-5 mx-auto mb-2 text-[#9E2626]" />
            {error}
          </div>
        ) : audits.length === 0 ? (
          <div className="p-16 text-center max-w-xl mx-auto">
            <div className="w-12 h-12 rounded-full bg-[#EAF5EE] text-[#1E6040] flex items-center justify-center mx-auto mb-4 border border-[#B7DEC5]">
              <FileText className="w-6 h-6" strokeWidth={1.8} />
            </div>
            <h4 className="text-[16px] font-bold text-[#1C211E]">
              No Audits Conducted Yet
            </h4>
            <p className="text-[13px] text-[#707770] mt-1.5 mb-6 leading-relaxed">
              Launch a demonstration audit above or submit your own custom document to start inspecting atomic assertions and verified citations.
            </p>
            <button
              onClick={() => navigate('/audit/new')}
              className="px-5 py-2.5 bg-[#326B55] hover:bg-[#265442] text-[#FFFFFF] text-[13px] font-semibold rounded transition-colors shadow-xs"
            >
              Start New Custom Audit
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#F7F8F6] text-[#707770] text-[11px] uppercase tracking-wider border-b border-[#E2E5E0]">
                <tr>
                  <th className="py-3 px-5 font-bold">Audit Name</th>
                  <th className="py-3 px-4 font-bold font-mono">ID</th>
                  <th className="py-3 px-4 font-bold">Date</th>
                  <th className="py-3 px-4 font-bold text-center">Sources</th>
                  <th className="py-3 px-4 font-bold text-center">Claims</th>
                  <th className="py-3 px-4 font-bold">Verdicts Distribution</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E5E0]">
                {audits.map((a) => {
                  const total = a.total_claims || 1;
                  const suppPct = Math.round((a.supported_count / total) * 100);
                  const contPct = Math.round((a.contradicted_count / total) * 100);
                  const ungrPct = Math.max(0, 100 - suppPct - contPct);

                  return (
                    <tr 
                      key={a.id} 
                      className="hover:bg-[#F9FAF8] transition-colors cursor-pointer group"
                      onClick={() => navigate(`/audit/${a.id}`)}
                    >
                      <td className="py-3.5 px-5 font-medium text-[#1C211E]">
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-4 h-4 text-[#707770] group-hover:text-[#326B55] shrink-0" />
                          <span className="group-hover:underline underline-offset-2 font-semibold text-[#1C211E]">{a.title}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[#707770] font-mono text-[11px]">
                        {a.id}
                      </td>
                      <td className="py-3.5 px-4 text-[#707770] font-mono text-[11px]">
                        {a.created_at}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-[12px]">
                        {a.source_doc_count}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-[#1C211E]">
                        {a.total_claims}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="w-40 space-y-1">
                          <div className="w-full bg-[#E2E5E0] h-2 rounded-full overflow-hidden flex shadow-2xs">
                            <div style={{ width: `${suppPct}%` }} className="bg-[#1E6040] h-full" title={`Supported: ${a.supported_count}`} />
                            <div style={{ width: `${contPct}%` }} className="bg-[#9E2626] h-full" title={`Contradicted: ${a.contradicted_count}`} />
                            <div style={{ width: `${ungrPct}%` }} className="bg-[#8C560D] h-full" title={`Ungrounded: ${a.insufficient_count}`} />
                          </div>
                          <div className="flex justify-between text-[10px] font-mono text-[#707770]">
                            <span className="text-[#1E6040] font-semibold">{a.supported_count} sup</span>
                            <span className="text-[#9E2626] font-semibold">{a.contradicted_count} cont</span>
                            <span className="text-[#8C560D] font-semibold">{a.insufficient_count} ungr</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(a.status)}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/audit/${a.id}`);
                            }}
                            className="inline-flex items-center gap-1 text-[12px] text-[#326B55] hover:text-[#265442] font-semibold"
                          >
                            <span>Open</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Verification Status Legend (Full Width Grid) */}
      <div className="border border-[#E2E5E0] bg-[#FFFFFF] rounded-md p-5 shadow-surface">
        <h4 className="text-[12px] font-bold text-[#1C211E] uppercase tracking-wider mb-3 flex items-center justify-between">
          <span>Verification Status Taxonomy</span>
          <span className="font-mono text-[11px] text-[#707770] font-normal">Standardized Evidentiary Criteria</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-[12px]">
          <div className="p-3.5 rounded border border-[#B7DEC5] bg-[#EAF5EE]">
            <div className="flex items-center gap-1.5 font-bold text-[#1E6040] mb-1">
              <span className="w-2 h-2 rounded-full bg-[#1E6040]" />
              SUPPORTED
            </div>
            <p className="text-[#32523E] text-[11.5px] leading-relaxed">
              Every key entity and metric in the assertion is corroborated by traceable verbatim source text.
            </p>
          </div>

          <div className="p-3.5 rounded border border-[#F7C4C4] bg-[#FDF2F2]">
            <div className="flex items-center gap-1.5 font-bold text-[#9E2626] mb-1">
              <span className="w-2 h-2 rounded-full bg-[#9E2626]" />
              CONTRADICTED
            </div>
            <p className="text-[#6E2A2A] text-[11.5px] leading-relaxed">
              Source passage directly disproves the claim via polar semantic conflict or deterministic mathematical discrepancy.
            </p>
          </div>

          <div className="p-3.5 rounded border border-[#F3DCAC] bg-[#FFFBF0]">
            <div className="flex items-center gap-1.5 font-bold text-[#8C560D] mb-1">
              <span className="w-2 h-2 rounded-full bg-[#8C560D]" />
              INSUFFICIENT EVIDENCE
            </div>
            <p className="text-[#61451C] text-[11.5px] leading-relaxed">
              Supplied documentation does not contain sufficient textual or numerical grounds to evaluate the claim.
            </p>
          </div>

          <div className="p-3.5 rounded border border-[#D8DCE3] bg-[#F4F5F7]">
            <div className="flex items-center gap-1.5 font-bold text-[#3D485C] mb-1">
              <span className="w-2 h-2 rounded-full bg-[#3D485C]" />
              AMBIGUOUS / MIXED
            </div>
            <p className="text-[#454E5E] text-[11.5px] leading-relaxed">
              Assertion contains conflicting interpretations, ungrounded sub-clauses, or qualified approximations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
