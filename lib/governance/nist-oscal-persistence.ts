import type {
  NistOscalImportProjection,
  OscalImportControl,
  OscalImportLink,
  OscalImportParameter,
  OscalImportPart,
  OscalImportProperty,
} from "./nist-oscal-import";

export const NIST_OSCAL_PERSISTENCE_SCHEMA =
  "TRV-NIST-OSCAL-PERSISTENCE-1.0" as const;

export type NistOscalFrameworkRecord = {
  slug: string;
  name: string;
  description: string | null;
  version: string | null;
  metadata: Record<string, unknown>;
};

export type NistOscalControlRecord = {
  controlId: string;
  parentControlId: string | null;
  family: string | null;
  title: string;
  sortOrder: number;
  metadata: Record<string, unknown>;
};

export type NistOscalParameterRecord = {
  controlId: string;
  oscalId: string;
  label: string | null;
  usage: string | null;
  props: unknown[];
  guidelines: unknown[];
  constraints: unknown[];
  selection: unknown;
  values: unknown[];
  remarks: string | null;
  sortOrder: number;
  metadata: Record<string, unknown>;
};

export type NistOscalPartRecord = {
  key: string;
  controlId: string;
  parentKey: string | null;
  oscalId: string | null;
  name: string;
  namespace: string | null;
  prose: string | null;
  props: unknown[];
  links: unknown[];
  sortOrder: number;
  metadata: Record<string, unknown>;
};

export type NistOscalPropertyRecord = {
  controlId: string;
  partKey: string | null;
  name: string;
  value: string | null;
  className: string | null;
  namespace: string | null;
  uuid: string | null;
  sortOrder: number;
  metadata: Record<string, unknown>;
};

export type NistOscalLinkRecord = {
  controlId: string;
  partKey: string | null;
  href: string;
  rel: string | null;
  text: string | null;
  mediaType: string | null;
  resourceFragment: string | null;
  sortOrder: number;
  metadata: Record<string, unknown>;
};

export type NistOscalPersistenceProjection = {
  schema: typeof NIST_OSCAL_PERSISTENCE_SCHEMA;
  sourceSchema: string;
  catalogUuid: string | null;
  catalogVersion: string | null;
  framework: NistOscalFrameworkRecord;
  controls: NistOscalControlRecord[];
  parameters: NistOscalParameterRecord[];
  parts: NistOscalPartRecord[];
  properties: NistOscalPropertyRecord[];
  links: NistOscalLinkRecord[];
};

function metadata(
  value: Record<string, unknown>
): Record<string, unknown> {
  return value;
}

function partKey(
  controlId: string,
  ancestry: number[]
): string {
  return (
    controlId +
    ":part:" +
    ancestry.join(".")
  );
}

function mapProperty(
  controlId: string,
  partKeyValue: string | null,
  property: OscalImportProperty,
  sortOrder: number
): NistOscalPropertyRecord {
  return {
    controlId,
    partKey: partKeyValue,
    name: property.name,
    value: property.value,
    className: property.className,
    namespace: property.namespace,
    uuid: property.uuid,
    sortOrder,
    metadata: metadata({
      source: "NIST_OSCAL",
    }),
  };
}

function mapLink(
  controlId: string,
  partKeyValue: string | null,
  link: OscalImportLink,
  sortOrder: number
): NistOscalLinkRecord {
  return {
    controlId,
    partKey: partKeyValue,
    href: link.href,
    rel: link.rel,
    text: link.text,
    mediaType: link.mediaType,
    resourceFragment:
      link.resourceFragment,
    sortOrder,
    metadata: metadata({
      source: "NIST_OSCAL",
    }),
  };
}

function mapParameter(
  controlId: string,
  parameter: OscalImportParameter,
  sortOrder: number
): NistOscalParameterRecord {
  return {
    controlId,
    oscalId: parameter.oscalId,
    label: parameter.label,
    usage: parameter.usage,
    props: parameter.props,
    guidelines: parameter.guidelines,
    constraints: parameter.constraints,
    selection: parameter.selection,
    values: parameter.values,
    remarks: parameter.remarks,
    sortOrder,
    metadata: metadata({
      source: "NIST_OSCAL",
    }),
  };
}

