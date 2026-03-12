import { useEffect, useState } from 'react';
import { fetchAuditRecords } from '@/api/client';
import type { AuditRecord } from '@/types/audit';

interface AuditTrailProps {
  flagKey: string;
}

const ACTION_LABELS: Record<string, string> = {
  'flag.created': 'Created',
  'flag.updated': 'Updated',
  'flag.deleted': 'Deleted',
  'flag.enabled': 'Enabled',
  'flag.disabled': 'Disabled',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function AuditTrail({ flagKey }: AuditTrailProps) {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchAuditRecords({ flagKey, limit: 20 })
      .then(setRecords)
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [flagKey]);

  if (loading) {
    return <p className="text-xs text-gray-400">Loading history...</p>;
  }

  if (records.length === 0) {
    return <p className="text-xs text-gray-400">No audit history yet.</p>;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Recent changes</h4>
      <ul className="space-y-1.5">
        {records.map((r) => (
          <li key={r.id} className="text-xs text-gray-600 border-l-2 border-gray-200 pl-3 py-1">
            <span className="font-medium">{ACTION_LABELS[r.action] ?? r.action}</span>
            {' by '}
            <span className="text-gray-800">{r.performedBy}</span>
            <br />
            <span className="text-gray-400">{formatDate(r.performedAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
