/**
 * @vitest-environment jsdom
 */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  searchParamsGet: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
  useSearchParams: () => ({
    get: mocks.searchParamsGet,
  }),
}));

import SelectOrgCompleteClient from "@/components/select-org/select-org-complete.client";

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

describe(
  "organization bootstrap executable UI transition",
  () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      vi.clearAllMocks();

      mocks.searchParamsGet.mockImplementation(
        (key: string) =>
          key === "returnTo"
            ? "/vendors"
            : null,
      );

      container =
        document.createElement("div");

      document.body.appendChild(container);

      root =
        createRoot(container);

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({
            ok: true,
          }),
        }),
      );
    });

    afterEach(async () => {
      await act(async () => {
        root.unmount();
      });

      container.remove();

      vi.unstubAllGlobals();
    });

    it(
      "navigates exactly once to the validated destination after mocked bootstrap success",
      async () => {
        await act(async () => {
          root.render(
            <SelectOrgCompleteClient />,
          );
        });

        await act(async () => {
          await Promise.resolve();
          await Promise.resolve();
        });

        expect(fetch).toHaveBeenCalledTimes(1);

        expect(fetch).toHaveBeenCalledWith(
          "/api/access/bootstrap-organization",
          {
            method: "POST",
            headers: {
              accept: "application/json",
            },
            cache: "no-store",
          },
        );

        expect(
          mocks.replace,
        ).toHaveBeenCalledTimes(1);

        expect(
          mocks.replace,
        ).toHaveBeenCalledWith(
          "/vendors",
        );

        expect(
          mocks.refresh,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "does not navigate when mocked bootstrap fails",
      async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: false,
          json: vi.fn().mockResolvedValue({
            ok: false,
            reason: "TEST_FAILURE",
          }),
        } as unknown as Response);

        await act(async () => {
          root.render(
            <SelectOrgCompleteClient />,
          );
        });

        await act(async () => {
          await Promise.resolve();
          await Promise.resolve();
        });

        expect(fetch).toHaveBeenCalledTimes(1);

        expect(
          mocks.replace,
        ).not.toHaveBeenCalled();

        expect(
          mocks.refresh,
        ).not.toHaveBeenCalled();

        expect(
          container.textContent,
        ).toContain(
          "Organization setup could not be completed.",
        );

        expect(
          container.textContent,
        ).toContain(
          "TEST_FAILURE",
        );
      },
    );
  },
);
