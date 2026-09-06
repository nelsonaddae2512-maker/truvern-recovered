import { describe, expect, it, vi } from "vitest";

import type {
  NistOscalPersistenceProjection,
} from "@/lib/governance/nist-oscal-persistence";

import {
  importNistOscalProjection,
  NIST_OSCAL_IMPORT_APPLY_CONFIRMATION,
} from "@/lib/repositories/nist-oscal-import-repository";

function projection(): NistOscalPersistenceProjection {
  return {
    schema:
      "TRV-NIST-OSCAL-PERSISTENCE-1.0",
    sourceSchema:
      "TRV-NIST-OSCAL-IMPORT-1.0",
    catalogUuid:
      "catalog-1",
    catalogVersion:
      "5.2.0",
    framework: {
      slug:
        "nist-sp-800-53-rev5",
      name:
        "NIST SP 800-53 Rev. 5",
      description:
        null,
      version:
        "5.2.0",
      metadata: {
        catalogUuid:
          "catalog-1",
      },
    },
    controls: [
      {
        controlId: "AC-1",
        parentControlId: null,
        family: "AC",
        title: "Policy and Procedures",
        sortOrder: 0,
        metadata: {
          oscalId: "ac-1",
        },
      },
      {
        controlId: "AC-1(1)",
        parentControlId: "AC-1",
        family: "AC",
        title: "Enhancement",
        sortOrder: 1,
        metadata: {
          oscalId: "ac-1.1",
        },
      },
    ],
    parameters: [
      {
        controlId: "AC-1",
        oscalId: "ac-1_prm_1",
        label: "organization-defined",
        usage: null,
        props: [],
        guidelines: [],
        constraints: [],
        selection: null,
        values: [],
        remarks: null,
        sortOrder: 0,
        metadata: {},
      },
    ],
    parts: [
      {
        key: "AC-1:part:0",
        controlId: "AC-1",
        parentKey: null,
        oscalId: "ac-1_smt",
        name: "statement",
        namespace: null,
        prose: "Base statement.",
        props: [],
        links: [],
        sortOrder: 0,
        metadata: {},
      },
      {
        key: "AC-1:part:0.0",
        controlId: "AC-1",
        parentKey: "AC-1:part:0",
        oscalId: "ac-1_obj",
        name: "assessment-objective",
        namespace: null,
        prose: "Determine whether...",
        props: [],
        links: [],
        sortOrder: 0,
        metadata: {},
      },
    ],
    properties: [
      {
        controlId: "AC-1",
        partKey: "AC-1:part:0.0",
        name: "method",
        value: "EXAMINE",
        className: null,
        namespace: null,
        uuid: null,
        sortOrder: 0,
        metadata: {},
      },
    ],
    links: [
      {
        controlId: "AC-1",
        partKey: "AC-1:part:0.0",
        href: "#ac-1_prm_1",
        rel: "related",
        text: null,
        mediaType: null,
        resourceFragment: "ac-1_prm_1",
        sortOrder: 0,
        metadata: {},
      },
    ],
  };
}

function fakeClient() {
  let nextControlId = 100;
  let nextPartId = 1000;

  return {
    truvernFramework: {
      upsert: vi.fn().mockResolvedValue({
        id: 10,
      }),
    },
    truvernControl: {
      upsert: vi.fn().mockImplementation(
        async () => ({
          id: nextControlId++,
        }),
      ),
      update: vi.fn().mockResolvedValue({}),
    },
    truvernControlParameter: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    truvernControlPart: {
      deleteMany: vi.fn().mockResolvedValue({
        count: 0,
      }),
      create: vi.fn().mockImplementation(
        async () => ({
          id: nextPartId++,
        }),
      ),
    },
    truvernControlProperty: {
      deleteMany: vi.fn().mockResolvedValue({
        count: 0,
      }),
      create: vi.fn().mockResolvedValue({}),
    },
    truvernControlLink: {
      deleteMany: vi.fn().mockResolvedValue({
        count: 0,
      }),
      create: vi.fn().mockResolvedValue({}),
    },
  };
}

