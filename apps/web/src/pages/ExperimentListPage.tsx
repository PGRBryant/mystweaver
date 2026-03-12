import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchExperiments,
  createExperiment,
  deleteExperiment,
  startExperiment,
  stopExperiment,
} from '@/api/client';
import type { Experiment, ExperimentStatus } from '@/types/experiment';

const STATUS_COLORS: Record<ExperimentStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  running: 'bg-green-100 text-green-700',
  stopped: 'bg-yellow-100 text-yellow-700',
  concluded: 'bg-blue-100 text-blue-700',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function ExperimentListPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    setError(null);
    fetchExperiments()
      .then(setExperiments)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleStart = async (id: string) => {
    try {
      await startExperiment(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start');
    }
  };

  const handleStop = async (id: string) => {
    try {
      await stopExperiment(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this experiment?')) return;
    try {
      await deleteExperiment(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Experiments</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          New experiment
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {showCreate && (
        <CreateExperimentForm
          onCreated={() => { setShowCreate(false); load(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading experiments...</p>
      ) : experiments.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No experiments yet. Create one to get started.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Flag</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metric</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {experiments.map((exp) => (
                <tr key={exp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => navigate(`/experiments/${exp.id}`)}
                      className="font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      {exp.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">{exp.flagKey}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{exp.metric}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[exp.status]}`}>
                      {exp.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(exp.startedAt)}
                  </td>
                  <td className="px-4 py-3 text-sm space-x-2">
                    {exp.status === 'draft' && (
                      <>
                        <button onClick={() => handleStart(exp.id)} className="text-green-600 hover:text-green-500 text-xs font-medium">
                          Start
                        </button>
                        <button onClick={() => handleDelete(exp.id)} className="text-red-600 hover:text-red-500 text-xs font-medium">
                          Delete
                        </button>
                      </>
                    )}
                    {exp.status === 'running' && (
                      <button onClick={() => handleStop(exp.id)} className="text-yellow-600 hover:text-yellow-500 text-xs font-medium">
                        Stop
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/experiments/${exp.id}`)}
                      className="text-indigo-600 hover:text-indigo-500 text-xs font-medium"
                    >
                      View
                    </button>
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

// ── Inline create form ───────────────────────────────────────────────────

function CreateExperimentForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [flagKey, setFlagKey] = useState('');
  const [metric, setMetric] = useState('');
  const [variantA, setVariantA] = useState({ key: 'control', value: '', weight: 50 });
  const [variantB, setVariantB] = useState({ key: 'treatment', value: '', weight: 50 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Try to parse variant values as JSON, fall back to string.
      const parseValue = (v: string): unknown => {
        try { return JSON.parse(v); } catch { return v; }
      };

      await createExperiment({
        name,
        flagKey,
        metric,
        variants: [
          { key: variantA.key, value: parseValue(variantA.value), weight: variantA.weight },
          { key: variantB.key, value: parseValue(variantB.value), weight: variantB.weight },
        ],
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-lg border border-gray-200 bg-white p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">New experiment</h3>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-3 gap-3">
        <input
          type="text"
          placeholder="Experiment name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        <input
          type="text"
          placeholder="Flag key"
          value={flagKey}
          onChange={(e) => setFlagKey(e.target.value)}
          required
          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono"
        />
        <input
          type="text"
          placeholder="Metric event name"
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          required
          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <fieldset className="rounded border border-gray-200 p-3 space-y-2">
          <legend className="text-xs font-medium text-gray-500 px-1">Variant A</legend>
          <input type="text" placeholder="Key" value={variantA.key} onChange={(e) => setVariantA({ ...variantA, key: e.target.value })} className="w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
          <input type="text" placeholder="Value" value={variantA.value} onChange={(e) => setVariantA({ ...variantA, value: e.target.value })} className="w-full rounded-md border-gray-300 shadow-sm sm:text-sm font-mono" />
          <label className="flex items-center gap-2 text-xs text-gray-500">
            Weight
            <input type="number" min={1} max={99} value={variantA.weight} onChange={(e) => { const w = Number(e.target.value); setVariantA({ ...variantA, weight: w }); setVariantB({ ...variantB, weight: 100 - w }); }} className="w-16 rounded-md border-gray-300 shadow-sm sm:text-sm" />
            %
          </label>
        </fieldset>
        <fieldset className="rounded border border-gray-200 p-3 space-y-2">
          <legend className="text-xs font-medium text-gray-500 px-1">Variant B</legend>
          <input type="text" placeholder="Key" value={variantB.key} onChange={(e) => setVariantB({ ...variantB, key: e.target.value })} className="w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
          <input type="text" placeholder="Value" value={variantB.value} onChange={(e) => setVariantB({ ...variantB, value: e.target.value })} className="w-full rounded-md border-gray-300 shadow-sm sm:text-sm font-mono" />
          <label className="flex items-center gap-2 text-xs text-gray-500">
            Weight
            <input type="number" min={1} max={99} value={variantB.weight} readOnly className="w-16 rounded-md border-gray-300 shadow-sm sm:text-sm bg-gray-50" />
            %
          </label>
        </fieldset>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50">
          {submitting ? 'Creating...' : 'Create'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
