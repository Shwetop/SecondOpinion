import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Trash2, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  FileText,
  RefreshCw,
  Filter,
  ArrowRight
} from 'lucide-react';
import type { AuditListItem } from '../types';
import { fetchAuditsList, deleteAudit } from '../services/api';

interface HistoryPageProps {
  navigate: (route: string) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ navigate }) => {
  const [audits, setAudits] = useState<AuditListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAudits = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAuditsList();
      setAudits(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudits();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete audit '${id}'? This will permanently remove its claim ledger from the SQLite database.`)) {
      return;
    }

    try {
      setDeletingId(id);
      await deleteAudit(id);
      setAudits(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredAudits = audits
    .filter(a => {
      if (searchTerm.trim() && !a.title.toLowerCase().includes(searchTerm.toLowerCase()) && !a.id.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (statusFilter !== 'ALL' && a.status !== statusFilter) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === 'desc') {
        return b.created_at.localeCompare(a.created_at);
      }
      return a.created_at.localeCompare(b.created_at);
    });

  return (
    <div className="w-full px-8 py-6 space-y-6">
      {/* Title & Controls (Full Width) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E2E5E0]">
        <div>
          <h2 className="text-[20px] font-semibold text-[#202522]">
            Audit History Ledger
          </h2>
          <p className="text-[13px] text-[#707770] mt-0.5">
            Complete searchable ledger of all historical audit sessions stored in the persistent database.
          </p>
        </div>

        <button
          onClick={loadAudits}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFFFFF] hover:bg-[#F7F8F6] border border-[#E2E5E0] text-[12px] text-[#202522] rounded transition-colors self-start sm:self-auto shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Filter and Search Bar (Full Width) */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#FFFFFF] p-3 border border-[#E2E5E0] rounded-md">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#707770]" />
          <input
            type="text"
            placeholder="Search audits by title, topic, or audit ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-[13px] bg-[#FBFBFA] border border-[#E2E5E0] rounded focus:outline-none focus:border-[#326B55]"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-[12px] bg-[#FBFBFA] border border-[#E2E5E0] rounded py-1.5 px-2.5 focus:outline-none text-[#202522]"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="PENDING">Pending / In Progress</option>
          </select>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="text-[12px] bg-[#FBFBFA] border border-[#E2E5E0] rounded py-1.5 px-2.5 focus:outline-none text-[#202522]"
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Audits Full-Width Table */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E0] rounded-md overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-[#707770] text-[13px]">
            <Clock className="w-5 h-5 mx-auto mb-2 animate-spin text-[#326B55]" />
            Loading historical records...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-[#A82A2A] text-[13px]">
            {error}
          </div>
        ) : filteredAudits.length === 0 ? (
          <div className="p-16 text-center text-[#707770] text-[13px]">
            No audits match your search query.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#F7F8F6] text-[#707770] text-[11px] uppercase tracking-wider border-b border-[#E2E5E0]">
                <tr>
                  <th className="py-3 px-5 font-semibold">Audit Name</th>
                  <th className="py-3 px-4 font-semibold font-mono">Audit ID</th>
                  <th className="py-3 px-4 font-semibold">Created Date</th>
                  <th className="py-3 px-4 font-semibold text-center">Sources</th>
                  <th className="py-3 px-4 font-semibold text-center">Claims</th>
                  <th className="py-3 px-4 font-semibold text-center">Contradictions</th>
                  <th className="py-3 px-4 font-semibold text-center">Supported</th>
                  <th className="py-3 px-4 font-semibold text-center">Ungrounded</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E5E0]">
                {filteredAudits.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => navigate(`/audit/${a.id}`)}
                    className="hover:bg-[#F9FAF8] transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-5 font-medium text-[#202522]">
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-[#707770] group-hover:text-[#326B55] shrink-0" />
                        <span className="group-hover:underline underline-offset-2">{a.title}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#707770]">
                      {a.id}
                    </td>
                    <td className="py-3.5 px-4 text-[#707770] font-mono text-[11px]">
                      {a.created_at}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-[12px]">
                      {a.source_doc_count}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-[#202522]">
                      {a.total_claims}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono">
                      {a.contradicted_count > 0 ? (
                        <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-[#FDF2F2] text-[#A82A2A] border border-[#F8CBCB]">
                          {a.contradicted_count}
                        </span>
                      ) : (
                        <span className="text-[#707770]">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-[#206443]">
                      {a.supported_count}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-[#966012]">
                      {a.insufficient_count}
                    </td>
                    <td className="py-3.5 px-4">
                      {a.status === 'COMPLETED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#EAF5EE] text-[#206443] border border-[#C1E2CE]">
                          <CheckCircle2 className="w-3 h-3" />
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#FDF2F2] text-[#A82A2A] border border-[#F8CBCB]">
                          <AlertCircle className="w-3 h-3" />
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/audit/${a.id}`);
                          }}
                          className="text-[12px] text-[#326B55] hover:underline font-medium inline-flex items-center gap-1"
                        >
                          <span>Review</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(a.id, e)}
                          disabled={deletingId === a.id}
                          className="text-[#707770] hover:text-[#A82A2A] p-1 rounded hover:bg-[#F7F8F6]"
                          title="Delete audit from database"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
