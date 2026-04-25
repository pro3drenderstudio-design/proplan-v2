export type PhaseId = "blueprint" | "interior" | "exterior";
export interface Phase {
  id: PhaseId;
  label: string;
  description: string;
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
  };
}

export const PHASES: Phase[] = [
  {
    id: "exterior",
    label: "Exterior",
    description: "Outside view of the home facade, roofing, and landscaping.",
    camera: {
      position: [10, 5, 15],
      target: [0, 2, 0],
      fov: 65,
    },
  },
  {
    id: "interior",
    label: "Interior",
    description: "Zoomed-in perspective for materials, finishes, and furnishings.",
    camera: {
      position: [0, 2, 5],
      target: [0, 1, 0],
      fov: 75,
    },
  },
];

export const DEFAULT_PHASE: PhaseId = "exterior";
