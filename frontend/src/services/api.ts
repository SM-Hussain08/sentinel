import type {
  AnomalyResult,
  Employee,
  IncidentDetail,
  IncidentInvestigation,
  IncidentListItem,
  IncidentSummary,
  IncidentTimelineEvent,
  MLAnomaly,
  MLEventAnalysis,
  MLModelInfo,
  MLSummary,
  SecurityEvent,
  EvaluationSummary,
  MLAnomalyFeedPage,
} from "../types/api";


const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "http://127.0.0.1:8000/api/v1";


async function request<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    options,
  );

  if (!response.ok) {
    throw new Error(
      `SENTINEL API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}


export function getEmployees(): Promise<Employee[]> {
  return request<Employee[]>("/employees");
}


export function getEvents(limit = 50): Promise<SecurityEvent[]> {
  return request<SecurityEvent[]>(`/events?limit=${limit}`);
}


export function getEvent(eventId: string): Promise<SecurityEvent> {
  return request<SecurityEvent>(`/events/${eventId}`);
}


export function getAnomalies(): Promise<AnomalyResult[]> {
  return request<AnomalyResult[]>("/anomalies");
}


export function analyzeEvent(
  eventId: string,
): Promise<AnomalyResult> {
  return request<AnomalyResult>(
    `/anomalies/analyze/${eventId}`,
    {
      method: "POST",
    },
  );
}


export function getMLModelInfo() {
  return request<MLModelInfo>(
    "/ml/model",
  );
}


export function getMLSummary() {
  return request<MLSummary>(
    "/ml/summary",
  );
}


export function getMLAnomalies(
  limit = 50,
) {
  return request<MLAnomaly[]>(
    `/ml/anomalies?limit=${limit}`,
  );
}


export function getMLEventAnalysis(
  eventId: string,
) {
  return request<MLEventAnalysis>(
    `/ml/events/${encodeURIComponent(
      eventId,
    )}`,
  );
}

export function getIncidentSummary() {
  return request<IncidentSummary>(
    "/incidents/summary",
  );
}


export function getIncidents(
  limit = 50,
) {
  return request<
    IncidentListItem[]
  >(
    `/incidents?limit=${limit}`,
  );
}


export function getIncidentsBySeverity(
  severity:
    | "CRITICAL"
    | "HIGH"
    | "MEDIUM",
  limit = 50,
) {
  return request<
    IncidentListItem[]
  >(
    `/incidents?severity=${severity}&limit=${limit}`,
  );
}


export function getIncidentDetail(
  incidentId: string,
) {
  return request<IncidentDetail>(
    `/incidents/${encodeURIComponent(
      incidentId,
    )}`,
  );
}


export function getIncidentTimeline(
  incidentId: string,
) {
  return request<
    IncidentTimelineEvent[]
  >(
    `/incidents/${encodeURIComponent(
      incidentId,
    )}/timeline`,
  );
}


export function getIncidentInvestigation(
  incidentId: string,
) {
  return request<
    IncidentInvestigation
  >(
    `/incidents/${encodeURIComponent(
      incidentId,
    )}/investigation`,
  );
}

export function getEvaluationSummary() {
  return request<EvaluationSummary>(
    "/evaluation/summary",
  );
}


export interface MLAnomalyPageOptions {
  riskLevel?:
    | "CRITICAL"
    | "HIGH"
    | "MEDIUM"
    | "LOW";

  search?: string;

  limit?: number;
  offset?: number;
}


export function getMLAnomalyPage(
  options:
    MLAnomalyPageOptions = {},
) {
  const params =
    new URLSearchParams();

  if (
    options.riskLevel
  ) {
    params.set(
      "risk_level",
      options.riskLevel,
    );
  }

  if (
    options.search
  ) {
    params.set(
      "search",
      options.search,
    );
  }

  params.set(
    "limit",
    String(
      options.limit
      ?? 50,
    ),
  );

  params.set(
    "offset",
    String(
      options.offset
      ?? 0,
    ),
  );

  return request<
    MLAnomalyFeedPage
  >(
    `/ml/anomalies/paged?${params.toString()}`,
  );
}