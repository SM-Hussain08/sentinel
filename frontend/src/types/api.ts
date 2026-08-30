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