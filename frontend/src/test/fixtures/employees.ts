import type {
  Employee,
  EmployeeActivityPage,
  EmployeeDetail,
  EmployeeDirectoryItem,
  EmployeeDirectoryPage,
  EmployeeSecuritySummary,
  EmployeeWorkforceSummary,
} from "../../types/api";


export function makeEmployee(
  overrides:
    Partial<Employee> = {},
): Employee {
  return {
    id: "employee-db-001",
    user_id: "EMP-001",
    name: "Aisha Khan",
    department: "Finance",
    job_role: "Financial Analyst",

    normal_start_hour: 9,
    normal_end_hour: 17,

    typical_ip:
      "10.10.1.25",

    typical_location:
      "Karachi HQ",

    typical_login_frequency: 8,
    typical_files_accessed: 14,
    typical_data_transfer_bytes:
      2_500_000,

    behavior_profile: {},

    is_active: true,

    created_at:
      "2026-09-01T08:00:00Z",

    ...overrides,
  };
}


export function makeEmployeeSecuritySummary(
  overrides:
    Partial<EmployeeSecuritySummary> = {},
): EmployeeSecuritySummary {
  return {
    total_events: 120,
    scored_event_count: 116,

    anomaly_count: 8,
    elevated_anomaly_count: 4,
    critical_anomaly_count: 1,

    incident_count: 2,
    open_incident_count: 1,

    highest_risk_level:
      "CRITICAL",

    highest_anomaly_score:
      0.982,

    last_activity_at:
      "2026-09-23T09:30:00Z",

    ...overrides,
  };
}


export function makeEmployeeDirectoryItem(
  overrides:
    Partial<EmployeeDirectoryItem> = {},
): EmployeeDirectoryItem {
  return {
    id: "employee-db-001",

    user_id: "EMP-001",
    name: "Aisha Khan",

    department: "Finance",
    job_role: "Financial Analyst",

    typical_location:
      "Karachi HQ",

    is_active: true,

    security:
      makeEmployeeSecuritySummary(),

    ...overrides,
  };
}


export function makeEmployeeDirectoryPage(
  overrides:
    Partial<EmployeeDirectoryPage> = {},
): EmployeeDirectoryPage {
  const item =
    makeEmployeeDirectoryItem();

  return {
    items: [
      item,
    ],

    total: 1,

    limit: 30,
    offset: 0,

    departments: [
      "Finance",
      "Engineering",
      "Operations",
    ],

    ...overrides,
  };
}


export function makeEmployeeWorkforceSummary(
  overrides:
    Partial<EmployeeWorkforceSummary> = {},
): EmployeeWorkforceSummary {
  return {
    total_employees: 300,

    active_employees: 294,

    critical_risk_employees: 2,
    high_risk_employees: 5,
    medium_risk_employees: 11,

    employees_with_open_incidents:
      7,

    elevated_anomaly_count:
      24,

    scored_employees: 287,

    ...overrides,
  };
}


export function makeEmployeeDetail(
  overrides:
    Partial<EmployeeDetail> = {},
): EmployeeDetail {
  return {
    id: "employee-db-001",

    user_id: "EMP-001",
    name: "Aisha Khan",

    department: "Finance",
    job_role: "Financial Analyst",

    is_active: true,

    created_at:
      "2026-09-01T08:00:00Z",

    baseline: {
      normal_start_hour: 9,
      normal_end_hour: 17,

      typical_ip:
        "10.10.1.25",

      typical_location:
        "Karachi HQ",

      typical_login_frequency:
        8,

      typical_files_accessed:
        14,

      typical_data_transfer_bytes:
        2_500_000,
    },

    security:
      makeEmployeeSecuritySummary(),

    recent_anomalies: [
      {
        event_id:
          "EVT-ANOM-001",

        timestamp:
          "2026-09-23T09:30:00Z",

        event_type:
          "LOGIN_FAILURE",

        anomaly_score:
          0.982,

        risk_level:
          "CRITICAL",

        resource_type:
          "authentication",

        resource_name:
          "VPN Gateway",

        source_ip:
          "203.0.113.25",

        source_location:
          "Unknown",
      },
    ],

    incidents: [
      {
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

        detector_name:
          "isolation-forest",

        detector_version:
          "1.2",

        correlation_engine:
          "sentinel-correlation",

        correlation_version:
          "1.0",

        first_seen:
          "2026-09-23T09:25:00Z",

        last_seen:
          "2026-09-23T09:31:00Z",

        event_count: 5,
        anomaly_count: 3,

        max_anomaly_score:
          0.982,

        summary:
          "Multiple elevated authentication events were correlated.",
      },
    ],

    ...overrides,
  };
}


export function makeEmployeeActivityPage(
  overrides:
    Partial<EmployeeActivityPage> = {},
): EmployeeActivityPage {
  return {
    user_id: "EMP-001",

    items: [
      {
        event_id:
          "EVT-001",

        timestamp:
          "2026-09-23T09:30:00Z",

        event_type:
          "LOGIN_FAILURE",

        session_id:
          "SESSION-001",

        source_ip:
          "203.0.113.25",

        destination_ip:
          "10.10.0.15",

        source_location:
          "Unknown",

        resource_type:
          "authentication",

        resource_name:
          "VPN Gateway",

        bytes_sent: 128,
        bytes_received: 64,

        success: false,

        anomaly_score:
          0.982,

        risk_level:
          "CRITICAL",

        detector_name:
          "isolation-forest",

        detector_version:
          "1.2",

        linked_incident_ids: [
          "INC-001",
        ],
      },
    ],

    total: 1,

    limit: 30,
    offset: 0,

    ...overrides,
  };
}
