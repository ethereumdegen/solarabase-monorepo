import { Link } from 'react-router-dom';
import { Footer } from '../components/Footer';

export function ApiDocs() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="border-b border-white/5 sticky top-0 z-10 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-white/90 tracking-tight">Solarabase</Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/docs" className="text-white/30 hover:text-white/60">Docs</Link>
            <Link to="/docs/api" className="text-white/90 font-medium">API</Link>
            <Link to="/login" className="px-4 py-2 bg-white/10 text-white rounded-lg font-medium hover:bg-white/15 transition-colors">Sign In</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-white/90 mb-2">API Reference</h1>
        <p className="text-white/30 mb-10">
          Authenticate with an API key in the <code className="text-white/60 bg-white/10 px-1.5 py-0.5 rounded text-xs">Authorization</code> header.
          Create API keys in your knowledgebase settings.
        </p>

        <div className="space-y-8">
          <Endpoint
            method="POST"
            path="/api/kb/{'{kb_id}'}/query"
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
            path="/api/kb/{'{kb_id}'}/retrieve"
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
            path="/api/kb/{'{kb_id}'}/documents"
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
            path="/api/kb/{'{kb_id}'}/documents"
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
            path="/api/kb/{'{kb_id}'}/documents/{'{doc_id}'}"
            description="Delete a document and all its indexed pages."
            response="204 No Content"
          />

          <Endpoint
            method="POST"
            path="/api/kb/{'{kb_id}'}/documents/{'{doc_id}'}/reindex"
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
  https://solarabase.com/api/kb/{kb_id}/query \\
  -H "Content-Type: application/json" \\
  -d '{"question": "What is..."}'`}</Code>
              <p className="text-white/40">
                API keys are scoped to a single knowledgebase. Create them in the KB settings page.
              </p>
            </div>
          </Section>

          <Section title="Rate Limits">
            <div className="bg-[#111] border border-white/5 rounded-xl p-5 text-sm text-white/40 space-y-2">
              <p>Rate limits depend on your plan:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong className="text-white/60">Free:</strong> 500 queries/month</li>
                <li><strong className="text-white/60">Pro:</strong> 5,000 queries/month</li>
                <li><strong className="text-white/60">Team:</strong> Unlimited</li>
              </ul>
              <p>When limits are exceeded, the API returns <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs text-white/60">429 Too Many Requests</code>.</p>
            </div>
          </Section>
        </div>
      </main>

      <Footer />
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
