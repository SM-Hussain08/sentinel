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


export type EmployeeRiskLevel =
  | "NORMAL"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";


export interface EmployeeSecuritySummary {
  total_events: number;

  scored_event_count: number;

  anomaly_count: number;

  elevated_anomaly_count: number;

  critical_anomaly_count: number;

  incident_count: number;

  open_incident_count: number;

  highest_risk_level:
    EmployeeRiskLevel;

  highest_anomaly_score:
    | number
    | null;

  last_activity_at:
    | string
    | null;
}


export interface EmployeeDirectoryItem {
  id: string;

  user_id: string;
  name: string;

  department: string;
  job_role: string;

  typical_location: string;

  is_active: boolean;

  security:
    EmployeeSecuritySummary;
}


export interface EmployeeDirectoryPage {
  items:
    EmployeeDirectoryItem[];

  total: number;

  limit: number;
  offset: number;

  departments: string[];
}


export interface EmployeeWorkforceSummary {
  total_employees: number;

  active_employees: number;

  critical_risk_employees:
    number;

  high_risk_employees:
    number;

  medium_risk_employees:
    number;

  employees_with_open_incidents:
    number;

  elevated_anomaly_count:
    number;

  scored_employees: number;
}


export interface EmployeeBehaviorBaseline {
  normal_start_hour: number;
  normal_end_hour: number;

  typical_ip: string;
  typical_location: string;

  typical_login_frequency:
    number;

  typical_files_accessed:
    number;

  typical_data_transfer_bytes:
    number;
}


export interface EmployeeAnomalyItem {
  event_id: string;

  timestamp: string;
  event_type: string;

  anomaly_score: number;

  risk_level:
    EmployeeRiskLevel;

  resource_type:
    | string
    | null;

  resource_name:
    | string
    | null;

  source_ip: string;

  source_location:
    | string
    | null;
}


export interface EmployeeIncidentItem {
  incident_id: string;

  title: string;
  incident_type: string;

  severity:
    IncidentSeverity;

  status:
    IncidentStatus;

  detector_name: string;
  detector_version: string;

  correlation_engine: string;
  correlation_version: string;

  first_seen: string;
  last_seen: string;

  event_count: number;
  anomaly_count: number;

  max_anomaly_score: number;

  summary: string;
}


export interface EmployeeDetail {
  id: string;

  user_id: string;
  name: string;

  department: string;
  job_role: string;

  is_active: boolean;

  created_at: string;

  baseline:
    EmployeeBehaviorBaseline;

  security:
    EmployeeSecuritySummary;

  recent_anomalies:
    EmployeeAnomalyItem[];

  incidents:
    EmployeeIncidentItem[];
}


export interface EmployeeActivityItem {
  event_id: string;

  timestamp: string;
  event_type: string;

  session_id:
    | string
    | null;

  source_ip: string;

  destination_ip:
    | string
    | null;

  source_location:
    | string
    | null;

  resource_type:
    | string
    | null;

  resource_name:
    | string
    | null;

  bytes_sent: number;
  bytes_received: number;

  success: boolean;

  anomaly_score:
    | number
    | null;

  risk_level:
    | EmployeeRiskLevel
    | null;

  detector_name:
    | string
    | null;

  detector_version:
    | string
    | null;

  linked_incident_ids:
    string[];
}


export interface EmployeeActivityPage {
  user_id: string;

  items:
    EmployeeActivityItem[];

  total: number;

  limit: number;
  offset: number;
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

  alerts: number;

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
  ml_training_period: string;
  ml_evaluation_period: string;

  incident_ground_truth_batch: string;
  ground_truth_policy: string;
}


export interface EvaluationComponentGeneratedAt {
  selected_model: string;
  model_comparison: string;
  incident_evaluation: string;
}


export interface BenchmarkDataset {
  employees: number;
  normal_events: number;
  attack_events: number;
  total_events: number;
  attack_instances: number;
}


export interface BenchmarkOperationalScoring {
  scored_events: number;

  risk_distribution: Record<
    string,
    number
  >;
}


export interface BenchmarkIncidentCorrelation {
  total: number;

  severity_distribution: Record<
    string,
    number
  >;
}


export interface BenchmarkCanonicalSignature {
  employees: number;
  events: number;

  selected_experiment: string;
  selected_detector: string;

  model_f1: number;

  critical_scores: number;
  incidents: number;

