import { Link } from 'react-router-dom';
import { Footer } from '../components/Footer';

export function Docs() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="border-b border-white/5 sticky top-0 z-10 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <Link to="/" className="text-lg sm:text-xl font-bold text-white/90 tracking-tight">Solarabase</Link>
          <nav className="flex items-center gap-3 sm:gap-4 text-sm">
            <Link to="/docs" className="text-white/90 font-medium">Docs</Link>
            <Link to="/docs/api" className="text-white/30 hover:text-white/60">API</Link>
            <Link to="/login" className="px-4 py-2 bg-white/10 text-white rounded-lg font-medium hover:bg-white/15 transition-colors">Sign In</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-3xl font-bold text-white/90 mb-2">Documentation</h1>
        <p className="text-white/30 mb-10">Everything you need to get started with Solarabase.</p>

        <div className="space-y-12">
          <Section title="Getting Started">
            <Step n={1} title="Create an account">
              Sign up with Google OAuth to get started.
            </Step>
            <Step n={2} title="Create a Knowledgebase">
              Each knowledgebase is an isolated collection of documents with its own RAG agent,
              system prompt, and API keys.
            </Step>
            <Step n={3} title="Upload documents">
              Upload <code className="bg-white/10 px-1 py-0.5 rounded text-xs">.txt</code>, <code className="bg-white/10 px-1 py-0.5 rounded text-xs">.md</code>, <code className="bg-white/10 px-1 py-0.5 rounded text-xs">.pdf</code>, or <code className="bg-white/10 px-1 py-0.5 rounded text-xs">.json</code> files.
              Documents are automatically split into pages and indexed using AI-powered tree structures.
            </Step>
            <Step n={4} title="Query your knowledge">
              Use the built-in chat interface or the API to ask questions. The RAG agent retrieves
              relevant pages and generates answers with citations.
            </Step>
          </Section>

          <Section title="Key Concepts">
            <Concept title="Knowledgebases">
              Isolated document collections. Each KB has its own AI agent configuration, documents, wiki,
              and API keys. Access can be controlled per-user with roles (viewer, editor, admin).
            </Concept>
            <Concept title="Auto-Indexing">
              When you upload a document, it's automatically split into pages and each page gets a
              tree-structured index with summaries, key entities, topics, and relationships.
              A root-level index summarizes the entire document.
            </Concept>
            <Concept title="Wiki Pages">
              After indexing, concept wiki pages are auto-generated from document themes,
              providing a browsable knowledge base alongside the raw documents.
            </Concept>
          </Section>

          <Section title="Plans">
            <p className="text-sm text-white/40 mb-4">
              Every user gets 1 free knowledgebase. Upgrade individual KBs to Pro or Team for higher limits.
              Paid KBs are unlimited — you can create as many as you need.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 pr-4 font-medium text-white/40">Feature</th>
                    <th className="text-center py-3 px-4 font-medium text-white/40">Free</th>
                    <th className="text-center py-3 px-4 font-medium text-white/40">Pro</th>
                    <th className="text-center py-3 px-4 font-medium text-white/40">Team</th>
                  </tr>
                </thead>
                <tbody className="text-white/60">
                  <PlanRow feature="Knowledgebases" free="1" pro="Unlimited" team="Unlimited" />
                  <PlanRow feature="Docs per KB" free="50" pro="Unlimited" team="Unlimited" />
                  <PlanRow feature="Queries / month" free="1,000" pro="5,000" team="Unlimited" />
                  <PlanRow feature="Team members" free="2" pro="5" team="Unlimited" />
                  <PlanRow feature="API keys" free="3" pro="10" team="Unlimited" />
                  <PlanRow feature="Max file size" free="100 MB" pro="500 MB" team="1 GB" />
                </tbody>
              </table>
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
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 bg-white/10 text-white/60 rounded-lg flex items-center justify-center text-sm font-bold">{n}</div>
      <div>
        <h3 className="font-medium text-white/80">{title}</h3>
        <p className="text-sm text-white/40 mt-1">{children}</p>
      </div>
    </div>
  );
}

function Concept({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#111] border border-white/5 rounded-xl p-5">
      <h3 className="font-medium text-white/80 mb-1">{title}</h3>
      <p className="text-sm text-white/40">{children}</p>
    </div>
  );
}

function PlanRow({ feature, free, pro, team }: { feature: string; free: string; pro: string; team: string }) {
  return (
    <tr className="border-b border-white/5">
      <td className="py-2.5 pr-4 font-medium">{feature}</td>
      <td className="py-2.5 px-4 text-center">{free}</td>
      <td className="py-2.5 px-4 text-center">{pro}</td>
      <td className="py-2.5 px-4 text-center">{team}</td>
    </tr>
  );
}
