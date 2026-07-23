// The Node<->Python contract, in TypeScript.
//
// These types mirror the Pydantic models in openly/api.py. They are the single
// source of truth on the Node side for what we send to and receive from the
// Python AI service. If the Python contract changes, these change too — keeping
// them in one file makes that boundary explicit and easy to maintain.

export type ContentType =
  "progress_update" | "origin_narrative" | "learning_reflection" | "concept_explainer";

// ---- POST /draft ----
export interface DraftRequest {
  content_type: ContentType;
  intent: string;
  session_context?: string | null;
  research_notes?: string | null;
  n_variations?: number; // 1..5, default 3 on the Python side
  model?: string | null;
}

export interface Source {
  title: string;
  url: string;
  snippet: string;
}

export interface Usage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface DraftResponse {
  variations: string[];
  content_type: string;
  needs_verification: boolean;
  sources: Source[];
  usage: Usage;
}

// ---- POST /fuse ----
export interface FuseRequest {
  content_type: ContentType;
  variations: string[];
  instruction?: string | null;
  model?: string | null;
}

export interface FuseResponse {
  text: string;
  content_type: string;
  usage: Usage;
}
