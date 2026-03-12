interface DeleteDialogProps {
  open: boolean;
  flagKey: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteDialog({ open, flagKey, onConfirm, onCancel }: DeleteDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-gray-500/75" onClick={onCancel} />
      <div className="relative bg-white rounded-lg p-6 shadow-xl max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900">Delete flag</h3>
        <p className="mt-2 text-sm text-gray-500">
          Are you sure you want to delete <span className="font-mono font-medium">{flagKey}</span>?
          This action cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
