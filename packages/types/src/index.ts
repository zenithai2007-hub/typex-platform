/* ============================================================================
 * @typex/types — shared domain types for TYPE X Core.
 * No runtime dependencies. Everything the agent engine, connection engine
 * and execution engine agree on lives here.
 * ========================================================================== */

/** What a platform connection is able to do. */
export enum Capability {
  READ_CONTEXT = 'READ_CONTEXT',
  READ_MESSAGES = 'READ_MESSAGES',
  READ_PAGE_CONTEXT = 'READ_PAGE_CONTEXT',
  GENERATE_CONTENT = 'GENERATE_CONTENT',
  GENERATE_TEXT = 'GENERATE_TEXT',
  GENERATE_REPLY = 'GENERATE_REPLY',
  INSERT_TEXT = 'INSERT_TEXT',
  SEND_MESSAGE = 'SEND_MESSAGE',
  FILL_FORM = 'FILL_FORM',
  SEARCH = 'SEARCH',
  UPLOAD = 'UPLOAD',
  POST = 'POST',
  SCHEDULE = 'SCHEDULE',
  MEDIA_SUPPORT = 'MEDIA_SUPPORT',
}

export type ConnectionType = 'oauth' | 'api_key' | 'extension' | 'companion' | 'none';
export type PlatformStatus = 'active' | 'beta' | 'disabled';

/** Static descriptor for a platform. Registered in PlatformRegistry —
 *  adding a platform never touches core. */
export interface Platform {
  id: string;
  name: string;
  icon: string;
  brandColor: string;
  connectionType: ConnectionType;
  capabilities: Capability[];
  authMethod: string;
  supportedActions: string[];
  contextExtraction: string;
  executionMethod: string;
  permissionRequirements: string[];
  rateLimits: string;
  approvalRequired: boolean;
  adapterVersion: string;
  status: PlatformStatus;
}

/** Standard result shape. `ok` is only ever true when the underlying
 *  provider/connection actually confirmed the action. */
export interface ExecutionResult {
  ok: boolean;
  code?: string;
  message?: string;
  data?: unknown;
}

export type ExecutionMode = 'api' | 'browser' | 'keyboard';

/** A planned, permission-checked unit of work. */
export interface ActionPlan {
  id: string;
  agentId: string;
  kind: string;
  platformId: string;
  payload: Record<string, unknown>;
  mode: ExecutionMode;
  requiresApproval: boolean;
  createdAt: Date;
}

/** Contract every platform adapter implements. Adapters override only what
 *  they truly support; PlatformAdapterBase answers the rest honestly. */
export interface PlatformAdapter {
  readonly platformId: string;
  connect(): Promise<ExecutionResult>;
  disconnect(): Promise<ExecutionResult>;
  authenticate(credentials: Record<string, string>): Promise<ExecutionResult>;
  getCapabilities(): Capability[];
  getCurrentContext(): Promise<ExecutionResult>;
  readContext(input?: unknown): Promise<ExecutionResult>;
  search(query: string): Promise<ExecutionResult>;
  generateAction(instruction: string, context: unknown): Promise<ExecutionResult>;
  prepareAction(plan: ActionPlan): Promise<ExecutionResult>;
  executeAction(plan: ActionPlan): Promise<ExecutionResult>;
  send(input: { to: string; text: string; name?: string }): Promise<ExecutionResult>;
  insertText(text: string): Promise<ExecutionResult>;
  upload(input: { file: unknown; name?: string }): Promise<ExecutionResult>;
  schedule(input: { at: string; action: unknown }): Promise<ExecutionResult>;
  stop(): Promise<ExecutionResult>;
  pause(): Promise<ExecutionResult>;
}

export type AgentStatus =
  | 'OFFLINE'
  | 'READY'
  | 'ACTIVE'
  | 'PAUSED'
  | 'WAITING_APPROVAL'
  | 'ERROR'
  | 'DISCONNECTED';

export type MemoryScope = 'GLOBAL' | 'PLATFORM' | 'AGENT' | 'TASK' | 'CONVERSATION';

/** Gateable powers an agent may hold. Denials are explicit and auditable. */
export enum Permission {
  READ_CONTEXT = 'READ_CONTEXT',
  READ_MESSAGES = 'READ_MESSAGES',
  GENERATE_CONTENT = 'GENERATE_CONTENT',
  GENERATE_TEXT = 'GENERATE_TEXT',
  GENERATE_REPLY = 'GENERATE_REPLY',
  INSERT_TEXT = 'INSERT_TEXT',
  SEND_MESSAGE = 'SEND_MESSAGE',
  SEARCH = 'SEARCH',
  FORM_FILL = 'FORM_FILL',
  UPLOAD = 'UPLOAD',
  POST = 'POST',
  DELETE = 'DELETE',
  SCHEDULE = 'SCHEDULE',
}

export interface Agent {
  id: string;
  userId: string;
  platformId: string;
  connectionId: string | null;
  name: string;
  avatar?: string;
  status: AgentStatus;
  instructions: string;
  memoryScope: MemoryScope;
  currentTask?: string | null;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
}

export type TaskStatus =
  | 'CREATED'
  | 'RUNNING'
  | 'WAITING'
  | 'WAITING_APPROVAL'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface AgentTask {
  id: string;
  agentId: string;
  objective: string;
  instructions: string;
  trigger?: string;
  status: TaskStatus;
  schedule?: string;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface Approval {
  id: string;
  agentId: string;
  action: string;
  preview: string;
  payload?: Record<string, unknown>;
  status: ApprovalStatus;
  createdAt: Date;
  decidedAt?: Date;
}

export type AuditOutcome = 'PREPARED' | 'APPROVED' | 'EXECUTED' | 'FAILED' | 'CANCELLED' | 'DENIED';

export interface AuditEvent {
  id: string;
  agentId: string;
  taskId?: string;
  action: string;
  outcome: AuditOutcome;
  detail?: Record<string, unknown>;
  createdAt: Date;
}

export interface MemoryItem {
  id: string;
  scope: MemoryScope;
  scopeId: string;
  key: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'EXPIRED' | 'NEEDS_SETUP' | 'ERROR';

export interface Connection {
  id: string;
  userId: string;
  platformId: string;
  status: ConnectionStatus;
  credentialsRef?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  agentId?: string;
  connectionId: string;
  platformId: string;
  externalId?: string;
  createdAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  dir: 'in' | 'out';
  text: string;
  externalId?: string;
  createdAt: Date;
}
