import {
  describe,
  expect,
  it,
} from "vitest";

import {
  SEVERITY_STYLES,
} from "./incidentStyles";


describe(
  "incident severity styles",
  () => {
    it(
      "defines styles for every supported incident severity",
      () => {
        expect(
          Object.keys(
            SEVERITY_STYLES,
          ).sort(),
        ).toEqual(
          [
            "CRITICAL",
            "HIGH",
            "MEDIUM",
          ].sort(),
        );
      },
    );


    it(
      "provides all required style tokens for every severity",
      () => {
        for (
          const style
          of Object.values(
            SEVERITY_STYLES,
          )
        ) {
          expect(
            style.badge,
          ).toBeTruthy();

          expect(
            style.border,
          ).toBeTruthy();

          expect(
            style.selected,
          ).toBeTruthy();

          expect(
            style.dot,
          ).toBeTruthy();

          expect(
            style.text,
          ).toBeTruthy();
        }
      },
    );
  },
);
