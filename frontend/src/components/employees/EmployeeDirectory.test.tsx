import {
  render,
  screen,
} from "@testing-library/react";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import EmployeeDirectory from "./EmployeeDirectory";

import {
  makeEmployeeDirectoryItem,
} from "../../test/fixtures/employees";

import userEvent from "@testing-library/user-event";


describe(
  "EmployeeDirectory",
  () => {
    it(
      "renders the loading state",
      () => {
        render(
          <EmployeeDirectory
            employees={[]}
            totalResults={0}
            showingFrom={0}
            showingTo={0}
            isLoading
            onOpenEmployee={vi.fn()}
          />,
        );

        expect(
          screen.getByText(
            /Loading employee intelligence/i,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders the empty state when no employees match",
      () => {
        render(
          <EmployeeDirectory
            employees={[]}
            totalResults={0}
            showingFrom={0}
            showingTo={0}
            isLoading={false}
            onOpenEmployee={vi.fn()}
          />,
        );

        expect(
          screen.getByText(
            "No employees found",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /No employee identities match/i,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders the result range and populated employee data",
      () => {
        const employee =
          makeEmployeeDirectoryItem();

        render(
          <EmployeeDirectory
            employees={[
              employee,
            ]}
            totalResults={25}
            showingFrom={1}
            showingTo={1}
            isLoading={false}
            onOpenEmployee={vi.fn()}
          />,
        );

        expect(
          screen.getByText(
            /1–1 of 25/,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            employee.name,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            employee.user_id,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "opens the selected employee from the directory",
      async () => {
        const user =
          userEvent.setup();

        const employee =
          makeEmployeeDirectoryItem();

        const onOpenEmployee =
          vi.fn();

        render(
          <EmployeeDirectory
            employees={[
              employee,
            ]}
            totalResults={1}
            showingFrom={1}
            showingTo={1}
            isLoading={false}
            onOpenEmployee={
              onOpenEmployee
            }
          />,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                new RegExp(
                  employee.name,
                  "i",
                ),
            },
          ),
        );

        expect(
          onOpenEmployee,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          onOpenEmployee,
        ).toHaveBeenCalledWith(
          employee.user_id,
        );
      },
    );


    it(
      "renders an inactive badge for inactive employees",
      () => {
        const employee =
          makeEmployeeDirectoryItem({
            is_active:
              false,
          });


        render(
          <EmployeeDirectory
            employees={[
              employee,
            ]}
            totalResults={1}
            showingFrom={1}
            showingTo={1}
            isLoading={false}
            onOpenEmployee={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "Inactive",
          ),
        ).toBeInTheDocument();
      },
    );
  },
);
