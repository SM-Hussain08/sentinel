import {
  screen,
} from "@testing-library/react";

import {
  useParams,
} from "react-router-dom";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  makeIncidentListItem,
} from "./fixtures/incidents";

import {
  renderWithRouter,
} from "./render";


function RouteProbe() {
  const {
    incidentId,
  } = useParams();

  return (
    <p>
      Incident:
      {" "}
      {incidentId}
    </p>
  );
}


describe(
  "shared frontend test harness",
  () => {
    it(
      "provides route parameters to rendered components",
      () => {
        renderWithRouter(
          <RouteProbe />,
          {
            route:
              "/incidents/INC-123",

            path:
              "/incidents/:incidentId",
          },
        );

        expect(
          screen.getByText(
            "Incident: INC-123",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "allows domain fixtures to be overridden safely",
      () => {
        const incident =
          makeIncidentListItem({
            severity:
              "HIGH",

            status:
              "INVESTIGATING",
          });

        expect(
          incident.severity,
        ).toBe(
          "HIGH",
        );

        expect(
          incident.status,
        ).toBe(
          "INVESTIGATING",
        );

        expect(
          incident.incident_id,
        ).toBe(
          "INC-001",
        );
      },
    );
  },
);
