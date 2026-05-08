import { useState, useRef, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { listSessions, createSession, getSession, sendSessionMessage } from '../api';
import type { ChatSession, ChatMessage } from '../types';

export function QueryPanel({ kbId }: { kbId: string }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [copiedIdx, setCopiedIdx] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Load sessions on mount
  useEffect(() => {
    listSessions(kbId)
      .then((s) => setSessions(s))
      .catch(() => {})
      .finally(() => setLoadingSessions(false));
  }, [kbId]);

  // Load messages when session changes
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    getSession(kbId, activeSessionId)
      .then(({ messages: msgs }) => setMessages(msgs))
      .catch(() => setMessages([]));
  }, [kbId, activeSessionId]);



  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(id);
    setTimeout(() => setCopiedIdx(null), 2000);
  }, []);

  const handleNewChat = async () => {
    try {
      const session = await createSession(kbId);
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
      setMessages([]);
    } catch (e: any) {
      console.error('Failed to create session', e);
    }
  };

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    // If no active session, create one first
    let sessionId = activeSessionId;
    if (!sessionId) {
      try {
        const title = question.length > 50 ? question.slice(0, 50) + '...' : question;
        const session = await createSession(kbId, title);
        setSessions((prev) => [session, ...prev]);
        setActiveSessionId(session.id);
        sessionId = session.id;
      } catch {
        return;
      }
    }

    setInput('');
    // Optimistic user message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      role: 'user',
      content: question,
      metadata: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const assistantMsg = await sendSessionMessage(kbId, sessionId, question);
      setMessages((prev) => [
        ...prev,
        assistantMsg,
      ]);
      // Update session title if it was the first message
      if (messages.length === 0) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? { ...s, title: question.length > 50 ? question.slice(0, 50) + '...' : question, updated_at: new Date().toISOString() }
              : s
          )
        );
      }
    } catch (e: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        session_id: sessionId,
        role: 'assistant',
        content: `Error: ${e.message || 'Query failed'}`,
        metadata: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="flex h-[calc(100vh-14rem)]">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } transition-all duration-200 overflow-hidden flex-shrink-0`}
      >
        <div className="w-64 h-full flex flex-col border-r border-white/5">
          <button
            onClick={handleNewChat}
            className="mx-3 mt-3 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm font-medium transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New Chat
          </button>

          <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
            {loadingSessions && (
              <p className="text-xs text-white/20 px-2 py-4">Loading...</p>
            )}
            {!loadingSessions && sessions.length === 0 && (
              <p className="text-xs text-white/20 px-2 py-4 text-center">No chats yet</p>
            )}
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelectSession(s.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer truncate ${
                  activeSessionId === s.id
                    ? 'bg-white/10 text-white'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                }`}
                title={s.title}
              >
                <div className="truncate">{s.title}</div>
                <div className="text-[10px] text-white/20 mt-0.5">{formatDate(s.updated_at)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toggle sidebar button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="flex-shrink-0 self-start mt-3 px-1.5 py-1.5 text-white/20 hover:text-white/50 transition-colors cursor-pointer"
        title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto space-y-4 pb-4 px-4"
        >
          {messages.length === 0 && !activeSessionId && (
            <div className="text-center py-20">
              <p className="text-white/30 text-lg">Ask a question about your documents</p>
              <p className="text-white/15 text-sm mt-2">
                Start typing to create a new chat session
              </p>
            </div>
          )}
          {messages.length === 0 && activeSessionId && (
            <div className="text-center py-20">
              <p className="text-white/30 text-lg">New chat</p>
              <p className="text-white/15 text-sm mt-2">Ask a question to get started</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id}>
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
                  <>
                    <div className="prose prose-sm prose-invert max-w-none text-white/70">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => copyToClipboard(msg.content, msg.id)}
                        className="text-white/20 hover:text-white/50 transition-colors cursor-pointer"
                        title="Copy response"
                      >
                        {copiedIdx === msg.id ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
              {msg.metadata && msg.metadata.reasoning_path.length > 0 && (
                <details className="mt-2 max-w-3xl">
                  <summary className="text-xs text-white/25 cursor-pointer hover:text-white/50">
                    Reasoning path ({msg.metadata.tools_used.length} tool calls)
                  </summary>
                  <div className="mt-2 bg-white/5 rounded-xl p-3 text-xs text-white/40 space-y-1">
                    {msg.metadata.reasoning_path.map((step, j) => (
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
        </div>

        <form onSubmit={handleSubmit} className="flex gap-3 pt-4 px-4 border-t border-white/5">
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
    </div>
  );
}
