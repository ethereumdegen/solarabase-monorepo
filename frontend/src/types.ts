export type UserRole = 'user' | 'admin';

export type User = {
  id: string;
  google_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  last_login_at: string;
};

export type Knowledgebase = {
  id: string;
  owner_id: string;
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
  folder_id: string | null;
  page_count: number | null;
  pages_indexed: number | null;
  error_msg: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DocFolder = {
  id: string;
  kb_id: string;
  parent_id: string | null;
  name: string;
  category: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BreadcrumbEntry = {
  id: string;
  name: string;
  parent_id: string | null;
};

export type FolderContents = {
  folders: DocFolder[];
  documents: Document[];
  breadcrumb: BreadcrumbEntry[];
};

export const FOLDER_CATEGORIES = [
  'legal',
  'hr',
  'engineering',
  'marketing',
  'finance',
  'operations',
  'compliance',
  'research',
] as const;

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
  user_id: string;
  kb_id: string;
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

export type ChatMessage = {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata: { reasoning_path: string[]; tools_used: string[] } | null;
  created_at: string;
};

export type KbRole = 'viewer' | 'editor' | 'admin';

export type KbMember = {
  user_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: KbRole;
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

export type AgentLog = {
  id: string;
  session_id: string;
  kb_id: string;
  owner_id: string;
  status: string;
  worker_id: string | null;
  content: string;
  error: string | null;
  claimed_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LlmLog = {
  id: string;
  kb_id: string | null;
  session_id: string | null;
  request_type: string;
  model: string;
  input_chars: number;
  output_chars: number;
  latency_ms: number;
  status: string;
  error_msg: string | null;
  created_at: string;
};

export type LlmStats = {
  last_24h: {
    total_calls: number;
    total_input_chars: number;
    total_output_chars: number;
    avg_latency_ms: number;
  };
};

export type Invitation = {
  id: string;
  kb_id: string;
  email: string;
  role: KbRole;
  token: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
};

export type AdminSubscription = {
  id: string;
  user_id: string;
  kb_id: string;
  plan: PlanTier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionStats = {
  total: number;
  by_plan: { free: number; pro: number; team: number };
  by_status: { active: number; past_due: number; canceled: number };
};

export type WebhookEvent = {
  id: string;
  user_id: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  detail: { event_id?: string; type?: string } | null;
  ip_address: string | null;
  created_at: string;
};
