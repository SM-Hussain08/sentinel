import type {
  IncidentDetail,
  IncidentInvestigation,
  IncidentListItem,
  IncidentSummary,
  IncidentTimelineEvent,
} from "../../types/api";


export function makeIncidentSummary(
  overrides:
    Partial<IncidentSummary> = {},
): IncidentSummary {
  return {
    total_incidents: 26,
    open_incidents: 7,

    critical_incidents: 3,
    high_incidents: 9,
    medium_incidents: 14,

    total_correlated_events:
      118,

    severity_distribution: {
      medium: 14,
      high: 9,
      critical: 3,
    },

    ...overrides,
  };
}


export function makeIncidentListItem(
  overrides:
    Partial<IncidentListItem> = {},
): IncidentListItem {
  return {
    incident_id:
      "INC-001",

    title:
      "Suspicious authentication sequence",

    incident_type:
      "ACCOUNT_TAKEOVER",

    severity:
      "CRITICAL",

    status:
      "OPEN",

    primary_employee_user_id:
      "EMP-001",

    first_seen:
      "2026-09-23T09:25:00Z",

    last_seen:
      "2026-09-23T09:31:00Z",

    event_count: 5,
    anomaly_count: 3,

    max_anomaly_score:
      0.982,

    summary:
      "Repeated authentication failures were followed by anomalous account activity.",

    ...overrides,
  };
}


export function makeIncidentDetail(
  overrides:
    Partial<IncidentDetail> = {},
): IncidentDetail {
  const incident =
    makeIncidentListItem();

  return {
    ...incident,

    correlation_reason:
      "Multiple temporally related security signals exceeded deterministic correlation criteria.",

    indicators: [
      {
        type:
          "AUTHENTICATION",

        label:
          "Failed logins",

        value:
          7,

        severity:
          "CRITICAL",
      },
    ],

    evidence: {
      signals: {
        login_failures: 7,
        distinct_source_ips: 3,
      },

      detector_name:
        "isolation-forest",

      detector_version:
        "1.2",

      correlation_engine:
        "sentinel-correlation",

      correlation_version:
        "1.0",

      investigation: {
        engine:
          "sentinel-investigation",

        version:
          "1.0",

        severity_rationale:
          "Multiple high-confidence authentication signals were observed.",
      },
    },

    investigation_steps: [
      {
        priority: 1,

        action:
          "Review authentication history",

        reason:
          "Repeated failures preceded unusual successful access.",
      },
    ],

    ...overrides,
  };
}


export function makeIncidentTimelineEvent(
  overrides:
    Partial<IncidentTimelineEvent> = {},
): IncidentTimelineEvent {
  return {
    sequence_number: 1,

    event_id:
      "EVT-001",

    timestamp:
      "2026-09-23T09:25:00Z",

    event_type:
      "LOGIN_FAILURE",

    employee_user_id:
      "EMP-001",

    source_ip:
      "203.0.113.25",

    destination_ip:
      "10.10.0.15",

    anomaly_score:
      0.982,

    risk_level:
      "CRITICAL",

    correlation_score:
      0.94,

    correlation_reason:
      "Authentication signal contributed to the correlated incident.",

    ...overrides,
  };
}


export function makeIncidentInvestigation(
  overrides:
    Partial<IncidentInvestigation> = {},
): IncidentInvestigation {
  return {
    incident_id:
      "INC-001",

    severity_rationale:
      "The incident combines repeated authentication failures with anomalous post-authentication behavior.",

    key_findings: [
      {
        category:
          "Authentication",

        finding:
          "Repeated authentication failures were observed.",

        value: 7,

        confidence:
          "HIGH",
      },
    ],

    investigation_steps: [
      {
        priority: 1,

        action:
          "Validate the employee's authentication activity",

        reason:
          "Confirm whether the suspicious login sequence was authorized.",
      },
    ],

    analyst_questions: [
      "Was the employee expected to authenticate from this source?",
    ],

    containment_actions: [
      {
        urgency:
          "HIGH",

        action:
          "Review active sessions",

        condition:
          "If the authentication activity is not recognized.",
      },
    ],

    ...overrides,
  };
}
