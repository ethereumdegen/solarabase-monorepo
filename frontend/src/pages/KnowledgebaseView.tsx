import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { QueryPanel } from '../components/QueryPanel';
import { DocumentList } from '../components/DocumentList';
import { Upload } from '../components/Upload';
import { WikiPanel } from '../components/WikiPanel';
import { KbSettings } from '../components/KbSettings';
import { getKbSettings } from '../api';
import type { Knowledgebase } from '../types';

type Tab = 'query' | 'documents' | 'wiki' | 'settings';

export function KnowledgebaseView() {
  const { kbId } = useParams<{ kbId: string }>();
  const [kb, setKb] = useState<Knowledgebase | null>(null);
  const [tab, setTab] = useState<Tab>('query');
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (kbId) {
      getKbSettings(kbId).then(setKb).catch((e) => setError(e.message));
    }
  }, [kbId]);

  if (error) {
    return <Layout><div className="text-center py-20"><p className="text-red-500 mb-4">{error}</p><Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">Back to Dashboard</Link></div></Layout>;
  }

  if (!kbId || !kb) {
    return <Layout><div className="text-gray-400 text-center py-20">Loading...</div></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/dashboard" className="text-xs text-gray-400 hover:text-gray-600 mb-1 inline-block">&larr; Dashboard</Link>
            <h1 className="text-2xl font-bold">{kb.name}</h1>
            {kb.description && (
              <p className="text-sm text-gray-400 mt-1">{kb.description}</p>
            )}
          </div>
          <nav className="flex gap-1">
            {(['query', 'documents', 'wiki', 'settings'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize ${
                  tab === t
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>

        {tab === 'query' && <QueryPanel kbId={kbId} />}
        {tab === 'documents' && (
          <div className="space-y-6">
            <Upload kbId={kbId} onUploaded={() => setRefreshKey((k) => k + 1)} />
            <DocumentList kbId={kbId} key={refreshKey} />
          </div>
        )}
        {tab === 'wiki' && <WikiPanel kbId={kbId} />}
        {tab === 'settings' && <KbSettings kb={kb} onUpdated={setKb} />}
      </div>
    </Layout>
  );
}
