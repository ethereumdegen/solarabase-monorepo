import { Link } from 'react-router-dom';
import { useAuth } from '../auth';

export function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#f0f0f3]">
      <header className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Solarabase</h1>
        <div>
          {user ? (
            <Link to="/dashboard" className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium">
              Dashboard
            </Link>
          ) : (
            <Link to="/login" className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium">
              Sign In
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h2 className="text-5xl font-bold tracking-tight text-gray-900 mb-6">
          Knowledgebase-as-a-Service
        </h2>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-12">
          Upload documents, auto-index with AI, and query with a RAG agent.
          Multi-tenant, per-KB configuration, API keys for programmatic access.
        </p>

        <div className="flex justify-center gap-4">
          <Link
            to="/login"
            className="px-8 py-3 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Get Started Free
          </Link>
        </div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            title="Auto-Indexing"
            description="Upload docs and they get indexed using AI-powered PageIndex tree structures."
          />
          <FeatureCard
            title="Per-KB RAG Agent"
            description="Each knowledgebase has its own AI agent with custom system prompts and model selection."
          />
          <FeatureCard
            title="API Access"
            description="Generate API keys. Use /retrieve for RAG-only or /query for full AI answers."
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm text-left">
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}
