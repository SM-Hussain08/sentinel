export interface Employee {
  id: string;
  user_id: string;
  name: string;
  department: string;
  job_role: string;

  normal_start_hour: number;
  normal_end_hour: number;

  typical_ip: string;
  typical_location: string;

  typical_login_frequency: number;
  typical_files_accessed: number;
  typical_data_transfer_bytes: number;

  behavior_profile: Record<string, unknown>;

  is_active: boolean;
  created_at: string;
}


export interface SecurityEvent {
  id: string;
  event_id: string;

  timestamp: string;

  employee_id: string;

  session_id: string | null;
  event_type: string;

  source_ip: string;
  destination_ip: string | null;

  source_location: string | null;

  resource_type: string | null;
  resource_name: string | null;

  bytes_sent: number;
  bytes_received: number;

  success: boolean;

  event_metadata: Record<string, unknown>;

  created_at: string;
}


export interface AnomalyResult {
  id: string;

  event_id: string;
  employee_user_id: string;

  detector_name: string;
  detector_version: string;
  detector_type: string;

  raw_score: number;
  anomaly_score: number;
  risk_level: "NORMAL" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

  feature_snapshot: Record<string, unknown>;

  explanation: {
    summary?: string;
    reasons?: string[];
    [key: string]: unknown;
  };

  created_at: string;
}

export type MLRiskLevel =
  | "NORMAL"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";


export interface MLModelInfo {
  model_name: string;
  model_version: string;
  algorithm: string;

  feature_count: number;

  training_rows: number;
  evaluation_rows: number;

  threshold_percentile: number;

  precision: number;
  recall: number;
  f1_score: number;
  false_positive_rate: number;
}


export interface MLRiskDistribution {
  normal: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
}


export interface MLSummary {
  detector_name: string;
  detector_version: string;

  events_scored: number;
  alert_count: number;

  average_score: number;
  highest_score: number;

  risk_distribution: MLRiskDistribution;
}


export interface MLExplanation {
  summary?: string;

  model_name?: string;
  model_version?: string;

  alert_threshold?: number;

  score_interpretation?: string;

  alert_threshold_reached?: boolean;

  [key: string]: unknown;
}


export interface MLAnomaly {
  score_id: string;

  event_id: string;
  employee_user_id: string;

  timestamp: string;
  event_type: string;

  anomaly_score: number;
  raw_score: number;

  risk_level: MLRiskLevel;

  alert_threshold_reached: boolean;

  feature_snapshot: Record<
    string,
    unknown
  >;

  explanation: MLExplanation;
}


export interface MLEventAnalysis {
  event_id: string;
  employee_user_id: string;

  timestamp: string;
  event_type: string;

  detector_name: string;
  detector_version: string;

  raw_score: number;
  anomaly_score: number;

  risk_level: MLRiskLevel;

  alert_threshold_reached: boolean;

  feature_snapshot: Record<
    string,
    unknown
  >;

  explanation: MLExplanation;
}


export type IncidentSeverity =
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";


export type IncidentStatus =
  | "OPEN"
  | "INVESTIGATING"
  | "RESOLVED"
  | "CLOSED";


export interface IncidentSeverityDistribution {
  medium: number;
  high: number;
  critical: number;
}


export interface IncidentSummary {
  total_incidents: number;
  open_incidents: number;

  critical_incidents: number;
  high_incidents: number;
  medium_incidents: number;

  total_correlated_events: number;

  severity_distribution:
    IncidentSeverityDistribution;
}


export interface IncidentListItem {
  incident_id: string;

  title: string;
  incident_type: string;

  severity: IncidentSeverity;
  status: IncidentStatus;

  primary_employee_user_id:
    | string
    | null;

  first_seen: string;
  last_seen: string;

  event_count: number;
  anomaly_count: number;

  max_anomaly_score: number;

  summary: string;
}


export interface IncidentIndicator {
  type: string;
  label: string;

  value: unknown;

  severity:
    | "MEDIUM"
    | "HIGH"
    | "CRITICAL";
}


export interface InvestigationStep {
  priority: number;

  action: string;
  reason: string;
}


export interface InvestigationFinding {
  category: string;

  finding: string;

  value: unknown;

  confidence:
    | "MEDIUM"
    | "HIGH"
    | "CRITICAL";
}


export interface ContainmentAction {
  urgency: string;

  action: string;
  condition: string;
}


export interface IncidentInvestigationData {
  engine?: string;
  version?: string;

  severity_rationale?: string;

  key_findings?:
    InvestigationFinding[];

  analyst_questions?:
    string[];

  containment_actions?:
    ContainmentAction[];
}


export interface IncidentEvidence {
  signals?: Record<
    string,
    unknown
  >;

  detector_name?: string;
  detector_version?: string;

  correlation_engine?: string;
  correlation_version?: string;

  investigation?:
    IncidentInvestigationData;

  [key: string]: unknown;
}


export interface IncidentDetail {
  incident_id: string;

  title: string;
  incident_type: string;

  severity: IncidentSeverity;
  status: IncidentStatus;

  primary_employee_user_id:
    | string
    | null;

  first_seen: string;
  last_seen: string;

  event_count: number;
  anomaly_count: number;

  max_anomaly_score: number;

  summary: string;

  correlation_reason: string;

  indicators:
    IncidentIndicator[];

  evidence:
    IncidentEvidence;

  investigation_steps:
    InvestigationStep[];
}


export interface IncidentTimelineEvent {
  sequence_number: number;

  event_id: string;

  timestamp: string;
  event_type: string;

  employee_user_id: string;

  source_ip:
    | string
    | null;

  destination_ip:
    | string
    | null;

  anomaly_score: number;

  risk_level: MLRiskLevel;

  correlation_score: number;

  correlation_reason: string;
}


export interface IncidentInvestigation {
  incident_id: string;

  severity_rationale: string;

  key_findings:
    InvestigationFinding[];

  investigation_steps:
    InvestigationStep[];

  analyst_questions:
    string[];

  containment_actions:
    ContainmentAction[];
}

export interface SelectedModelEvaluation {
  name: string;
  detector_name: string;
  version: string;

  feature_count: number;

  training_rows: number;
  evaluation_rows: number;

  precision: number;
  recall: number;
  f1_score: number;

  false_positive_rate: number;
  false_positives: number;

  threshold_percentile: number;
}


export interface ModelExperimentEvaluation {
  name: string;
  version: string;

  feature_count: number;

  precision: number;
  recall: number;
  f1_score: number;

  false_positive_rate: number;
  false_positives: number;

  selected: boolean;
  decision: string;
}


export interface IncidentEvaluation {
  true_positive_incidents: number;
  false_positive_incidents: number;

  attack_instances_detected: number;
  attack_instances_total: number;

  precision: number;
  recall: number;
  f1_score: number;

  timeline_events_recovered: number;
  timeline_events_total: number;

  timeline_recovery_rate: number;
}


export interface EvaluationProvenance {
  ml_evaluation_period: string;
  ml_training_period: string;

  incident_ground_truth_batch: string;
  ground_truth_policy: string;
}


export interface EvaluationSummary {
  registry_version: string;

  generated_at: string;

  selected_model:
    SelectedModelEvaluation;

  experiments:
    ModelExperimentEvaluation[];

  incident_evaluation:
    IncidentEvaluation;

  provenance:
    EvaluationProvenance;
}


export interface MLAnomalyFeedPage {
  items: MLAnomaly[];

  total: number;

  limit: number;
  offset: number;

  has_previous: boolean;
  has_next: boolean;
}