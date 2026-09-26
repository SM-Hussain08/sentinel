import {
  render,
  screen,
} from "@testing-library/react";

import {
  describe,
  expect,
  it,
} from "vitest";

import InvestigationPanel from "./InvestigationPanel";

import {
  makeIncidentInvestigation,
} from "../../test/fixtures/incidents";


describe(
  "InvestigationPanel",
  () => {
    it(
      "renders deterministic investigation sections",
      () => {
        const investigation =
          makeIncidentInvestigation();

        render(
          <InvestigationPanel
            investigation={
              investigation
            }
            severity="HIGH"
          />,
        );

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                "Key Findings",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                "Severity Rationale",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                "Recommended Investigation",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            investigation
              .severity_rationale,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders key findings from deterministic evidence",
      () => {
        const investigation =
          makeIncidentInvestigation();

        const finding =
          investigation
            .key_findings[0];

        render(
          <InvestigationPanel
            investigation={
              investigation
            }
            severity="CRITICAL"
          />,
        );

        expect(
          screen.getByText(
            `${investigation.key_findings.length} findings`,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            finding.category,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            finding.finding,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            finding.confidence,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders prioritized deterministic investigation steps",
      () => {
        const investigation =
          makeIncidentInvestigation();

        const step =
          investigation
            .investigation_steps[0];

        render(
          <InvestigationPanel
            investigation={
              investigation
            }
            severity="MEDIUM"
          />,
        );

        expect(
          screen.getByText(
            step.action,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            step.reason,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            String(
              step.priority,
            ),
          ),
        ).toBeInTheDocument();
      },
    );


    it.each([
      [
        true,
        "Yes",
      ],
      [
        false,
        "No",
      ],
      [
        null,
        "—",
      ],
      [
        2_500_000,
        "2.50 MB",
      ],
      [
        2_500_000_000,
        "2.50 GB",
      ],
    ] as const)(
      "formats finding value %s as %s",
      (
        value,
        expected,
      ) => {
        const investigation =
          makeIncidentInvestigation({
            key_findings: [
              {
                category:
                  "TEST SIGNAL",

                confidence:
                  "HIGH",

                finding:
                  "Formatter branch test",

                value,
              },
            ],
          });

        render(
          <InvestigationPanel
            investigation={
              investigation
            }
            severity="HIGH"
          />,
        );

        expect(
          screen.getByText(
            expected,
          ),
        ).toBeInTheDocument();
      },
    );
  },
);
