import {
  describe,
  expect,
  it,
} from "vitest";

import {
  OVERVIEW_SEVERITY_STYLES,
  formatOverviewIncidentType,
  formatOverviewNumber,
  formatOverviewPercent,
} from "./overviewStyles";


describe(
  "overview helpers",
  () => {
    it(
      "formats overview numbers with separators",
      () => {
        expect(
          formatOverviewNumber(
            12612,
          ),
        ).toBe(
          "12,612",
        );
      },
    );


    it(
      "formats overview percentages with default precision",
      () => {
        expect(
          formatOverviewPercent(
            0.955,
          ),
        ).toBe(
          "95.5%",
        );
      },
    );


    it(
      "supports custom overview percentage precision",
      () => {
        expect(
          formatOverviewPercent(
            0.7984,
            2,
          ),
        ).toBe(
          "79.84%",
        );
      },
    );


    it(
      "formats incident types as readable labels",
      () => {
        expect(
          formatOverviewIncidentType(
            "ACCOUNT_TAKEOVER",
          ),
        ).toBe(
          "Account Takeover",
        );

        expect(
          formatOverviewIncidentType(
            "DATA_EXFILTRATION",
          ),
        ).toBe(
          "Data Exfiltration",
        );
      },
    );


    it(
      "defines presentation styles for every incident severity",
      () => {
        expect(
          Object.keys(
            OVERVIEW_SEVERITY_STYLES,
          ).sort(),
        ).toEqual(
          [
            "CRITICAL",
            "HIGH",
            "MEDIUM",
          ].sort(),
        );

        for (
          const style
          of Object.values(
            OVERVIEW_SEVERITY_STYLES,
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
        }
      },
    );
  },
);
