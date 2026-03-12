import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFlag } from '@/hooks/useFlag';
import { updateFlag, deleteFlag } from '@/api/client';
import { FlagForm } from '@/components/FlagForm';
import { EvalTester } from '@/components/EvalTester';
import { AuditTrail } from '@/components/AuditTrail';
import { DeleteDialog } from '@/components/DeleteDialog';
import type { CreateFlagData, UpdateFlagData } from '@/types/flag';

export function FlagEditPage() {
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const { flag, loading, error } = useFlag(key!);
  const [submitting, setSubmitting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        Failed to load flag: {error}
      </div>
    );
  }
  if (!flag) return <p className="text-sm text-gray-500">Flag not found.</p>;

  const handleSubmit = async (data: CreateFlagData | UpdateFlagData) => {
    setSubmitting(true);
    try {
      await updateFlag(flag.key, data as UpdateFlagData);
      navigate('/');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    await deleteFlag(flag.key);
    navigate('/');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{flag.name}</h1>
          <p className="text-sm text-gray-500 font-mono">{flag.key}</p>
        </div>
        <button
          onClick={() => setDeleteOpen(true)}
          className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
        >
          Delete
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <FlagForm
            mode="edit"
            initial={flag}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        </div>
        <div className="space-y-8">
          <EvalTester flagKey={flag.key} />
          <AuditTrail flagKey={flag.key} />
        </div>
      </div>

      <DeleteDialog
        open={deleteOpen}
        flagKey={flag.key}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
