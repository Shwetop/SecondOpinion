import React, { useEffect, useState } from 'react';
import { 
  Key, 
  ShieldCheck, 
  Database, 
  Info, 
  CheckCircle2, 
  AlertCircle,
  Save,
  Server,
  Cpu,
  Layers,
  Lock
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
      <div className="py-24 text-center text-[#707770] text-[13px]">
        Loading system diagnostics...
      </div>
    );
  }

  return (
    <div className="w-full px-8 py-6 space-y-6">
      {/* Page Header (Full Width) */}
      <div className="pb-4 border-b border-[#E2E5E0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold text-[#202522]">
            Settings & Operational Boundaries
          </h2>
          <p className="text-[13px] text-[#707770] mt-0.5">
            Configure model provider parameters, default audit checks, and review operational boundaries.
          </p>
        </div>

        {saveSuccess && (
          <div className="p-2 px-3 bg-[#EAF5EE] border border-[#C1E2CE] rounded text-[12px] text-[#206443] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Configuration saved successfully.</span>
          </div>
        )}
      </div>

      {config && (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Two-Column Responsive Grid occupying the screen efficiently */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* LEFT COLUMN: Provider & Storage */}
            <div className="space-y-6">
              
              {/* Section 1: Model Provider Configuration */}
              <div className="bg-[#FFFFFF] border border-[#E2E5E0] rounded-md p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-[#E2E5E0] pb-3">
                  <Key className="w-4 h-4 text-[#326B55]" />
                  <h3 className="text-[14px] font-semibold text-[#202522]">
                    Model Provider & API Integration
                  </h3>
                </div>

                <div className="text-[13px] space-y-3.5">
                  <div className="flex items-center justify-between p-3.5 bg-[#FBFBFA] rounded border border-[#E2E5E0]">
                    <div>
                      <span className="font-semibold text-[#202522] block">Gemini API Key Status</span>
                      <span className="text-[11px] text-[#707770]">
                        Configured via environment variable or local override. Keys remain masked.
                      </span>
                    </div>
                    <div>
                      {config.gemini_api_key_configured ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-[#EAF5EE] text-[#206443] border border-[#C1E2CE]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Configured & Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-[#FFFBF0] text-[#966012] border border-[#F6E2B6]">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Local Zero-API Mode
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#707770] mb-1">
                      Update Gemini API Key (Optional Override)
                    </label>
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder={config.gemini_api_key_configured ? '••••••••••••••••••••••••' : 'Enter Gemini API key to activate semantic LLM assistance'}
                      className="w-full px-3 py-2 bg-[#FBFBFA] border border-[#E2E5E0] rounded text-[13px] focus:outline-none focus:border-[#326B55] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#707770] mb-1">
                      Selected Model Provider Target
                    </label>
                    <select
                      value={config.gemini_model}
                      onChange={(e) => setConfig({ ...config, gemini_model: e.target.value })}
                      className="w-full px-3 py-2 bg-[#FBFBFA] border border-[#E2E5E0] rounded text-[13px] focus:outline-none"
                    >
                      <option value="gemini-2.5-flash">gemini-2.5-flash (Default Fast & Accurate)</option>
                      <option value="gemini-2.5-pro">gemini-2.5-pro (High Reasoning Depth)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Data Retention & SQLite Storage */}
              <div className="bg-[#FFFFFF] border border-[#E2E5E0] rounded-md p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-[#E2E5E0] pb-3">
                  <Database className="w-4 h-4 text-[#326B55]" />
                  <h3 className="text-[14px] font-semibold text-[#202522]">
                    Document Retention & SQLite Persistence
                  </h3>
                </div>

                <div className="text-[13px] text-[#484F49] space-y-3">
                  <p className="text-[12.5px] leading-relaxed">
                    Audits and extracted source passages are persistently recorded in a local SQLite database (<code className="font-mono text-[11px] bg-[#F7F8F6] px-1.5 py-0.5 rounded border border-[#E2E5E0]">backend/second_opinion.db</code>).
                  </p>
                  
                  <div className="flex items-center justify-between p-3 bg-[#FBFBFA] rounded border border-[#E2E5E0]">
                    <div>
                      <span className="font-semibold text-[#202522] block text-[12px]">Ledger Retention Window</span>
                      <span className="text-[11px] text-[#707770]">Audit history and provenance tracking duration</span>
                    </div>
                    <select
                      value={config.retention_days}
                      onChange={(e) => setConfig({ ...config, retention_days: Number(e.target.value) })}
                      className="px-3 py-1.5 bg-[#FFFFFF] border border-[#E2E5E0] rounded text-[12px] focus:outline-none font-medium"
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
              <div className="bg-[#FFFFFF] border border-[#E2E5E0] rounded-md p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-[#E2E5E0] pb-3">
                  <ShieldCheck className="w-4 h-4 text-[#326B55]" />
                  <h3 className="text-[14px] font-semibold text-[#202522]">
                    Default Auditing Rules & Safety Thresholds
                  </h3>
                </div>

                <div className="space-y-3 text-[13px] text-[#484F49]">
                  <label className="flex items-start gap-3 p-2.5 rounded hover:bg-[#FBFBFA] border border-transparent hover:border-[#E2E5E0] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={config.default_verify_sources}
                      onChange={(e) => setConfig({ ...config, default_verify_sources: e.target.checked })}
                      className="mt-0.5 accent-[#326B55]"
                    />
                    <div>
                      <span className="font-semibold text-[#202522] block">Verify against supplied sources</span>
                      <span className="text-[11px] text-[#707770] leading-snug block">
                        Strictly enforce that every claim must find traceable grounding in reference passages.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-2.5 rounded hover:bg-[#FBFBFA] border border-transparent hover:border-[#E2E5E0] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={config.default_reasoning_checks}
                      onChange={(e) => setConfig({ ...config, default_reasoning_checks: e.target.checked })}
                      className="mt-0.5 accent-[#326B55]"
                    />
                    <div>
                      <span className="font-semibold text-[#202522] block">Reasoning consistency checks</span>
                      <span className="text-[11px] text-[#707770] leading-snug block">
                        Flag causal leaps, circular assertions, and internally conflicting claims.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-2.5 rounded hover:bg-[#FBFBFA] border border-transparent hover:border-[#E2E5E0] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={config.default_safety_review}
                      onChange={(e) => setConfig({ ...config, default_safety_review: e.target.checked })}
                      className="mt-0.5 accent-[#326B55]"
                    />
                    <div>
                      <span className="font-semibold text-[#202522] block">Safety & directive review</span>
                      <span className="text-[11px] text-[#707770] leading-snug block">
                        Detect unauthorized clinical dosages, destructive commands, or financial guarantees.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Section 4: Operational Boundaries & Scope */}
              <div className="bg-[#FFFFFF] border border-[#E2E5E0] rounded-md p-5 space-y-3">
                <div className="flex items-center gap-2 border-b border-[#E2E5E0] pb-3">
                  <Info className="w-4 h-4 text-[#707770]" />
                  <h3 className="text-[14px] font-semibold text-[#202522]">
                    Operational Boundaries & Auditing Scope
                  </h3>
                </div>

                <div className="text-[12px] text-[#707770] leading-relaxed space-y-2.5">
                  <p>
                    <strong>1. Evidence Grounding:</strong> Assertions are evaluated strictly against the text of supplied reference files. Claims not found in source text will receive an <code className="text-[#966012] bg-[#FFFBF0] px-1 py-0.5 rounded font-mono">INSUFFICIENT_EVIDENCE</code> verdict.
                  </p>
                  <p>
                    <strong>2. Deterministic Arithmetic:</strong> Number and percentage checks compare quantities directly via Python math logic, catching metric discrepancies like revenue mismatch or growth rate inflation.
                  </p>
                  <p>
                    <strong>3. Human Review Standard:</strong> Automated verdicts indicate evidentiary grounding and are designed to assist human product, compliance, and research teams.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar: Diagnostics & Save Button (Full Width) */}
          <div className="bg-[#FAFAF9] border border-[#E2E5E0] rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-[#707770] gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 font-medium text-[#202522]">
                <Server className="w-3.5 h-3.5 text-[#326B55]" />
                <span>Engine: {config.engine_mode}</span>
              </div>
              <span>·</span>
              <span className="font-mono">App v{config.version}</span>
              <span>·</span>
              <span className="font-mono">Python {config.python_version}</span>
              <span>·</span>
              <span>FastAPI + SQLite Persistence</span>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-[#326B55] hover:bg-[#285644] text-[#FFFFFF] text-[13px] font-medium rounded transition-colors self-end sm:self-auto shadow-xs"
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
