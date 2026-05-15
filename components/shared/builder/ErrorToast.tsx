'use client';

interface Props {
  message: string | null;
  onClose?: () => void;
}

export default function ErrorToast({ message, onClose }: Props) {
  if (!message) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-lg border border-red-100 bg-white px-4 py-3 shadow-xl">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-2 w-2 rounded-full bg-red-400" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-red-600">Sparning misslyckades</p>
          <p className="mt-1 text-sm text-gray-600">{message}</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-gray-300 transition-colors hover:text-gray-600"
            aria-label="Stäng felmeddelande"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
