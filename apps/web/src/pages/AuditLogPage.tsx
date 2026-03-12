import { useEffect, useState } from 'react';
import { fetchAuditRecords, auditExportUrl } from '@/api/client';
import type { AuditRecord, AuditAction } from '@/types/audit';

const ACTIONS: AuditAction[] = [
  'flag.created',
  'flag.updated',
  'flag.deleted',
  'flag.enabled',
  'flag.disabled',
  'sdk-key.created',
  'sdk-key.revoked',
  'experiment.started',
  'experiment.stopped',
];

const ACTION_LABELS: Record<string, string> = {
  'flag.created': 'Flag created',
  'flag.updated': 'Flag updated',
  'flag.deleted': 'Flag deleted',
  'flag.enabled': 'Flag enabled',
  'flag.disabled': 'Flag disabled',
  'sdk-key.created': 'SDK key created',
  'sdk-key.revoked': 'SDK key revoked',
  'experiment.started': 'Experiment started',
  'experiment.stopped': 'Experiment stopped',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function DiffView({ label, data }: { label: string; data: unknown }) {
  if (data === null || data === undefined) return null;
  return (
    <details className="mt-1">
      <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
        {label}
      </summary>
      <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

export function AuditLogPage() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [flagKey, setFlagKey] = useState('');
  const [action, setAction] = useState('');
  const [performedBy, setPerformedBy] = useState('');

  const currentFilters = {
    flagKey: flagKey || undefined,
    action: action || undefined,
    performedBy: performedBy || undefined,
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchAuditRecords({
      flagKey: flagKey || undefined,
      action: action || undefined,
      performedBy: performedBy || undefined,
      limit: 100,
    })
      .then(setRecords)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [flagKey, action, performedBy]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit log</h1>
        <a
          href={auditExportUrl(currentFilters)}
          download
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Export CSV
        </a>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Filter by flag key..."
          value={flagKey}
          onChange={(e) => setFlagKey(e.target.value)}
          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm w-48"
        />
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Filter by user..."
          value={performedBy}
          onChange={(e) => setPerformedBy(e.target.value)}
          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm w-48"
        />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading audit records...</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No audit records found.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Flag
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(r.performedAt)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {ACTION_LABELS[r.action] ?? r.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">
                    {r.flagKey ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {r.performedBy}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <DiffView label="Before" data={r.before} />
                    <DiffView label="After" data={r.after} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