  attack_instances_recovered: number;
  timeline_events_recovered: number;

  incident_precision: number;
  incident_recall: number;
}


export interface ControlledBenchmarkSummary {
  name: string;
  status: string;

  seed: number;
  reproducible: boolean;

  database_isolation: string;

  generated_at: string;
  elapsed_seconds: number;

  dataset: BenchmarkDataset;

  operational_scoring:
    BenchmarkOperationalScoring;

  incident_correlation:
    BenchmarkIncidentCorrelation;

  canonical_signature:
    BenchmarkCanonicalSignature;
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

  component_generated_at:
    EvaluationComponentGeneratedAt;

  benchmark:
    ControlledBenchmarkSummary;
}

export interface MLAnomalyFeedPage {
  items: MLAnomaly[];

  total: number;

  limit: number;
  offset: number;

  has_previous: boolean;
  has_next: boolean;
}


// ============================================================
// Operational runtime intelligence
// ============================================================

export type RuntimeHealthState =
  | "HEALTHY"
  | "STALE"
  | "STOPPED"
  | "ERROR"
  | "UNKNOWN";


export interface RuntimeErrorInfo {
  message: string;

  occurred_at:
    | string
    | null;
}


export interface ProcessorDetectorInfo {
  name: string;
  version: string;
}


export interface ProcessorRuntimeCounters {
  events_processed: number;
  scores_created: number;

  incidents_created: number;
  incidents_updated: number;

  live_backlog: number;
}


export interface ProcessorRuntimeStatus {
  service: string;

  operational: boolean;

  health: RuntimeHealthState;

  status:
    | string
    | null;

  processor_name:
    | string
    | null;

  worker_id:
    | string
    | null;

  worker_version:
    | string
    | null;

  activated_at:
    | string
    | null;

  last_heartbeat_at:
    | string
    | null;

  heartbeat_age_seconds:
    | number
    | null;

  stopped_at:
    | string
    | null;

  detector:
    | ProcessorDetectorInfo
    | null;

  counters:
    ProcessorRuntimeCounters;

  last_error:
    | RuntimeErrorInfo
    | null;
}


export interface SimulationRuntimeClock {
  real_runtime_seconds:
    | number
    | null;

  simulated_runtime_seconds:
    | number
    | null;

  simulated_hours_elapsed:
    | number
    | null;

  simulation_minutes_per_real_second:
    | number
    | null;

  speed_multiplier:
    | number
    | null;

  simulated_now:
    | string
    | null;

  simulated_start_time:
    | string
    | null;
}


export interface SimulationRuntimeConfiguration {
  preset:
    | string
    | null;

  heartbeat_seconds:
    | number
    | null;

  attack_campaign_rate_per_simulated_hour:
    | number
    | null;

  simulation_minutes_per_real_second:
    | number
    | null;

  max_events_per_tick:
    | number
    | null;

  max_events_per_employee_per_tick:
    | number
    | null;

  scenario_cooldown_minutes:
    | number
    | null;

  max_concurrent_attacks:
    | number
    | null;
}


export interface SimulationObservedMetrics {
  employees_loaded:
    | number
    | null;

  active_employees:
    | number
    | null;

  events_generated:
    | number
    | null;

  event_throughput_per_real_minute:
    | number
    | null;

  incidents_observed:
    | number
    | null;

  incident_rate_per_real_hour:
    | number
    | null;

  incident_rate_per_simulated_hour:
    | number
    | null;
}


export interface SimulationRuntimeStatus {
  service: string;

  running: boolean;

  health: RuntimeHealthState;

  status:
    | string
    | null;

  has_run_history: boolean;

  run_id:
    | string
    | null;

  mode:
    | string
    | null;

  worker_id:
    | string
    | null;

  worker_version:
    | string
    | null;

  seed:
    | number
    | null;

  started_at:
    | string
    | null;

  stopped_at:
    | string
    | null;

  last_heartbeat_at:
    | string
    | null;

  heartbeat_age_seconds:
    | number
    | null;

  clock:
    | SimulationRuntimeClock
    | null;

  configuration:
    | SimulationRuntimeConfiguration
    | null;

  metrics:
    | SimulationObservedMetrics
    | null;

  last_error:
    | RuntimeErrorInfo
    | null;
}


export interface OperationsStatus {
  generated_at: string;

  sentinel:
    ProcessorRuntimeStatus;

  simulation:
    SimulationRuntimeStatus;
}