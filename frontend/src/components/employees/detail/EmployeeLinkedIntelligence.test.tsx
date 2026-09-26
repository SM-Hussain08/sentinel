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
  EmployeeAnomalyItem,
  EmployeeIncidentItem,
} from "../../../types/api";

import {
  makeEmployeeDetail,
} from "../../../test/fixtures/employees";

import EmployeeIncidentHistory from "./EmployeeIncidentHistory";
import EmployeeRecentAnomalies from "./EmployeeRecentAnomalies";


function makeIncident(
  overrides:
    Partial<EmployeeIncidentItem> = {},
): EmployeeIncidentItem {
  const base =
    makeEmployeeDetail()
      .incidents[0];

  return {
    ...base,
    ...overrides,
  };
}


function makeAnomaly(
  overrides:
    Partial<EmployeeAnomalyItem> = {},
): EmployeeAnomalyItem {
  const base =
    makeEmployeeDetail()
      .recent_anomalies[0];

  return {
    ...base,
    ...overrides,
  };
}


describe(
  "employee linked intelligence",
  () => {
    it(
      "renders the empty incident history state",
      () => {
        render(
          <EmployeeIncidentHistory
            incidents={[]}
            onOpenIncident={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "Security Incidents",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /No correlated incident history/i,
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
      "renders incident intelligence and opens the selected incident",
      () => {
        const onOpenIncident =
          vi.fn();


        render(
          <EmployeeIncidentHistory
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
            "Suspicious authentication sequence",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Account Takeover",
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


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                /Suspicious authentication sequence/i,
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
      "renders all supported incident severity styles",
      () => {
        render(
          <EmployeeIncidentHistory
            incidents={[
              makeIncident({
                incident_id:
                  "INC-MEDIUM",

                title:
                  "Medium incident",

                severity:
                  "MEDIUM",
              }),

              makeIncident({
                incident_id:
                  "INC-HIGH",

                title:
                  "High incident",

                severity:
                  "HIGH",
              }),

              makeIncident({
                incident_id:
                  "INC-CRITICAL",

                title:
                  "Critical incident",

                severity:
                  "CRITICAL",
              }),
            ]}
            onOpenIncident={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "MEDIUM",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "HIGH",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "CRITICAL",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders the empty anomaly state",
      () => {
        render(
          <EmployeeRecentAnomalies
            anomalies={[]}
            onOpenAnomaly={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "Recent Anomalies",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /No selected-model anomaly signals/i,
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
      "renders recent anomaly intelligence and opens the selected anomaly",
      () => {
        const onOpenAnomaly =
          vi.fn();


        render(
          <EmployeeRecentAnomalies
            anomalies={[
              makeAnomaly(),
            ]}
            onOpenAnomaly={
              onOpenAnomaly
            }
          />,
        );


        expect(
          screen.getByText(
            "EVT-ANOM-001",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Login Failure",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "VPN Gateway",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Critical",
          ),
        ).toBeInTheDocument();


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                /EVT-ANOM-001/i,
            },
          ),
        );


        expect(
          onOpenAnomaly,
        ).toHaveBeenCalledWith(
          "EVT-ANOM-001",
        );
      },
    );


    it(
      "falls back from resource name to type and then to an em dash",
      () => {
        render(
          <EmployeeRecentAnomalies
            anomalies={[
              makeAnomaly({
                event_id:
                  "EVT-RESOURCE-TYPE",

                resource_name:
                  null,

                resource_type:
                  "database",
              }),

              makeAnomaly({
                event_id:
                  "EVT-NO-RESOURCE",

                resource_name:
                  null,

                resource_type:
                  null,
              }),
            ]}
            onOpenAnomaly={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "database",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "—",
          ),
        ).toBeInTheDocument();
      },
    );
  },
);