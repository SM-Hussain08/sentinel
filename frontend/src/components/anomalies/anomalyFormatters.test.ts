import {
  describe,
  expect,
  it,
} from "vitest";

import {
  formatAnomalyEventType,
  formatAnomalyNumber,
  formatAnomalyPercent,
  getAnomalyNumberFeature,
} from "./anomalyFormatters";

import {
  makeMLEventAnalysis,
} from "../../test/fixtures/anomalies";


describe(
  "anomaly formatters",
  () => {
    it(
      "formats large numbers with separators",
      () => {
        expect(
          formatAnomalyNumber(
            12612,
          ),
        ).toBe(
          "12,612",
        );
      },
    );


    it(
      "formats anomaly percentages with the default precision",
      () => {
        expect(
          formatAnomalyPercent(
            0.955,
          ),
        ).toBe(
          "95.5%",
        );
      },
    );


    it(
      "supports custom anomaly percentage precision",
      () => {
        expect(
          formatAnomalyPercent(
            0.7984,
            2,
          ),
        ).toBe(
          "79.84%",
        );
      },
    );


    it(
      "converts event type constants into readable labels",
      () => {
        expect(
          formatAnomalyEventType(
            "LOGIN_FAILURE",
          ),
        ).toBe(
          "Login Failure",
        );

        expect(
          formatAnomalyEventType(
            "DATA_EXFILTRATION_ATTEMPT",
          ),
        ).toBe(
          "Data Exfiltration Attempt",
        );
      },
    );


    it(
      "returns numeric feature values",
      () => {
        const analysis =
          makeMLEventAnalysis({
            feature_snapshot: {
              failed_logins_10m:
                7,
            },
          });

        expect(
          getAnomalyNumberFeature(
            analysis,
            "failed_logins_10m",
          ),
        ).toBe(
          7,
        );
      },
    );


    it(
      "returns null for missing numeric features",
      () => {
        const analysis =
          makeMLEventAnalysis({
            feature_snapshot:
              {},
          });

        expect(
          getAnomalyNumberFeature(
            analysis,
            "missing_feature",
          ),
        ).toBeNull();
      },
    );


    it(
      "returns null when a feature exists but is not numeric",
      () => {
        const analysis =
          makeMLEventAnalysis({
            feature_snapshot: {
              source_location:
                "Karachi",
            },
          });

        expect(
          getAnomalyNumberFeature(
            analysis,
            "source_location",
          ),
        ).toBeNull();
      },
    );
  },
);
