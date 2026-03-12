import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  fetchExperiment,
  fetchExperimentResults,
  startExperiment,
  stopExperiment,
  concludeExperiment,
} from '@/api/client';
import type { Experiment } from '@/types/experiment';
import type { ExperimentResults, VariantResult } from '@/types/experiment';

const STATUS_COLORS: Record<string, string> = {
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

function formatPValue(p: number | null): string {
  if (p === null) return 'N/A';
  if (p < 0.001) return '< 0.001';
  return p.toFixed(4);
}

function pValueExplanation(p: number | null, significant: boolean): string {
  if (p === null) return 'Not enough data to calculate statistical significance.';
  if (significant) {
    return `The difference between variants is statistically significant (p = ${formatPValue(p)}). There is less than a 5% probability that this result is due to chance.`;
  }
  return `The difference is not yet statistically significant (p = ${formatPValue(p)}). More data is needed — there is a ${(p * 100).toFixed(1)}% probability the observed difference is due to chance.`;
}

export function ExperimentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [results, setResults] = useState<ExperimentResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [exp, res] = await Promise.all([
        fetchExperiment(id),
        fetchExperimentResults(id).catch(() => null),
      ]);
      setExperiment(exp);
      setResults(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll for results every 10s when running.
  useEffect(() => {
    if (experiment?.status !== 'running') return;
    const interval = setInterval(() => {
      if (!id) return;
      fetchExperimentResults(id)
        .then(setResults)
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [experiment?.status, id]);

  const handleStart = async () => {
    if (!id) return;
    setActionError(null);
    try {
      await startExperiment(id);
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleStop = async () => {
    if (!id) return;
    setActionError(null);
    try {
      await stopExperiment(id);
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleConclude = async (winnerKey: string) => {
    if (!id) return;
    if (
      !confirm(
        `Declare "${winnerKey}" the winner? This will update the flag's default value and stop the experiment.`,
      )
    )
      return;
    setActionError(null);
    try {
      await concludeExperiment(id, winnerKey);
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed');
    }
  };

  if (loading) return <p className="text-sm text-gray-500">Loading experiment...</p>;
  if (error) return <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!experiment) return <div className="text-sm text-gray-500">Experiment not found.</div>;

  const variantKeys = Object.keys(results?.variants ?? {});
  const maxSample = Math.max(...variantKeys.map((k) => results?.variants[k]?.sampleSize ?? 0), 1);

  return (
    <div>
      <button
        onClick={() => navigate('/experiments')}
        className="text-sm text-indigo-600 hover:text-indigo-500 mb-4 inline-block"
      >
        &larr; All experiments
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{experiment.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Flag: <span className="font-mono">{experiment.flagKey}</span> &middot; Metric:{' '}
            <span className="font-medium">{experiment.metric}</span>
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLORS[experiment.status]}`}
        >
          {experiment.status}
        </span>
      </div>

      {actionError && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 mb-4">{actionError}</div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mb-6">
        {experiment.status === 'draft' && (
          <button
            onClick={handleStart}
            className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500"
          >
            Start experiment
          </button>
        )}
        {experiment.status === 'running' && (
          <button
            onClick={handleStop}
            className="rounded-md bg-yellow-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yellow-500"
          >
            Stop experiment
          </button>
        )}
      </div>

      {/* Variants */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Variants
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {experiment.variants.map((v) => (
            <div key={v.key} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{v.key}</span>
                <span className="text-xs text-gray-500">{v.weight}% traffic</span>
              </div>
              <p className="text-sm font-mono text-gray-600">{JSON.stringify(v.value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      {results && variantKeys.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Results</h2>

          {/* Sample size bars */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
            <h3 className="text-xs font-medium text-gray-500 uppercase">Sample size</h3>
            {variantKeys.map((key) => {
              const vr = results.variants[key] as VariantResult;
              const pct = maxSample > 0 ? (vr.sampleSize / maxSample) * 100 : 0;
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{key}</span>
                    <span className="text-gray-500">{vr.sampleSize} users</span>
                  </div>
                  <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Metric comparison */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase mb-3">Metric comparison</h3>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase">
                  <th className="pb-2">Variant</th>
                  <th className="pb-2">Conversion rate</th>
                  <th className="pb-2">Mean</th>
                  <th className="pb-2">Std Dev</th>
                  <th className="pb-2">Sample</th>
                  {experiment.status === 'running' && <th className="pb-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {variantKeys.map((key) => {
                  const vr = results.variants[key] as VariantResult;
                  const isWinner = results.winner === key;
                  return (
                    <tr key={key} className={isWinner ? 'bg-green-50' : ''}>
                      <td className="py-2 font-medium text-gray-900">
                        {key}
                        {isWinner && (
                          <span className="ml-2 text-xs text-green-600 font-semibold">WINNER</span>
                        )}
                      </td>
                      <td className="py-2 text-gray-700">
                        {(vr.conversionRate * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 text-gray-700">{vr.mean.toFixed(2)}</td>
                      <td className="py-2 text-gray-700">{vr.stdDev.toFixed(2)}</td>
                      <td className="py-2 text-gray-500">{vr.sampleSize}</td>
                      {experiment.status === 'running' && (
                        <td className="py-2">
                          <button
                            onClick={() => handleConclude(key)}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                          >
                            Declare winner
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Statistical significance */}
          <div
            className={`rounded-lg border p-4 ${results.significanceReached ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xs font-medium text-gray-500 uppercase">
                Statistical significance
              </h3>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${results.significanceReached ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
              >
                p = {formatPValue(results.pValue)}
              </span>
            </div>
            <p className="text-sm text-gray-700">
              {pValueExplanation(results.pValue, results.significanceReached)}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Confidence level: {(results.confidenceLevel * 100).toFixed(0)}% (two-tailed Welch's
              t-test)
            </p>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-xs font-medium text-gray-500 uppercase mb-3">Timeline</h3>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-gray-500">Created</dt>
          <dd className="text-gray-700">{formatDate(experiment.createdAt)}</dd>
          <dt className="text-gray-500">Started</dt>
          <dd className="text-gray-700">{formatDate(experiment.startedAt)}</dd>
          <dt className="text-gray-500">Stopped</dt>
          <dd className="text-gray-700">{formatDate(experiment.stoppedAt)}</dd>
          {experiment.winner && (
            <>
              <dt className="text-gray-500">Winner</dt>
              <dd className="text-gray-700 font-medium">{experiment.winner}</dd>
            </>
          )}
          <dt className="text-gray-500">Created by</dt>
          <dd className="text-gray-700">{experiment.createdBy}</dd>
        </dl>
      </div>
    </div>
  );
}
