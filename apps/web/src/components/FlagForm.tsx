import React, { useState } from 'react';
import type { FlagType, TargetingRule, CreateFlagData, UpdateFlagData, Flag } from '@/types/flag';
import { RuleEditor } from './RuleEditor';
import { ValueInput } from './ValueInput';
import { Toggle } from './Toggle';

const FLAG_TYPES: FlagType[] = ['boolean', 'string', 'number', 'json'];

const DEFAULT_VALUES: Record<FlagType, unknown> = {
  boolean: false,
  string: '',
  number: 0,
  json: {},
};

interface FlagFormProps {
  mode: 'create' | 'edit';
  initial?: Flag;
  onSubmit: (data: CreateFlagData | UpdateFlagData) => Promise<void>;
  submitting?: boolean;
}

export function FlagForm({ mode, initial, onSubmit, submitting }: FlagFormProps) {
  const [key, setKey] = useState(initial?.key ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [type, setType] = useState<FlagType>(initial?.type ?? 'boolean');
  const [defaultValue, setDefaultValue] = useState<unknown>(initial?.defaultValue ?? false);
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [rules, setRules] = useState<TargetingRule[]>(initial?.rules ?? []);
  const [error, setError] = useState<string | null>(null);

  const handleTypeChange = (newType: FlagType) => {
    setType(newType);
    setDefaultValue(DEFAULT_VALUES[newType]);
    // Reset rule values to match new type
    setRules(rules.map((r) => ({ ...r, value: DEFAULT_VALUES[newType] })));
  };

  const updateRule = (i: number, rule: TargetingRule) => {
    const next = [...rules];
    next[i] = rule;
    setRules(next);
  };

  const removeRule = (i: number) => {
    setRules(rules.filter((_, idx) => idx !== i));
  };

  const addRule = () => {
    setRules([
      ...rules,
      {
        id: `rule-${Date.now()}`,
        description: '',
        conditions: [{ attribute: '', operator: 'eq' as const, value: '' }],
        value: DEFAULT_VALUES[type],
      },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (mode === 'create' && !key.trim()) {
      setError('Flag key is required');
      return;
    }
    if (!name.trim()) {
      setError('Flag name is required');
      return;
    }

    try {
      if (mode === 'create') {
        await onSubmit({
          key: key.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          type,
          defaultValue,
          enabled,
          rules: rules.length > 0 ? rules : undefined,
        } satisfies CreateFlagData);
      } else {
        await onSubmit({
          name: name.trim(),
          description: description.trim(),
          enabled,
          defaultValue,
          rules,
        } satisfies UpdateFlagData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Key (create only) */}
      {mode === 'create' && (
        <div>
          <label htmlFor="flag-key" className="block text-sm font-medium text-gray-700">
            Key
          </label>
          <input
            id="flag-key"
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="e.g. new-dashboard"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Used in SDK calls. Cannot be changed after creation.
          </p>
        </div>
      )}

      {/* Name */}
      <div>
        <label htmlFor="flag-name" className="block text-sm font-medium text-gray-700">
          Name
        </label>
        <input
          id="flag-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New Dashboard"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="flag-desc" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="flag-desc"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      {/* Type */}
      <div>
        <label htmlFor="flag-type" className="block text-sm font-medium text-gray-700">
          Type
        </label>
        <select
          id="flag-type"
          value={type}
          onChange={(e) => handleTypeChange(e.target.value as FlagType)}
          disabled={mode === 'edit'}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-100"
        >
          {FLAG_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Enabled */}
      <div className="flex items-center gap-3">
        <Toggle enabled={enabled} onChange={setEnabled} />
        <span className="text-sm text-gray-700">{enabled ? 'Enabled' : 'Disabled'}</span>
      </div>

      {/* Default value */}
      <ValueInput type={type} value={defaultValue} onChange={setDefaultValue} label="Default value" />

      {/* Rules */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">Targeting rules</label>
          <button
            type="button"
            onClick={addRule}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            + Add rule
          </button>
        </div>
        {rules.length === 0 && (
          <p className="text-sm text-gray-500">
            No targeting rules. All users will receive the default value.
          </p>
        )}
        {rules.map((rule, i) => (
          <RuleEditor
            key={i}
            rule={rule}
            flagType={type}
            index={i}
            onChange={(r) => updateRule(i, r)}
            onRemove={() => removeRule(i)}
          />
        ))}
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          {submitting
            ? mode === 'create'
              ? 'Creating...'
              : 'Saving...'
            : mode === 'create'
              ? 'Create flag'
              : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
