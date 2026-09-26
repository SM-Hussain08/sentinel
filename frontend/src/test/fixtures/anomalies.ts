import type {
  AnomalyResult,
  MLAnomaly,
  MLAnomalyFeedPage,
  MLEventAnalysis,
  MLModelInfo,
  MLSummary,
} from "../../types/api";


export function makeMLModelInfo(
  overrides:
    Partial<MLModelInfo> = {},
): MLModelInfo {
  return {
    model_name:
      "isolation-forest",

    model_version:
      "1.2",

    algorithm:
      "Isolation Forest",

    feature_count: 17,

    training_rows: 10_000,
    evaluation_rows: 2_000,

    threshold_percentile:
      0.95,

    precision: 0.91,
    recall: 0.88,
    f1_score: 0.895,

    false_positive_rate:
      0.03,

    ...overrides,
  };
}


export function makeMLSummary(
  overrides:
    Partial<MLSummary> = {},
): MLSummary {
  return {
    detector_name:
      "isolation-forest",

    detector_version:
      "1.2",

    events_scored:
      12_612,

    alert_count:
      42,

    average_score:
      0.41,

    highest_score:
      0.982,

    risk_distribution: {
      normal: 10_500,
      low: 1_400,
      medium: 500,
      high: 170,
      critical: 42,
    },

    ...overrides,
  };
}


export function makeMLAnomaly(
  overrides:
    Partial<MLAnomaly> = {},
): MLAnomaly {
  return {
    score_id:
      "SCORE-001",

    event_id:
      "EVT-ANOM-001",

    employee_user_id:
      "EMP-001",

    timestamp:
      "2026-09-23T09:30:00Z",

    event_type:
      "LOGIN_FAILURE",

    anomaly_score:
      0.982,

    raw_score:
      -0.184,

    risk_level:
      "CRITICAL",

    alert_threshold_reached:
      true,

    feature_snapshot: {
      failed_logins_10m: 7,
      outside_work_hours: 1,
    },

    explanation: {
      summary:
        "Activity is highly unusual relative to historical behavior.",

      model_name:
        "isolation-forest",

      model_version:
        "1.2",

      alert_threshold:
        0.95,

      score_interpretation:
        "Historical percentile-based anomaly score.",

      alert_threshold_reached:
        true,
    },

    ...overrides,
  };
}


export function makeMLEventAnalysis(
  overrides:
    Partial<MLEventAnalysis> = {},
): MLEventAnalysis {
  const anomaly =
    makeMLAnomaly();

  return {
    event_id:
      anomaly.event_id,

    employee_user_id:
      anomaly.employee_user_id,

    timestamp:
      anomaly.timestamp,

    event_type:
      anomaly.event_type,

    detector_name:
      "isolation-forest",

    detector_version:
      "1.2",

    raw_score:
      anomaly.raw_score,

    anomaly_score:
      anomaly.anomaly_score,

    risk_level:
      anomaly.risk_level,

    alert_threshold_reached:
      true,

    feature_snapshot:
      anomaly.feature_snapshot,

    explanation:
      anomaly.explanation,

    ...overrides,
  };
}


export function makeMLAnomalyFeedPage(
  overrides:
    Partial<MLAnomalyFeedPage> = {},
): MLAnomalyFeedPage {
  return {
    items: [
      makeMLAnomaly(),
    ],

    total: 1,

    limit: 50,
    offset: 0,

    has_previous:
      false,

    has_next:
      false,

    ...overrides,
  };
}


export function makeAnomalyResult(
  overrides:
    Partial<AnomalyResult> = {},
): AnomalyResult {
  return {
    id:
      "anomaly-db-001",

    event_id:
      "EVT-ANOM-001",

    employee_user_id:
      "EMP-001",

    detector_name:
      "isolation-forest",

    detector_version:
      "1.2",

    detector_type:
      "unsupervised",

    raw_score:
      -0.184,

    anomaly_score:
      0.982,

    risk_level:
      "CRITICAL",

    feature_snapshot: {
      failed_logins_10m:
        7,
    },

    explanation: {
      summary:
        "Highly unusual authentication behavior.",

      reasons: [
        "Repeated authentication failures",
        "Activity differs from the employee baseline",
      ],
    },

    created_at:
      "2026-09-23T09:30:05Z",

    ...overrides,
  };
}
