import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { queryKb } from '../api';
import type { QueryResponse } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  meta?: QueryResponse;
}

export function QueryPanel({ kbId }: { kbId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    try {
      const response = await queryKb(kbId, question);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.answer, meta: response },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${e.message || 'Query failed'}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)]">
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="text-center py-20">
            <p className="text-white/30 text-lg">Ask a question about your documents</p>
            <p className="text-white/15 text-sm mt-2">
              The agent will search through indexed documents using PageIndex tree navigation
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i}>
            <div
              className={`rounded-xl px-5 py-4 max-w-3xl ${
                msg.role === 'user'
                  ? 'bg-white/10 text-white ml-auto'
                  : 'bg-[#111] border border-white/5'
              }`}
            >
              <p className="text-xs font-medium mb-2 text-white/30">
                {msg.role === 'user' ? 'You' : 'Agent'}
              </p>
              {msg.role === 'user' ? (
                <div className="text-white/80 text-sm leading-relaxed">{msg.content}</div>
              ) : (
                <div className="prose prose-sm prose-invert max-w-none text-white/70">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              )}
            </div>
            {msg.meta && msg.meta.reasoning_path.length > 0 && (
              <details className="mt-2 max-w-3xl">
                <summary className="text-xs text-white/25 cursor-pointer hover:text-white/50">
                  Reasoning path ({msg.meta.tools_used.length} tool calls)
                </summary>
                <div className="mt-2 bg-white/5 rounded-xl p-3 text-xs text-white/40 space-y-1">
                  {msg.meta.reasoning_path.map((step, j) => (
                    <p key={j} className="font-mono">{j + 1}. {step}</p>
                  ))}
                </div>
              </details>
            )}
          </div>
        ))}
        {loading && (
          <div className="bg-[#111] border border-white/5 rounded-xl px-5 py-4 max-w-3xl">
            <p className="text-xs font-medium mb-2 text-white/30">Agent</p>
            <p className="text-white/30 animate-pulse text-sm">Thinking...</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3 pt-4 border-t border-white/5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          disabled={loading}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:ring-1 focus:ring-white/20 transition-all disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-white/10 hover:bg-white/15 disabled:bg-white/5 disabled:text-white/20 text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
