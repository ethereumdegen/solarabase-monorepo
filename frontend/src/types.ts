export type User = {
  id: string;
  google_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
  last_login_at: string;
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceRole = 'owner' | 'admin' | 'member';

export type MemberWithUser = {
  user_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: WorkspaceRole;
};

export type Knowledgebase = {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description: string;
  system_prompt: string;
  model: string;
  accent_color: string;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Document = {
  id: string;
  kb_id: string;
  filename: string;
  mime_type: string;
  s3_key: string;
  size_bytes: number;
  status: 'uploaded' | 'processing' | 'indexed' | 'failed';
  page_count: number | null;
  pages_indexed: number | null;
  error_msg: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type QueryResponse = {
  answer: string;
  reasoning_path: string[];
  tools_used: string[];
};

export type ApiKeyInfo = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
};

export type ApiKeyCreated = ApiKeyInfo & {
  key: string;
};

export type PlanTier = 'free' | 'pro' | 'team';

export type Subscription = {
  id: string;
  workspace_id: string;
  plan: PlanTier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

export type BillingInfo = {
  subscription: Subscription;
  usage: {
    queries: number;
  };
};

export type ChatSession = {
  id: string;
  kb_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type WikiPage = {
  id: string;
  kb_id: string;
  document_id: string | null;
  slug: string;
  title: string;
  summary: string | null;
  content_s3_key: string;
  page_type: string;
  sources: any;
  created_at: string;
  updated_at: string;
};

export type WikiPageDetail = WikiPage & {
  markdown: string;
};

export type Invitation = {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
};
