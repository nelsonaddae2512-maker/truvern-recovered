export async function persistTransparencyChainCheckpoint() {
  return {
    checkpointSkipped: true,
    reason: "Legacy checkpoint schema disabled",
  };
}
