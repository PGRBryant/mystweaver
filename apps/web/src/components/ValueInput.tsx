import type { FlagType } from '@/types/flag';

interface ValueInputProps {
  type: FlagType;
  value: unknown;
  onChange: (value: unknown) => void;
  label?: string;
}

export function ValueInput({ type, value, onChange, label }: ValueInputProps) {
  const id = label?.toLowerCase().replace(/\s+/g, '-') ?? 'value';

  switch (type) {
    case 'boolean':
      return (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          {label && <span className="text-sm text-gray-700">{label}</span>}
        </label>
      );

    case 'number':
      return (
        <div>
          {label && (
            <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
              {label}
            </label>
          )}
          <input
            id={id}
            type="number"
            value={typeof value === 'number' ? value : ''}
            onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      );

    case 'json':
      return (
        <div>
          {label && (
            <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
              {label}
            </label>
          )}
          <textarea
            id={id}
            rows={3}
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                onChange(JSON.parse(e.target.value));
              } catch {
                onChange(e.target.value);
              }
            }}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono"
          />
        </div>
      );

    default:
      return (
        <div>
          {label && (
            <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
              {label}
            </label>
          )}
          <input
            id={id}
            type="text"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      );
  }
}
