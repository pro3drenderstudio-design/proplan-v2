/**
 * POST /api/admin/seed-polyhaven-materials-3
 *
 * Adds 38 specific Polyhaven materials to the ProPlan library.
 * Safe to run multiple times — skips any name that already exists.
 *
 * Usage:
 *   Invoke-WebRequest -Method POST -Uri http://localhost:3000/api/admin/seed-polyhaven-materials-3
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const PH = "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k";

function diff(id: string)  { return `${PH}/${id}/${id}_diff_2k.jpg`; }
function nor(id: string)   { return `${PH}/${id}/${id}_nor_gl_2k.jpg`; }
function rough(id: string) { return `${PH}/${id}/${id}_rough_2k.jpg`; }
function ao(id: string)    { return `${PH}/${id}/${id}_ao_2k.jpg`; }

const MATERIALS = [

  // ══════════════════════════════════════════════════════════════════
  //  CONCRETE / WALLS
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Concrete Wall 008",
    category: "Walls",
    base_color: "#8c8c84",
    roughness: 0.88,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("concrete_wall_008"), normalMapUrl: nor("concrete_wall_008"),
      roughnessMapUrl: rough("concrete_wall_008"), aoMapUrl: ao("concrete_wall_008"),
      normalScale: 0.5, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Rough Concrete",
    category: "Walls",
    base_color: "#909088",
    roughness: 0.93,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("rough_concrete"), normalMapUrl: nor("rough_concrete"),
      roughnessMapUrl: rough("rough_concrete"), aoMapUrl: ao("rough_concrete"),
      normalScale: 0.65, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Granular Concrete",
    category: "Walls",
    base_color: "#989890",
    roughness: 0.9,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("granular_concrete"), normalMapUrl: nor("granular_concrete"),
      roughnessMapUrl: rough("granular_concrete"), aoMapUrl: ao("granular_concrete"),
      normalScale: 0.55, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Gravel Concrete",
    category: "Exterior",
    base_color: "#9a9890",
    roughness: 0.92,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("gravel_concrete"), normalMapUrl: nor("gravel_concrete"),
      roughnessMapUrl: rough("gravel_concrete"), aoMapUrl: ao("gravel_concrete"),
      normalScale: 0.7, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Garage Floor",
    category: "Flooring",
    base_color: "#888880",
    roughness: 0.78,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("garage_floor"), normalMapUrl: nor("garage_floor"),
      roughnessMapUrl: rough("garage_floor"), aoMapUrl: ao("garage_floor"),
      normalScale: 0.5, uvRepeatX: 3, uvRepeatY: 3,
    },
  },
  {
    name: "Macro Flour",
    category: "Walls",
    base_color: "#e8e4dc",
    roughness: 0.82,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("macro_flour"), normalMapUrl: nor("macro_flour"),
      roughnessMapUrl: rough("macro_flour"), aoMapUrl: ao("macro_flour"),
      normalScale: 0.4, uvRepeatX: 2, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  BRICK
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Brick Wall 13",
    category: "Walls",
    base_color: "#a86050",
    roughness: 0.93,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("brick_wall_13"), normalMapUrl: nor("brick_wall_13"),
      roughnessMapUrl: rough("brick_wall_13"), aoMapUrl: ao("brick_wall_13"),
      normalScale: 1.0, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Brick Wall 10",
    category: "Walls",
    base_color: "#a05848",
    roughness: 0.92,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("brick_wall_10"), normalMapUrl: nor("brick_wall_10"),
      roughnessMapUrl: rough("brick_wall_10"), aoMapUrl: ao("brick_wall_10"),
      normalScale: 1.0, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Brick Wall 02",
    category: "Walls",
    base_color: "#a86858",
    roughness: 0.91,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("brick_wall_02"), normalMapUrl: nor("brick_wall_02"),
      roughnessMapUrl: rough("brick_wall_02"), aoMapUrl: ao("brick_wall_02"),
      normalScale: 0.95, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Brick Wall 005",
    category: "Walls",
    base_color: "#b07060",
    roughness: 0.92,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("brick_wall_005"), normalMapUrl: nor("brick_wall_005"),
      roughnessMapUrl: rough("brick_wall_005"), aoMapUrl: ao("brick_wall_005"),
      normalScale: 1.0, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Brick Wall 001",
    category: "Walls",
    base_color: "#9a5848",
    roughness: 0.93,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("brick_wall_001"), normalMapUrl: nor("brick_wall_001"),
      roughnessMapUrl: rough("brick_wall_001"), aoMapUrl: ao("brick_wall_001"),
      normalScale: 1.0, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Stone Brick Wall 001",
    category: "Walls",
    base_color: "#9a9080",
    roughness: 0.92,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("stone_brick_wall_001"), normalMapUrl: nor("stone_brick_wall_001"),
      roughnessMapUrl: rough("stone_brick_wall_001"), aoMapUrl: ao("stone_brick_wall_001"),
      normalScale: 1.0, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Worn Brick Floor",
    category: "Flooring",
    base_color: "#a07060",
    roughness: 0.9,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("worn_brick_floor"), normalMapUrl: nor("worn_brick_floor"),
      roughnessMapUrl: rough("worn_brick_floor"), aoMapUrl: ao("worn_brick_floor"),
      normalScale: 0.85, uvRepeatX: 2, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  MARBLE / STONE
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Marble 01",
    category: "Countertops",
    base_color: "#f0ece4",
    roughness: 0.06,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("marble_01"), normalMapUrl: nor("marble_01"),
      roughnessMapUrl: rough("marble_01"), aoMapUrl: ao("marble_01"),
      normalScale: 0.2, clearcoat: 0.9, clearcoatRoughness: 0.04,
      uvRepeatX: 1, uvRepeatY: 1,
    },
  },
  {
    name: "Rock Wall 11",
    category: "Walls",
    base_color: "#7a7870",
    roughness: 0.94,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("rock_wall_11"), normalMapUrl: nor("rock_wall_11"),
      roughnessMapUrl: rough("rock_wall_11"), aoMapUrl: ao("rock_wall_11"),
      normalScale: 1.1, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Stone Wall 05",
    category: "Walls",
    base_color: "#808078",
    roughness: 0.93,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("stone_wall_05"), normalMapUrl: nor("stone_wall_05"),
      roughnessMapUrl: rough("stone_wall_05"), aoMapUrl: ao("stone_wall_05"),
      normalScale: 1.05, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Monastery Stone Floor",
    category: "Flooring",
    base_color: "#8a8478",
    roughness: 0.88,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("monastery_stone_floor"), normalMapUrl: nor("monastery_stone_floor"),
      roughnessMapUrl: rough("monastery_stone_floor"), aoMapUrl: ao("monastery_stone_floor"),
      normalScale: 0.8, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Seaworn Stone Tiles",
    category: "Flooring",
    base_color: "#9a9488",
    roughness: 0.85,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("seaworn_stone_tiles"), normalMapUrl: nor("seaworn_stone_tiles"),
      roughnessMapUrl: rough("seaworn_stone_tiles"), aoMapUrl: ao("seaworn_stone_tiles"),
      normalScale: 0.75, uvRepeatX: 2, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  PLASTER / WALL FINISHES
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Plastered Wall 02",
    category: "Walls",
    base_color: "#d8d2c8",
    roughness: 0.82,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("plastered_wall_02"), normalMapUrl: nor("plastered_wall_02"),
      roughnessMapUrl: rough("plastered_wall_02"), aoMapUrl: ao("plastered_wall_02"),
      normalScale: 0.45, uvRepeatX: 2, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  METAL / SHUTTER
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Worn Shutter",
    category: "Walls",
    base_color: "#788090",
    roughness: 0.65,
    metalness: 0.5,
    properties: {
      albedoMapUrl: diff("worn_shutter"), normalMapUrl: nor("worn_shutter"),
      roughnessMapUrl: rough("worn_shutter"), aoMapUrl: ao("worn_shutter"),
      normalScale: 0.6, uvRepeatX: 1, uvRepeatY: 2,
    },
  },
  {
    name: "Rusty Metal Shutter",
    category: "Walls",
    base_color: "#8a5038",
    roughness: 0.78,
    metalness: 0.6,
    properties: {
      albedoMapUrl: diff("rusty_metal_shutter"), normalMapUrl: nor("rusty_metal_shutter"),
      roughnessMapUrl: rough("rusty_metal_shutter"), aoMapUrl: ao("rusty_metal_shutter"),
      normalScale: 0.7, uvRepeatX: 1, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  WOOD
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Wood Planks Grey",
    category: "Exterior",
    base_color: "#9a9898",
    roughness: 0.88,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("wood_planks_grey"), normalMapUrl: nor("wood_planks_grey"),
      roughnessMapUrl: rough("wood_planks_grey"), aoMapUrl: ao("wood_planks_grey"),
      normalScale: 0.6, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Wood Planks Dirt",
    category: "Exterior",
    base_color: "#7a6248",
    roughness: 0.9,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("wood_planks_dirt"), normalMapUrl: nor("wood_planks_dirt"),
      roughnessMapUrl: rough("wood_planks_dirt"), aoMapUrl: ao("wood_planks_dirt"),
      normalScale: 0.7, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Plank Flooring 03",
    category: "Flooring",
    base_color: "#c49868",
    roughness: 0.5,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("plank_flooring_03"), normalMapUrl: nor("plank_flooring_03"),
      roughnessMapUrl: rough("plank_flooring_03"), aoMapUrl: ao("plank_flooring_03"),
      normalScale: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.28,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  PAVEMENT / PAVING
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Pavement 02",
    category: "Exterior",
    base_color: "#9e9e96",
    roughness: 0.9,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("pavement_02"), normalMapUrl: nor("pavement_02"),
      roughnessMapUrl: rough("pavement_02"), aoMapUrl: ao("pavement_02"),
      normalScale: 0.65, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Pavement 03",
    category: "Exterior",
    base_color: "#9c9c94",
    roughness: 0.91,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("pavement_03"), normalMapUrl: nor("pavement_03"),
      roughnessMapUrl: rough("pavement_03"), aoMapUrl: ao("pavement_03"),
      normalScale: 0.65, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Pavement 04",
    category: "Exterior",
    base_color: "#a0a098",
    roughness: 0.9,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("pavement_04"), normalMapUrl: nor("pavement_04"),
      roughnessMapUrl: rough("pavement_04"), aoMapUrl: ao("pavement_04"),
      normalScale: 0.6, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Pavement 06",
    category: "Exterior",
    base_color: "#a2a09a",
    roughness: 0.89,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("pavement_06"), normalMapUrl: nor("pavement_06"),
      roughnessMapUrl: rough("pavement_06"), aoMapUrl: ao("pavement_06"),
      normalScale: 0.6, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Rectangular Paving",
    category: "Exterior",
    base_color: "#9c9a92",
    roughness: 0.9,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("rectangular_paving"), normalMapUrl: nor("rectangular_paving"),
      roughnessMapUrl: rough("rectangular_paving"), aoMapUrl: ao("rectangular_paving"),
      normalScale: 0.7, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Patterned Paving 02",
    category: "Exterior",
    base_color: "#9a9888",
    roughness: 0.9,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("patterned_paving_02"), normalMapUrl: nor("patterned_paving_02"),
      roughnessMapUrl: rough("patterned_paving_02"), aoMapUrl: ao("patterned_paving_02"),
      normalScale: 0.75, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Herringbone Pavement",
    category: "Exterior",
    base_color: "#9a9890",
    roughness: 0.9,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("herringbone_pavement"), normalMapUrl: nor("herringbone_pavement"),
      roughnessMapUrl: rough("herringbone_pavement"), aoMapUrl: ao("herringbone_pavement"),
      normalScale: 0.7, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Herringbone Pavement 03",
    category: "Exterior",
    base_color: "#9c9a90",
    roughness: 0.9,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("herringbone_pavement_03"), normalMapUrl: nor("herringbone_pavement_03"),
      roughnessMapUrl: rough("herringbone_pavement_03"), aoMapUrl: ao("herringbone_pavement_03"),
      normalScale: 0.7, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Concrete Pavement 02",
    category: "Exterior",
    base_color: "#9e9e96",
    roughness: 0.91,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("concrete_pavement_02"), normalMapUrl: nor("concrete_pavement_02"),
      roughnessMapUrl: rough("concrete_pavement_02"), aoMapUrl: ao("concrete_pavement_02"),
      normalScale: 0.55, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Asphalt 01",
    category: "Exterior",
    base_color: "#2e2e2c",
    roughness: 0.96,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("asphalt_01"), normalMapUrl: nor("asphalt_01"),
      roughnessMapUrl: rough("asphalt_01"), aoMapUrl: ao("asphalt_01"),
      normalScale: 0.55, uvRepeatX: 3, uvRepeatY: 3,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  TILES
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Tiled Floor 001",
    category: "Flooring",
    base_color: "#c8c4bc",
    roughness: 0.22,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("tiled_floor_001"), normalMapUrl: nor("tiled_floor_001"),
      roughnessMapUrl: rough("tiled_floor_001"), aoMapUrl: ao("tiled_floor_001"),
      normalScale: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.08,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Patio Tiles",
    category: "Exterior",
    base_color: "#c0b8a8",
    roughness: 0.75,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("patio_tiles"), normalMapUrl: nor("patio_tiles"),
      roughnessMapUrl: rough("patio_tiles"), aoMapUrl: ao("patio_tiles"),
      normalScale: 0.6, uvRepeatX: 2, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  SAND / GROUND
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Coast Sand 01",
    category: "Sand",
    base_color: "#c8b888",
    roughness: 0.93,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("coast_sand_01"), normalMapUrl: nor("coast_sand_01"),
      roughnessMapUrl: rough("coast_sand_01"), aoMapUrl: ao("coast_sand_01"),
      normalScale: 0.4, uvScaleX: 4, uvScaleY: 4, uvScaleZ: 4,
      projection: "triplanar",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  ROOFING
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Roof Slates 03",
    category: "Roofing",
    base_color: "#484848",
    roughness: 0.85,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("roof_slates_03"), normalMapUrl: nor("roof_slates_03"),
      roughnessMapUrl: rough("roof_slates_03"), aoMapUrl: ao("roof_slates_03"),
      normalScale: 0.8, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
];

export async function POST() {
  const supabase = db();

  const { data: existing, error: fetchErr } = await supabase
    .from("material_library")
    .select("name");

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  const existingNames = new Set((existing ?? []).map((r: { name: string }) => r.name));
  const toInsert = MATERIALS.filter(m => !existingNames.has(m.name));

  if (toInsert.length === 0) {
    return NextResponse.json({ message: "All materials already exist.", inserted: 0, skipped: MATERIALS.length });
  }

  const { error: insertErr } = await supabase.from("material_library").insert(toInsert);
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({
    message: `Seeded ${toInsert.length} Polyhaven materials.`,
    inserted: toInsert.length,
    skipped: MATERIALS.length - toInsert.length,
  });
}
