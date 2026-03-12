import { useState } from 'react';
import { evaluateFlag } from '@/api/client';
import type { EvaluateResult } from '@/types/flag';

interface EvalTesterProps {
  flagKey: string;
}

export function EvalTester({ flagKey }: EvalTesterProps) {
  const [contextJson, setContextJson] = useState('{\n  "userId": "user-123"\n}');
  const [result, setResult] = useState<EvaluateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEvaluate = async () => {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const context = JSON.parse(contextJson);
      const res = await evaluateFlag(flagKey, context);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Test evaluation</h3>
      <div>
        <label htmlFor="eval-context" className="block text-xs font-medium text-gray-500 mb-1">
          Context (JSON)
        </label>
        <textarea
          id="eval-context"
          rows={4}
          value={contextJson}
          onChange={(e) => setContextJson(e.target.value)}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono"
        />
      </div>
      <button
        type="button"
        onClick={handleEvaluate}
        disabled={loading}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? 'Evaluating...' : 'Evaluate'}
      </button>
      {result && (
        <div className="rounded-md bg-green-50 p-3 text-sm">
          <span className="font-medium text-green-800">Result:</span>{' '}
          <span className="font-mono text-green-700">{JSON.stringify(result.value)}</span>
        </div>
      )}
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    </div>
  );
}
