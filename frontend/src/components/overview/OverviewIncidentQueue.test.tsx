import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import OverviewIncidentQueue from "./OverviewIncidentQueue";

import {
  makeIncidentListItem,
} from "../../test/fixtures/incidents";


function renderQueue({
  incidents = [],
  onOpenIncident =
    vi.fn(),
  onOpenAllIncidents =
    vi.fn(),
}: {
  incidents?: ReturnType<
    typeof makeIncidentListItem
  >[];

  onOpenIncident?: (
    incidentId: string,
  ) => void;

  onOpenAllIncidents?: () => void;
} = {}) {
  render(
    <MemoryRouter
      initialEntries={[
        "/",
      ]}
    >
      <Routes>
        <Route
          path="/"
          element={
            <OverviewIncidentQueue
              incidents={
                incidents
              }
              onOpenIncident={
                onOpenIncident
              }
              onOpenAllIncidents={
                onOpenAllIncidents
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
  "OverviewIncidentQueue",
  () => {
    it(
      "renders the recent-incidents workspace",
      () => {
        renderQueue();

        expect(
          screen.getByText(
            /Recent Security Incidents/i,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders an empty incident state",
      () => {
        renderQueue();

        expect(
          screen.getByText(
            "No active priority incidents",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "The operational queue is currently clear.",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders operational incident information",
      () => {
        const incident =
          makeIncidentListItem({
            incident_id:
              "INC-OVERVIEW-001",

            title:
              "Suspicious Authentication Activity",

            severity:
              "CRITICAL",
          });

        renderQueue({
          incidents: [
            incident,
          ],
        });

        expect(
          screen.getByText(
            "INC-OVERVIEW-001",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Suspicious Authentication Activity",
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
      "opens the selected incident",
      async () => {
        const user =
          userEvent.setup();

        const incident =
          makeIncidentListItem({
            incident_id:
              "INC-OVERVIEW-002",

            title:
              "Potential Account Compromise",
          });

        const onOpenIncident =
          vi.fn();

        renderQueue({
          incidents: [
            incident,
          ],

          onOpenIncident,
        });

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                new RegExp(
                  incident.title,
                  "i",
                ),
            },
          ),
        );

        expect(
          onOpenIncident,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          onOpenIncident,
        ).toHaveBeenCalledWith(
          "INC-OVERVIEW-002",
        );
      },
    );


    it(
      "opens the complete incident queue",
      async () => {
        const user =
          userEvent.setup();

        const onOpenAllIncidents =
          vi.fn();

        renderQueue({
          incidents: [
            makeIncidentListItem(),
          ],

          onOpenAllIncidents,
        });

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                /Go to Incidents/i,
            },
          ),
        );

        expect(
          onOpenAllIncidents,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );


    it(
      "renders multiple severity levels",
      () => {
        renderQueue({
          incidents: [
            makeIncidentListItem({
              incident_id:
                "INC-HIGH",

              severity:
                "HIGH",
            }),

            makeIncidentListItem({
              incident_id:
                "INC-MEDIUM",

              severity:
                "MEDIUM",
            }),
          ],
        });

        expect(
          screen.getByText(
            "HIGH",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "MEDIUM",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "opens the affected employee without opening the incident",
      async () => {
        const user =
          userEvent.setup();

        const onOpenIncident =
          vi.fn();

        renderQueue({
          incidents: [
            makeIncidentListItem({
              primary_employee_user_id:
                "EMP-001",
            }),
          ],

          onOpenIncident,
        });


        await user.click(
          screen.getByRole(
            "link",
            {
              name:
                /EMP-001/i,
            },
          ),
        );


        expect(
          screen.getByText(
            "Employee destination",
          ),
        ).toBeInTheDocument();

        expect(
          onOpenIncident,
        ).not.toHaveBeenCalled();
      },
    );


    it(
      "opens the affected employee from the keyboard",
      () => {
        renderQueue({
          incidents: [
            makeIncidentListItem({
              primary_employee_user_id:
                "EMP-KEYBOARD",
            }),
          ],
        });


        fireEvent.keyDown(
          screen.getByRole(
            "link",
            {
              name:
                /EMP-KEYBOARD/i,
            },
          ),
          {
            key:
              "Enter",
          },
        );


        expect(
          screen.getByText(
            "Employee destination",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders an unknown identity when no employee is linked",
      () => {
        renderQueue({
          incidents: [
            makeIncidentListItem({
              primary_employee_user_id:
                null,
            }),
          ],
        });


        expect(
          screen.getByText(
            "Unknown",
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByRole(
            "link",
          ),
        ).not.toBeInTheDocument();
      },
    );


    it(
      "opens the affected employee with the Space key",
      () => {
        renderQueue({
          incidents: [
            makeIncidentListItem({
              primary_employee_user_id:
                "EMP-SPACE",
            }),
          ],
        });


        fireEvent.keyDown(
          screen.getByRole(
            "link",
            {
              name:
                /EMP-SPACE/i,
            },
          ),
          {
            key:
              " ",
          },
        );


        expect(
          screen.getByText(
            "Employee destination",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "does not open the affected employee for unrelated keys",
      () => {
        renderQueue({
          incidents: [
            makeIncidentListItem({
              primary_employee_user_id:
                "EMP-IGNORE-KEY",
            }),
          ],
        });


        fireEvent.keyDown(
          screen.getByRole(
            "link",
            {
              name:
                /EMP-IGNORE-KEY/i,
            },
          ),
          {
            key:
              "Escape",
          },
        );


        expect(
          screen.queryByText(
            "Employee destination",
          ),
        ).not.toBeInTheDocument();
      },
    );
  },
);
