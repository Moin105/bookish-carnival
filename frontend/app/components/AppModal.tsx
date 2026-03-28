interface AppModalProps {
  isOpen: boolean
  title: string
  message: string
  onClose: () => void
  onConfirm?: () => void
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
}

export default function AppModal({
  isOpen,
  title,
  message,
  onClose,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
}: AppModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6 whitespace-pre-line">{message}</p>

        <div className="flex justify-end gap-3">
          {onConfirm && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm ?? onClose}
            className={`px-4 py-2 text-sm font-medium rounded-lg text-white ${
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {onConfirm ? confirmText : 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}
