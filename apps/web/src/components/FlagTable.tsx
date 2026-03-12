import { useNavigate } from 'react-router-dom';
import type { Flag } from '@/types/flag';
import { Toggle } from './Toggle';
import { updateFlag } from '@/api/client';

interface FlagTableProps {
  flags: Flag[];
  onToggle: () => void;
}

export function FlagTable({ flags, onToggle }: FlagTableProps) {
  const navigate = useNavigate();

  const handleToggle = async (flag: Flag) => {
    await updateFlag(flag.key, { enabled: !flag.enabled });
    onToggle();
  };

  return (
    <div className="overflow-hidden shadow ring-1 ring-black/5 rounded-lg">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">
              Name
            </th>
            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Key</th>
            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Type</th>
            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Enabled
            </th>
            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Updated
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {flags.map((flag) => (
            <tr
              key={flag.key}
              onClick={() => navigate(`/flags/${encodeURIComponent(flag.key)}`)}
              className="cursor-pointer hover:bg-gray-50"
            >
              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                {flag.name}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                {flag.key}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{flag.type}</td>
              <td
                className="whitespace-nowrap px-3 py-4 text-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <Toggle enabled={flag.enabled} onChange={() => handleToggle(flag)} />
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {new Date(flag.updatedAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
