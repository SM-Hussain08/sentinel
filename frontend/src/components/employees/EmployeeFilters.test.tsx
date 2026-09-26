import {
  fireEvent,
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

import EmployeeFilters from "./EmployeeFilters";


function renderEmployeeFilters(
  overrides: Partial<
    React.ComponentProps<
      typeof EmployeeFilters
    >
  > = {},
) {
  const props = {
    searchQuery:
      "",

    department:
      "",

    status:
      "all" as const,

    risk:
      "ALL" as const,

    sort:
      "RISK" as const,

    departments: [
      "Finance",
      "Engineering",
      "Operations",
    ],

    onSearchChange:
      vi.fn(),

    onDepartmentChange:
      vi.fn(),

    onStatusChange:
      vi.fn(),

    onRiskChange:
      vi.fn(),

    onSortChange:
      vi.fn(),

    ...overrides,
  };

  render(
    <EmployeeFilters
      {...props}
    />,
  );

  return props;
}


describe(
  "EmployeeFilters",
  () => {
    it(
      "renders all employee risk choices",
      () => {
        renderEmployeeFilters();

        for (
          const label
          of [
            "All",
            "Critical",
            "High",
            "Medium",
            "Low",
            "Normal",
          ]
        ) {
          expect(
            screen.getByRole(
              "button",
              {
                name:
                  label,
              },
            ),
          ).toBeInTheDocument();
        }
      },
    );


    it(
      "calls onRiskChange when a risk option is selected",
      async () => {
        const user =
          userEvent.setup();

        const props =
          renderEmployeeFilters();

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Critical",
            },
          ),
        );

        expect(
          props.onRiskChange,
        ).toHaveBeenCalledWith(
          "CRITICAL",
        );
      },
    );


    it(
      "reports employee search changes",
      () => {
        const props =
          renderEmployeeFilters();

        fireEvent.change(
          screen.getByPlaceholderText(
            "Search employee, ID, role or department...",
          ),
          {
            target: {
              value:
                "Aisha",
            },
          },
        );

        expect(
          props.onSearchChange,
        ).toHaveBeenCalledWith(
          "Aisha",
        );
      },
    );


    it(
      "renders the available departments",
      () => {
        renderEmployeeFilters();

        expect(
          screen.getByRole(
            "option",
            {
              name:
                "All Departments",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "option",
            {
              name:
                "Finance",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "option",
            {
              name:
                "Engineering",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "option",
            {
              name:
                "Operations",
            },
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "reports department selection",
      async () => {
        const user =
          userEvent.setup();

        const props =
          renderEmployeeFilters();

        const departmentSelect =
          screen.getByDisplayValue(
            "All Departments",
          );

        await user.selectOptions(
          departmentSelect,
          "Finance",
        );

        expect(
          props.onDepartmentChange,
        ).toHaveBeenCalledWith(
          "Finance",
        );
      },
    );


    it(
      "reports employee status selection",
      async () => {
        const user =
          userEvent.setup();

        const props =
          renderEmployeeFilters();

        const statusSelect =
          screen.getByDisplayValue(
            "All Statuses",
          );

        await user.selectOptions(
          statusSelect,
          "active",
        );

        expect(
          props.onStatusChange,
        ).toHaveBeenCalledWith(
          "active",
        );
      },
    );


    it(
      "reports employee sort selection",
      async () => {
        const user =
          userEvent.setup();

        const props =
          renderEmployeeFilters();

        const sortSelect =
          screen.getByDisplayValue(
            "Highest Risk First",
          );

        await user.selectOptions(
          sortSelect,
          "ANOMALIES",
        );

        expect(
          props.onSortChange,
        ).toHaveBeenCalledWith(
          "ANOMALIES",
        );
      },
    );


    it(
      "renders every available sort option",
      () => {
        renderEmployeeFilters();

        expect(
          screen.getByRole(
            "option",
            {
              name:
                "Highest Risk First",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "option",
            {
              name:
                "Most Anomalies",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "option",
            {
              name:
                "Most Incidents",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "option",
            {
              name:
                "Most Recent Activity",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "option",
            {
              name:
                "User ID A–Z",
            },
          ),
        ).toBeInTheDocument();
      },
    );
  },
);
