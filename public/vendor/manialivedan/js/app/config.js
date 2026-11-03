// Site adapter; upstream UI/OBS settings are intentionally not bundled.
export const APP = Object.freeze({
  segmentationEnabled: true, segmentCurveWindowMs: 1200,
  segmentCurveLookaheadMs: 0, segmentMergeLnDelta: 0.35,
  segmentMergeDelta: 0.35, segmentMinMs: 4000, segmentMaxMs: 32000,
  extendedRange: true,
});
