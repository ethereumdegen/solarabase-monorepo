import type {
  User,
  Workspace,
  Knowledgebase,
  Document,
  QueryResponse,
  ApiKeyInfo,
  ApiKeyCreated,
  BillingInfo,
  MemberWithUser,
  ChatSession,
  WikiPage,
  WikiPageDetail,
  KbMember,
  KbRole,
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

// Workspaces
export const listWorkspaces = () => fetchJson<Workspace[]>('/api/workspaces');
export const createWorkspace = (data: { name: string; slug: string }) =>
  fetchJson<Workspace>('/api/workspaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
export const getWorkspace = (id: string) => fetchJson<Workspace>(`/api/workspaces/${id}`);
export const updateWorkspace = (id: string, data: { name: string }) =>
  fetchJson<Workspace>(`/api/workspaces/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
export const deleteWorkspace = (id: string) =>
  fetch(`/api/workspaces/${id}`, { method: 'DELETE', credentials: 'include' });
export const listMembers = (wsId: string) =>
  fetchJson<MemberWithUser[]>(`/api/workspaces/${wsId}/members`);
export const inviteMember = (wsId: string, email: string, role?: string) =>
  fetchJson<unknown>(`/api/workspaces/${wsId}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role }),
  });
export const removeMember = (wsId: string, userId: string) =>
  fetch(`/api/workspaces/${wsId}/members/${userId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

// Knowledgebases
export const listKbs = (wsId: string) =>
  fetchJson<Knowledgebase[]>(`/api/workspaces/${wsId}/kbs`);
export const createKb = (wsId: string, data: { name: string; slug: string; description?: string }) =>
  fetchJson<Knowledgebase>(`/api/workspaces/${wsId}/kbs`, {
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
export const uploadDocument = (kbId: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
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

// Billing
export const getBilling = (wsId: string) =>
  fetchJson<BillingInfo>(`/api/workspaces/${wsId}/billing`);
export const createCheckout = (wsId: string, plan: string) =>
  fetchJson<{ url: string }>(`/api/workspaces/${wsId}/billing/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  });
export const createPortal = (wsId: string) =>
  fetchJson<{ url: string }>(`/api/workspaces/${wsId}/billing/portal`, {
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

// Chat sessions
export const listSessions = (kbId: string) =>
  fetchJson<ChatSession[]>(`/api/kb/${kbId}/sessions`);

// Invitations
export const acceptInvite = (token: string) =>
  fetchJson<Workspace>(`/api/invitations/accept?token=${encodeURIComponent(token)}`, {
    method: 'POST',
  });
