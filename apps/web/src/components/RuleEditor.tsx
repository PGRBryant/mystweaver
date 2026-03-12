import type { FlagType, Condition, TargetingRule } from '@/types/flag';
import { RuleConditionRow } from './RuleConditionRow';
import { ValueInput } from './ValueInput';

interface RuleEditorProps {
  rule: TargetingRule;
  flagType: FlagType;
  index: number;
  onChange: (rule: TargetingRule) => void;
  onRemove: () => void;
}

export function RuleEditor({ rule, flagType, index, onChange, onRemove }: RuleEditorProps) {
  const updateCondition = (i: number, condition: Condition) => {
    const conditions = [...rule.conditions];
    conditions[i] = condition;
    onChange({ ...rule, conditions });
  };

  const removeCondition = (i: number) => {
    onChange({ ...rule, conditions: rule.conditions.filter((_, idx) => idx !== i) });
  };

  const addCondition = () => {
    onChange({
      ...rule,
      conditions: [...rule.conditions, { attribute: '', operator: 'eq' as const, value: '' }],
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">Rule {index + 1}</h4>
        <button
          type="button"
          onClick={onRemove}
          className="text-sm text-red-600 hover:text-red-800"
        >
          Remove rule
        </button>
      </div>

      <input
        type="text"
        placeholder="Rule description"
        value={rule.description}
        onChange={(e) => onChange({ ...rule, description: e.target.value })}
        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
      />

      {/* Conditions */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
          Conditions (all must match)
        </label>
        {rule.conditions.map((condition, i) => (
          <RuleConditionRow
            key={i}
            condition={condition}
            onChange={(c) => updateCondition(i, c)}
            onRemove={() => removeCondition(i)}
          />
        ))}
        <button
          type="button"
          onClick={addCondition}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          + Add condition
        </button>
      </div>

      {/* Rollout percentage */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          Rollout percentage
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            value={rule.rolloutPercentage ?? 100}
            onChange={(e) =>
              onChange({
                ...rule,
                rolloutPercentage: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
            className="w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <span className="text-sm text-gray-500">%</span>
        </div>
      </div>

      {/* Value to serve */}
      <ValueInput
        type={flagType}
        value={rule.value}
        onChange={(v) => onChange({ ...rule, value: v })}
        label="Value to serve"
      />
    </div>
  );
}
