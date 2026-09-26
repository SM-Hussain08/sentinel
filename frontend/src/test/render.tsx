import type {
  ReactElement,
} from "react";

import {
  render,
  type RenderOptions,
} from "@testing-library/react";

import RouterWrapper from "./RouterWrapper";


interface RenderWithRouterOptions
  extends Omit<
    RenderOptions,
    "wrapper"
  > {
  route?: string;

  path?: string;

  initialEntries?: string[];
}


export function renderWithRouter(
  ui: ReactElement,
  {
    route = "/",
    path,
    initialEntries,
    ...renderOptions
  }: RenderWithRouterOptions = {},
) {
  return render(
    <RouterWrapper
      route={route}
      path={path}
      initialEntries={
        initialEntries
      }
    >
      {ui}
    </RouterWrapper>,
    renderOptions,
  );
}
