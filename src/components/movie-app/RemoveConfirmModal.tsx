"use client";

interface RemoveConfirmModalProps {
  type: "character" | "scene" | "project";
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RemoveConfirmModal({
  type,
  name,
  onConfirm,
  onCancel,
}: RemoveConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full mx-4 text-center">
        <p className="text-white text-lg font-semibold mb-2">
          Remove {type === "character" ? "Character" : type === "scene" ? "Scene" : "Project"}
        </p>
        <p className="text-neutral-400 text-sm mb-6">
          Are you sure you want to remove{" "}
          <span className="text-white font-medium">{name || "this item"}</span>?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 text-neutral-400 hover:text-white rounded-xl font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-500 transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