function appendPart(
  controlId: string,
  part: OscalImportPart,
  ancestry: number[],
  parentKey: string | null,
  parts: NistOscalPartRecord[],
  properties: NistOscalPropertyRecord[],
  links: NistOscalLinkRecord[]
): void {
  const key =
    partKey(
      controlId,
      ancestry
    );

  const sortOrder =
    ancestry[ancestry.length - 1] ?? 0;

  parts.push({
    key,
    controlId,
    parentKey,
    oscalId: part.oscalId,
    name: part.name,
    namespace: part.namespace,
    prose: part.prose,
    props: part.props,
    links: part.links,
    sortOrder,
    metadata: metadata({
      source: "NIST_OSCAL",
      depth: ancestry.length - 1,
    }),
  });

  part.properties.forEach(
    (property, index) => {
      properties.push(
        mapProperty(
          controlId,
          key,
          property,
          index
        )
      );
    }
  );

  part.semanticLinks.forEach(
    (link, index) => {
      links.push(
        mapLink(
          controlId,
          key,
          link,
          index
        )
      );
    }
  );

  part.childParts.forEach(
    (child, index) => {
      appendPart(
        controlId,
        child,
        [...ancestry, index],
        key,
        parts,
        properties,
        links
      );
    }
  );
}

function appendControl(
  control: OscalImportControl,
  parentControlId: string | null,
  controls: NistOscalControlRecord[],
  parameters: NistOscalParameterRecord[],
  parts: NistOscalPartRecord[],
  properties: NistOscalPropertyRecord[],
  links: NistOscalLinkRecord[],
  sortOrder: number
): void {
  controls.push({
    controlId: control.controlId,
    parentControlId,
    family: control.family,
    title: control.title,
    sortOrder,
    metadata: metadata({
      source: "NIST_OSCAL",
      oscalId: control.oscalId,
    }),
  });

  control.parameters.forEach(
    (parameter, index) => {
      parameters.push(
        mapParameter(
          control.controlId,
          parameter,
          index
        )
      );
    }
  );

  control.properties.forEach(
    (property, index) => {
      properties.push(
        mapProperty(
          control.controlId,
          null,
          property,
          index
        )
      );
    }
  );

  control.links.forEach(
    (link, index) => {
      links.push(
        mapLink(
          control.controlId,
          null,
          link,
          index
        )
      );
    }
  );

  control.parts.forEach(
    (part, index) => {
      appendPart(
        control.controlId,
        part,
        [index],
        null,
        parts,
        properties,
        links
      );
    }
  );

  control.childControls.forEach(
    (child, index) => {
      appendControl(
        child,
        control.controlId,
        controls,
        parameters,
        parts,
        properties,
        links,
        index
      );
    }
  );
}

export function buildNistOscalPersistenceProjection(
  source: NistOscalImportProjection
): NistOscalPersistenceProjection {
  const controls:
    NistOscalControlRecord[] = [];

  const parameters:
    NistOscalParameterRecord[] = [];

  const parts:
    NistOscalPartRecord[] = [];

  const properties:
    NistOscalPropertyRecord[] = [];

  const links:
    NistOscalLinkRecord[] = [];

  source.controls.forEach(
    (control, index) => {
      appendControl(
        control,
        null,
        controls,
        parameters,
        parts,
        properties,
        links,
        index
      );
    }
  );

  return {
    schema:
      NIST_OSCAL_PERSISTENCE_SCHEMA,

    sourceSchema:
      source.schema,

    catalogUuid:
      source.catalogUuid,

    catalogVersion:
      source.catalogVersion,

    framework: {
      slug:
        "nist-sp-800-53-rev5",

      name:
        "NIST SP 800-53 Rev. 5",

      description:
        source.catalogTitle,

      version:
        source.catalogVersion,

      metadata: metadata({
        source: "NIST_OSCAL",
        catalogUuid:
          source.catalogUuid,
        sourceSchema:
          source.schema,
      }),
    },

    controls,
    parameters,
    parts,
    properties,
    links,
  };
}