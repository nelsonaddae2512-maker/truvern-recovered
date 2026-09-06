import { Prisma } from "@prisma/client";

import type {
  NistOscalControlRecord,
  NistOscalLinkRecord,
  NistOscalParameterRecord,
  NistOscalPartRecord,
  NistOscalPersistenceProjection,
  NistOscalPropertyRecord,
} from "@/lib/governance/nist-oscal-persistence";

export const NIST_OSCAL_IMPORT_APPLY_CONFIRMATION =
  "APPLY-NIST-OSCAL-IMPORT";

export type NistOscalImportMode =
  | "DRY_RUN"
  | "APPLY";

export type NistOscalImportPlan = {
  framework: number;
  controls: number;
  parameters: number;
  parts: number;
  properties: number;
  links: number;
};

export type NistOscalImportResult =
  NistOscalImportPlan & {
    mode: NistOscalImportMode;
    applied: boolean;
  };

type NistOscalImportClient =
  Prisma.TransactionClient;

function toPrismaJson(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

function planFor(
  projection: NistOscalPersistenceProjection,
): NistOscalImportPlan {
  return {
    framework: 1,
    controls: projection.controls.length,
    parameters: projection.parameters.length,
    parts: projection.parts.length,
    properties: projection.properties.length,
    links: projection.links.length,
  };
}

function controlKey(
  controlId: string,
): string {
  return controlId;
}

function partKey(
  part: NistOscalPartRecord,
): string {
  return part.key;
}

function propertiesForControl(
  rows: NistOscalPropertyRecord[],
  controlId: string,
): NistOscalPropertyRecord[] {
  return rows.filter(
    (row) =>
      row.controlId === controlId &&
      row.partKey === null,
  );
}

function linksForControl(
  rows: NistOscalLinkRecord[],
  controlId: string,
): NistOscalLinkRecord[] {
  return rows.filter(
    (row) =>
      row.controlId === controlId &&
      row.partKey === null,
  );
}

export async function importNistOscalProjection(
  client: NistOscalImportClient,
  projection: NistOscalPersistenceProjection,
  options: {
    mode?: NistOscalImportMode;
    confirmation?: string;
  } = {},
): Promise<NistOscalImportResult> {
  const mode =
    options.mode ?? "DRY_RUN";

  const plan =
    planFor(projection);

  if (mode === "DRY_RUN") {
    return {
      ...plan,
      mode,
      applied: false,
    };
  }

  if (
    options.confirmation !==
    NIST_OSCAL_IMPORT_APPLY_CONFIRMATION
  ) {
    throw new Error(
      "Explicit NIST OSCAL import confirmation is required.",
    );
  }

  const framework =
    await client.truvernFramework.upsert({
      where: {
        slug: projection.framework.slug,
      },
      create: {
        slug: projection.framework.slug,
        name: projection.framework.name,
        description:
          projection.framework.description,
        version:
          projection.framework.version,
        status: "DRAFT",
        metadata:
          toPrismaJson(projection.framework.metadata),
      },
      update: {
        name: projection.framework.name,
        description:
          projection.framework.description,
        version:
          projection.framework.version,
        metadata:
          toPrismaJson(projection.framework.metadata),
      },
      select: {
        id: true,
      },
    });

  const controlDatabaseIds =
    new Map<string, number>();

  /*
   * Pass 1 deliberately writes controls without parentControlId.
   * This guarantees that every base/enhancement database identity
   * exists before hierarchy wiring.
   */
  for (
    const control of projection.controls
  ) {
    const row =
      await upsertControl(
        client,
        framework.id,
        control,
      );

    controlDatabaseIds.set(
      controlKey(control.controlId),
      row.id,
    );
  }

  /*
   * Pass 2 wires enhancement hierarchy only after all controls
   * have stable database IDs.
   */
  for (
    const control of projection.controls
  ) {
    const databaseId =
      controlDatabaseIds.get(
        controlKey(control.controlId),
      );

    if (databaseId === undefined) {
      throw new Error(
        `Missing persisted control identity: ${control.controlId}`,
      );
    }

    const parentDatabaseId =
      control.parentControlId === null
        ? null
        : controlDatabaseIds.get(
            controlKey(
              control.parentControlId,
            ),
          );

    if (
      control.parentControlId !== null &&
      parentDatabaseId === undefined
    ) {
      throw new Error(
        `Missing persisted parent control identity: ${control.parentControlId}`,
      );
    }

    await client.truvernControl.update({
      where: {
        id: databaseId,
      },
      data: {
        parentControlId:
          parentDatabaseId ?? null,
      },
    });
  }

  /*
   * Parameters have a real Prisma uniqueness contract and can
   * therefore be imported idempotently by (controlId, oscalId).
   */
  for (
    const parameter of projection.parameters
  ) {
    const databaseControlId =
      requireControlDatabaseId(
        controlDatabaseIds,
        parameter.controlId,
      );

    await upsertParameter(
      client,
      databaseControlId,
      parameter,
    );
  }

  /*
   * Parts/properties/links do not have natural Prisma uniqueness
   * constraints. Rebuild only these OSCAL semantic children for
   * each imported control. Controls and questions are never
   * deleted.
   */
  for (
    const control of projection.controls
  ) {
    const databaseControlId =
      requireControlDatabaseId(
        controlDatabaseIds,
        control.controlId,
      );

    await client.truvernControlProperty.deleteMany({
      where: {
        controlId: databaseControlId,
        partId: null,
      },
    });

    await client.truvernControlLink.deleteMany({
      where: {
        controlId: databaseControlId,
        partId: null,
      },
    });

    await client.truvernControlPart.deleteMany({
      where: {
        controlId: databaseControlId,
      },
    });

    for (
      const property of propertiesForControl(
        projection.properties,
        control.controlId,
      )
    ) {
      await client.truvernControlProperty.create({
        data: {
          controlId: databaseControlId,
          partId: null,
          name: property.name,
          value: property.value,
          className: property.className,
          namespace: property.namespace,
          uuid: property.uuid,
          sortOrder: property.sortOrder,
          metadata: toPrismaJson(property.metadata),
        },
      });
    }

    for (
      const link of linksForControl(
        projection.links,
        control.controlId,
      )
    ) {
      await client.truvernControlLink.create({
        data: {
          controlId: databaseControlId,
          partId: null,
          href: link.href,
          rel: link.rel,
          text: link.text,
          mediaType: link.mediaType,
          resourceFragment:
            link.resourceFragment,
          sortOrder: link.sortOrder,
          metadata: toPrismaJson(link.metadata),
        },
      });
    }

    await createPartsForControl(
      client,
      databaseControlId,
      control.controlId,
      projection.parts,
      projection.properties,
      projection.links,
    );
  }

  return {
    ...plan,
    mode,
    applied: true,
  };
}

async function upsertControl(
  client: NistOscalImportClient,
  frameworkId: number,
  control: NistOscalControlRecord,
): Promise<{ id: number }> {
  return client.truvernControl.upsert({
    where: {
      frameworkId_controlId: {
        frameworkId,
        controlId:
          control.controlId,
      },
    },
    create: {
      frameworkId,
      controlId:
        control.controlId,
      family:
        control.family,
      title:
        control.title,
      sortOrder:
        control.sortOrder,
      metadata:
        toPrismaJson(control.metadata),
    },
    update: {
      family:
        control.family,
      title:
        control.title,
      sortOrder:
        control.sortOrder,
      metadata:
        toPrismaJson(control.metadata),
    },
    select: {
      id: true,
    },
  });
}

async function upsertParameter(
  client: NistOscalImportClient,
  databaseControlId: number,
  parameter: NistOscalParameterRecord,
): Promise<void> {
  await client.truvernControlParameter.upsert({
    where: {
      controlId_oscalId: {
        controlId:
          databaseControlId,
        oscalId:
          parameter.oscalId,
      },
    },
    create: {
      controlId:
        databaseControlId,
      oscalId:
        parameter.oscalId,
      label:
        parameter.label,
      usage:
        parameter.usage,
      props:
        toPrismaJson(parameter.props),
      guidelines:
        toPrismaJson(parameter.guidelines),
      constraints:
        toPrismaJson(parameter.constraints),
      selection:
        toPrismaJson(parameter.selection),
      values:
        toPrismaJson(parameter.values),
      remarks:
        parameter.remarks,
      sortOrder:
        parameter.sortOrder,
      metadata:
        toPrismaJson(parameter.metadata),
    },
    update: {
      label:
        parameter.label,
      usage:
        parameter.usage,
      props:
        toPrismaJson(parameter.props),
      guidelines:
        toPrismaJson(parameter.guidelines),
      constraints:
        toPrismaJson(parameter.constraints),
      selection:
        toPrismaJson(parameter.selection),
      values:
        toPrismaJson(parameter.values),
      remarks:
        parameter.remarks,
      sortOrder:
        parameter.sortOrder,
      metadata:
        toPrismaJson(parameter.metadata),
    },
  });
}

function requireControlDatabaseId(
  ids: Map<string, number>,
  controlId: string,
): number {
  const id =
    ids.get(controlKey(controlId));

  if (id === undefined) {
    throw new Error(
      `Missing persisted control identity: ${controlId}`,
    );
  }

  return id;
}

async function createPartsForControl(
  client: NistOscalImportClient,
  databaseControlId: number,
  canonicalControlId: string,
  parts: NistOscalPartRecord[],
  properties: NistOscalPropertyRecord[],
  links: NistOscalLinkRecord[],
): Promise<void> {
  const controlParts =
    parts.filter(
      (part) =>
        part.controlId ===
        canonicalControlId,
    );

  const databasePartIds =
    new Map<string, number>();

  const pending =
    [...controlParts].sort(
      (left, right) =>
        left.key.split(".").length - right.key.split(".").length ||
        left.sortOrder - right.sortOrder ||
        left.key.localeCompare(right.key),
    );

  for (const part of pending) {
    const parentDatabaseId =
      part.parentKey === null
        ? null
        : databasePartIds.get(
            part.parentKey,
          );

    if (
      part.parentKey !== null &&
      parentDatabaseId === undefined
    ) {
      throw new Error(
        `Missing persisted parent part identity: ${part.parentKey}`,
      );
    }

    const created =
      await client.truvernControlPart.create({
        data: {
          controlId:
            databaseControlId,
          oscalId:
            part.oscalId,
          name:
            part.name,
          namespace:
            part.namespace,
          prose:
            part.prose,
          parentPartId:
            parentDatabaseId ?? null,
          props:
            toPrismaJson(part.props),
          links:
            toPrismaJson(part.links),
          sortOrder:
            part.sortOrder,
          metadata:
            toPrismaJson(part.metadata),
        },
        select: {
          id: true,
        },
      });

    databasePartIds.set(
      partKey(part),
      created.id,
    );
  }

  for (const property of properties) {
    if (
      property.controlId !==
        canonicalControlId ||
      property.partKey === null
    ) {
      continue;
    }

    const databasePartId =
      databasePartIds.get(
        property.partKey,
      );

    if (databasePartId === undefined) {
      throw new Error(
        `Missing persisted part identity: ${property.partKey}`,
      );
    }

    await client.truvernControlProperty.create({
      data: {
        controlId:
          databaseControlId,
        partId:
          databasePartId,
        name:
          property.name,
        value:
          property.value,
        className:
          property.className,
        namespace:
          property.namespace,
        uuid:
          property.uuid,
        sortOrder:
          property.sortOrder,
        metadata:
          toPrismaJson(property.metadata),
      },
    });
  }

  for (const link of links) {
    if (
      link.controlId !==
        canonicalControlId ||
      link.partKey === null
    ) {
      continue;
    }

    const databasePartId =
      databasePartIds.get(
        link.partKey,
      );

    if (databasePartId === undefined) {
      throw new Error(
        `Missing persisted part identity: ${link.partKey}`,
      );
    }

    await client.truvernControlLink.create({
      data: {
        controlId:
          databaseControlId,
        partId:
          databasePartId,
        href:
          link.href,
        rel:
          link.rel,
        text:
          link.text,
        mediaType:
          link.mediaType,
        resourceFragment:
          link.resourceFragment,
        sortOrder:
          link.sortOrder,
        metadata:
          toPrismaJson(link.metadata),
      },
    });
  }
}