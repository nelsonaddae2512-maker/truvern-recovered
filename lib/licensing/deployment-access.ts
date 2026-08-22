import "server-only";

import {
  DeploymentLicenseError,
  requireValidDeploymentLicense,
  type DeploymentLicenseResolution,
} from "@/lib/licensing/deployment-license";

export type DeploymentAccessResolution =
  DeploymentLicenseResolution;

export async function requireDeploymentAccess():
  Promise<DeploymentAccessResolution> {
  return requireValidDeploymentLicense();
}

export function isDeploymentLicenseError(
  error: unknown,
): error is DeploymentLicenseError {
  return error instanceof DeploymentLicenseError;
}