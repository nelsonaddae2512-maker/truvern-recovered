import { describe, expect, it } from "vitest";

import {
  buildNistOscalImportProjection,
  flattenOscalControls,
  flattenOscalParts,
  NIST_OSCAL_IMPORT_SCHEMA,
} from "../lib/governance/nist-oscal-import";

describe(
  "R58 authoritative NIST OSCAL projection",
  () => {
    const fixture = {
      catalog: {
        uuid: "catalog-1",
        metadata: {
          title: "NIST Test Catalog",
          version: "5.x",
        },
        groups: [
          {
            id: "ac",
            controls: [
              {
                id: "ac-1",
                props: [
                  {
                    name: "label",
                    value: "AC-01",
                  },
                ],
                params: [
                  {
                    id: "ac-01_odp.01",
                    label: "organization-defined personnel",
                    values: [],
                  },
                ],
                parts: [
                  {
                    id: "ac-1_title",
                    name: "title",
                    prose:
                      "Policy and Procedures",
                  },
                  {
                    id: "ac-1_obj",
                    name:
                      "assessment-objective",
                    props: [
                      {
                        name: "label",
                        class: "sp800-53a",
                        value: "AC-01",
                      },
                    ],
                    parts: [
                      {
                        id:
                          "ac-1_obj.a-1",
                        name:
                          "assessment-objective",
                        prose:
                          "the policy is developed and documented;",
                      },
                    ],
                  },
                  {
                    id:
                      "ac-1_asm-examine",
                    name:
                      "assessment-method",
                    props: [
                      {
                        name: "method",
                        value: "EXAMINE",
                      },
                    ],
                    parts: [
                      {
                        name:
                          "assessment-objects",
                        prose:
                          "Access control policy and procedures",
                      },
                    ],
                  },
                ],
                controls: [
                  {
                    id: "ac-1.1",
                    props: [
                      {
                        name: "label",
                        value:
                          "AC-01 (01)",
                      },
                    ],
                    parts: [
                      {
                        name: "title",
                        prose:
                          "Enhancement",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    it(
      "projects catalog identity",
      () => {
        const result =
          buildNistOscalImportProjection(
            fixture
          );

        expect(result.schema).toBe(
          NIST_OSCAL_IMPORT_SCHEMA
        );

        expect(
          result.catalogUuid
        ).toBe("catalog-1");

        expect(
          result.catalogVersion
        ).toBe("5.x");
      }
    );

    it(
      "preserves control hierarchy",
      () => {
        const result =
          buildNistOscalImportProjection(
            fixture
          );

        const controls =
          flattenOscalControls(
            result.controls
          );

        expect(
          controls.map(
            (control) =>
              control.controlId
          )
        ).toEqual([
          "AC-1",
          "AC-1(1)",
        ]);

        expect(
          controls[1]
            ?.parentControlId
        ).toBe("AC-1");
      }
    );

    it(
      "preserves assessment objectives and methods",
      () => {
        const result =
          buildNistOscalImportProjection(
            fixture
          );

        const parts =
          flattenOscalParts(
            result.controls[0]
              ?.parts ?? []
          );

        expect(
          parts.filter(
            (part) =>
              part.name ===
              "assessment-objective"
          )
        ).toHaveLength(2);

        expect(
          parts.some(
            (part) =>
              part.name ===
              "assessment-method"
          )
        ).toBe(true);

        expect(
          parts.some(
            (part) =>
              part.name ===
                "assessment-objects" &&
              part.prose ===
                "Access control policy and procedures"
          )
        ).toBe(true);
      }
    );

    it(
      "preserves parameters",
      () => {
        const result =
          buildNistOscalImportProjection(
            fixture
          );

        expect(
          result.controls[0]
            ?.parameters[0]
            ?.oscalId
        ).toBe(
          "ac-01_odp.01"
        );
      }
    );

    it(
      "rejects non-catalog input",
      () => {
        expect(() =>
          buildNistOscalImportProjection(
            {}
          )
        ).toThrow(
          "Expected an OSCAL catalog document."
        );
      }
    );
  }
);