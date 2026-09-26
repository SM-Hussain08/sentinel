import {
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
} from "vitest";

import NotFoundPage from "./NotFoundPage";


function renderNotFound(
  initialEntries:
    string[] = [
      "/missing",
    ],

  initialIndex:
    number = 0,
) {
  return render(
    <MemoryRouter
      initialEntries={
        initialEntries
      }
      initialIndex={
        initialIndex
      }
    >
      <Routes>
        <Route
          path="/"
          element={
            <div>
              Overview Destination
            </div>
          }
        />

        <Route
          path="/incidents"
          element={
            <div>
              Incidents Destination
            </div>
          }
        />

        <Route
          path="*"
          element={
            <NotFoundPage />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}


describe(
  "NotFoundPage",
  () => {
    it(
      "renders a clear 404 recovery state",
      () => {
        renderNotFound();

        expect(
          screen.getByText(
            "404",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "SENTINEL Navigation",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                "Workspace not found",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /does not exist or is not currently available/i,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Go to Overview",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "← Go Back",
            },
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "navigates to Overview from an unknown route",
      async () => {
        const user =
          userEvent.setup();

        renderNotFound();

        const overviewButton =
          screen.getByRole(
            "button",
            {
              name:
                "Go to Overview",
            },
          );

        overviewButton.focus();

        expect(
          overviewButton,
        ).toHaveFocus();

        await user.keyboard(
          "{Enter}",
        );

        expect(
          screen.getByText(
            "Overview Destination",
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "Workspace not found",
          ),
        ).not.toBeInTheDocument();
      },
    );


    it(
      "returns to the previous route when Go Back is selected",
      async () => {
        const user =
          userEvent.setup();

        renderNotFound(
          [
            "/incidents",
            "/missing",
          ],
          1,
        );

        const backButton =
          screen.getByRole(
            "button",
            {
              name:
                "← Go Back",
            },
          );

        backButton.focus();

        expect(
          backButton,
        ).toHaveFocus();

        await user.keyboard(
          "{Enter}",
        );

        expect(
          screen.getByText(
            "Incidents Destination",
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "Workspace not found",
          ),
        ).not.toBeInTheDocument();
      },
    );
  },
);