describe(
  "R58 NIST OSCAL transactional import repository",
  () => {
    it(
      "defaults to a database-free dry run",
      async () => {
        const client =
          fakeClient();

        const result =
          await importNistOscalProjection(
            client as never,
            projection(),
          );

        expect(result).toEqual({
          mode: "DRY_RUN",
          applied: false,
          framework: 1,
          controls: 2,
          parameters: 1,
          parts: 2,
          properties: 1,
          links: 1,
        });

        expect(
          client.truvernFramework.upsert,
        ).not.toHaveBeenCalled();

        expect(
          client.truvernControl.upsert,
        ).not.toHaveBeenCalled();

        expect(
          client.truvernControlPart.deleteMany,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "rejects APPLY without explicit confirmation",
      async () => {
        const client =
          fakeClient();

        await expect(
          importNistOscalProjection(
            client as never,
            projection(),
            {
              mode: "APPLY",
            },
          ),
        ).rejects.toThrow(
          "Explicit NIST OSCAL import confirmation is required.",
        );

        expect(
          client.truvernFramework.upsert,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "upserts framework and controls without deleting controls",
      async () => {
        const client =
          fakeClient();

        await importNistOscalProjection(
          client as never,
          projection(),
          {
            mode: "APPLY",
            confirmation:
              NIST_OSCAL_IMPORT_APPLY_CONFIRMATION,
          },
        );

        expect(
          client.truvernFramework.upsert,
        ).toHaveBeenCalledTimes(1);

        expect(
          client.truvernControl.upsert,
        ).toHaveBeenCalledTimes(2);

        expect(
          (
            client.truvernControl as Record<
              string,
              unknown
            >
          ).deleteMany,
        ).toBeUndefined();
      },
    );

    it(
      "wires enhancement hierarchy after control identity creation",
      async () => {
        const client =
          fakeClient();

        await importNistOscalProjection(
          client as never,
          projection(),
          {
            mode: "APPLY",
            confirmation:
              NIST_OSCAL_IMPORT_APPLY_CONFIRMATION,
          },
        );

        expect(
          client.truvernControl.update,
        ).toHaveBeenCalledTimes(2);

        expect(
          client.truvernControl.update,
        ).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({
            data: {
              parentControlId: 100,
            },
          }),
        );
      },
    );

    it(
      "uses the parameter composite identity",
      async () => {
        const client =
          fakeClient();

        await importNistOscalProjection(
          client as never,
          projection(),
          {
            mode: "APPLY",
            confirmation:
              NIST_OSCAL_IMPORT_APPLY_CONFIRMATION,
          },
        );

        expect(
          client.truvernControlParameter.upsert,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              controlId_oscalId: {
                controlId: 100,
                oscalId:
                  "ac-1_prm_1",
              },
            },
          }),
        );
      },
    );

    it(
      "rebuilds only OSCAL semantic children and preserves part hierarchy",
      async () => {
        const client =
          fakeClient();

        await importNistOscalProjection(
          client as never,
          projection(),
          {
            mode: "APPLY",
            confirmation:
              NIST_OSCAL_IMPORT_APPLY_CONFIRMATION,
          },
        );

        expect(
          client.truvernControlPart.deleteMany,
        ).toHaveBeenCalledTimes(2);

        expect(
          client.truvernControlProperty.deleteMany,
        ).toHaveBeenCalledTimes(2);

        expect(
          client.truvernControlLink.deleteMany,
        ).toHaveBeenCalledTimes(2);

        expect(
          client.truvernControlPart.create,
        ).toHaveBeenCalledTimes(2);

        expect(
          client.truvernControlPart.create,
        ).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({
            data: expect.objectContaining({
              parentPartId: 1000,
            }),
          }),
        );

        expect(
          client.truvernControlProperty.create,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              partId: 1001,
              name: "method",
              value: "EXAMINE",
            }),
          }),
        );

        expect(
          client.truvernControlLink.create,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              partId: 1001,
              href: "#ac-1_prm_1",
            }),
          }),
        );
      },
    );
  },
);