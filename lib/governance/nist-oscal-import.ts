export const NIST_OSCAL_IMPORT_SCHEMA =
  "TRV-NIST-OSCAL-IMPORT-1.0" as const;

export type JsonObject =
  Record<string, any>;

export type OscalImportProperty = {
  name: string;
  value: string | null;
  className: string | null;
  namespace: string | null;
  uuid: string | null;
  sortOrder: number;
  metadata: JsonObject | null;
};

export type OscalImportLink = {
  href: string;
  rel: string | null;
  text: string | null;
  mediaType: string | null;
  resourceFragment: string | null;
  sortOrder: number;
  metadata: JsonObject | null;
};

export type OscalImportPart = {
  oscalId: string | null;
  name: string;
  namespace: string | null;
  prose: string | null;
  sortOrder: number;
  props: JsonObject[];
  links: JsonObject[];
  properties: OscalImportProperty[];
  semanticLinks: OscalImportLink[];
  childParts: OscalImportPart[];
};

export type OscalImportParameter = {
  oscalId: string;
  label: string | null;
  usage: string | null;
  props: JsonObject[];
  guidelines: JsonObject[];
  constraints: JsonObject[];
  selection: JsonObject | null;
  values: string[];
  remarks: string | null;
  sortOrder: number;
  metadata: JsonObject | null;
};

export type OscalImportControl = {
  oscalId: string;
  controlId: string;
  family: string | null;
  title: string;
  parentControlId: string | null;
  sortOrder: number;
  parameters: OscalImportParameter[];
  parts: OscalImportPart[];
  properties: OscalImportProperty[];
  links: OscalImportLink[];
  childControls: OscalImportControl[];
  metadata: JsonObject;
};

export type NistOscalImportProjection = {
  schema: typeof NIST_OSCAL_IMPORT_SCHEMA;
  catalogUuid: string | null;
  catalogVersion: string | null;
  catalogTitle: string | null;
  controls: OscalImportControl[];
};

function asArray<T = any>(
  value: T[] | null | undefined
): T[] {
  return Array.isArray(value)
    ? value
    : [];
}

function asString(
  value: unknown
): string | null {
  return typeof value === "string"
    ? value
    : null;
}

function normalizeControlId(
  value: string
): string {
  const normalized =
    value
      .trim()
      .toUpperCase();

  const baseMatch =
    normalized.match(
      /^([A-Z]{2})-0*(\d+)$/
    );

  if (baseMatch) {
    return (
      `${baseMatch[1]}-${Number(baseMatch[2])}`
    );
  }

  const parenthesizedEnhancementMatch =
    normalized.match(
      /^([A-Z]{2})-0*(\d+)\s*\(\s*0*(\d+)\s*\)$/
    );

  if (parenthesizedEnhancementMatch) {
    return (
      `${parenthesizedEnhancementMatch[1]}-` +
      `${Number(parenthesizedEnhancementMatch[2])}` +
      `(${Number(parenthesizedEnhancementMatch[3])})`
    );
  }

  const dottedEnhancementMatch =
    normalized.match(
      /^([A-Z]{2})-0*(\d+)\.0*(\d+)$/
    );

  if (dottedEnhancementMatch) {
    return (
      `${dottedEnhancementMatch[1]}-` +
      `${Number(dottedEnhancementMatch[2])}` +
      `(${Number(dottedEnhancementMatch[3])})`
    );
  }

  return normalized;
}

function propertyProjection(
  prop: JsonObject,
  sortOrder: number
): OscalImportProperty {
  return {
    name:
      asString(prop?.name) ??
      "unknown",
    value:
      asString(prop?.value),
    className:
      asString(prop?.class),
    namespace:
      asString(prop?.ns),
    uuid:
      asString(prop?.uuid),
    sortOrder,
    metadata: null,
  };
}

function linkProjection(
  link: JsonObject,
  sortOrder: number
): OscalImportLink {
  const href =
    asString(link?.href) ??
    "";

  const hashIndex =
    href.indexOf("#");

  return {
    href,
    rel:
      asString(link?.rel),
    text:
      asString(link?.text),
    mediaType:
      asString(link?.["media-type"]),
    resourceFragment:
      hashIndex >= 0
        ? href.slice(hashIndex + 1) || null
        : null,
    sortOrder,
    metadata: null,
  };
}

function proseFromPart(
  part: JsonObject
): string | null {
  const prose =
    asString(part?.prose);

  if (prose) {
    return prose;
  }

  const paragraphs =
    asArray<JsonObject>(
      part?.p
    )
      .map((entry) =>
        typeof entry === "string"
          ? entry
          : asString(entry?.prose)
      )
      .filter(
        (entry): entry is string =>
          Boolean(entry)
      );

  return paragraphs.length > 0
    ? paragraphs.join("\n\n")
    : null;
}

