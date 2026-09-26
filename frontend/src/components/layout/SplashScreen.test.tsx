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

import SplashScreen from "./SplashScreen";


describe(
  "SplashScreen",
  () => {
    it(
      "renders the SENTINEL startup branding and initialization state",
      () => {
        render(
          <SplashScreen
            onComplete={
              vi.fn()
            }
          />,
        );

        expect(
          screen.getByAltText(
            "SENTINEL — AI Powered Security Operations",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Initializing Security Intelligence",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Behavioral Analytics · Incident Intelligence",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "marks the decorative background image as hidden from assistive technology",
      () => {
        const {
          container,
        } = render(
          <SplashScreen
            onComplete={
              vi.fn()
            }
          />,
        );

        const decorativeImage =
          container.querySelector(
            'img[aria-hidden="true"]',
          );

        expect(
          decorativeImage,
        ).not.toBeNull();

        expect(
          decorativeImage,
        ).toHaveAttribute(
          "alt",
          "",
        );
      },
    );


    it(
      "renders the animation-driven splash root",
      () => {
        const {
          container,
        } = render(
          <SplashScreen
            onComplete={
              vi.fn()
            }
          />,
        );

        const splash =
          container.querySelector(
            ".sentinel-splash",
          );

        expect(
          splash,
        ).not.toBeNull();

        expect(
          splash,
        ).toHaveClass(
          "sentinel-splash",
        );
      },
    );
  },
);
