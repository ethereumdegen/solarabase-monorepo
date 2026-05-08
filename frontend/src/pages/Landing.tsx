import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { Footer } from '../components/Footer';
import { NetworkBanner } from '../components/NetworkBanner';
import { SparkleBox } from '../components/SparkleBox';

export function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between w-full">
        <h1 className="text-lg font-medium tracking-tight text-white/90">Solarabase</h1>
        <nav className="flex items-center gap-6">
          <Link to="/docs" className="text-sm text-white/40 hover:text-white/80 transition-colors">Docs</Link>
          <Link to="/docs/api" className="text-sm text-white/40 hover:text-white/80 transition-colors">API</Link>
          {user ? (
            <Link to="/dashboard" className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition-colors">
              Dashboard
            </Link>
          ) : (
            <Link to="/login" className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition-colors">
              Sign In
            </Link>
          )}
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 pt-24 pb-32">
          <div className="flex flex-col md:flex-row md:items-center md:gap-12 lg:gap-20">
            {/* Left — text */}
            <div className="flex-1 min-w-0">
              <div className="mb-8 h-24 md:h-32" />
              <p className="text-lg text-white/40 max-w-xl mb-12 leading-relaxed">
                Upload documents, auto-index with AI, and query with a RAG agent.
                Multi-tenant, per-KB configuration, API keys for programmatic access.
              </p>
              <div className="flex gap-4">
                <Link
                  to="/login"
                  className="group inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition-colors"
                >
                  Get Started Free
                  <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link
                  to="/docs"
                  className="px-6 py-3 border border-white/10 text-white/60 rounded-lg text-sm font-medium hover:border-white/30 hover:text-white/80 transition-colors"
                >
                  Read the Docs
                </Link>
              </div>
            </div>

            {/* Right — sparkle box */}
            <div className="mt-12 md:mt-0 md:w-[420px] lg:w-[480px] flex-shrink-0">
              <SparkleBox>
                <div className="h-72 md:h-80 lg:h-96 flex flex-col items-start justify-end p-8 md:p-10">
                  <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1]">
                    <span className="text-white/90">Agentic</span>{' '}
                    <span className="text-white/30">Knowledgebase</span>
                  </h3>
                </div>
              </SparkleBox>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6 py-24">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5 rounded-2xl overflow-hidden">
              <FeatureCard
                tag="01"
                title="Auto-Indexing"
                description="Upload docs and they get split into pages, each indexed with AI-powered tree structures — summaries, entities, topics, relationships."
              />
              <FeatureCard
                tag="02"
                title="RAG Agent"
                description="Each knowledgebase gets its own AI agent. Custom system prompts, model selection, and multi-turn conversations with citations."
              />
              <FeatureCard
                tag="03"
                title="API Access"
                description="Generate API keys scoped per-KB. Use /retrieve for raw page retrieval or /query for full AI-synthesized answers."
              />
            </div>
          </div>
        </section>

        {/* Banner */}
        <NetworkBanner />

        {/* How it works */}
        <section className="border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6 py-24">
            <h3 className="text-sm text-white/30 uppercase tracking-widest mb-12">How it works</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <Step n="01" title="Create" desc="Sign up and create a knowledgebase in seconds." />
              <Step n="02" title="Upload" desc="Drop in PDFs, markdown, text files. Any docs." />
              <Step n="03" title="Index" desc="AI auto-indexes every page into tree structures." />
              <Step n="04" title="Query" desc="Ask questions via chat or API. Get cited answers." />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-white/5">
          <div className="max-w-4xl mx-auto px-6 py-32 text-center">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">Start answering today</h3>
            <p className="text-white/40 mb-8">Free tier. No credit card required.</p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition-colors"
            >
              Get Started Free
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function FeatureCard({ tag, title, description }: { tag: string; title: string; description: string }) {
  return (
    <div className="bg-[#0f0f0f] p-8 flex flex-col">
      <span className="text-xs text-white/20 font-mono mb-6">{tag}</span>
      <h3 className="text-lg font-semibold text-white/90 mb-3">{title}</h3>
      <p className="text-sm text-white/40 leading-relaxed">{description}</p>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div>
      <span className="text-xs text-white/20 font-mono">{n}</span>
      <h4 className="text-white/90 font-medium mt-2 mb-2">{title}</h4>
      <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
    </div>
  );
}
