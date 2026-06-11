"use client";

interface ImagePreviewModalProps {
  imageUrl: string;
  alt: string;
  onClose: () => void;
}

export function ImagePreviewModal({
  imageUrl,
  alt,
  onClose,
}: ImagePreviewModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors"
      >
        <svg
          className="w-8 h-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
      <img
        src={imageUrl}
        alt={alt}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
