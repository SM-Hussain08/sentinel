import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  makeIncidentDetail,
} from "../../test/fixtures/incidents";

import IncidentHero from "./IncidentHero";


function renderHero(
  incident =
    makeIncidentDetail(),
) {
  render(
    <MemoryRouter
      initialEntries={[
        "/incidents/INC-001",
      ]}
    >
      <Routes>
        <Route
          path="/incidents/:incidentId"
          element={
            <IncidentHero
              incident={
                incident
              }
            />
          }
        />

        <Route
          path="/employees/:userId"
          element={
            <div>
              Employee destination
            </div>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}


describe(
  "IncidentHero",
  () => {
    it(
      "renders the core incident investigation context",
      () => {
        renderHero();


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
            "Repeated authentication failures were followed by anomalous account activity.",
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
            "EMP-001",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "5",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "98.2%",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /Multiple temporally related security signals exceeded deterministic correlation criteria/i,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "shows the operational metadata labels",
      () => {
        renderHero();


        expect(
          screen.getByText(
            "Affected Identity",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Correlated Events",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "First Seen",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Peak Anomaly",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Correlation Rationale",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "opens the affected employee investigation",
      () => {
        renderHero();


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                /Affected Identity.*EMP-001/i,
            },
          ),
        );


        expect(
          screen.getByText(
            "Employee destination",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders a safe unknown-identity fallback when no employee is linked",
      () => {
        renderHero(
          makeIncidentDetail({
            primary_employee_user_id:
              null,
          }),
        );


        expect(
          screen.getByText(
            "Unknown",
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByRole(
            "button",
            {
              name:
                /Affected Identity/i,
            },
          ),
        ).not.toBeInTheDocument();
      },
    );
  },
);