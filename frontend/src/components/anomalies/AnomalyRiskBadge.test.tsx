import {
  render,
  screen,
} from "@testing-library/react";

import {
  describe,
  expect,
  it,
} from "vitest";

import AnomalyRiskBadge from "./AnomalyRiskBadge";


describe(
  "AnomalyRiskBadge",
  () => {
    it.each([
      "NORMAL",
      "LOW",
      "MEDIUM",
      "HIGH",
      "CRITICAL",
    ] as const)(
      "renders the %s risk level",
      (risk) => {
        render(
          <AnomalyRiskBadge
            risk={risk}
          />,
        );

        expect(
          screen.getByText(
            risk,
          ),
        ).toBeInTheDocument();
      },
    );
  },
);
