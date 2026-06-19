// A2A (Agent2Agent) protocol model — aligned with spec v0.2.5
// https://a2a-protocol.org/v0.2.5/specification/

export const A2A_SPEC_VERSION = "0.2.5";
export const WELL_KNOWN_PATH = "/.well-known/agent-card.json";
export const LEGACY_WELL_KNOWN_PATH = "/.well-known/agent.json";

// ---- Agent Card ------------------------------------------------------------

export interface AgentProvider {
  organization: string;
  url: string;
}

export interface AgentExtension {
  uri: string;
  description?: string;
  required?: boolean;
  params?: Record<string, unknown>;
}

export interface AgentCapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  stateTransitionHistory?: boolean;
  extensions?: AgentExtension[];
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
}

export interface AgentInterface {
  url: string;
  transport: string;
}

export interface AgentCard {
  protocolVersion: string;
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: AgentCapabilities;
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: AgentSkill[];
  // optional
  provider?: AgentProvider;
  iconUrl?: string;
  documentationUrl?: string;
  preferredTransport?: string;
  additionalInterfaces?: AgentInterface[];
  securitySchemes?: Record<string, unknown>;
  security?: Array<Record<string, string[]>>;
  supportsAuthenticatedExtendedCard?: boolean;
}

// ---- Messages / Tasks ------------------------------------------------------

export type Role = "user" | "agent";

export interface TextPart {
  kind: "text";
  text: string;
  metadata?: Record<string, unknown>;
}
export interface FilePart {
  kind: "file";
  file: { name?: string; mimeType?: string; uri?: string; bytes?: string };
  metadata?: Record<string, unknown>;
}
export interface DataPart {
  kind: "data";
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
export type Part = TextPart | FilePart | DataPart;

export interface Message {
  kind: "message";
  role: Role;
  parts: Part[];
  messageId: string;
  taskId?: string;
  contextId?: string;
  metadata?: Record<string, unknown>;
}

export type TaskState =
  | "submitted"
  | "working"
  | "input-required"
  | "auth-required"
  | "completed"
  | "canceled"
  | "failed"
  | "rejected"
  | "unknown";

export const TERMINAL_STATES: TaskState[] = [
  "completed",
  "canceled",
  "failed",
  "rejected",
  "unknown",
];

export interface TaskStatus {
  state: TaskState;
  message?: Message;
  timestamp?: string;
}

export interface Artifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts: Part[];
}

export interface Task {
  kind: "task";
  id: string;
  contextId: string;
  status: TaskStatus;
  history?: Message[];
  artifacts?: Artifact[];
  metadata?: Record<string, unknown>;
}

// ---- Streaming events ------------------------------------------------------

export interface TaskStatusUpdateEvent {
  kind: "status-update";
  taskId: string;
  contextId: string;
  status: TaskStatus;
  final: boolean;
}

export interface TaskArtifactUpdateEvent {
  kind: "artifact-update";
  taskId: string;
  contextId: string;
  artifact: Artifact;
  append?: boolean;
  lastChunk?: boolean;
}

export type StreamEvent =
  | Task
  | Message
  | TaskStatusUpdateEvent
  | TaskArtifactUpdateEvent;

// ---- JSON-RPC --------------------------------------------------------------

export interface JsonRpcRequest<P = unknown> {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params: P;
}

export interface JsonRpcResponse<R = unknown> {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: R;
  error?: { code: number; message: string; data?: unknown };
}
