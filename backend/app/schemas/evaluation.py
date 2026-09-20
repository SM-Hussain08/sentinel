from datetime import datetime

from pydantic import BaseModel


# ============================================================
# Selected production model
# ============================================================

class SelectedModelEvaluation(BaseModel):
    name: str
    detector_name: str
    version: str

    feature_count: int

    training_rows: int
    evaluation_rows: int

    precision: float
    recall: float
    f1_score: float

    false_positive_rate: float
    false_positives: int

    threshold_percentile: float


# ============================================================
# Experiment comparison
# ============================================================

class ModelExperimentEvaluation(BaseModel):
    name: str
    version: str

    feature_count: int

    precision: float
    recall: float
    f1_score: float

    false_positive_rate: float
    false_positives: int

    alerts: int

    selected: bool
    decision: str


# ============================================================
# Incident evaluation
# ============================================================

class IncidentEvaluation(BaseModel):
    true_positive_incidents: int
    false_positive_incidents: int

    attack_instances_detected: int
    attack_instances_total: int

    precision: float
    recall: float
    f1_score: float

    timeline_events_recovered: int
    timeline_events_total: int

    timeline_recovery_rate: float


# ============================================================
# Evaluation provenance
# ============================================================

class EvaluationProvenance(BaseModel):
    ml_training_period: str
    ml_evaluation_period: str

    incident_ground_truth_batch: str
    ground_truth_policy: str


class EvaluationComponentGeneratedAt(BaseModel):
    selected_model: datetime
    model_comparison: datetime
    incident_evaluation: datetime


# ============================================================
# Controlled benchmark
# ============================================================

class BenchmarkDataset(BaseModel):
    employees: int
    normal_events: int
    attack_events: int
    total_events: int
    attack_instances: int


class BenchmarkOperationalScoring(BaseModel):
    scored_events: int

    risk_distribution: dict[
        str,
        int,
    ]


class BenchmarkIncidentCorrelation(BaseModel):
    total: int

    severity_distribution: dict[
        str,
        int,
    ]


class BenchmarkCanonicalSignature(BaseModel):
    employees: int
    events: int

    selected_experiment: str
    selected_detector: str

    model_f1: float

    critical_scores: int
    incidents: int

    attack_instances_recovered: int
    timeline_events_recovered: int

    incident_precision: float
    incident_recall: float


class ControlledBenchmarkSummary(BaseModel):
    name: str
    status: str

    seed: int
    reproducible: bool

    database_isolation: str

    generated_at: datetime
    elapsed_seconds: float

    dataset: BenchmarkDataset

    operational_scoring: BenchmarkOperationalScoring

    incident_correlation: BenchmarkIncidentCorrelation

    canonical_signature: BenchmarkCanonicalSignature


# ============================================================
# Complete evaluation response
# ============================================================

class EvaluationSummary(BaseModel):
    registry_version: str

    generated_at: datetime

    selected_model: SelectedModelEvaluation

    experiments: list[ ModelExperimentEvaluation ]

    incident_evaluation: IncidentEvaluation

    provenance: EvaluationProvenance

    component_generated_at: EvaluationComponentGeneratedAt

    benchmark: ControlledBenchmarkSummary