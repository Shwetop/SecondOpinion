import React, { useState } from 'react';
import { 
  Upload, 
  FileText, 
  Trash2, 
  Play, 
  Clock, 
  AlertCircle, 
  FileCode, 
  BookOpen, 
  Settings2,
  Sparkles,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { uploadSourceFile, createAudit, fetchAudit, fetchDemoDataset } from '../services/api';
import type { AuditOptions } from '../types';

interface NewAuditPageProps {
  navigate: (route: string) => void;
}

interface UploadedDoc {
  id: string;
  filename: string;
  size_bytes: number;
  page_count: number;
  preview_snippet: string;
}

export const NewAuditPage: React.FC<NewAuditPageProps> = ({ navigate }) => {
  const [title, setTitle] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [sourceMode, setSourceMode] = useState<'upload' | 'paste'>('upload');
  const [pastedSource, setPastedSource] = useState('');
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [options, setOptions] = useState<AuditOptions>({
    verify_sources: true,
    reasoning_checks: true,
    safety_review: true,
    external_verification: false
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeStepText, setActiveStepText] = useState('');
  const [progressPct, setProgressPct] = useState(0);

  const wordCount = answerText.trim() ? answerText.trim().split(/\s+/).length : 0;
  const charCount = answerText.length;
  const paragraphCount = answerText.trim() ? answerText.trim().split(/\n\s*\n/).length : 0;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      setUploading(true);
      setUploadError(null);
      const res = await uploadSourceFile(file);
      setUploadedDocs(prev => [...prev, res]);
    } catch (err: any) {
      setUploadError(err.message || 'File upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeDoc = (id: string) => {
    setUploadedDocs(prev => prev.filter(d => d.id !== id));
  };

  const loadDemo = async (demoId: 'earnings' | 'cybersecurity') => {
    try {
      setSubmitError(null);
      const demo = await fetchDemoDataset(demoId);
      setTitle(demo.title);
      setAnswerText(demo.answer_text);
      setPastedSource(demo.source_text);
      setSourceMode('paste');
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to load demo dataset');
    }
  };

  const handleRunAudit = async () => {
    if (!answerText.trim()) {
      setSubmitError('Please supply the AI-generated answer to audit.');
      return;
    }

    if (sourceMode === 'paste' && !pastedSource.trim()) {
      setSubmitError('Please paste the reference source material.');
      return;
    }

    if (sourceMode === 'upload' && uploadedDocs.length === 0) {
      setSubmitError('Please upload at least one source document (PDF, DOCX, or TXT).');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      setActiveStepText('Submitting audit request...');
      setProgressPct(5);

      const audit = await createAudit({
        title: title.trim() || undefined,
        answer_text: answerText,
        source_text: sourceMode === 'paste' ? pastedSource : undefined,
        source_document_ids: sourceMode === 'upload' ? uploadedDocs.map(d => d.id) : [],
        options
      });

      const auditId = audit.id;
      let completed = false;
      let attempts = 0;

      while (!completed && attempts < 100) {
        await new Promise(r => setTimeout(r, 500));
        attempts++;
        const statusReport = await fetchAudit(auditId);
        
        setActiveStepText(statusReport.current_step || 'Processing...');
        setProgressPct(statusReport.progress_percentage || 20);

        if (statusReport.status === 'COMPLETED') {
          completed = true;
          navigate(`/audit/${auditId}`);
          return;
        } else if (statusReport.status === 'FAILED') {
          throw new Error(statusReport.error_message || 'Audit execution failed');
        }
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Audit failed');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full px-8 py-6 space-y-5">
      
      {/* Page Title & Presets (Full Width) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E2E5E0]">
        <div>
          <h2 className="text-[20px] font-semibold text-[#202522]">
            New Audit Submission
          </h2>
          <p className="text-[13px] text-[#707770] mt-0.5">
            Submit an AI-generated answer and primary reference documents for traceable verification.
          </p>
        </div>

        {/* Demo Data Presets */}
        <div className="flex items-center gap-2.5 text-[12px]">
          <span className="text-[#707770] font-medium">Quick Demonstration Presets:</span>
          <button
            onClick={() => loadDemo('earnings')}
            className="px-3 py-1.5 text-[11px] font-medium bg-[#FFFFFF] hover:bg-[#F7F8F6] border border-[#E2E5E0] rounded text-[#202522] transition-colors shadow-xs"
          >
            Q3 Earnings Report Sample
          </button>
          <button
            onClick={() => loadDemo('cybersecurity')}
            className="px-3 py-1.5 text-[11px] font-medium bg-[#FFFFFF] hover:bg-[#F7F8F6] border border-[#E2E5E0] rounded text-[#202522] transition-colors shadow-xs"
          >
            Security Compliance Sample
          </button>
        </div>
      </div>

      {submitError && (
        <div className="p-3 bg-[#FDF2F2] border border-[#F8CBCB] rounded text-[13px] text-[#A82A2A] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Audit Title Input */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E0] rounded-md p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="text-[12px] font-semibold uppercase tracking-wider text-[#707770] shrink-0 sm:w-44">
          Audit Ledger Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Clinical Trial Analysis BC-902 / Q3 Financial Audit Report"
          className="flex-1 px-3 py-1.5 bg-[#FBFBFA] border border-[#E2E5E0] rounded text-[13px] focus:outline-none focus:border-[#326B55]"
        />
        <span className="text-[11px] text-[#707770] font-mono shrink-0 hidden sm:inline">
          Automatic from input if left blank
        </span>
      </div>

      {/* Two-Column Document Submission Workspace (Full Width, Viewport Efficient) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: AI-Generated Answer */}
        <div className="bg-[#FFFFFF] border border-[#E2E5E0] rounded-md p-5 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] font-semibold text-[#202522] uppercase tracking-wider flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-[#326B55]" />
                Target AI-Generated Answer
              </label>
              {answerText && (
                <button
                  onClick={() => setAnswerText('')}
                  className="text-[11px] text-[#A82A2A] hover:underline font-medium"
                >
                  Clear Editor
                </button>
              )}
            </div>
            <p className="text-[11px] text-[#707770] mb-3">
              The unverified output or report produced by your AI model to be audited.
            </p>

            <textarea
              rows={18}
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Paste the full AI-generated response, analysis, or claims here..."
              className="w-full p-4 bg-[#FBFBFA] border border-[#E2E5E0] rounded text-[13.5px] font-normal leading-relaxed focus:outline-none focus:border-[#326B55] resize-y min-h-[380px]"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#E2E5E0] text-[11px] text-[#707770] font-mono">
            <span>{wordCount} words · {paragraphCount} paragraphs</span>
            <span>{charCount} characters</span>
          </div>
        </div>

        {/* Right Column: Primary Source Material */}
        <div className="bg-[#FFFFFF] border border-[#E2E5E0] rounded-md p-5 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] font-semibold text-[#202522] uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-[#326B55]" />
                Primary Source Material (Ground Truth)
              </label>

              {/* Source Tab Toggle */}
              <div className="flex rounded border border-[#E2E5E0] p-0.5 bg-[#F7F8F6] text-[11px]">
                <button
                  type="button"
                  onClick={() => setSourceMode('upload')}
                  className={`px-3 py-1 rounded font-medium transition-colors ${
                    sourceMode === 'upload' ? 'bg-[#FFFFFF] text-[#202522] shadow-xs' : 'text-[#707770]'
                  }`}
                >
                  Upload Files (PDF / DOCX)
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode('paste')}
                  className={`px-3 py-1 rounded font-medium transition-colors ${
                    sourceMode === 'paste' ? 'bg-[#FFFFFF] text-[#202522] shadow-xs' : 'text-[#707770]'
                  }`}
                >
                  Paste Ground-Truth Text
                </button>
              </div>
            </div>

            <p className="text-[11px] text-[#707770] mb-3">
              Official reference documentation used for verbatim citation extraction and mathematical cross-checks.
            </p>

            {sourceMode === 'upload' ? (
              <div className="space-y-4">
                {/* Upload Drag & Drop Area */}
                <label className="border-2 border-dashed border-[#D5D8D2] hover:border-[#326B55] rounded-md p-8 flex flex-col items-center justify-center cursor-pointer bg-[#FBFBFA] transition-colors">
                  <Upload className="w-8 h-8 text-[#707770] mb-2" />
                  <span className="text-[13.5px] font-medium text-[#202522]">
                    Select source document or drag & drop files
                  </span>
                  <span className="text-[11px] text-[#707770] mt-1 font-mono">
                    Supported: PDF (PyMuPDF/pypdf), Word (.docx), PowerPoint (.pptx), Plain Text (.txt, .md)
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc,.pptx,.txt,.md"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>

                {uploading && (
                  <div className="flex items-center gap-2 text-[12px] text-[#326B55] p-3 bg-[#EAF5EE] rounded border border-[#C1E2CE]">
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Extracting pages and chunking passages with stable character offsets...</span>
                  </div>
                )}

                {uploadError && (
                  <div className="p-3 bg-[#FDF2F2] border border-[#F8CBCB] rounded text-[12px] text-[#A82A2A]">
                    {uploadError}
                  </div>
                )}

                {/* Uploaded Documents List */}
                {uploadedDocs.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    <span className="text-[11px] font-semibold text-[#707770] uppercase tracking-wider block">
                      Parsed Source Documents ({uploadedDocs.length}):
                    </span>
                    {uploadedDocs.map(doc => (
                      <div key={doc.id} className="p-3 bg-[#F7F8F6] border border-[#E2E5E0] rounded text-[12px] flex items-start justify-between gap-3">
                        <div className="overflow-hidden">
                          <div className="flex items-center gap-2 font-medium text-[#202522]">
                            <FileText className="w-4 h-4 text-[#326B55] shrink-0" />
                            <span className="truncate">{doc.filename}</span>
                          </div>
                          <div className="text-[11px] text-[#707770] font-mono mt-0.5">
                            {doc.page_count} page(s) · {doc.preview_snippet ? 'Passages indexed' : ''} · {Math.round(doc.size_bytes / 1024)} KB
                          </div>
                          <p className="text-[11px] text-[#484F49] mt-1 line-clamp-2 italic">
                            "{doc.preview_snippet}"
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDoc(doc.id)}
                          className="text-[#707770] hover:text-[#A82A2A] p-1.5 rounded hover:bg-[#FFFFFF]"
                          title="Remove document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <textarea
                  rows={18}
                  value={pastedSource}
                  onChange={(e) => setPastedSource(e.target.value)}
                  placeholder="Paste verified ground-truth documentation, trial notes, financial ledger, or specification text here..."
                  className="w-full p-4 bg-[#FBFBFA] border border-[#E2E5E0] rounded text-[13.5px] font-normal leading-relaxed focus:outline-none focus:border-[#326B55] resize-y min-h-[380px]"
                />
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#E2E5E0] flex items-center justify-between text-[11px] text-[#707770]">
            <span>Mode: <strong className="text-[#202522]">Strict Source Grounding</strong></span>
            <span className="font-mono">Never obeys embedded prompt injections</span>
          </div>
        </div>
      </div>

      {/* Verification Parameters & Run Action (Full Width Banner) */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E0] rounded-md p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-[#202522]">
            <Settings2 className="w-4 h-4 text-[#707770]" />
            Auditing Parameters
          </div>
          <div className="flex flex-wrap items-center gap-6 text-[13px] text-[#484F49]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.verify_sources}
                onChange={(e) => setOptions(prev => ({ ...prev, verify_sources: e.target.checked }))}
                className="accent-[#326B55]"
              />
              <span>Verify against supplied sources</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.reasoning_checks}
                onChange={(e) => setOptions(prev => ({ ...prev, reasoning_checks: e.target.checked }))}
                className="accent-[#326B55]"
              />
              <span>Reasoning consistency checks</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.safety_review}
                onChange={(e) => setOptions(prev => ({ ...prev, safety_review: e.target.checked }))}
                className="accent-[#326B55]"
              />
              <span>Safety & directive review</span>
            </label>
          </div>
        </div>

        <button
          onClick={handleRunAudit}
          disabled={isSubmitting}
          className={`
            px-6 py-2.5 rounded text-[13px] font-medium flex items-center gap-2 transition-colors shrink-0 shadow-xs
            ${isSubmitting 
              ? 'bg-[#E2E5E0] text-[#707770] cursor-not-allowed' 
              : 'bg-[#326B55] hover:bg-[#285644] text-[#FFFFFF]'}
          `}
        >
          {isSubmitting ? (
            <>
              <Clock className="w-4 h-4 animate-spin" />
              <span>Processing Audit Pipeline...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Run Audit</span>
            </>
          )}
        </button>
      </div>

      {/* Live Processing Pipeline Overlay / Progress Tracker */}
      {isSubmitting && (
        <div className="bg-[#FFFFFF] border border-[#326B55] rounded-md p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between text-[13px]">
            <div className="flex items-center gap-2 font-semibold text-[#202522]">
              <Clock className="w-4 h-4 animate-spin text-[#326B55]" />
              <span>{activeStepText || 'Auditing in progress...'}</span>
            </div>
            <span className="font-mono text-[12px] text-[#326B55] font-semibold">{progressPct}%</span>
          </div>

          <div className="w-full bg-[#E2E5E0] h-2 rounded-full overflow-hidden">
            <div 
              className="bg-[#326B55] h-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] pt-1 text-[#707770]">
            <div className={`p-2 rounded text-center border ${progressPct >= 15 ? 'text-[#326B55] font-semibold bg-[#EAF5EE] border-[#C1E2CE]' : 'border-[#E2E5E0]'}`}>
              1. Processing Sources
            </div>
            <div className={`p-2 rounded text-center border ${progressPct >= 35 ? 'text-[#326B55] font-semibold bg-[#EAF5EE] border-[#C1E2CE]' : 'border-[#E2E5E0]'}`}>
              2. Extracting Claims
            </div>
            <div className={`p-2 rounded text-center border ${progressPct >= 55 ? 'text-[#326B55] font-semibold bg-[#EAF5EE] border-[#C1E2CE]' : 'border-[#E2E5E0]'}`}>
              3. Retrieving Evidence
            </div>
            <div className={`p-2 rounded text-center border ${progressPct >= 75 ? 'text-[#326B55] font-semibold bg-[#EAF5EE] border-[#C1E2CE]' : 'border-[#E2E5E0]'}`}>
              4. Verifying Claims
            </div>
            <div className={`p-2 rounded text-center border ${progressPct >= 95 ? 'text-[#326B55] font-semibold bg-[#EAF5EE] border-[#C1E2CE]' : 'border-[#E2E5E0]'}`}>
              5. Assembling Ledger
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
