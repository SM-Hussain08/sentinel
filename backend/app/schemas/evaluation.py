from datetime import datetime

from pydantic import BaseModel


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


class ModelExperimentEvaluation(BaseModel):
    name: str
    version: str

    feature_count: int

    precision: float
    recall: float
    f1_score: float
    false_positive_rate: float

    false_positives: int

    selected: bool
    decision: str


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


class EvaluationProvenance(BaseModel):
    ml_evaluation_period: str
    ml_training_period: str

    incident_ground_truth_batch: str
    ground_truth_policy: str


class EvaluationSummary(BaseModel):
    registry_version: str

    generated_at: datetime

    selected_model:SelectedModelEvaluation

    experiments: list[ModelExperimentEvaluation]

    incident_evaluation: IncidentEvaluation

    provenance: EvaluationProvenance