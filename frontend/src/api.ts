import type {
  User,
  Knowledgebase,
  Document,
  DocFolder,
  FolderContents,
  QueryResponse,
  ApiKeyInfo,
  ApiKeyCreated,
  BillingInfo,
  ChatSession,
  ChatMessage,
  WikiPage,
  WikiPageDetail,
  KbMember,
  KbRole,
  AgentLog,
  LlmLog,
  LlmStats,
  AdminSubscription,
  SubscriptionStats,
  WebhookEvent,
} from './types';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: 'include', ...init });
  } catch {
    throw new Error('Network error — check your connection');
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || res.statusText);
  }
  return res.json();
}

// Auth
export const getMe = () => fetchJson<User>('/api/auth/me');
export const logout = () => fetch('/auth/logout', { method: 'POST', credentials: 'include' });

// Knowledgebases
export const listKbs = () =>
  fetchJson<Knowledgebase[]>('/api/kbs');
export const createKb = (data: { name: string; slug: string; description?: string }) =>
  fetchJson<Knowledgebase>('/api/kbs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

// KB operations
export const getKbSettings = (kbId: string) =>
  fetchJson<Knowledgebase>(`/api/kb/${kbId}/settings`);
export const updateKbSettings = (kbId: string, data: Partial<Knowledgebase>) =>
  fetchJson<Knowledgebase>(`/api/kb/${kbId}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

// Documents
export const listDocuments = (kbId: string) =>
  fetchJson<Document[]>(`/api/kb/${kbId}/documents`);
export const uploadDocument = (kbId: string, file: File, folderId?: string) => {
  const form = new FormData();
  form.append('file', file);
  if (folderId) form.append('folder_id', folderId);
  return fetchJson<Document>(`/api/kb/${kbId}/documents`, {
    method: 'POST',
    body: form,
  });
};
export const deleteDocument = (kbId: string, docId: string) =>
  fetch(`/api/kb/${kbId}/documents/${docId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
export const reindexDocument = (kbId: string, docId: string) =>
  fetchJson<Document>(`/api/kb/${kbId}/documents/${docId}/reindex`, { method: 'POST' });
export const getDocumentContentUrl = (kbId: string, docId: string) =>
  `/api/kb/${kbId}/documents/${docId}/content`;
export const getDocumentPages = (kbId: string, docId: string) =>
  fetchJson<{ document: Document; pages: any[]; root_index: any }>(`/api/kb/${kbId}/documents/${docId}/pages`);

// Folders
export const listFolderContents = (kbId: string, parentId?: string) => {
  const params = parentId ? `?parent_id=${parentId}` : '';
  return fetchJson<FolderContents>(`/api/kb/${kbId}/folders${params}`);
};
export const createFolder = (kbId: string, data: { name: string; parent_id?: string; category?: string }) =>
  fetchJson<DocFolder>(`/api/kb/${kbId}/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
export const renameFolder = (kbId: string, folderId: string, name: string) =>
  fetchJson<DocFolder>(`/api/kb/${kbId}/folders/${folderId}/rename`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
export const moveFolder = (kbId: string, folderId: string, parentId: string | null) =>
  fetchJson<DocFolder>(`/api/kb/${kbId}/folders/${folderId}/move`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parent_id: parentId }),
  });
export const updateFolderCategory = (kbId: string, folderId: string, category: string | null) =>
  fetchJson<DocFolder>(`/api/kb/${kbId}/folders/${folderId}/category`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category }),
  });
export const deleteFolder = (kbId: string, folderId: string) =>
  fetch(`/api/kb/${kbId}/folders/${folderId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
export const moveDocument = (kbId: string, docId: string, folderId: string | null) =>
  fetchJson<Document>(`/api/kb/${kbId}/documents/${docId}/move`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder_id: folderId }),
  });

// Wiki
export const listWikiPages = (kbId: string) =>
  fetchJson<{ pages: WikiPage[]; total: number }>(`/api/kb/${kbId}/wiki`);
export const getWikiPage = (kbId: string, slug: string) =>
  fetchJson<WikiPageDetail>(`/api/kb/${kbId}/wiki/${slug}`);

// Query
export const queryKb = (kbId: string, question: string, sessionId?: string) =>
  fetchJson<QueryResponse>(`/api/kb/${kbId}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, session_id: sessionId }),
  });

// API Keys
export const listApiKeys = (kbId: string) =>
  fetchJson<ApiKeyInfo[]>(`/api/kb/${kbId}/api-keys`);
export const createApiKey = (kbId: string, name: string) =>
  fetchJson<ApiKeyCreated>(`/api/kb/${kbId}/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
export const revokeApiKey = (kbId: string, keyId: string) =>
  fetch(`/api/kb/${kbId}/api-keys/${keyId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

// Billing (per-KB)
export const getKbBilling = (kbId: string) =>
  fetchJson<BillingInfo>(`/api/kb/${kbId}/billing`);
export const createKbCheckout = (kbId: string, plan: string) =>
  fetchJson<{ url: string }>(`/api/kb/${kbId}/billing/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  });
// Billing portal (user-level — manage payment methods)
export const createPortal = () =>
  fetchJson<{ url: string }>('/api/billing/portal', {
    method: 'POST',
  });

// KB Members
export const listKbMembers = (kbId: string) =>
  fetchJson<KbMember[]>(`/api/kb/${kbId}/members`);
export const addKbMember = (kbId: string, email: string, role?: KbRole) =>
  fetchJson<unknown>(`/api/kb/${kbId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role }),
  });
export const removeKbMember = (kbId: string, userId: string) =>
  fetch(`/api/kb/${kbId}/members/${userId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

// KB Invitations
export const inviteToKb = (kbId: string, email: string, role?: KbRole) =>
  fetchJson<unknown>(`/api/kb/${kbId}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role }),
  });

// Chat sessions
export const listSessions = (kbId: string) =>
  fetchJson<ChatSession[]>(`/api/kb/${kbId}/sessions`);
export const createSession = (kbId: string, title?: string) =>
  fetchJson<ChatSession>(`/api/kb/${kbId}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
export const getSession = (kbId: string, sessionId: string) =>
  fetchJson<{ session: ChatSession; messages: ChatMessage[] }>(`/api/kb/${kbId}/sessions/${sessionId}`);
export const sendSessionMessage = (kbId: string, sessionId: string, content: string) =>
  fetchJson<ChatMessage>(`/api/kb/${kbId}/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });

/** Stream a chat message via SSE. Returns an AbortController to cancel. */
export function streamMessage(
  kbId: string,
  sessionId: string,
  content: string,
  onEvent: (event: StreamEvent) => void,
  onDone: (result: StreamComplete) => void,
  onError: (error: string) => void,
): AbortController {
  const controller = new AbortController();

  fetch(`/api/kb/${kbId}/sessions/${sessionId}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ content }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.text();
        onError(body || res.statusText);
        return;
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'complete') {
                onDone(data as StreamComplete);
              } else if (data.type === 'error') {
                onError(data.message);
              } else {
                onEvent(data as StreamEvent);
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError(err.message || 'Stream failed');
      }
    });

  return controller;
}

export interface StreamEvent {
  type: 'llm_start' | 'llm_end' | 'tool_start' | 'tool_end' | 'done' | 'error';
  name?: string;
  call_id?: string;
  tool_calls?: number;
  has_answer?: boolean;
  is_error?: boolean;
  duration_ms?: number;
  answer?: string;
  message?: string;
}

export interface StreamComplete {
  type: 'complete';
  answer: string;
  reasoning_path: string[];
  tools_used: string[];
}

// Admin
export const adminListUsers = () => fetchJson<{ users: User[]; total: number }>('/api/admin/users');
export const adminListKbs = () => fetchJson<{ kbs: Knowledgebase[]; total: number }>('/api/admin/kbs');
export const adminListAgentLogs = (limit = 50, offset = 0) =>
  fetchJson<{ jobs: AgentLog[]; total: number }>(`/api/admin/agent-logs?limit=${limit}&offset=${offset}`);
export const adminGetAgentLog = (id: string) =>
  fetchJson<{
    job: AgentLog;
    session: { id: string; kb_id: string; user_id: string; title: string; created_at: string; updated_at: string } | null;
    messages: ChatMessage[];
    owner: { id: string; name: string; email: string } | null;
  }>(`/api/admin/agent-logs/${id}`);
export const adminListLlmLogs = (limit = 50, offset = 0) =>
  fetchJson<{ logs: LlmLog[]; total: number; stats: LlmStats }>(`/api/admin/llm-logs?limit=${limit}&offset=${offset}`);
export const adminListSubscriptions = (limit = 50, offset = 0) =>
  fetchJson<{ subscriptions: AdminSubscription[]; total: number; stats: SubscriptionStats }>(`/api/admin/subscriptions?limit=${limit}&offset=${offset}`);
export const adminListWebhookEvents = (limit = 50, offset = 0) =>
  fetchJson<{ events: WebhookEvent[]; total: number }>(`/api/admin/webhook-events?limit=${limit}&offset=${offset}`);

// Invitations
export const acceptInvite = (token: string) =>
  fetchJson<Knowledgebase>(`/api/invitations/accept?token=${encodeURIComponent(token)}`, {
    method: 'POST',
  });
