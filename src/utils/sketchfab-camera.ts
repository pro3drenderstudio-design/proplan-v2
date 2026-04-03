import { PhaseId, PHASES } from "@/constants/phases";

export const TRANSITION_DURATION = 2; // seconds

export interface SketchfabCameraApi {
  setCameraLookAt: (
    position: [number, number, number],
    target: [number, number, number],
    duration: number,
    cb?: (err: unknown) => void
  ) => void;
  setFov: (fov: number, cb?: (err: unknown) => void) => void;
  getScreenShot: (
    width: number,
    height: number,
    cb: (err: unknown, result: string) => void
  ) => void;
}

/**
 * Explicit camera coordinates — used to override the phase default
 * (e.g. a category-level close-up view).
 */
export interface CameraCoords {
  pos: number[];
  target: number[];
  fov?: number;
}

/**
 * Moves the Sketchfab camera.
 *
 * Priority:
 *   1. override  — explicit CameraCoords passed by the caller
 *   2. phase default — coordinates from the PHASES constant
 *
 * Blueprint: camera is pinned directly above the target (top-down view)
 * by setting position Y from the phase default and zeroing X/Z to match
 * the target. User rotation is not locked here because setCameraConstraints
 * is not supported in Sketchfab Viewer API v1.12.1.
 */
export function setPhaseCamera(
  api: SketchfabCameraApi,
  phaseId: PhaseId,
  override?: CameraCoords
): void {
  const phase = PHASES.find((p) => p.id === phaseId);
  if (!phase) {
    console.warn(`setPhaseCamera: unknown phase "${phaseId}"`);
    return;
  }

  const position = (override?.pos ?? phase.camera.position) as [number, number, number];
  const target   = (override?.target ?? phase.camera.target) as [number, number, number];
  const fov      = override?.fov ?? phase.camera.fov;

  // Blueprint default: force camera directly overhead (top-down) when using
  // the hardcoded constant. If a saved DB camera is provided, use it as-is.
  const finalPosition: [number, number, number] =
    phaseId === "blueprint" && !override
      ? [target[0], position[1], target[2]]
      : position;

  api.setCameraLookAt(finalPosition, target, TRANSITION_DURATION, (err) => {
    if (err) console.error("setPhaseCamera: setCameraLookAt failed", err);
  });

  api.setFov(fov, (err) => {
    if (err) console.error("setPhaseCamera: setFov failed", err);
  });
}
