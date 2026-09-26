import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ANOMALY_RISK_STYLES,
} from "./anomalyStyles";


describe(
  "anomaly risk styles",
  () => {
    it(
      "defines styles for every anomaly risk level",
      () => {
        expect(
          Object.keys(
            ANOMALY_RISK_STYLES,
          ).sort(),
        ).toEqual(
          [
            "NORMAL",
            "LOW",
            "MEDIUM",
            "HIGH",
            "CRITICAL",
          ].sort(),
        );
      },
    );


    it(
      "provides all required style tokens for every risk level",
      () => {
        for (
          const style
          of Object.values(
            ANOMALY_RISK_STYLES,
          )
        ) {
          expect(
            style.badge,
          ).toBeTruthy();

          expect(
            style.dot,
          ).toBeTruthy();

          expect(
            style.bar,
          ).toBeTruthy();

          expect(
            style.border,
          ).toBeTruthy();

          expect(
            style.text,
          ).toBeTruthy();

          expect(
            style.hover,
          ).toBeTruthy();
        }
      },
    );
  },
);
