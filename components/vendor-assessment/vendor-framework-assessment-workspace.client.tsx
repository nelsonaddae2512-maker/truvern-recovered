"use client";

import {
  useMemo,
  useState,
} from "react";
import VendorFrameworkInteractionCard, {
  type VendorFrameworkResponse,
  type VendorInteractionDefinition,
} from "./vendor-framework-interaction-card.client";

type Props = {
  assessmentId: number;
  initialStatus: string;
  responses: VendorFrameworkResponse[];
  token: string;
  profileId: string;
  profileVersion: string;
  interactions: VendorInteractionDefinition[];
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function hasAnswer(value: unknown) {
  if (
    value === null ||
    value === undefined
  ) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return true;
}

function initialComponentComplete(
  response: VendorFrameworkResponse,
) {
  const metadata =
    isRecord(response.metadata)
      ? response.metadata
      : null;

  const rawProjection =
    metadata &&
    isRecord(
      metadata.truvernQuestionnaireProjection,
    )
      ? metadata.truvernQuestionnaireProjection
      : null;

  if (!rawProjection) {
    return hasAnswer(response.answer);
  }

  const applicability =
    rawProjection.applicability;

  if (
    applicability ===
    "UNRESOLVED"
  ) {
    return false;
  }

  if (
    applicability ===
    "NOT_APPLICABLE"
  ) {
    return (
      typeof rawProjection
        .notApplicableJustification ===
        "string" &&
      rawProjection
        .notApplicableJustification
        .trim()
        .length > 0
    );
  }

  return hasAnswer(response.answer);
}

export default function VendorFrameworkAssessmentWorkspace({
  assessmentId,
  initialStatus,
  responses,
  token,
  profileId,
  profileVersion,
  interactions,
}: Props) {
  const responsesByQuestionId =
    useMemo(() => {
      const map:
        Record<
          number,
          VendorFrameworkResponse
        > = {};

      for (const response of responses) {
        map[response.questionId] =
          response;
      }

      return map;
    }, [responses]);

  const initialCompletion =
    useMemo(() => {
      const map =
        new Map<number, boolean>();

      for (const response of responses) {
        map.set(
          response.id,
          initialComponentComplete(
            response,
          ),
        );
      }

      return map;
    }, [responses]);

  const [
    componentCompletion,
    setComponentCompletion,
  ] =
    useState<Map<number, boolean>>(
      () => initialCompletion,
    );

  const [status] =
    useState(initialStatus);

  function handleComponentSaved(
    responseId: number,
    complete: boolean,
  ) {
    setComponentCompletion(
      (current) => {
        const next =
          new Map(current);

        next.set(
          responseId,
          complete,
        );

        return next;
      },
    );
  }

  const completedInteractions =
    interactions.filter(
      (interaction) =>
        interaction.components.every(
          (component) => {
            const response =
              responsesByQuestionId[
                component
                  .canonicalQuestionId
              ];

            return (
              response !== undefined &&
              componentCompletion.get(
                response.id,
              ) === true
            );
          },
        ),
    ).length;

  const completedComponents =
    Array.from(
      componentCompletion.values(),
    ).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Status
            </div>

            <div className="mt-1 font-semibold">
              {status}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Vendor progress
            </div>

            <div className="mt-1 font-semibold">
              {completedInteractions} /{" "}
              {interactions.length} interactions
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Canonical coverage
            </div>

            <div className="mt-1 font-semibold">
              {completedComponents} /{" "}
              {responses.length} controls
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-400">
          The questionnaire is organized into
          {` ${interactions.length} `}
          vendor interactions while preserving
          independent canonical control responses
          for governance review.
        </p>
      </section>

      <section className="space-y-5">
        {interactions.map(
          (interaction) => (
            <VendorFrameworkInteractionCard
              key={
                interaction.interactionId
              }
              assessmentId={
                assessmentId
              }
              token={token}
              profileId={profileId}
              profileVersion={
                profileVersion
              }
              interaction={
                interaction
              }
              responsesByQuestionId={
                responsesByQuestionId
              }
              onComponentSaved={
                handleComponentSaved
              }
            />
          ),
        )}
      </section>
    </div>
  );
}