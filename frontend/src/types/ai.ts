export type AIProvider =
  | "ollama";


export type AIConfidence =
  | "LOW"
  | "MEDIUM"
  | "HIGH";


export interface AIServiceStatus {
  enabled: boolean;
  available: boolean;

  provider: AIProvider;
  model: string;

  message: string;
}


export interface AIInvestigationContent {
  executive_assessment: string;

  why_suspicious: string[];

  timeline_interpretation: string;

  investigation_priorities: string[];

  containment_considerations: string[];

  confidence: AIConfidence;

  limitations: string[];
}


export interface AIInvestigationResponse {
  incident_id: string;

  provider: AIProvider;
  model: string;

  generated_at: string;

  generation_duration_ms: number;

  grounded_on_deterministic_evidence: boolean;

  content: AIInvestigationContent;
}


// ============================================================
// Incident AI Chat
// ============================================================

export type AIChatRole =
  | "user"
  | "assistant";


export type AIChatResponseType =
  | "ANSWER"
  | "INVALID_QUESTION"
  | "OUT_OF_SCOPE"
  | "INSUFFICIENT_EVIDENCE";


export interface AIChatHistoryMessage {
  role: AIChatRole;

  content: string;
}


export interface AIIncidentChatRequest {
  message: string;

  history: AIChatHistoryMessage[];
}


export interface AIIncidentChatContent {
  response_type: AIChatResponseType;

  answer: string;
}


export interface AIIncidentChatResponse {
  incident_id: string;

  provider: AIProvider;
  model: string;

  generated_at: string;

  generation_duration_ms: number;

  grounded_on_deterministic_evidence: boolean;

  content: AIIncidentChatContent;
}