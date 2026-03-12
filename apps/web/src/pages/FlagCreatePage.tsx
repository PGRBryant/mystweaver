import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createFlag } from '@/api/client';
import { FlagForm } from '@/components/FlagForm';
import type { CreateFlagData, UpdateFlagData } from '@/types/flag';

export function FlagCreatePage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (data: CreateFlagData | UpdateFlagData) => {
    setSubmitting(true);
    try {
      await createFlag(data as CreateFlagData);
      navigate('/');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create flag</h1>
      <FlagForm mode="create" onSubmit={handleSubmit} submitting={submitting} />
    </div>
  );
}
