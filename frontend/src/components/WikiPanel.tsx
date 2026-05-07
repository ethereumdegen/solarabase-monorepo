import React, { useEffect, useState } from 'react';
import { listWikiPages, getWikiPage } from '../api';
import type { WikiPage, WikiPageDetail } from '../types';

export function WikiPanel({ kbId }: { kbId: string }) {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WikiPageDetail | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);

  useEffect(() => {
    listWikiPages(kbId)
      .then((data) => setPages(data.pages))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [kbId]);

  const openPage = async (slug: string) => {
    setLoadingPage(true);
    try {
      const detail = await getWikiPage(kbId, slug);
      setSelected(detail);
    } catch {
      // ignore
    } finally {
      setLoadingPage(false);
    }
  };

  if (loading) return <p className="text-gray-400 text-center py-8">Loading wiki...</p>;

  if (selected) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelected(null)}
          className="text-xs text-gray-400 hover:text-gray-600">&larr; Back to wiki</button>
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-xl font-bold mb-1">{selected.title}</h2>
          {selected.summary && <p className="text-sm text-gray-400 mb-4">{selected.summary}</p>}
          <div className="prose prose-sm max-w-none">
            <MarkdownRenderer content={selected.markdown} />
          </div>
          {selected.sources && Array.isArray(selected.sources) && selected.sources.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Sources</p>
              <div className="space-y-1">
                {selected.sources.map((s: any, i: number) => (
                  <p key={i} className="text-xs text-gray-400">{s.filename}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (pages.length === 0) {
    return <p className="text-gray-400 text-center py-8">No wiki pages yet. Wiki pages are auto-generated when documents are indexed.</p>;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
        Wiki ({pages.length} pages)
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {pages.map((page) => (
          <button
            key={page.id}
            onClick={() => openPage(page.slug)}
            disabled={loadingPage}
            className="bg-white rounded-2xl shadow-sm p-5 text-left hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 truncate">{page.title}</h3>
                {page.summary && (
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{page.summary}</p>
                )}
              </div>
              <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] text-gray-500 uppercase shrink-0">
                {page.page_type}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MarkdownRenderer({ content }: { content: string }) {
  // Simple markdown rendering — handles headers, bold, lists, code blocks
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeKey = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(<pre key={`code-${codeKey++}`} className="bg-gray-50 rounded-lg p-3 text-xs overflow-x-auto my-2">{codeLines.join('\n')}</pre>);
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(2)}</h1>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-lg font-semibold mt-3 mb-1">{line.slice(3)}</h2>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-base font-medium mt-2 mb-1">{line.slice(4)}</h3>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(<li key={i} className="ml-4 text-sm text-gray-700">{formatInline(line.slice(2))}</li>);
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i} className="text-sm text-gray-700">{formatInline(line)}</p>);
    }
  }

  return <>{elements}</>;
}

function formatInline(text: string): React.ReactNode {
  // Handle **bold** and `code`
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const codeMatch = remaining.match(/`(.+?)`/);

    const nextMatch = [boldMatch, codeMatch]
      .filter(Boolean)
      .sort((a, b) => (a!.index ?? Infinity) - (b!.index ?? Infinity))[0];

    if (!nextMatch || nextMatch.index === undefined) {
      parts.push(remaining);
      break;
    }

    if (nextMatch.index > 0) {
      parts.push(remaining.slice(0, nextMatch.index));
    }

    if (nextMatch === boldMatch) {
      parts.push(<strong key={key++}>{nextMatch[1]}</strong>);
    } else {
      parts.push(<code key={key++} className="bg-gray-100 px-1 py-0.5 rounded text-xs">{nextMatch[1]}</code>);
    }

    remaining = remaining.slice(nextMatch.index + nextMatch[0].length);
  }

  return <>{parts}</>;
}
