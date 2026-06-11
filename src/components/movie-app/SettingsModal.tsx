"use client";

interface SettingsModalProps {
  folderName: string | null;
  pickerError: string | null;
  onChangeFolder: () => void;
  onClose: () => void;
}

export function SettingsModal({
  folderName,
  pickerError,
  onChangeFolder,
  onClose,
}: SettingsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold text-white mb-2">Settings</h2>
        <p className="text-neutral-400 text-sm mb-6">
          Current workspace:{" "}
          <span className="text-neutral-300 font-mono">{folderName}</span>
        </p>

        {pickerError && (
          <p className="text-red-400 text-sm mb-4 bg-red-400/10 rounded-lg px-4 py-2">
            {pickerError}
          </p>
        )}

        <button
          onClick={onChangeFolder}
          className="w-full px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-neutral-200 transition-colors mb-3"
        >
          Change Workspace Folder
        </button>

        <button
          onClick={onClose}
          className="w-full px-4 py-3 text-neutral-400 hover:text-white rounded-xl font-medium transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
