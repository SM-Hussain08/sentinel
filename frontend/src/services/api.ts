import type {
  AnomalyResult,
  Employee,
  MLAnomaly,
  MLEventAnalysis,
  MLModelInfo,
  MLSummary,
  SecurityEvent,
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