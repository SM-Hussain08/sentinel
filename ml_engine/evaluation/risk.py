def classify_ml_risk(
    anomaly_score: float,
) -> str:
    """
    Convert SENTINEL's historical anomaly percentile into a risk label.

    The anomaly score is NOT the probability that an event is malicious.

    Example:
        0.99 means the event is more unusual than roughly 99% of the
        historical training baseline.
    """

    if anomaly_score >= 0.99:
        return "CRITICAL"

    if anomaly_score >= 0.98:
        return "HIGH"

    if anomaly_score >= 0.95:
        return "MEDIUM"

    if anomaly_score >= 0.90:
        return "LOW"

    return "NORMAL"