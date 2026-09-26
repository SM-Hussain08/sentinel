import {
  describe,
  expect,
  it,
} from "vitest";

import {
  formatBytes,
  formatDetailNumber,
  formatDetailTimestamp,
  formatEventType,
  formatIncidentType,
  formatRiskLabel,
  formatShortTimestamp,
} from "./employeeDetailFormatters";


describe(
  "employee detail formatters",
  () => {
    it(
      "formats detail numbers with separators",
      () => {
        expect(
          formatDetailNumber(
            2500000,
          ),
        ).toBe(
          "2,500,000",
        );
      },
    );


    it.each([
      [
        0,
        "0 B",
      ],
      [
        999,
        "999 B",
      ],
      [
        1000,
        "1.0 KB",
      ],
      [
        999999,
        "1000.0 KB",
      ],
      [
        1000000,
        "1.0 MB",
      ],
      [
        999999999,
        "1000.0 MB",
      ],
      [
        1000000000,
        "1.00 GB",
      ],
      [
        2500000000,
        "2.50 GB",
      ],
    ])(
      "formats %d bytes as %s",
      (
        bytes,
        expected,
      ) => {
        expect(
          formatBytes(
            bytes,
          ),
        ).toBe(
          expected,
        );
      },
    );


    it(
      "formats event type constants as readable text",
      () => {
        expect(
          formatEventType(
            "LOGIN_FAILURE",
          ),
        ).toBe(
          "Login Failure",
        );

        expect(
          formatEventType(
            "FILE_ACCESS",
          ),
        ).toBe(
          "File Access",
        );
      },
    );


    it(
      "formats incident types using the same readable convention",
      () => {
        expect(
          formatIncidentType(
            "ACCOUNT_TAKEOVER",
          ),
        ).toBe(
          "Account Takeover",
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
      "formats %s risk labels as %s",
      (
        risk,
        expected,
      ) => {
        expect(
          formatRiskLabel(
            risk,
          ),
        ).toBe(
          expected,
        );
      },
    );


    it(
      "returns No activity for absent detail timestamps",
      () => {
        expect(
          formatDetailTimestamp(
            null,
          ),
        ).toBe(
          "No activity",
        );

        expect(
          formatShortTimestamp(
            null,
          ),
        ).toBe(
          "No activity",
        );
      },
    );


    it(
      "returns Unknown for invalid detail timestamps",
      () => {
        expect(
          formatDetailTimestamp(
            "invalid",
          ),
        ).toBe(
          "Unknown",
        );

        expect(
          formatShortTimestamp(
            "invalid",
          ),
        ).toBe(
          "Unknown",
        );
      },
    );
  },
);
