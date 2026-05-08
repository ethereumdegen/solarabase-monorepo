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

// Admin
export const adminListUsers = () => fetchJson<User[]>('/api/admin/users');
export const adminListKbs = () => fetchJson<Knowledgebase[]>('/api/admin/kbs');

// Invitations
export const acceptInvite = (token: string) =>
  fetchJson<Knowledgebase>(`/api/invitations/accept?token=${encodeURIComponent(token)}`, {
    method: 'POST',
  });
