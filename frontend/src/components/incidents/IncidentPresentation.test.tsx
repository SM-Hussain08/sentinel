import {
  render,
  screen,
} from "@testing-library/react";

import {
  describe,
  expect,
  it,
} from "vitest";

import IncidentIndicators from "./IncidentIndicators";
import IncidentKpiCard from "./IncidentKpiCard";


describe(
  "incident presentation",
  () => {
    it(
      "renders incident KPI content using the default accent",
      () => {
        render(
          <IncidentKpiCard
            label="Open Incidents"
            value={1234}
            helper="Currently active investigations"
          />,
        );


        expect(
          screen.getByText(
            "Open Incidents",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "1,234",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Currently active investigations",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders every KPI accent variant",
      () => {
        const {
          rerender,
        } = render(
          <IncidentKpiCard
            label="Critical"
            value={3}
            helper="Critical incidents"
            accent="red"
          />,
        );


        expect(
          screen.getByText(
            "3",
          ),
        ).toBeInTheDocument();


        rerender(
          <IncidentKpiCard
            label="High"
            value={9}
            helper="High severity incidents"
            accent="orange"
          />,
        );


        expect(
          screen.getByText(
            "9",
          ),
        ).toBeInTheDocument();


        rerender(
          <IncidentKpiCard
            label="Resolved"
            value={14}
            helper="Resolved investigations"
            accent="emerald"
          />,
        );


        expect(
          screen.getByText(
            "14",
          ),
        ).toBeInTheDocument();


        rerender(
          <IncidentKpiCard
            label="Events"
            value={118}
            helper="Correlated events"
            accent="cyan"
          />,
        );


        expect(
          screen.getByText(
            "118",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders an empty indicator collection safely",
      () => {
        render(
          <IncidentIndicators
            indicators={[]}
          />,
        );


        expect(
          screen.getByText(
            "Key Indicators",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "0 correlated signals",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "formats boolean and ordinary indicator values",
      () => {
        render(
          <IncidentIndicators
            indicators={[
              {
                type:
                  "BOOL_TRUE",

                label:
                  "Outside work hours",

                value:
                  true,

                severity:
                  "CRITICAL",
              },

              {
                type:
                  "BOOL_FALSE",

                label:
                  "Trusted source",

                value:
                  false,

                severity:
                  "MEDIUM",
              },

              {
                type:
                  "COUNT",

                label:
                  "Failed logins",

                value:
                  7,

                severity:
                  "HIGH",
              },

              {
                type:
                  "TEXT",

                label:
                  "Authentication state",

                value:
                  "Suspicious",

                severity:
                  "HIGH",
              },
            ]}
          />,
        );


        expect(
          screen.getByText(
            "4 correlated signals",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Yes",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "No",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "7",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Suspicious",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "CRITICAL",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "MEDIUM",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getAllByText(
            "HIGH",
          ),
        ).toHaveLength(
          2,
        );
      },
    );


    it(
      "formats megabyte and gigabyte indicator values",
      () => {
        render(
          <IncidentIndicators
            indicators={[
              {
                type:
                  "TRANSFER_MB",

                label:
                  "Outbound transfer",

                value:
                  2_500_000,

                severity:
                  "HIGH",
              },

              {
                type:
                  "TRANSFER_GB",

                label:
                  "Large transfer",

                value:
                  2_500_000_000,

                severity:
                  "CRITICAL",
              },
            ]}
          />,
        );


        expect(
          screen.getByText(
            "2.50 MB",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "2.50 GB",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders null and undefined indicator values as an em dash",
      () => {
        render(
          <IncidentIndicators
            indicators={[
              {
                type:
                  "NULL_VALUE",

                label:
                  "Missing signal",

                value:
                  null,

                severity:
                  "MEDIUM",
              },

              {
                type:
                  "UNDEFINED_VALUE",

                label:
                  "Unavailable signal",

                value:
                  undefined,

                severity:
                  "HIGH",
              },
            ]}
          />,
        );


        expect(
          screen.getAllByText(
            "—",
          ),
        ).toHaveLength(
          2,
        );
      },
    );
  },
);