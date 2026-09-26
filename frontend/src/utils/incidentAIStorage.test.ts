import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  getAIChatStorageKey,
  getAIInvestigationStorageKey,
  readSessionValue,
  removeSessionValue,
  writeSessionValue,
} from "./incidentAIStorage";


describe(
  "incident AI session storage",
  () => {
    afterEach(() => {
      vi.restoreAllMocks();

      window.sessionStorage.clear();
    });


    it(
      "creates an investigation key with an encoded incident identifier",
      () => {
        expect(
          getAIInvestigationStorageKey(
            "INC / 01",
          ),
        ).toBe(
          "sentinel:incident-ai:investigation:INC%20%2F%2001",
        );
      },
    );


    it(
      "creates a chat key with an encoded incident identifier",
      () => {
        expect(
          getAIChatStorageKey(
            "INC / 01",
          ),
        ).toBe(
          "sentinel:incident-ai:chat:INC%20%2F%2001",
        );
      },
    );


    it(
      "writes and reads a JSON session value",
      () => {
        const key =
          getAIInvestigationStorageKey(
            "INC-001",
          );

        const value = {
          incident_id:
            "INC-001",

          confidence:
            "HIGH",

          grounded:
            true,
        };

        writeSessionValue(
          key,
          value,
        );

        expect(
          readSessionValue(
            key,
          ),
        ).toEqual(
          value,
        );
      },
    );


    it(
      "returns null when the session value does not exist",
      () => {
        expect(
          readSessionValue(
            "missing-key",
          ),
        ).toBeNull();
      },
    );


    it(
      "returns null when stored JSON is invalid",
      () => {
        window.sessionStorage.setItem(
          "invalid-json",
          "{broken-json",
        );

        expect(
          readSessionValue(
            "invalid-json",
          ),
        ).toBeNull();
      },
    );


    it(
      "removes a stored session value",
      () => {
        const key =
          getAIChatStorageKey(
            "INC-001",
          );

        writeSessionValue(
          key,
          {
            message:
              "cached response",
          },
        );

        expect(
          readSessionValue(
            key,
          ),
        ).not.toBeNull();

        removeSessionValue(
          key,
        );

        expect(
          readSessionValue(
            key,
          ),
        ).toBeNull();
      },
    );


    it(
      "returns null instead of throwing when sessionStorage reads fail",
      () => {
        vi.spyOn(
          Storage.prototype,
          "getItem",
        ).mockImplementation(
          () => {
            throw new Error(
              "Storage access denied",
            );
          },
        );

        expect(
          () =>
            readSessionValue(
              "restricted-key",
            ),
        ).not.toThrow();

        expect(
          readSessionValue(
            "restricted-key",
          ),
        ).toBeNull();
      },
    );


    it(
      "does not throw when sessionStorage writes fail",
      () => {
        vi.spyOn(
          Storage.prototype,
          "setItem",
        ).mockImplementation(
          () => {
            throw new Error(
              "Storage quota exceeded",
            );
          },
        );

        expect(
          () =>
            writeSessionValue(
              "restricted-key",
              {
                value:
                  "must not break workflow",
              },
            ),
        ).not.toThrow();
      },
    );


    it(
      "does not throw when sessionStorage removal fails",
      () => {
        vi.spyOn(
          Storage.prototype,
          "removeItem",
        ).mockImplementation(
          () => {
            throw new Error(
              "Storage access denied",
            );
          },
        );

        expect(
          () =>
            removeSessionValue(
              "restricted-key",
            ),
        ).not.toThrow();
      },
    );
  },
);
