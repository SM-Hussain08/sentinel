import {
  describe,
  expect,
  it,
} from "vitest";

import {
  EMPLOYEE_RISK_RANK,
  formatEmployeeNumber,
  formatEmployeeRisk,
  formatEmployeeTimestamp,
} from "./employeeFormatters";


describe(
  "employee formatters",
  () => {
    it(
      "formats employee numbers with separators",
      () => {
        expect(
          formatEmployeeNumber(
            12612,
          ),
        ).toBe(
          "12,612",
        );
      },
    );


    it(
      "preserves employee risk ordering",
      () => {
        expect(
          EMPLOYEE_RISK_RANK.CRITICAL,
        ).toBeGreaterThan(
          EMPLOYEE_RISK_RANK.HIGH,
        );

        expect(
          EMPLOYEE_RISK_RANK.HIGH,
        ).toBeGreaterThan(
          EMPLOYEE_RISK_RANK.MEDIUM,
        );

        expect(
          EMPLOYEE_RISK_RANK.MEDIUM,
        ).toBeGreaterThan(
          EMPLOYEE_RISK_RANK.LOW,
        );

        expect(
          EMPLOYEE_RISK_RANK.LOW,
        ).toBeGreaterThan(
          EMPLOYEE_RISK_RANK.NORMAL,
        );
      },
    );


    it.each([
      [
        "NORMAL",
        "Normal",
      ],
      [
        "LOW",
        "Low",
      ],
      [
        "MEDIUM",
        "Medium",
      ],
      [
        "HIGH",
        "High",
      ],
      [
        "CRITICAL",
        "Critical",
      ],
    ] as const)(
      "formats %s employee risk as %s",
      (
        input,
        expected,
      ) => {
        expect(
          formatEmployeeRisk(
            input,
          ),
        ).toBe(
          expected,
        );
      },
    );


    it(
      "returns No activity for missing employee timestamps",
      () => {
        expect(
          formatEmployeeTimestamp(
            null,
          ),
        ).toBe(
          "No activity",
        );

        expect(
          formatEmployeeTimestamp(
            "",
          ),
        ).toBe(
          "No activity",
        );
      },
    );


    it(
      "returns Unknown for invalid employee timestamps",
      () => {
        expect(
          formatEmployeeTimestamp(
            "not-a-date",
          ),
        ).toBe(
          "Unknown",
        );
      },
    );
  },
);
