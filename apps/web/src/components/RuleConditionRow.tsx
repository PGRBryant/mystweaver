import type { Operator, Condition } from '@/types/flag';

const OPERATORS: { value: Operator; label: string }[] = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'not equals' },
  { value: 'gt', label: 'greater than' },
  { value: 'lt', label: 'less than' },
  { value: 'gte', label: 'greater or equal' },
  { value: 'lte', label: 'less or equal' },
  { value: 'in', label: 'in list' },
  { value: 'contains', label: 'contains' },
];

interface RuleConditionRowProps {
  condition: Condition;
  onChange: (condition: Condition) => void;
  onRemove: () => void;
}

export function RuleConditionRow({ condition, onChange, onRemove }: RuleConditionRowProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        placeholder="attribute"
        value={condition.attribute}
        onChange={(e) => onChange({ ...condition, attribute: e.target.value })}
        className="w-36 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
      />
      <select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.target.value as Operator })}
        className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
      >
        {OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        placeholder="value"
        value={String(condition.value ?? '')}
        onChange={(e) => onChange({ ...condition, value: e.target.value })}
        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
      />
      <button
        type="button"
        onClick={onRemove}
        className="text-gray-400 hover:text-red-500"
        title="Remove condition"
      >
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}
