const STORAGE_PREFIX =
  "sentinel:incident-ai";


function safeIncidentId(
  incidentId: string,
): string {
  return encodeURIComponent(
    incidentId,
  );
}


export function getAIInvestigationStorageKey(
  incidentId: string,
): string {
  return (
    `${STORAGE_PREFIX}:investigation:`
    + safeIncidentId(
      incidentId,
    )
  );
}


export function getAIChatStorageKey(
  incidentId: string,
): string {
  return (
    `${STORAGE_PREFIX}:chat:`
    + safeIncidentId(
      incidentId,
    )
  );
}


/*
 * sessionStorage can fail in unusual browser
 * configurations, so caching must never be able
 * to break SENTINEL itself.
 */
export function readSessionValue<T>(
  key: string,
): T | null {
  try {
    const rawValue =
      window.sessionStorage.getItem(
        key,
      );


    if (
      rawValue === null
    ) {
      return null;
    }


    return JSON.parse(
      rawValue,
    ) as T;
  } catch {
    return null;
  }
}


export function writeSessionValue<T>(
  key: string,
  value: T,
): void {
  try {
    window.sessionStorage.setItem(
      key,
      JSON.stringify(
        value,
      ),
    );
  } catch {
    /*
     * AI persistence is a convenience layer.
     * Storage failure must not interrupt the
     * investigation workflow.
     */
  }
}


export function removeSessionValue(
  key: string,
): void {
  try {
    window.sessionStorage.removeItem(
      key,
    );
  } catch {
    /*
     * Ignore browser storage failures for the
     * same reason as writes above.
     */
  }
}