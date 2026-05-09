import { useEffect, useState } from 'react';
import { listDocuments, deleteDocument, reindexDocument, getDocumentContentUrl, getDocumentPages } from '../api';
import type { Document } from '../types';
import { formatBytes, timeAgo } from '../utils/format';
import { STATUS_COLORS } from '../constants/colors';
import { ProgressBar } from './ui/ProgressBar';

function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
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
        {/* Header */}
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

        {/* Tabs */}
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

        {/* Body */}
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

export function DocumentList({ kbId }: { kbId: string }) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);

  const load = async () => {
    try {
      setDocs(await listDocuments(kbId));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => { load(); }, [kbId]);

  // Polling: fast when docs are active, slow otherwise
  const hasActive = docs.some((d) => d.status === 'uploaded' || d.status === 'processing');
  useEffect(() => {
    const interval = setInterval(load, hasActive ? 3000 : 15000);
    return () => clearInterval(interval);
  }, [kbId, hasActive]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this document?')) return;
    await deleteDocument(kbId, id);
    load();
  };

  const handleReindex = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await reindexDocument(kbId, id);
    load();
  };

  if (loading) return <p className="text-white/30 text-center py-8">Loading documents...</p>;
  if (docs.length === 0) return <p className="text-white/30 text-center py-8">No documents yet. Upload one above.</p>;

  return (
    <>
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider">
          Documents ({docs.length})
        </h2>
        <div className="bg-[#111] border border-white/5 rounded-xl overflow-hidden">
          {docs.map((doc, i) => (
            <div
              key={doc.id}
              onClick={() => setViewingDoc(doc)}
              className={`flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors cursor-pointer ${
                i > 0 ? 'border-t border-white/5' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/80 font-medium truncate">{doc.filename}</p>
                <p className="text-xs text-white/25 mt-0.5">
                  {formatBytes(doc.size_bytes)}
                  {doc.page_count != null && ` · ${doc.page_count} pages`}
                  {' · '}{timeAgo(doc.created_at)}
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

              <div className="flex items-center gap-1">
                {(doc.status === 'indexed' || doc.status === 'failed') && (
                  <button
                    onClick={(e) => handleReindex(e, doc.id)}
                    className="text-white/20 hover:text-blue-400 transition-colors text-xs px-1"
                    title="Re-index"
                  >
                    ↻
                  </button>
                )}
                <button
                  onClick={(e) => handleDelete(e, doc.id)}
                  className="text-white/20 hover:text-red-400 transition-colors text-sm"
                  title="Delete"
                >
                  x
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {viewingDoc && (
        <DocumentViewer kbId={kbId} doc={viewingDoc} onClose={() => setViewingDoc(null)} />
      )}
    </>
  );
}
