import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlags } from '@/hooks/useFlags';
import { FlagTable } from '@/components/FlagTable';
import { EmptyState } from '@/components/EmptyState';
import type { FlagType } from '@/types/flag';

type StatusFilter = 'all' | 'enabled' | 'disabled';

export function FlagListPage() {
  const { flags, loading, error, refetch } = useFlags();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<FlagType | 'all'>('all');
  const [tagFilter, setTagFilter] = useState('');

  // Collect unique tags for the tag filter dropdown.
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const f of flags) {
      for (const t of f.tags ?? []) set.add(t);
    }
    return Array.from(set).sort();
  }, [flags]);

  const filtered = useMemo(() => {
    let result = flags;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (f) => f.key.toLowerCase().includes(q) || f.name.toLowerCase().includes(q),
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((f) => (statusFilter === 'enabled' ? f.enabled : !f.enabled));
    }

    if (typeFilter !== 'all') {
      result = result.filter((f) => f.type === typeFilter);
    }

    if (tagFilter) {
      result = result.filter((f) => (f.tags ?? []).includes(tagFilter));
    }

    return result;
  }, [flags, search, statusFilter, typeFilter, tagFilter]);

  if (loading) {
    return <p className="text-sm text-gray-500">Loading flags...</p>;
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        Failed to load flags: {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Feature flags</h1>
        <button
          onClick={() => navigate('/flags/new')}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          Create flag
        </button>
      </div>

      {/* Search + filters */}
      {flags.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search by key or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm w-64"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="all">All statuses</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as FlagType | 'all')}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="all">All types</option>
            <option value="boolean">boolean</option>
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="json">json</option>
          </select>
          {allTags.length > 0 && (
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">All tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {flags.length === 0 ? (
        <EmptyState
          title="No flags yet"
          description="Create your first feature flag to get started."
          actionLabel="Create flag"
          onAction={() => navigate('/flags/new')}
        />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No flags match your filters.</p>
      ) : (
        <FlagTable flags={filtered} onToggle={refetch} />
      )}
    </div>
  );
}
