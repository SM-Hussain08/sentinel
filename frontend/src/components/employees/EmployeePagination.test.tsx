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

import EmployeePagination from "./EmployeePagination";


describe(
  "EmployeePagination",
  () => {
    it(
      "renders the current employee result range and page",
      () => {
        render(
          <EmployeePagination
            currentPage={2}
            totalPages={5}
            showingFrom={31}
            showingTo={60}
            totalResults={143}
            hasPrevious
            hasNext
            onPrevious={vi.fn()}
            onNext={vi.fn()}
          />,
        );

        expect(
          screen.getByText(
            /Showing/,
          ),
        ).toHaveTextContent(
          "Showing 31–60 of 143 employees",
        );

        expect(
          screen.getByText(
            /Page/,
          ),
        ).toHaveTextContent(
          "Page 2 of 5",
        );
      },
    );


    it(
      "uses page 1 when totalPages is zero",
      () => {
        render(
          <EmployeePagination
            currentPage={1}
            totalPages={0}
            showingFrom={0}
            showingTo={0}
            totalResults={0}
            hasPrevious={false}
            hasNext={false}
            onPrevious={vi.fn()}
            onNext={vi.fn()}
          />,
        );

        expect(
          screen.getByText(
            /Page/,
          ),
        ).toHaveTextContent(
          "Page 1 of 1",
        );
      },
    );


    it(
      "disables pagination controls when navigation is unavailable",
      () => {
        render(
          <EmployeePagination
            currentPage={1}
            totalPages={1}
            showingFrom={1}
            showingTo={10}
            totalResults={10}
            hasPrevious={false}
            hasNext={false}
            onPrevious={vi.fn()}
            onNext={vi.fn()}
          />,
        );

        expect(
          screen.getByRole(
            "button",
            {
              name:
                /Previous/,
            },
          ),
        ).toBeDisabled();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                /Next/,
            },
          ),
        ).toBeDisabled();
      },
    );


    it(
      "calls previous and next handlers when navigation is available",
      async () => {
        const user =
          userEvent.setup();

        const onPrevious =
          vi.fn();

        const onNext =
          vi.fn();

        render(
          <EmployeePagination
            currentPage={2}
            totalPages={4}
            showingFrom={31}
            showingTo={60}
            totalResults={100}
            hasPrevious
            hasNext
            onPrevious={onPrevious}
            onNext={onNext}
          />,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                /Previous/,
            },
          ),
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                /Next/,
            },
          ),
        );

        expect(
          onPrevious,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          onNext,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );


    it(
      "does not call disabled navigation handlers",
      async () => {
        const user =
          userEvent.setup();

        const onPrevious =
          vi.fn();

        const onNext =
          vi.fn();

        render(
          <EmployeePagination
            currentPage={1}
            totalPages={1}
            showingFrom={1}
            showingTo={5}
            totalResults={5}
            hasPrevious={false}
            hasNext={false}
            onPrevious={onPrevious}
            onNext={onNext}
          />,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                /Previous/,
            },
          ),
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                /Next/,
            },
          ),
        );

        expect(
          onPrevious,
        ).not.toHaveBeenCalled();

        expect(
          onNext,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
