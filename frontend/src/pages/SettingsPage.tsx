import React, { useEffect, useState } from 'react';
import { 
  Key, 
  ShieldCheck, 
  Database, 
  Info, 
  CheckCircle2, 
  AlertCircle,
  Save,
  Server
} from 'lucide-react';
import type { SettingsConfig } from '../types';
import { fetchSettings, saveSettings } from '../services/api';

export const SettingsPage: React.FC = () => {
  const [config, setConfig] = useState<SettingsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchSettings();
        setConfig(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load configuration');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    try {
      setSaving(true);
      setSaveSuccess(false);
      const updated = await saveSettings({
        gemini_api_key: apiKeyInput.trim() || undefined,
        gemini_model: config.gemini_model,
        retention_days: config.retention_days,
        default_verify_sources: config.default_verify_sources,
        default_reasoning_checks: config.default_reasoning_checks,
        default_safety_review: config.default_safety_review,
      });
      setConfig(updated);
      setApiKeyInput('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-[var(--text-secondary)] text-[13px]">
        Loading system diagnostics...
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="w-full max-w-[1200px] mx-auto px-6 lg:px-10 py-9">
        <div className="p-4 bg-[var(--contradicted-tint)] border border-[var(--line)] rounded-[12px] text-[13px] text-[var(--contradicted-text)] flex items-center gap-2.5 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 text-[var(--contradicted-dot)]" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1200px] mx-auto px-6 lg:px-10 py-9 space-y-7">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold text-[var(--ink)] tracking-tight">
            Settings & System Diagnostics
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)] mt-1 font-medium">
            Configure model provider parameters, default audit checks, and operational boundaries.
          </p>
        </div>

        {saveSuccess && (
          <div className="px-4 py-2 bg-[var(--accent-tint)] border border-[var(--line)] rounded-[10px] text-[12.5px] font-bold text-[var(--accent-text)] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--accent)]" />
            <span>Configuration saved successfully.</span>
          </div>
        )}
      </div>

      {config && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* LEFT COLUMN: Provider & Storage */}
            <div className="space-y-6">
              
              {/* Section 1: Model Provider Configuration */}
              <div className="bg-[var(--surface)] rounded-[16px] p-6 border border-[var(--line)] space-y-4">
                <div className="flex items-center gap-2 border-b border-[var(--line)] pb-3">
                  <Key className="w-4 h-4 text-[var(--accent-text)]" />
                  <h2 className="text-[16px] font-bold text-[var(--ink)]">
                    Model Provider & API Integration
                  </h2>
                </div>

                <div className="text-[13px] space-y-4">
                  <div className="flex items-center justify-between p-4 bg-[var(--surface-alt)] rounded-[12px] border border-[var(--line)]">
                    <div>
                      <span className="font-bold text-[var(--ink)] block">Gemini API Key Status</span>
                      <span className="text-[12px] text-[var(--text-secondary)] font-medium">
                        Configured via environment variable or local override. Keys remain masked.
                      </span>
                    </div>
                    <div>
                      {config.gemini_api_key_configured ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[var(--accent-tint)] text-[var(--accent-text)] border border-[var(--line)]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                          Configured & Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[var(--insufficient-tint)] text-[var(--insufficient-text)] border border-[var(--line)]">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Local Zero-API Mode
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                      Update Gemini API Key (Optional Override)
                    </label>
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder={config.gemini_api_key_configured ? '••••••••••••••••••••••••' : 'Enter Gemini API key to activate semantic LLM assistance'}
                      className="w-full h-[40px] px-4 bg-[var(--surface-alt)] border border-[var(--line)] rounded-[10px] text-[13px] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--ink)] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                      Selected Model Provider Target
                    </label>
                    <select
                      value={config.gemini_model}
                      onChange={(e) => setConfig({ ...config, gemini_model: e.target.value })}
                      className="w-full h-[40px] px-4 bg-[var(--surface-alt)] border border-[var(--line)] rounded-[10px] text-[13px] text-[var(--ink)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ink)]"
                    >
                      <option value="gemini-2.5-flash">gemini-2.5-flash (Default Fast & Accurate)</option>
                      <option value="gemini-2.5-pro">gemini-2.5-pro (High Reasoning Depth)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Data Retention & SQLite Storage */}
              <div className="bg-[var(--surface)] rounded-[16px] p-6 border border-[var(--line)] space-y-4">
                <div className="flex items-center gap-2 border-b border-[var(--line)] pb-3">
                  <Database className="w-4 h-4 text-[var(--accent-text)]" />
                  <h2 className="text-[16px] font-bold text-[var(--ink)]">
                    Document Retention & SQLite Persistence
                  </h2>
                </div>

                <div className="text-[13px] text-[var(--text-body)] space-y-3 font-medium">
                  <p className="text-[13px] leading-relaxed">
                    Audits and extracted source passages are persistently recorded in a local SQLite database (<code className="font-mono text-[11.5px] bg-[var(--surface-alt)] px-1.5 py-0.5 rounded border border-[var(--line)] text-[var(--ink)]">backend/second_opinion.db</code>).
                  </p>
                  
                  <div className="flex items-center justify-between p-4 bg-[var(--surface-alt)] rounded-[12px] border border-[var(--line)]">
                    <div>
                      <span className="font-bold text-[var(--ink)] block text-[13px]">Ledger Retention Window</span>
                      <span className="text-[11px] text-[var(--text-secondary)]">Audit history and provenance tracking duration</span>
                    </div>
                    <select
                      value={config.retention_days}
                      onChange={(e) => setConfig({ ...config, retention_days: Number(e.target.value) })}
                      className="h-[38px] px-3 bg-[var(--surface)] border border-[var(--line)] rounded-[10px] text-[12px] font-bold text-[var(--ink)] focus:outline-none"
                    >
                      <option value={7}>7 Days</option>
                      <option value={30}>30 Days (Standard)</option>
                      <option value={90}>90 Days</option>
                      <option value={365}>1 Year (Indefinite)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Verification Defaults & Boundaries */}
            <div className="space-y-6">
              
              {/* Section 3: Verification Engine Defaults */}
              <div className="bg-[var(--surface)] rounded-[16px] p-6 border border-[var(--line)] space-y-4">
                <div className="flex items-center gap-2 border-b border-[var(--line)] pb-3">
                  <ShieldCheck className="w-4 h-4 text-[var(--accent-text)]" />
                  <h2 className="text-[16px] font-bold text-[var(--ink)]">
                    Default Auditing Rules & Safety Thresholds
                  </h2>
                </div>

                <div className="space-y-3 text-[13px] text-[var(--text-body)] font-medium">
                  <label className="flex items-start gap-3 p-3 rounded-[10px] hover:bg-[var(--surface-hover)] border border-transparent hover:border-[var(--line)] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={config.default_verify_sources}
                      onChange={(e) => setConfig({ ...config, default_verify_sources: e.target.checked })}
                      className="mt-0.5 w-4 h-4 rounded text-[var(--accent)] accent-[var(--accent)] border-[var(--line)]"
                    />
                    <div>
                      <span className="font-bold text-[var(--ink)] block">Verify against supplied sources</span>
                      <span className="text-[12px] text-[var(--text-secondary)] leading-snug block mt-0.5">
                        Strictly enforce that every claim must find traceable grounding in reference passages.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-[10px] hover:bg-[var(--surface-hover)] border border-transparent hover:border-[var(--line)] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={config.default_reasoning_checks}
                      onChange={(e) => setConfig({ ...config, default_reasoning_checks: e.target.checked })}
                      className="mt-0.5 w-4 h-4 rounded text-[var(--accent)] accent-[var(--accent)] border-[var(--line)]"
                    />
                    <div>
                      <span className="font-bold text-[var(--ink)] block">Reasoning consistency checks</span>
                      <span className="text-[12px] text-[var(--text-secondary)] leading-snug block mt-0.5">
                        Flag causal leaps, circular assertions, and internally conflicting claims.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-[10px] hover:bg-[var(--surface-hover)] border border-transparent hover:border-[var(--line)] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={config.default_safety_review}
                      onChange={(e) => setConfig({ ...config, default_safety_review: e.target.checked })}
                      className="mt-0.5 w-4 h-4 rounded text-[var(--accent)] accent-[var(--accent)] border-[var(--line)]"
                    />
                    <div>
                      <span className="font-bold text-[var(--ink)] block">Safety & directive review</span>
                      <span className="text-[12px] text-[var(--text-secondary)] leading-snug block mt-0.5">
                        Detect unauthorized clinical dosages, destructive commands, or financial guarantees.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Section 4: Operational Boundaries & Scope */}
              <div className="bg-[var(--surface)] rounded-[16px] p-6 border border-[var(--line)] space-y-3">
                <div className="flex items-center gap-2 border-b border-[var(--line)] pb-3">
                  <Info className="w-4 h-4 text-[var(--text-secondary)]" />
                  <h2 className="text-[16px] font-bold text-[var(--ink)]">
                    Operational Boundaries & Auditing Scope
                  </h2>
                </div>

                <div className="text-[12.5px] text-[var(--text-body)] leading-relaxed space-y-2.5 font-medium">
                  <p>
                    <strong className="text-[var(--ink)]">1. Evidence Grounding:</strong> Assertions are evaluated strictly against supplied reference text. Claims not found receive <code className="text-[var(--insufficient-text)] bg-[var(--insufficient-tint)] px-1.5 py-0.5 rounded font-mono font-bold">INSUFFICIENT_EVIDENCE</code>.
                  </p>
                  <p>
                    <strong className="text-[var(--ink)]">2. Deterministic Arithmetic:</strong> Python arithmetic checkers compare numerical claims directly, detecting inflation and discrepancy.
                  </p>
                  <p>
                    <strong className="text-[var(--ink)]">3. Human Review Standard:</strong> Automated verdicts indicate evidentiary grounding to assist human reviewers with full traceability.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar: Diagnostics & Save Button */}
          <div className="bg-[var(--surface)] rounded-[16px] p-5 border border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between text-[12px] text-[var(--text-secondary)] gap-4">
            <div className="flex items-center gap-4 flex-wrap font-medium">
              <div className="flex items-center gap-1.5 font-bold text-[var(--ink)]">
                <Server className="w-4 h-4 text-[var(--accent-text)]" />
                <span>Engine: {config.engine_mode}</span>
              </div>
              <span>·</span>
              <span className="font-mono">v{config.version}</span>
              <span>·</span>
              <span className="font-mono">Python {config.python_version}</span>
              <span>·</span>
              <span>FastAPI + SQLite Persistence</span>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 h-[42px] px-6 bg-[var(--accent)] hover:opacity-90 text-[var(--ink)] text-[13px] font-bold rounded-[10px] transition-all self-end sm:self-auto"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
