import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildNistOscalImportProjection,
} from "../lib/governance/nist-oscal-import";

import {
  buildNistOscalPersistenceProjection,
  NIST_OSCAL_PERSISTENCE_SCHEMA,
} from "../lib/governance/nist-oscal-persistence";

function fixture() {
  return {
    catalog: {
      uuid:
        "catalog-test-uuid",

      metadata: {
        title:
          "NIST SP 800-53 Rev. 5 Test Catalog",

        version:
          "5.2.0",
      },

      groups: [
        {
          id: "ac",
          class: "family",
          title:
            "Access Control",

          controls: [
            {
              id: "ac-1",
              class: "SP800-53",

              title:
                "Policy and Procedures",

              props: [
                {
                  name:
                    "label",
                  value:
                    "AC-01",
                },
                {
                  name:
                    "sort-id",
                  value:
                    "ac-01",
                },
              ],

              params: [
                {
                  id:
                    "ac-1_prm_1",

                  label:
                    "organization-defined personnel",

                  usage:
                    "Identify responsible personnel",

                  values: [
                    "security officer",
                  ],
                },
              ],

              parts: [
                {
                  id:
                    "ac-1_smt",

                  name:
                    "statement",

                  prose:
                    "Develop and document access control policy.",

                  parts: [
                    {
                      id:
                        "ac-1_obj",

                      name:
                        "assessment-objective",

                      prose:
                        "Determine whether the policy is defined.",

                      props: [
                        {
                          name:
                            "method",
                          value:
                            "EXAMINE",
                        },
                      ],

                      links: [
                        {
                          href:
                            "#ac-1_prm_1",
                          rel:
                            "related",
                        },
                      ],
                    },
                  ],
                },
              ],

              controls: [
                {
                  id:
                    "ac-1.1",

                  title:
                    "Enhancement",

                  props: [
                    {
                      name:
                        "label",
                      value:
                        "AC-01 (01)",
                    },
                  ],

                  parts: [
                    {
                      id:
                        "ac-1.1_obj",

                      name:
                        "assessment-objective",

                      prose:
                        "Determine whether enhancement requirements are satisfied.",
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
}

describe(
  "R58 NIST OSCAL persistence projection",
  () => {
    it(
      "maps framework identity deterministically",
      () => {
        const imported =
          buildNistOscalImportProjection(
            fixture()
          );

        const first =
          buildNistOscalPersistenceProjection(
            imported
          );

        const second =
          buildNistOscalPersistenceProjection(
            imported
          );

        expect(first).toEqual(second);

        expect(first.schema).toBe(
          NIST_OSCAL_PERSISTENCE_SCHEMA
        );

        expect(
          first.framework.slug
        ).toBe(
          "nist-sp-800-53-rev5"
        );

        expect(
          first.framework.version
        ).toBe("5.2.0");

        expect(
          first.catalogUuid
        ).toBe(
          "catalog-test-uuid"
        );
      }
    );

    it(
      "maps base controls and enhancements with canonical hierarchy",
      () => {
        const projection =
          buildNistOscalPersistenceProjection(
            buildNistOscalImportProjection(
              fixture()
            )
          );

        expect(
          projection.controls.map(
            (control) => ({
              id:
                control.controlId,
              parent:
                control.parentControlId,
            })
          )
        ).toEqual([
          {
            id: "AC-1",
            parent: null,
          },
          {
            id: "AC-1(1)",
            parent: "AC-1",
          },
        ]);
      }
    );

    it(
      "maps parameters without losing OSCAL identity",
      () => {
        const projection =
          buildNistOscalPersistenceProjection(
            buildNistOscalImportProjection(
              fixture()
            )
          );

        expect(
          projection.parameters
        ).toHaveLength(1);

        expect(
          projection.parameters[0]
        ).toMatchObject({
          controlId: "AC-1",
          oscalId:
            "ac-1_prm_1",
          label:
            "organization-defined personnel",
          usage:
            "Identify responsible personnel",
          values: [
            "security officer",
          ],
        });
      }
    );

    it(
      "preserves hierarchical assessment parts and their semantic properties and links",
      () => {
        const projection =
          buildNistOscalPersistenceProjection(
            buildNistOscalImportProjection(
              fixture()
            )
          );

        const statement =
          projection.parts.find(
            (part) =>
              part.oscalId ===
              "ac-1_smt"
          );

        const objective =
          projection.parts.find(
            (part) =>
              part.oscalId ===
              "ac-1_obj"
          );

        expect(statement).toBeTruthy();
        expect(objective).toBeTruthy();

        expect(
          objective?.parentKey
        ).toBe(
          statement?.key
        );

        expect(
          projection.properties
        ).toContainEqual(
          expect.objectContaining({
            controlId:
              "AC-1",
            partKey:
              objective?.key,
            name:
              "method",
            value:
              "EXAMINE",
          })
        );

        expect(
          projection.links
        ).toContainEqual(
          expect.objectContaining({
            controlId:
              "AC-1",
            partKey:
              objective?.key,
            href:
              "#ac-1_prm_1",
            rel:
              "related",
          })
        );
      }
    );

    it(
      "does not collapse enhancement assessment semantics into the parent control",
      () => {
        const projection =
          buildNistOscalPersistenceProjection(
            buildNistOscalImportProjection(
              fixture()
            )
          );

        expect(
          projection.parts.some(
            (part) =>
              part.controlId ===
                "AC-1(1)" &&
              part.oscalId ===
                "ac-1.1_obj"
          )
        ).toBe(true);
      }
    );
  }
);