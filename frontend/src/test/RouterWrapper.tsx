import type {
  ReactNode,
} from "react";

import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";


interface RouterWrapperProps {
  children: ReactNode;

  route: string;

  path?: string;

  initialEntries?: string[];
}


export default function RouterWrapper({
  children,
  route,
  path,
  initialEntries,
}: RouterWrapperProps) {
  const entries =
    initialEntries
    ?? [
      route,
    ];

  return (
    <MemoryRouter
      initialEntries={
        entries
      }
    >
      {path ? (
        <Routes>
          <Route
            path={path}
            element={
              children
            }
          />
        </Routes>
      ) : (
        children
      )}
    </MemoryRouter>
  );
}
