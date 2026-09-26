import {
  render,
  screen,
} from "@testing-library/react";

import {
  describe,
  expect,
  it,
} from "vitest";

import SeverityBadge from "./SeverityBadge";


describe(
  "SeverityBadge",
  () => {
    it.each([
      "MEDIUM",
      "HIGH",
      "CRITICAL",
    ] as const)(
      "renders the %s incident severity",
      (
        severity,
      ) => {
        render(
          <SeverityBadge
            severity={severity}
          />,
        );

        expect(
          screen.getByText(
            severity,
          ),
        ).toBeInTheDocument();
      },
    );
  },
);
