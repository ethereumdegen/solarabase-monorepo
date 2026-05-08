import { useCallback, useState } from 'react';
import { uploadDocument } from '../api';

export function Upload({ kbId, folderId, onUploaded }: { kbId: string; folderId?: string; onUploaded: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setError(null);
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          await uploadDocument(kbId, file, folderId);
        }
        onUploaded();
      } catch (e: any) {
        setError(e.message || 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [kbId, folderId, onUploaded]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      className={`border border-dashed rounded-xl p-10 text-center transition-colors ${
        dragging ? 'border-white/40 bg-white/5' : 'border-white/10 hover:border-white/20'
      }`}
    >
      {uploading ? (
        <p className="text-white/40">Uploading...</p>
      ) : (
        <>
          <p className="text-white/50 mb-3">
            Drag & drop files here, or{' '}
            <label className="text-white font-medium hover:underline cursor-pointer">
              browse
              <input type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            </label>
          </p>
          <p className="text-xs text-white/25">Supports .txt, .md, .pdf, .json, and more</p>
        </>
      )}
      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
    </div>
  );
}
