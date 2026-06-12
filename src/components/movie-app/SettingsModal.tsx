"use client";

import { useState, useEffect } from "react";

interface SettingsModalProps {
  folderName: string | null;
  pickerError: string | null;
  apiKey: string | null;
  onChangeFolder: () => void;
  onSaveApiKey: (key: string) => Promise<void>;
  onClose: () => void;
}

export function SettingsModal({
  folderName,
  pickerError,
  apiKey,
  onChangeFolder,
  onSaveApiKey,
  onClose,
}: SettingsModalProps) {
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    setKey(apiKey ?? "");
  }, [apiKey]);

  const handleSave = async () => {
    if (!key.trim()) return;
    setSaving(true);
    setKeyError(null);
    try {
      await onSaveApiKey(key.trim());
    } catch {
      setKeyError("Failed to save API key");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold text-white mb-2">Settings</h2>
        <p className="text-neutral-400 text-sm mb-6">
          Current workspace:{" "}
          <span className="text-neutral-300 font-mono">{folderName}</span>
        </p>

        {/* API Key */}
        <div className="mb-6">
          <label className="text-sm text-neutral-400 block mb-2">
            fal.ai API Key
          </label>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            placeholder="Paste your fal.ai API key..."
            className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors mb-2"
          />
          {keyError && (
            <p className="text-red-400 text-xs mb-2">{keyError}</p>
          )}
          <button
            onClick={handleSave}
            disabled={!key.trim() || saving}
            className="w-full px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save API Key"}
          </button>
        </div>

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
