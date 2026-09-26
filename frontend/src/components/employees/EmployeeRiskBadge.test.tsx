import {
  render,
  screen,
} from "@testing-library/react";

import {
  describe,
  expect,
  it,
} from "vitest";

import EmployeeRiskBadge from "./EmployeeRiskBadge";


describe(
  "EmployeeRiskBadge",
  () => {
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
      "renders %s as %s",
      (
        risk,
        label,
      ) => {
        render(
          <EmployeeRiskBadge
            risk={risk}
          />,
        );

        expect(
          screen.getByText(
            label,
          ),
        ).toBeInTheDocument();
      },
    );
  },
);
