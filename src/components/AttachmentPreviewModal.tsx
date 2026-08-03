import React, { useEffect, useState } from 'react';
import { X, File, Download } from 'lucide-react';

interface AttachmentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  attachment: any | null;
  blobUrl: string | null;
}

export const AttachmentPreviewModal: React.FC<AttachmentPreviewModalProps> = ({
  isOpen,
  onClose,
  attachment,
  blobUrl,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen && !isAnimating) return null;

  const isImage = attachment?.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const isPdf = attachment?.fileName?.match(/\.(pdf)$/i);

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div 
        className={`relative w-full max-w-[1200px] max-h-[95vh] md:max-h-[90vh] bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 transform ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--bg-card)] z-10 sticky top-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-primary/10 text-primary rounded-lg flex-shrink-0">
              <File size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-[var(--text-primary)] truncate" title={attachment?.fileName}>
                {attachment?.fileName || 'Attachment Preview'}
              </h3>
              {attachment?.fileSize && (
                <p className="text-xs text-muted">
                  {(attachment.fileSize / 1024).toFixed(1)} KB
                </p>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-muted hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto bg-[var(--bg-body)] flex flex-col items-center justify-center p-4 min-h-[300px]">
          {!blobUrl ? (
            <div className="flex flex-col items-center text-muted">
              <div className="spinner mb-4"></div>
              <p>Loading preview...</p>
            </div>
          ) : isImage ? (
            <img 
              src={blobUrl} 
              alt={attachment?.fileName} 
              className="max-w-full max-h-[70vh] object-contain rounded shadow-lg"
            />
          ) : isPdf ? (
            <iframe 
              src={`${blobUrl}#toolbar=0`} 
              title={attachment?.fileName}
              className="w-full h-[70vh] rounded border border-[var(--border)] bg-white"
            />
          ) : (
            <div className="flex flex-col items-center text-center max-w-md p-8 bg-[var(--bg-card)] rounded-xl border border-[var(--border)]">
              <File size={48} className="text-muted mb-4" />
              <h4 className="text-lg font-medium mb-2">Preview Not Available</h4>
              <p className="text-sm text-muted mb-6">
                This file type cannot be previewed in the browser. Please download the file to view it.
              </p>
              <a 
                href={blobUrl} 
                download={attachment?.fileName}
                className="btn btn-primary w-full flex justify-center gap-2"
              >
                <Download size={18} /> Download File
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-card)] flex items-center justify-end gap-3 sticky bottom-0 z-10">
          <button 
            onClick={onClose}
            className="btn btn-outline"
          >
            Close
          </button>
          {blobUrl && (
            <a 
              href={blobUrl} 
              download={attachment?.fileName}
              className="btn btn-primary flex items-center gap-2"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Download</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
