import {
  render,
  screen,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import IncidentQueue from "./IncidentQueue";

import {
  makeIncidentListItem,
} from "../../test/fixtures/incidents";


describe(
  "IncidentQueue",
  () => {
    it(
      "renders the empty incident state",
      () => {
        render(
          <IncidentQueue
            incidents={[]}
            totalFiltered={0}
            pageStart={0}
            onOpenIncident={vi.fn()}
          />,
        );

        expect(
          screen.getByText(
            "No incidents found",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /Adjust the current search or severity filter/i,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /0–0 of 0/,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders incident information and result range",
      () => {
        const incident =
          makeIncidentListItem();

        render(
          <IncidentQueue
            incidents={[
              incident,
            ]}
            totalFiltered={30}
            pageStart={10}
            onOpenIncident={vi.fn()}
          />,
        );

        expect(
          screen.getByText(
            incident.incident_id,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            incident.title,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            incident.summary,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "11–11 of 30",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders Unknown when an incident has no primary identity",
      () => {
        const incident =
          makeIncidentListItem({
            primary_employee_user_id:
              null,
          });

        render(
          <IncidentQueue
            incidents={[
              incident,
            ]}
            totalFiltered={1}
            pageStart={0}
            onOpenIncident={vi.fn()}
          />,
        );

        expect(
          screen.getByText(
            "Unknown",
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
          makeIncidentListItem();

        const onOpenIncident =
          vi.fn();

        render(
          <IncidentQueue
            incidents={[
              incident,
            ]}
            totalFiltered={1}
            pageStart={0}
            onOpenIncident={
              onOpenIncident
            }
          />,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                new RegExp(
                  incident.title,
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
          incident.incident_id,
        );
      },
    );
  },
);
