import type { Employee, SecurityEvent } from "../types/api";


const API_BASE_URL = "http://127.0.0.1:8000/api/v1";


async function request<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`);

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