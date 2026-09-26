import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  IncidentListItem,
} from "../../types/api";

import {
  makeMLSummary,
} from "../../test/fixtures/anomalies";

import AnomalyLinkedIncidents from "./AnomalyLinkedIncidents";
import AnomalyRiskDistribution from "./AnomalyRiskDistribution";


function makeIncident(
  overrides:
    Partial<IncidentListItem> = {},
): IncidentListItem {
  return {
    incident_id:
      "INC-001",

    title:
      "Suspicious authentication activity",

    incident_type:
      "ACCOUNT_TAKEOVER",

    severity:
      "CRITICAL",

    status:
      "OPEN",

    primary_employee_user_id:
      "EMP-001",

    first_seen:
      "2026-09-23T09:00:00Z",

    last_seen:
      "2026-09-23T09:30:00Z",

    event_count:
      7,

    anomaly_count:
      4,

    max_anomaly_score:
      0.982,

    summary:
      "Multiple unusual authentication events were correlated.",

    ...overrides,
  };
}


describe(
  "anomaly linked intelligence",
  () => {
    it(
      "renders the empty linked-incident state",
      () => {
        render(
          <AnomalyLinkedIncidents
            incidents={[]}
            onOpenIncident={
              vi.fn()
            }
          />,
        );


        expect(
          screen.getByText(
            "Linked Incidents",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "No linked incident",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /has not been correlated into an incident/i,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "0",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders linked incident intelligence and opens the selected incident",
      () => {
        const onOpenIncident =
          vi.fn();


        render(
          <AnomalyLinkedIncidents
            incidents={[
              makeIncident(),
            ]}
            onOpenIncident={
              onOpenIncident
            }
          />,
        );


        expect(
          screen.getByText(
            "INC-001",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "CRITICAL",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "OPEN",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Suspicious authentication activity",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Multiple unusual authentication events were correlated.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "98.2%",
          ),
        ).toBeInTheDocument();


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                /Suspicious authentication activity/i,
            },
          ),
        );


        expect(
          onOpenIncident,
        ).toHaveBeenCalledWith(
          "INC-001",
        );
      },
    );


    it(
      "renders all populated risk distribution buckets",
      () => {
        render(
          <AnomalyRiskDistribution
            summary={
              makeMLSummary({
                events_scored:
                  100,

                risk_distribution: {
                  critical:
                    10,

                  high:
                    20,

                  medium:
                    30,

                  low:
                    25,

                  normal:
                    15,
                },
              })
            }
          />,
        );


        expect(
          screen.getByText(
            "Risk Distribution",
          ),
        ).toBeInTheDocument();

        for (
          const risk
          of [
            "CRITICAL",
            "HIGH",
            "MEDIUM",
            "LOW",
            "NORMAL",
          ]
        ) {
          expect(
            screen.getByText(
              risk,
            ),
          ).toBeInTheDocument();
        }


        expect(
          screen.getByText(
            "10.0% of scored events",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "20.0% of scored events",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "30.0% of scored events",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "25.0% of scored events",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "15.0% of scored events",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "handles zero scored events without dividing by zero",
      () => {
        render(
          <AnomalyRiskDistribution
            summary={
              makeMLSummary({
                events_scored:
                  0,

                risk_distribution: {
                  critical:
                    0,

                  high:
                    0,

                  medium:
                    0,

                  low:
                    0,

                  normal:
                    0,
                },
              })
            }
          />,
        );


        expect(
          screen.getAllByText(
            "0.0% of scored events",
          ),
        ).toHaveLength(
          5,
        );
      },
    );


    it(
      "uses a minimum visible bar width for a nonzero tiny risk bucket",
      () => {
        const {
          container,
        } = render(
          <AnomalyRiskDistribution
            summary={
              makeMLSummary({
                events_scored:
                  1000,

                risk_distribution: {
                  critical:
                    1,

                  high:
                    0,

                  medium:
                    0,

                  low:
                    0,

                  normal:
                    999,
                },
              })
            }
          />,
        );


        const bars =
          container.querySelectorAll(
            '[style*="width"]',
          );


        expect(
          Array.from(
            bars,
          ).some(
            (bar) =>
              (
                bar as HTMLElement
              ).style.width
              === "1%",
          ),
        ).toBe(
          true,
        );
      },
    );


    it(
      "renders safely when risk summary data is unavailable",
      () => {
        render(
          <AnomalyRiskDistribution
            summary={
              null
            }
          />,
        );


        expect(
          screen.getByText(
            "Risk Distribution",
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "CRITICAL",
          ),
        ).not.toBeInTheDocument();

        expect(
          screen.getByText(
            /not attack probabilities/i,
          ),
        ).toBeInTheDocument();
      },
    );
  },
);