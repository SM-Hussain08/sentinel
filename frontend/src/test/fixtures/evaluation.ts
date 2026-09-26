import type {
  EvaluationSummary,
} from "../../types/api";


export function makeEvaluationSummary(
  overrides:
    Partial<EvaluationSummary> = {},
): EvaluationSummary {
  return {
    registry_version:
      "1.0",

    generated_at:
      "2026-09-23T09:30:00Z",

    selected_model: {
      name:
        "Isolation Forest v1.2",

      detector_name:
        "isolation-forest",

      version:
        "1.2",

      feature_count:
        17,

      training_rows:
        10_000,

      evaluation_rows:
        2_000,

      precision:
        0.91,

      recall:
        0.88,

      f1_score:
        0.895,

      false_positive_rate:
        0.03,

      false_positives:
        12,

      threshold_percentile:
        0.95,
    },

    experiments: [
      {
        name:
          "Isolation Forest V1",

        version:
          "1.2",

        feature_count:
          17,

        precision:
          0.91,

        recall:
          0.88,

        f1_score:
          0.895,

        false_positive_rate:
          0.03,

        false_positives:
          12,

        alerts:
          42,

        selected:
          true,

        decision:
          "Selected for production.",
      },

      {
        name:
          "Isolation Forest V2",

        version:
          "2.0",

        feature_count:
          27,

        precision:
          0.89,

        recall:
          0.9,

        f1_score:
          0.894,

        false_positive_rate:
          0.04,

        false_positives:
          16,

        alerts:
          46,

        selected:
          false,

        decision:
          "Not selected.",
      },
    ],

    incident_evaluation: {
      true_positive_incidents:
        5,

      false_positive_incidents:
        0,

      attack_instances_detected:
        5,

      attack_instances_total:
        5,

      precision:
        1,

      recall:
        1,

      f1_score:
        1,

      timeline_events_recovered:
        20,

      timeline_events_total:
        20,

      timeline_recovery_rate:
        1,
    },

    provenance: {
      ml_training_period:
        "Historical known-normal period",

      ml_evaluation_period:
        "Future controlled evaluation period",

      incident_ground_truth_batch:
        "benchmark-v1",

      ground_truth_policy:
        "Evaluation-only hidden ground truth",
    },

    component_generated_at: {
      selected_model:
        "2026-09-23T09:30:00Z",

      model_comparison:
        "2026-09-23T09:30:00Z",

      incident_evaluation:
        "2026-09-23T09:30:00Z",
    },

    benchmark: {
      name:
        "SENTINEL controlled benchmark",

      status:
        "PASS",

      seed:
        42,

      reproducible:
        true,

      database_isolation:
        "Isolated benchmark PostgreSQL",

      generated_at:
        "2026-09-23T09:30:00Z",

      elapsed_seconds:
        12.5,

      dataset: {
        employees:
          100,

        normal_events:
          5_814,

        attack_events:
          89,

        total_events:
          5_903,

        attack_instances:
          5,
      },

      operational_scoring: {
        scored_events:
          5_903,

        risk_distribution: {
          NORMAL:
            5_000,

          LOW:
            500,

          MEDIUM:
            250,

          HIGH:
            120,

          CRITICAL:
            33,
        },
      },

      incident_correlation: {
        total:
          5,

        severity_distribution: {
          CRITICAL:
            2,

          HIGH:
            2,

          MEDIUM:
            1,
        },
      },

      canonical_signature: {
        employees:
          100,

        events:
          5_903,

        selected_experiment:
          "Isolation Forest V1",

        selected_detector:
          "isolation-forest",

        model_f1:
          0.895,

        critical_scores:
          33,

        incidents:
          5,

        attack_instances_recovered:
          5,

        timeline_events_recovered:
          20,

        incident_precision:
          1,

        incident_recall:
          1,
      },
    },

    ...overrides,
  };
}
