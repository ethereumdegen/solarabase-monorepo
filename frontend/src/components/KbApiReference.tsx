import { useState, useEffect } from 'react';
import { listApiKeys, createApiKey, revokeApiKey } from '../api';
import type { ApiKeyInfo } from '../types';

export function KbApiReference({ kbId }: { kbId: string }) {
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    listApiKeys(kbId).then(setApiKeys).catch(() => {});
  }, [kbId]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    setKeyError(null);
    try {
      const result = await createApiKey(kbId, newKeyName.trim());
      setCreatedKey(result.key);
      setNewKeyName('');
      listApiKeys(kbId).then(setApiKeys);
    } catch (e: any) {
      setKeyError(e.message || 'Failed to create key');
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Revoke this API key?')) return;
    try {
      await revokeApiKey(kbId, keyId);
      listApiKeys(kbId).then(setApiKeys);
    } catch (e: any) {
      setKeyError(e.message || 'Failed to revoke key');
    }
  };

  return (
    <div className="space-y-8">
      {/* API Keys */}
      <div className="bg-[#111] border border-white/5 rounded-xl p-6">
        <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-4">API Keys</h2>

        {createdKey && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-4">
            <p className="text-xs text-green-400 mb-1 font-medium">Key created! Copy it now - it won't be shown again.</p>
            <code className="text-xs bg-white/5 px-2 py-1 rounded text-white/70 select-all">{createdKey}</code>
            <button onClick={() => setCreatedKey(null)} className="ml-3 text-xs text-green-400/60 hover:text-green-400">Dismiss</button>
          </div>
        )}

        {keyError && <p className="text-xs text-red-400 mb-3">{keyError}</p>}

        <div className="flex gap-2 mb-4">
          <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
            placeholder="Key name (e.g. production)"
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-white/20" />
          <button onClick={handleCreateKey}
            className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/15 transition-colors">
            Generate
          </button>
        </div>

        {apiKeys.length === 0 ? (
          <p className="text-sm text-white/25">No API keys yet.</p>
        ) : (
          <div className="space-y-2">
            {apiKeys.map((k) => (
              <div key={k.id} className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-white/70">{k.name}</span>
                  <span className="text-xs text-white/25 ml-2">{k.key_prefix}...</span>
                </div>
                <button onClick={() => handleRevokeKey(k.id)}
                  className="text-xs text-red-400/60 hover:text-red-400">
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white/80 mb-1">API Reference</h2>
        <p className="text-sm text-white/30 mb-6">
          Authenticate with an API key in the <code className="text-white/60 bg-white/10 px-1.5 py-0.5 rounded text-xs">Authorization</code> header.
        </p>
      </div>

      <Endpoint
        method="POST"
        path={`/api/kb/${kbId}/query`}
        description="Ask a question and get an AI-generated answer with citations from your documents."
        body={`{
  "question": "What does PRL mean?"
}`}
        response={`{
  "answer": "PRL stands for Pool Route Length...",
  "reasoning_path": ["retrieve_pages", "synthesize"],
  "tools_used": ["retrieve_pages"],
  "sources": [
    { "document": "TELLER_ERROR_CODES.md", "page": 2 }
  ]
}`}
      />

      <Endpoint
        method="POST"
        path={`/api/kb/${kbId}/retrieve`}
        description="Retrieve relevant document pages without AI synthesis. Useful for building custom RAG pipelines."
        body={`{
  "query": "error codes",
  "max_pages": 5
}`}
        response={`{
  "pages": [
    {
      "document_id": "...",
      "filename": "TELLER_ERROR_CODES.md",
      "page_num": 1,
      "content": "...",
      "score": 0.92
    }
  ]
}`}
      />

      <Endpoint
        method="GET"
        path={`/api/kb/${kbId}/documents`}
        description="List all documents in the knowledgebase with their indexing status."
        response={`[
  {
    "id": "...",
    "filename": "report.pdf",
    "status": "indexed",
    "size_bytes": 204800,
    "page_count": 12,
    "created_at": "2026-01-15T10:30:00Z"
  }
]`}
      />

      <Endpoint
        method="POST"
        path={`/api/kb/${kbId}/documents`}
        description="Upload a document. Send as multipart/form-data with a 'file' field. Indexing starts automatically."
        body="multipart/form-data: file=@document.pdf"
        response={`{
  "id": "...",
  "filename": "document.pdf",
  "status": "uploaded",
  "size_bytes": 102400
}`}
      />

      <Endpoint
        method="DELETE"
        path={`/api/kb/${kbId}/documents/{doc_id}`}
        description="Delete a document and all its indexed pages."
        response="204 No Content"
      />

      <Endpoint
        method="POST"
        path={`/api/kb/${kbId}/documents/{doc_id}/reindex`}
        description="Re-index a document. Clears existing indexes and queues the document for reprocessing."
        response={`{
  "id": "...",
  "filename": "report.pdf",
  "status": "uploaded"
}`}
      />

      <Section title="Authentication">
        <div className="bg-[#111] border border-white/5 rounded-xl p-5 space-y-3 text-sm">
          <p className="text-white/60">Include your API key in every request:</p>
          <Code>{`curl -H "Authorization: Bearer sk_your_api_key" \\
  https://solarabase.com/api/kb/${kbId}/query \\
  -H "Content-Type: application/json" \\
  -d '{"question": "What is..."}'`}</Code>
          <p className="text-white/40">
            API keys are scoped to a single knowledgebase. Create them in the KB settings page.
          </p>
        </div>
      </Section>

      <Section title="Rate Limits">
        <div className="bg-[#111] border border-white/5 rounded-xl p-5 text-sm text-white/40 space-y-2">
          <p>Rate limits depend on your plan (per KB):</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong className="text-white/60">Free:</strong> 1,000 queries/month, 3 API keys</li>
            <li><strong className="text-white/60">Pro:</strong> 5,000 queries/month, 10 API keys</li>
            <li><strong className="text-white/60">Team:</strong> Unlimited queries &amp; API keys</li>
          </ul>
          <p>When limits are exceeded, the API returns <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs text-white/60">429 Too Many Requests</code>.</p>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-white/80 mb-4 pb-2 border-b border-white/5">{title}</h2>
      {children}
    </section>
  );
}

function Endpoint({ method, path, description, body, response }: {
  method: string;
  path: string;
  description: string;
  body?: string;
  response: string;
}) {
  const methodColor = method === 'GET' ? 'bg-green-500/15 text-green-400'
    : method === 'POST' ? 'bg-blue-500/15 text-blue-400'
    : method === 'DELETE' ? 'bg-red-500/15 text-red-400'
    : 'bg-white/10 text-white/60';

  return (
    <div className="bg-[#111] border border-white/5 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-3 mb-2">
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${methodColor}`}>{method}</span>
          <code className="text-sm font-mono text-white/70">{path}</code>
        </div>
        <p className="text-sm text-white/40">{description}</p>
      </div>
      <div className="px-5 py-4 space-y-3">
        {body && (
          <div>
            <p className="text-xs font-medium text-white/25 uppercase mb-1.5">Request</p>
            <Code>{body}</Code>
          </div>
        )}
        <div>
          <p className="text-xs font-medium text-white/25 uppercase mb-1.5">Response</p>
          <Code>{response}</Code>
        </div>
      </div>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-black/30 text-white/50 rounded-lg p-4 text-xs overflow-x-auto font-mono">{children}</pre>
  );
}
