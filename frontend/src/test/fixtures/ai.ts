import type {
  AIIncidentChatResponse,
  AIInvestigationResponse,
  AIServiceStatus,
} from "../../types/ai";


export function makeAIServiceStatus(
  overrides:
    Partial<AIServiceStatus> = {},
): AIServiceStatus {
  return {
    enabled:
      true,

    available:
      true,

    provider:
      "ollama",

    model:
      "llama3.2:3b",

    message:
      "Local AI is ready.",

    ...overrides,
  };
}


export function makeAIInvestigationResponse(
  overrides:
    Partial<AIInvestigationResponse> = {},
): AIInvestigationResponse {
  return {
    incident_id:
      "INC-001",

    provider:
      "ollama",

    model:
      "llama3.2:3b",

    generated_at:
      "2026-09-23T09:35:00Z",

    generation_duration_ms:
      4200,

    grounded_on_deterministic_evidence:
      true,

    content: {
      executive_assessment:
        "The incident contains a suspicious authentication sequence supported by SENTINEL evidence.",

      why_suspicious: [
        "Repeated authentication failures preceded unusual successful access.",
      ],

      timeline_interpretation:
        "The sequence indicates escalating authentication activity followed by anomalous access.",

      investigation_priorities: [
        "Validate whether the employee recognizes the authentication source.",
      ],

      containment_considerations: [
        "Review active sessions if the activity is not recognized.",
      ],

      confidence:
        "HIGH",

      limitations: [
        "The assessment is limited to the deterministic evidence supplied by SENTINEL.",
      ],
    },

    ...overrides,
  };
}


export function makeAIChatResponse(
  overrides:
    Partial<AIIncidentChatResponse> = {},
): AIIncidentChatResponse {
  return {
    incident_id:
      "INC-001",

    provider:
      "ollama",

    model:
      "llama3.2:3b",

    generated_at:
      "2026-09-23T09:36:00Z",

    generation_duration_ms:
      3500,

    grounded_on_deterministic_evidence:
      true,

    content: {
      response_type:
        "ANSWER",

      answer:
        "The repeated failures followed by unusual access are the strongest authentication indicators in the supplied evidence.",
    },

    ...overrides,
  };
}
