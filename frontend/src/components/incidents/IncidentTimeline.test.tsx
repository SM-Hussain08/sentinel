import {
  render,
  screen,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import {
  MemoryRouter,
  Route,
  Routes,
  useParams,
} from "react-router-dom";

import {
  describe,
  expect,
  it,
} from "vitest";

import IncidentTimeline from "./IncidentTimeline";

import {
  makeIncidentTimelineEvent,
} from "../../test/fixtures/incidents";


function AnomalyDestination() {
  const {
    eventId,
  } = useParams();

  return (
    <div>
      Opened anomaly {eventId}
    </div>
  );
}


function renderTimeline(
  events:
    ReturnType<
      typeof makeIncidentTimelineEvent
    >[],
) {
  return render(
    <MemoryRouter
      initialEntries={[
        "/incidents/INC-001",
      ]}
    >
      <Routes>
        <Route
          path="/incidents/:incidentId"
          element={
            <IncidentTimeline
              events={events}
            />
          }
        />

        <Route
          path="/anomalies/:eventId"
          element={
            <AnomalyDestination />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}


describe(
  "IncidentTimeline",
  () => {
    it(
      "renders an empty correlated-event count",
      () => {
        renderTimeline(
          [],
        );

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                "Incident Timeline",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "0 correlated events",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders correlated timeline events",
      () => {
        const firstEvent =
          makeIncidentTimelineEvent({
            event_id:
              "EVT-TIMELINE-001",

            event_type:
              "LOGIN_FAILURE",

            risk_level:
              "CRITICAL",
          });

        const secondEvent =
          makeIncidentTimelineEvent({
            event_id:
              "EVT-TIMELINE-002",

            event_type:
              "FILE_ACCESS",

            risk_level:
              "HIGH",
          });

        renderTimeline(
          [
            firstEvent,
            secondEvent,
          ],
        );

        expect(
          screen.getByText(
            "2 correlated events",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "EVT-TIMELINE-001",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "EVT-TIMELINE-002",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Login Failure",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "File Access",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "opens anomaly analysis for the selected timeline event",
      async () => {
        const user =
          userEvent.setup();

        const event =
          makeIncidentTimelineEvent({
            event_id:
              "EVT / SPECIAL",

            event_type:
              "NETWORK_CONNECTION",
          });

        renderTimeline(
          [
            event,
          ],
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                new RegExp(
                  "EVT / SPECIAL",
                ),
            },
          ),
        );

        expect(
          screen.getByText(
            "Opened anomaly EVT / SPECIAL",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders em dashes when source or destination IP context is unavailable",
      () => {
        render(
          <MemoryRouter>
            <IncidentTimeline
              events={[
                makeIncidentTimelineEvent({
                  event_id:
                    "EVT-NO-IP",

                  source_ip:
                    null,

                  destination_ip:
                    null,
                }),
              ]}
            />
          </MemoryRouter>,
        );


        expect(
          screen.getByText(
            "— → —",
          ),
        ).toBeInTheDocument();
      },
    );
  },
);