function partProjection(
  part: JsonObject,
  sortOrder: number
): OscalImportPart {
  const props =
    asArray<JsonObject>(
      part?.props
    );

  const links =
    asArray<JsonObject>(
      part?.links
    );

  return {
    oscalId:
      asString(part?.id),
    name:
      asString(part?.name) ??
      "unknown",
    namespace:
      asString(part?.ns),
    prose:
      proseFromPart(part),
    sortOrder,
    props,
    links,
    properties:
      props.map(
        propertyProjection
      ),
    semanticLinks:
      links.map(
        linkProjection
      ),
    childParts:
      asArray<JsonObject>(
        part?.parts
      ).map(
        partProjection
      ),
  };
}

function parameterProjection(
  parameter: JsonObject,
  sortOrder: number
): OscalImportParameter {
  const values =
    asArray<any>(
      parameter?.values
    )
      .map(asString)
      .filter(
        (value): value is string =>
          value !== null
      );

  return {
    oscalId:
      asString(parameter?.id) ??
      `unknown-parameter-${sortOrder}`,
    label:
      asString(parameter?.label),
    usage:
      asString(parameter?.usage),
    props:
      asArray<JsonObject>(
        parameter?.props
      ),
    guidelines:
      asArray<JsonObject>(
        parameter?.guidelines
      ),
    constraints:
      asArray<JsonObject>(
        parameter?.constraints
      ),
    selection:
      parameter?.select &&
      typeof parameter.select === "object"
        ? parameter.select
        : null,
    values,
    remarks:
      asString(parameter?.remarks),
    sortOrder,
    metadata: null,
  };
}

function controlLabel(
  control: JsonObject
): string | null {
  const label =
    asArray<JsonObject>(
      control?.props
    ).find(
      (prop) =>
        prop?.name === "label"
    );

  return asString(
    label?.value
  );
}

function controlTitle(
  control: JsonObject
): string {
  const title =
    asArray<JsonObject>(
      control?.parts
    ).find(
      (part) =>
        part?.name === "title"
    );

  return (
    proseFromPart(title ?? {}) ??
    controlLabel(control) ??
    asString(control?.id) ??
    "Untitled control"
  );
}

function controlProjection(
  control: JsonObject,
  family: string | null,
  parentControlId: string | null,
  sortOrder: number
): OscalImportControl {
  const oscalId =
    asString(control?.id) ??
    `unknown-control-${sortOrder}`;

  const label =
    controlLabel(control) ??
    oscalId;

  const normalizedId =
    normalizeControlId(label);

  const props =
    asArray<JsonObject>(
      control?.props
    );

  const links =
    asArray<JsonObject>(
      control?.links
    );

  return {
    oscalId,
    controlId:
      normalizedId,
    family,
    title:
      controlTitle(control),
    parentControlId,
    sortOrder,
    parameters:
      asArray<JsonObject>(
        control?.params
      ).map(
        parameterProjection
      ),
    parts:
      asArray<JsonObject>(
        control?.parts
      ).map(
        partProjection
      ),
    properties:
      props.map(
        propertyProjection
      ),
    links:
      links.map(
        linkProjection
      ),
    childControls:
      asArray<JsonObject>(
        control?.controls
      ).map(
        (
          child,
          childIndex
        ) =>
          controlProjection(
            child,
            family,
            normalizedId,
            childIndex
          )
      ),
    metadata: {
      oscalId,
      sourceLabel:
        label,
    },
  };
}

export function buildNistOscalImportProjection(
  input: JsonObject
): NistOscalImportProjection {
  const catalog =
    input?.catalog;

  if (
    !catalog ||
    typeof catalog !== "object"
  ) {
    throw new Error(
      "Expected an OSCAL catalog document."
    );
  }

  const controls =
    asArray<JsonObject>(
      catalog.groups
    ).flatMap(
      (
        group,
        groupIndex
      ) => {
        const family =
          asString(group?.id)?.toUpperCase() ??
          null;

        return asArray<JsonObject>(
          group?.controls
        ).map(
          (
            control,
            controlIndex
          ) =>
            controlProjection(
              control,
              family,
              null,
              groupIndex * 1000 +
                controlIndex
            )
        );
      }
    );

  return {
    schema:
      NIST_OSCAL_IMPORT_SCHEMA,
    catalogUuid:
      asString(catalog?.uuid),
    catalogVersion:
      asString(
        catalog?.metadata?.version
      ),
    catalogTitle:
      asString(
        catalog?.metadata?.title
      ),
    controls,
  };
}

export function flattenOscalControls(
  controls: OscalImportControl[]
): OscalImportControl[] {
  const flattened:
    OscalImportControl[] = [];

  const visit = (
    control: OscalImportControl
  ) => {
    flattened.push(control);

    for (
      const child
      of control.childControls
    ) {
      visit(child);
    }
  };

  for (
    const control
    of controls
  ) {
    visit(control);
  }

  return flattened;
}

export function flattenOscalParts(
  parts: OscalImportPart[]
): OscalImportPart[] {
  const flattened:
    OscalImportPart[] = [];

  const visit = (
    part: OscalImportPart
  ) => {
    flattened.push(part);

    for (
      const child
      of part.childParts
    ) {
      visit(child);
    }
  };

  for (
    const part
    of parts
  ) {
    visit(part);
  }

  return flattened;
}
