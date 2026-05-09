import { useCallback, useEffect, useState } from 'react';
import {
  listFolderContents,
  createFolder,
  renameFolder,
  deleteFolder,
  updateFolderCategory,
  deleteDocument,
  reindexDocument,
  moveDocument,
  getDocumentContentUrl,
  getDocumentPages,
} from '../api';
import { Upload } from './Upload';
import BrailleSpinner from './ui/BrailleSpinner';
import type { DocFolder, Document, BreadcrumbEntry, FolderContents } from '../types';
import { FOLDER_CATEGORIES } from '../types';

const CATEGORY_COLORS: Record<string, string> = {
  legal: 'bg-purple-500/15 text-purple-400',
  hr: 'bg-pink-500/15 text-pink-400',
  engineering: 'bg-blue-500/15 text-blue-400',
  marketing: 'bg-orange-500/15 text-orange-400',
  finance: 'bg-green-500/15 text-green-400',
  operations: 'bg-yellow-500/15 text-yellow-400',
  compliance: 'bg-red-500/15 text-red-400',
  research: 'bg-cyan-500/15 text-cyan-400',
};

const STATUS_COLORS: Record<string, string> = {
  uploaded: 'bg-amber-500/15 text-amber-400',
  processing: 'bg-blue-500/15 text-blue-400',
  indexed: 'bg-green-500/15 text-green-400',
  failed: 'bg-red-500/15 text-red-400',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-white/5 rounded-full h-1.5 mt-1.5">
      <div className="bg-white/40 h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] || 'bg-white/10 text-white/50';
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${color}`}>
      {category}
    </span>
  );
}

/* ---------- Create Folder Modal ---------- */
function CreateFolderModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (name: string, category?: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), category || undefined);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="text-lg font-semibold text-white/90">New Folder</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:border-white/20"
              placeholder="Folder name"
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Category (optional)</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-white/20"
            >
              <option value="">None</option>
              {FOLDER_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-white/40 hover:text-white/60 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={!name.trim()}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-30">
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- Folder Context Menu ---------- */
function FolderContextMenu({
  folder,
  position,
  onClose,
  onRename,
  onSetCategory,
  onDelete,
}: {
  folder: DocFolder;
  position: { x: number; y: number };
  onClose: () => void;
  onRename: () => void;
  onSetCategory: () => void;
  onDelete: () => void;
}) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [onClose]);

  return (
    <div
      className="fixed z-50 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{ top: position.y, left: position.x }}
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={onRename}
        className="w-full text-left px-4 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white/80">
        Rename
      </button>
      <button onClick={onSetCategory}
        className="w-full text-left px-4 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white/80">
        Set Category
      </button>
      <button onClick={onDelete}
        className="w-full text-left px-4 py-2 text-sm text-red-400/60 hover:bg-white/5 hover:text-red-400">
        Delete
      </button>
    </div>
  );
}

/* ---------- Document Context Menu ---------- */
function DocumentContextMenu({
  doc,
  position,
  onClose,
  onReindex,
  onMove,
  onDelete,
}: {
  doc: Document;
  position: { x: number; y: number };
  onClose: () => void;
  onReindex: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [onClose]);

  return (
    <div
      className="fixed z-50 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{ top: position.y, left: position.x }}
      onClick={(e) => e.stopPropagation()}
    >
      {(doc.status === 'indexed' || doc.status === 'failed') && (
        <button onClick={onReindex}
          className="w-full text-left px-4 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white/80">
          Re-index
        </button>
      )}
      <button onClick={onMove}
        className="w-full text-left px-4 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white/80">
        Move to&hellip;
      </button>
      <button onClick={onDelete}
        className="w-full text-left px-4 py-2 text-sm text-red-400/60 hover:bg-white/5 hover:text-red-400">
        Delete
      </button>
    </div>
  );
}

/* ---------- Move Document Modal ---------- */
function MoveDocumentModal({
  kbId,
  doc,
  currentFolderId,
  onClose,
  onMoved,
}: {
  kbId: string;
  doc: Document;
  currentFolderId: string | undefined;
  onClose: () => void;
  onMoved: () => void;
}) {
  const [folders, setFolders] = useState<DocFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    listFolderContents(kbId, undefined)
      .then((data) => setFolders(data.folders))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [kbId]);

  const handleMove = async (folderId: string | null) => {
    setMoving(true);
    try {
      await moveDocument(kbId, doc.id, folderId);
      onMoved();
    } catch (e: any) {
      alert(e.message || 'Failed to move document');
    } finally {
      setMoving(false);
    }
  };

  const isCurrentFolder = (id: string | null) =>
    (id === null && !currentFolderId) || id === currentFolderId;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="text-lg font-semibold text-white/90">Move "{doc.filename}"</h3>
        </div>
        <div className="p-4 max-h-[50vh] overflow-auto">
          {loading ? (
            <p className="text-white/30 text-center py-4">Loading folders...</p>
          ) : (
            <div className="space-y-1">
              <button
                disabled={isCurrentFolder(null) || moving}
                onClick={() => handleMove(null)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${
                  isCurrentFolder(null)
                    ? 'text-white/20 cursor-not-allowed'
                    : 'text-white/60 hover:bg-white/5 hover:text-white/80'
                }`}
              >
                Root (no folder)
                {isCurrentFolder(null) && <span className="text-xs text-white/15 ml-2">(current)</span>}
              </button>
              {folders.map((f) => (
                <button
                  key={f.id}
                  disabled={isCurrentFolder(f.id) || moving}
                  onClick={() => handleMove(f.id)}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    isCurrentFolder(f.id)
                      ? 'text-white/20 cursor-not-allowed'
                      : 'text-white/60 hover:bg-white/5 hover:text-white/80'
                  }`}
                >
                  <span className="truncate">{f.name}</span>
                  {f.category && <CategoryBadge category={f.category} />}
                  {isCurrentFolder(f.id) && <span className="text-xs text-white/15 ml-auto">(current)</span>}
                </button>
              ))}
              {folders.length === 0 && (
                <p className="text-white/30 text-center py-4 text-sm">No folders. Create one first.</p>
              )}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-white/5 flex justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-white/40 hover:text-white/60 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Category Picker Modal ---------- */
function CategoryPickerModal({
  current,
  onSubmit,
  onClose,
}: {
  current: string | null;
  onSubmit: (category: string | null) => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState(current || '');

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="text-lg font-semibold text-white/90">Set Category</h3>
        </div>
        <div className="p-6 space-y-4">
          <select
            autoFocus
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-white/20"
          >
            <option value="">None</option>
            {FOLDER_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-white/40 hover:text-white/60 transition-colors">
              Cancel
            </button>
            <button onClick={() => onSubmit(category || null)}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-sm font-medium rounded-lg transition-colors">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Rename Modal ---------- */
function RenameModal({
  currentName,
  onSubmit,
  onClose,
}: {
  currentName: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(currentName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="text-lg font-semibold text-white/90">Rename Folder</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-white/20"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-white/40 hover:text-white/60 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={!name.trim()}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-30">
              Rename
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- Document Viewer ---------- */
function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    fetch(url, { credentials: 'include' })
      .then((r) => r.text())
      .then(setText)
      .catch(() => setText('Failed to load content'));
  }, [url]);
  if (text === null) return <p className="text-white/30 text-center py-8">Loading...</p>;
  return <pre className="text-sm text-white/60 whitespace-pre-wrap bg-white/5 rounded-xl p-4 max-h-[70vh] overflow-auto">{text}</pre>;
}

function DocumentViewer({ kbId, doc, onClose }: { kbId: string; doc: Document; onClose: () => void }) {
  const [tab, setTab] = useState<'content' | 'pages'>('content');
  const [pages, setPages] = useState<any[] | null>(null);
  const [rootIndex, setRootIndex] = useState<any>(null);
  const [loadingPages, setLoadingPages] = useState(false);

  useEffect(() => {
    if (tab === 'pages' && pages === null) {
      setLoadingPages(true);
      getDocumentPages(kbId, doc.id)
        .then((data) => {
          setPages(data.pages);
          setRootIndex(data.root_index);
        })
        .catch(() => setPages([]))
        .finally(() => setLoadingPages(false));
    }
  }, [tab, kbId, doc.id]);

  const contentUrl = getDocumentContentUrl(kbId, doc.id);
  const isText = doc.mime_type.startsWith('text/') || doc.mime_type === 'application/json';
  const isPdf = doc.mime_type === 'application/pdf';

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111] border border-white/10 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-white/90 truncate">{doc.filename}</h3>
            <p className="text-xs text-white/30">
              {formatBytes(doc.size_bytes)} · {doc.mime_type}
              {doc.page_count != null && ` · ${doc.page_count} pages`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href={contentUrl} download={doc.filename}
              className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white/50 rounded-lg transition-colors">
              Download
            </a>
            <button onClick={onClose} className="text-white/30 hover:text-white/60 text-xl px-2">&times;</button>
          </div>
        </div>

        {doc.status === 'indexed' && (
          <div className="flex gap-1 px-6 pt-3">
            <button onClick={() => setTab('content')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === 'content' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}>
              Content
            </button>
            <button onClick={() => setTab('pages')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === 'pages' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}>
              Index ({doc.page_count ?? 0} pages)
            </button>
          </div>
        )}

        <div className="flex-1 overflow-auto p-6">
          {tab === 'content' && (
            <>
              {isPdf ? (
                <iframe src={contentUrl} className="w-full h-[70vh] rounded-lg border border-white/5" />
              ) : isText ? (
                <TextPreview url={contentUrl} />
              ) : (
                <div className="text-center py-12 text-white/30">
                  <p className="mb-3">Preview not available for {doc.mime_type}</p>
                  <a href={contentUrl} download={doc.filename}
                    className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium inline-block hover:bg-white/15 transition-colors">
                    Download File
                  </a>
                </div>
              )}
            </>
          )}

          {tab === 'pages' && (
            <>
              {loadingPages && <p className="text-white/30 text-center py-8">Loading pages...</p>}
              {rootIndex && (
                <div className="bg-white/5 rounded-xl p-4 mb-4">
                  <h4 className="text-xs font-medium text-white/40 uppercase mb-2">Document Summary</h4>
                  <p className="text-sm text-white/60">{rootIndex.summary}</p>
                  {rootIndex.key_themes && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {rootIndex.key_themes.map((t: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-white/5 rounded-md text-xs text-white/40 border border-white/5">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {pages && pages.length > 0 && (
                <div className="space-y-3">
                  {pages.map((page) => (
                    <details key={page.id} className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
                      <summary className="px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors">
                        <span className="text-sm font-medium text-white/70">Page {page.page_num}</span>
                        {page.tree_index?.summary && (
                          <span className="text-xs text-white/30 ml-2">{page.tree_index.summary.slice(0, 100)}...</span>
                        )}
                      </summary>
                      <div className="px-4 pb-3 border-t border-white/5">
                        <pre className="text-xs text-white/50 whitespace-pre-wrap mt-2 max-h-60 overflow-auto">{page.content}</pre>
                        {page.tree_index?.topics && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-white/40 mb-1">Topics</p>
                            <div className="flex flex-wrap gap-1">
                              {page.tree_index.topics.map((t: any, i: number) => (
                                <span key={i} className="px-2 py-0.5 bg-white/5 rounded text-xs text-white/40">{t.name}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              )}
              {pages && pages.length === 0 && <p className="text-white/30 text-center py-8">No indexed pages yet.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Main FolderBrowser ---------- */
export function FolderBrowser({ kbId }: { kbId: string }) {
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [contents, setContents] = useState<FolderContents | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ folder: DocFolder; x: number; y: number } | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<DocFolder | null>(null);
  const [categoryFolder, setCategoryFolder] = useState<DocFolder | null>(null);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [docMenu, setDocMenu] = useState<{ doc: Document; x: number; y: number } | null>(null);
  const [moveDoc, setMoveDoc] = useState<Document | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listFolderContents(kbId, currentFolderId);
      setContents(data);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [kbId, currentFolderId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Polling: fast when docs are active, slow otherwise
  const hasActive = contents?.documents.some((d) => d.status === 'uploaded' || d.status === 'processing') ?? false;
  useEffect(() => {
    const interval = setInterval(load, hasActive ? 3000 : 15000);
    return () => clearInterval(interval);
  }, [load, hasActive]);

  const navigateTo = (folderId?: string) => {
    setCurrentFolderId(folderId);
  };

  const handleCreateFolder = async (name: string, category?: string) => {
    try {
      await createFolder(kbId, { name, parent_id: currentFolderId, category });
      setShowCreateFolder(false);
      load();
    } catch (e: any) {
      alert(e.message || 'Failed to create folder');
    }
  };

  const handleRename = async (name: string) => {
    if (!renamingFolder) return;
    try {
      await renameFolder(kbId, renamingFolder.id, name);
      setRenamingFolder(null);
      load();
    } catch (e: any) {
      alert(e.message || 'Failed to rename');
    }
  };

  const handleSetCategory = async (category: string | null) => {
    if (!categoryFolder) return;
    try {
      await updateFolderCategory(kbId, categoryFolder.id, category);
      setCategoryFolder(null);
      load();
    } catch (e: any) {
      alert(e.message || 'Failed to set category');
    }
  };

  const handleDeleteFolder = async (folder: DocFolder) => {
    if (!confirm(`Delete folder "${folder.name}" and all its subfolders? Documents will be moved to root.`)) return;
    try {
      await deleteFolder(kbId, folder.id);
      load();
    } catch (e: any) {
      alert(e.message || 'Failed to delete');
    }
  };

  const handleDeleteDoc = async (doc: Document) => {
    if (!confirm(`Delete "${doc.filename}"?`)) return;
    await deleteDocument(kbId, doc.id);
    load();
  };

  const handleReindex = async (doc: Document) => {
    await reindexDocument(kbId, doc.id);
    load();
  };

  const handleDropOnFolder = async (docId: string, folderId: string) => {
    try {
      await moveDocument(kbId, docId, folderId);
      load();
    } catch (e: any) {
      alert(e.message || 'Failed to move document');
    }
  };

  const handleFolderContextMenu = (e: React.MouseEvent, folder: DocFolder) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ folder, x: e.clientX, y: e.clientY });
  };

  if (loading && !contents) {
    return <div className="py-8"><BrailleSpinner animation="orbit" size="lg" label="Loading documents..." /></div>;
  }

  const folders = contents?.folders ?? [];
  const docs = contents?.documents ?? [];
  const breadcrumb = contents?.breadcrumb ?? [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm flex-wrap">
        <button
          onClick={() => navigateTo(undefined)}
          className={`hover:text-white/80 transition-colors ${!currentFolderId ? 'text-white/80 font-medium' : 'text-white/40'}`}
        >
          Root
        </button>
        {breadcrumb.map((entry) => (
          <span key={entry.id} className="flex items-center gap-1.5">
            <span className="text-white/20">/</span>
            <button
              onClick={() => navigateTo(entry.id)}
              className={`hover:text-white/80 transition-colors ${entry.id === currentFolderId ? 'text-white/80 font-medium' : 'text-white/40'}`}
            >
              {entry.name}
            </button>
          </span>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider">
          {folders.length} folders, {docs.length} documents
        </h2>
        <button
          onClick={() => setShowCreateFolder(true)}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white text-xs font-medium rounded-lg transition-colors"
        >
          New Folder
        </button>
      </div>

      {/* Upload zone */}
      <Upload kbId={kbId} folderId={currentFolderId} onUploaded={load} />

      {/* Folder cards */}
      {folders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {folders.map((folder) => (
            <div
              key={folder.id}
              onClick={() => navigateTo(folder.id)}
              onContextMenu={(e) => handleFolderContextMenu(e, folder)}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes('application/x-doc-id')) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverFolder(folder.id);
                }
              }}
              onDragLeave={() => setDragOverFolder(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverFolder(null);
                const docId = e.dataTransfer.getData('application/x-doc-id');
                if (docId) handleDropOnFolder(docId, folder.id);
              }}
              className={`bg-[#111] border rounded-xl p-4 hover:bg-white/5 transition-colors cursor-pointer group ${
                dragOverFolder === folder.id ? 'border-blue-400/50 bg-blue-400/5' : 'border-white/5'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white/80 font-medium truncate">{folder.name}</p>
                  <p className="text-[10px] text-white/25 mt-1">{timeAgo(folder.created_at)}</p>
                </div>
                <button
                  onClick={(e) => handleFolderContextMenu(e, folder)}
                  className="text-white/20 hover:text-white/50 opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-lg leading-none"
                >
                  ...
                </button>
              </div>
              {folder.category && (
                <div className="mt-2">
                  <CategoryBadge category={folder.category} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Document rows */}
      {docs.length > 0 && (
        <div className="bg-[#111] border border-white/5 rounded-xl overflow-hidden">
          {docs.map((doc, i) => (
            <div
              key={doc.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-doc-id', doc.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onClick={() => setViewingDoc(doc)}
              className={`flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors cursor-pointer group ${
                i > 0 ? 'border-t border-white/5' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/80 font-medium truncate">{doc.filename}</p>
                <p className="text-xs text-white/25 mt-0.5">
                  {formatBytes(doc.size_bytes)}
                  {doc.page_count != null && ` \u00b7 ${doc.page_count} pages`}
                  {' \u00b7 '}{timeAgo(doc.created_at)}
                </p>
                {doc.error_msg && <p className="text-xs text-red-400 mt-1 truncate">{doc.error_msg}</p>}
              </div>

              <div className="flex flex-col items-end gap-1 min-w-[120px]">
                <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium ${STATUS_COLORS[doc.status] || ''}`}>
                  {(doc.status === 'uploaded' || doc.status === 'processing') && <Spinner />}
                  {doc.status === 'uploaded' && 'Queued'}
                  {doc.status === 'processing' && 'Indexing'}
                  {doc.status === 'indexed' && 'Ready'}
                  {doc.status === 'failed' && 'Failed'}
                </span>
                {doc.status === 'processing' && doc.page_count != null && doc.page_count > 0 && (
                  <div className="w-full">
                    <p className="text-[10px] text-white/25 text-right">
                      {doc.pages_indexed ?? 0}/{doc.page_count} pages
                    </p>
                    <ProgressBar value={doc.pages_indexed ?? 0} max={doc.page_count} />
                  </div>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDocMenu({ doc, x: e.clientX, y: e.clientY });
                }}
                className="text-white/20 hover:text-white/50 opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none px-1"
                title="Actions"
              >
                ⋯
              </button>
            </div>
          ))}
        </div>
      )}

      {folders.length === 0 && docs.length === 0 && !loading && (
        <p className="text-white/30 text-center py-8">
          {currentFolderId ? 'This folder is empty.' : 'No documents yet. Upload one above or create a folder.'}
        </p>
      )}

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      {/* Modals */}
      {showCreateFolder && (
        <CreateFolderModal
          onSubmit={handleCreateFolder}
          onClose={() => setShowCreateFolder(false)}
        />
      )}

      {contextMenu && (
        <FolderContextMenu
          folder={contextMenu.folder}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          onRename={() => { setRenamingFolder(contextMenu.folder); setContextMenu(null); }}
          onSetCategory={() => { setCategoryFolder(contextMenu.folder); setContextMenu(null); }}
          onDelete={() => { handleDeleteFolder(contextMenu.folder); setContextMenu(null); }}
        />
      )}

      {renamingFolder && (
        <RenameModal
          currentName={renamingFolder.name}
          onSubmit={handleRename}
          onClose={() => setRenamingFolder(null)}
        />
      )}

      {categoryFolder && (
        <CategoryPickerModal
          current={categoryFolder.category}
          onSubmit={handleSetCategory}
          onClose={() => setCategoryFolder(null)}
        />
      )}

      {docMenu && (
        <DocumentContextMenu
          doc={docMenu.doc}
          position={{ x: docMenu.x, y: docMenu.y }}
          onClose={() => setDocMenu(null)}
          onReindex={() => { handleReindex(docMenu.doc); setDocMenu(null); }}
          onMove={() => { setMoveDoc(docMenu.doc); setDocMenu(null); }}
          onDelete={() => { handleDeleteDoc(docMenu.doc); setDocMenu(null); }}
        />
      )}

      {moveDoc && (
        <MoveDocumentModal
          kbId={kbId}
          doc={moveDoc}
          currentFolderId={currentFolderId}
          onClose={() => setMoveDoc(null)}
          onMoved={() => { setMoveDoc(null); load(); }}
        />
      )}

      {viewingDoc && (
        <DocumentViewer kbId={kbId} doc={viewingDoc} onClose={() => setViewingDoc(null)} />
      )}
    </div>
  );
}
