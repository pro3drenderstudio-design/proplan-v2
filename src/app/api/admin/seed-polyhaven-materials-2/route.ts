/**
 * POST /api/admin/seed-polyhaven-materials-2
 *
 * Adds 45 specific Polyhaven materials to the ProPlan library.
 * Safe to run multiple times — skips any name that already exists.
 *
 * Usage:
 *   Invoke-WebRequest -Method POST -Uri http://localhost:3000/api/admin/seed-polyhaven-materials-2
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
  //  BRICK
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Medieval Red Brick",
    category: "Walls",
    base_color: "#9a4a38",
    roughness: 0.94,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("medieval_red_brick"), normalMapUrl: nor("medieval_red_brick"),
      roughnessMapUrl: rough("medieval_red_brick"), aoMapUrl: ao("medieval_red_brick"),
      normalScale: 1.0, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Pebble Bricks",
    category: "Exterior",
    base_color: "#8a8078",
    roughness: 0.91,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("pebble_bricks"), normalMapUrl: nor("pebble_bricks"),
      roughnessMapUrl: rough("pebble_bricks"), aoMapUrl: ao("pebble_bricks"),
      normalScale: 0.9, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Brick Crosswalk",
    category: "Exterior",
    base_color: "#b07060",
    roughness: 0.92,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("brick_crosswalk"), normalMapUrl: nor("brick_crosswalk"),
      roughnessMapUrl: rough("brick_crosswalk"), aoMapUrl: ao("brick_crosswalk"),
      normalScale: 0.85, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Brick Wall 006",
    category: "Walls",
    base_color: "#a06050",
    roughness: 0.93,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("brick_wall_006"), normalMapUrl: nor("brick_wall_006"),
      roughnessMapUrl: rough("brick_wall_006"), aoMapUrl: ao("brick_wall_006"),
      normalScale: 1.0, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Brick Wall 09",
    category: "Walls",
    base_color: "#986050",
    roughness: 0.92,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("brick_wall_09"), normalMapUrl: nor("brick_wall_09"),
      roughnessMapUrl: rough("brick_wall_09"), aoMapUrl: ao("brick_wall_09"),
      normalScale: 1.0, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Seaworn Sandstone Brick",
    category: "Walls",
    base_color: "#c8a878",
    roughness: 0.88,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("seaworn_sandstone_brick"), normalMapUrl: nor("seaworn_sandstone_brick"),
      roughnessMapUrl: rough("seaworn_sandstone_brick"), aoMapUrl: ao("seaworn_sandstone_brick"),
      normalScale: 0.9, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Red Brick Pavers",
    category: "Exterior",
    base_color: "#a84838",
    roughness: 0.93,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("red_brick_pavers"), normalMapUrl: nor("red_brick_pavers"),
      roughnessMapUrl: rough("red_brick_pavers"), aoMapUrl: ao("red_brick_pavers"),
      normalScale: 0.9, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Patterned Brick Floor",
    category: "Flooring",
    base_color: "#b07868",
    roughness: 0.9,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("patterned_brick_floor"), normalMapUrl: nor("patterned_brick_floor"),
      roughnessMapUrl: rough("patterned_brick_floor"), aoMapUrl: ao("patterned_brick_floor"),
      normalScale: 0.85, uvRepeatX: 2, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  ROOFING
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Clay Roof Tiles 02",
    category: "Roofing",
    base_color: "#b86840",
    roughness: 0.88,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("clay_roof_tiles_02"), normalMapUrl: nor("clay_roof_tiles_02"),
      roughnessMapUrl: rough("clay_roof_tiles_02"), aoMapUrl: ao("clay_roof_tiles_02"),
      normalScale: 0.9, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Corrugated Iron 02",
    category: "Roofing",
    base_color: "#7a8888",
    roughness: 0.55,
    metalness: 0.7,
    properties: {
      albedoMapUrl: diff("corrugated_iron_02"), normalMapUrl: nor("corrugated_iron_02"),
      roughnessMapUrl: rough("corrugated_iron_02"), aoMapUrl: ao("corrugated_iron_02"),
      normalScale: 0.7, uvRepeatX: 2, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  ASPHALT
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Asphalt Track",
    category: "Exterior",
    base_color: "#282828",
    roughness: 0.96,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("asphalt_track"), normalMapUrl: nor("asphalt_track"),
      roughnessMapUrl: rough("asphalt_track"), aoMapUrl: ao("asphalt_track"),
      normalScale: 0.6, uvRepeatX: 3, uvRepeatY: 3,
    },
  },
  {
    name: "Asphalt 04",
    category: "Exterior",
    base_color: "#303030",
    roughness: 0.95,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("asphalt_04"), normalMapUrl: nor("asphalt_04"),
      roughnessMapUrl: rough("asphalt_04"), aoMapUrl: ao("asphalt_04"),
      normalScale: 0.55, uvRepeatX: 3, uvRepeatY: 3,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  WOOD FLOORING / PLANKS
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Laminate Floor 03",
    category: "Flooring",
    base_color: "#b89068",
    roughness: 0.35,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("laminate_floor_03"), normalMapUrl: nor("laminate_floor_03"),
      roughnessMapUrl: rough("laminate_floor_03"), aoMapUrl: ao("laminate_floor_03"),
      normalScale: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.15,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Laminate Floor",
    category: "Flooring",
    base_color: "#a88058",
    roughness: 0.38,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("laminate_floor"), normalMapUrl: nor("laminate_floor"),
      roughnessMapUrl: rough("laminate_floor"), aoMapUrl: ao("laminate_floor"),
      normalScale: 0.3, clearcoat: 0.55, clearcoatRoughness: 0.18,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Herringbone Parquet",
    category: "Flooring",
    base_color: "#c09060",
    roughness: 0.45,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("herringbone_parquet"), normalMapUrl: nor("herringbone_parquet"),
      roughnessMapUrl: rough("herringbone_parquet"), aoMapUrl: ao("herringbone_parquet"),
      normalScale: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.2,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Diagonal Parquet",
    category: "Flooring",
    base_color: "#b88858",
    roughness: 0.48,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("diagonal_parquet"), normalMapUrl: nor("diagonal_parquet"),
      roughnessMapUrl: rough("diagonal_parquet"), aoMapUrl: ao("diagonal_parquet"),
      normalScale: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.2,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Weathered Planks",
    category: "Exterior",
    base_color: "#786050",
    roughness: 0.9,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("weathered_planks"), normalMapUrl: nor("weathered_planks"),
      roughnessMapUrl: rough("weathered_planks"), aoMapUrl: ao("weathered_planks"),
      normalScale: 0.8, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Synthetic Wood",
    category: "Flooring",
    base_color: "#a88060",
    roughness: 0.42,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("synthetic_wood"), normalMapUrl: nor("synthetic_wood"),
      roughnessMapUrl: rough("synthetic_wood"), aoMapUrl: ao("synthetic_wood"),
      normalScale: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.15,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Dark Wooden Planks",
    category: "Flooring",
    base_color: "#4a3828",
    roughness: 0.7,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("dark_wooden_planks"), normalMapUrl: nor("dark_wooden_planks"),
      roughnessMapUrl: rough("dark_wooden_planks"), aoMapUrl: ao("dark_wooden_planks"),
      normalScale: 0.5, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Wooden Planks",
    category: "Flooring",
    base_color: "#b88858",
    roughness: 0.6,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("wooden_planks"), normalMapUrl: nor("wooden_planks"),
      roughnessMapUrl: rough("wooden_planks"), aoMapUrl: ao("wooden_planks"),
      normalScale: 0.45, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Raw Plank Wall",
    category: "Walls",
    base_color: "#9a7858",
    roughness: 0.85,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("raw_plank_wall"), normalMapUrl: nor("raw_plank_wall"),
      roughnessMapUrl: rough("raw_plank_wall"), aoMapUrl: ao("raw_plank_wall"),
      normalScale: 0.7, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Kitchen Wood",
    category: "Flooring",
    base_color: "#c09868",
    roughness: 0.5,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("kitchen_wood"), normalMapUrl: nor("kitchen_wood"),
      roughnessMapUrl: rough("kitchen_wood"), aoMapUrl: ao("kitchen_wood"),
      normalScale: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.25,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  PLASTER / WALL FINISHES
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Plastered Wall",
    category: "Walls",
    base_color: "#d8d0c0",
    roughness: 0.82,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("plastered_wall"), normalMapUrl: nor("plastered_wall"),
      roughnessMapUrl: rough("plastered_wall"), aoMapUrl: ao("plastered_wall"),
      normalScale: 0.45, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Patterned Concrete Wall",
    category: "Walls",
    base_color: "#9a9890",
    roughness: 0.86,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("patterned_concrete_wall"), normalMapUrl: nor("patterned_concrete_wall"),
      roughnessMapUrl: rough("patterned_concrete_wall"), aoMapUrl: ao("patterned_concrete_wall"),
      normalScale: 0.6, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Concrete Wall 007",
    category: "Walls",
    base_color: "#909088",
    roughness: 0.88,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("concrete_wall_007"), normalMapUrl: nor("concrete_wall_007"),
      roughnessMapUrl: rough("concrete_wall_007"), aoMapUrl: ao("concrete_wall_007"),
      normalScale: 0.5, uvRepeatX: 2, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  CONCRETE / STONE FLOORING
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Concrete Tiles 02",
    category: "Flooring",
    base_color: "#a0a098",
    roughness: 0.84,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("concrete_tiles_02"), normalMapUrl: nor("concrete_tiles_02"),
      roughnessMapUrl: rough("concrete_tiles_02"), aoMapUrl: ao("concrete_tiles_02"),
      normalScale: 0.5, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Concrete Pavers 02",
    category: "Exterior",
    base_color: "#9a9890",
    roughness: 0.88,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("concrete_pavers_02"), normalMapUrl: nor("concrete_pavers_02"),
      roughnessMapUrl: rough("concrete_pavers_02"), aoMapUrl: ao("concrete_pavers_02"),
      normalScale: 0.7, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Concrete Pavement",
    category: "Exterior",
    base_color: "#a0a098",
    roughness: 0.9,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("concrete_pavement"), normalMapUrl: nor("concrete_pavement"),
      roughnessMapUrl: rough("concrete_pavement"), aoMapUrl: ao("concrete_pavement"),
      normalScale: 0.55, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Concrete Pavement 03",
    category: "Exterior",
    base_color: "#9e9e96",
    roughness: 0.91,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("concrete_pavement_03"), normalMapUrl: nor("concrete_pavement_03"),
      roughnessMapUrl: rough("concrete_pavement_03"), aoMapUrl: ao("concrete_pavement_03"),
      normalScale: 0.55, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Gravel Embedded Concrete",
    category: "Exterior",
    base_color: "#9a9888",
    roughness: 0.93,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("gravel_embedded_concrete"), normalMapUrl: nor("gravel_embedded_concrete"),
      roughnessMapUrl: rough("gravel_embedded_concrete"), aoMapUrl: ao("gravel_embedded_concrete"),
      normalScale: 0.75, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Pebble Embedded Concrete 02",
    category: "Exterior",
    base_color: "#8a8878",
    roughness: 0.88,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("pebble_embedded_concrete_02"), normalMapUrl: nor("pebble_embedded_concrete_02"),
      roughnessMapUrl: rough("pebble_embedded_concrete_02"), aoMapUrl: ao("pebble_embedded_concrete_02"),
      normalScale: 0.9, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Grey Cartago 03",
    category: "Flooring",
    base_color: "#8a8a88",
    roughness: 0.3,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("grey_cartago_03"), normalMapUrl: nor("grey_cartago_03"),
      roughnessMapUrl: rough("grey_cartago_03"), aoMapUrl: ao("grey_cartago_03"),
      normalScale: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.12,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Long White Tiles",
    category: "Flooring",
    base_color: "#f0eeea",
    roughness: 0.2,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("long_white_tiles"), normalMapUrl: nor("long_white_tiles"),
      roughnessMapUrl: rough("long_white_tiles"), aoMapUrl: ao("long_white_tiles"),
      normalScale: 0.25, clearcoat: 0.65, clearcoatRoughness: 0.08,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Square Tiles 03",
    category: "Flooring",
    base_color: "#d8d0c8",
    roughness: 0.25,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("square_tiles_03"), normalMapUrl: nor("square_tiles_03"),
      roughnessMapUrl: rough("square_tiles_03"), aoMapUrl: ao("square_tiles_03"),
      normalScale: 0.3, clearcoat: 0.55, clearcoatRoughness: 0.1,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Rock Tile Floor",
    category: "Flooring",
    base_color: "#8a8278",
    roughness: 0.82,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("rock_tile_floor"), normalMapUrl: nor("rock_tile_floor"),
      roughnessMapUrl: rough("rock_tile_floor"), aoMapUrl: ao("rock_tile_floor"),
      normalScale: 0.9, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Dirty Tiles",
    category: "Flooring",
    base_color: "#b0a898",
    roughness: 0.72,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("dirty_tiles"), normalMapUrl: nor("dirty_tiles"),
      roughnessMapUrl: rough("dirty_tiles"), aoMapUrl: ao("dirty_tiles"),
      normalScale: 0.5, uvRepeatX: 2, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  STONE WALLS
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Stone Tile Wall",
    category: "Walls",
    base_color: "#8a8278",
    roughness: 0.9,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("stone_tile_wall"), normalMapUrl: nor("stone_tile_wall"),
      roughnessMapUrl: rough("stone_tile_wall"), aoMapUrl: ao("stone_tile_wall"),
      normalScale: 1.0, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Japanese Stone Wall",
    category: "Walls",
    base_color: "#7a7870",
    roughness: 0.92,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("japanese_stone_wall"), normalMapUrl: nor("japanese_stone_wall"),
      roughnessMapUrl: rough("japanese_stone_wall"), aoMapUrl: ao("japanese_stone_wall"),
      normalScale: 1.0, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Stone Wall",
    category: "Walls",
    base_color: "#808078",
    roughness: 0.94,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("stone_wall"), normalMapUrl: nor("stone_wall"),
      roughnessMapUrl: rough("stone_wall"), aoMapUrl: ao("stone_wall"),
      normalScale: 1.1, uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Gravel Concrete 04",
    category: "Exterior",
    base_color: "#989890",
    roughness: 0.92,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("gravel_concrete_04"), normalMapUrl: nor("gravel_concrete_04"),
      roughnessMapUrl: rough("gravel_concrete_04"), aoMapUrl: ao("gravel_concrete_04"),
      normalScale: 0.7, uvRepeatX: 2, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  LINOLEUM
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Linoleum Brown",
    category: "Flooring",
    base_color: "#8a6850",
    roughness: 0.62,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("linoleum_brown"), normalMapUrl: nor("linoleum_brown"),
      roughnessMapUrl: rough("linoleum_brown"), aoMapUrl: ao("linoleum_brown"),
      normalScale: 0.35, uvRepeatX: 3, uvRepeatY: 3,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  NATURE / GROUND
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Brown Mud Leaves",
    category: "Ground",
    base_color: "#5a4430",
    roughness: 0.96,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("brown_mud_leaves_01"), normalMapUrl: nor("brown_mud_leaves_01"),
      roughnessMapUrl: rough("brown_mud_leaves_01"), aoMapUrl: ao("brown_mud_leaves_01"),
      normalScale: 0.7, uvScaleX: 3, uvScaleY: 3, uvScaleZ: 3,
      projection: "triplanar",
    },
  },
  {
    name: "Sparse Grass",
    category: "Grass",
    base_color: "#6a8048",
    roughness: 0.92,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("sparse_grass"), normalMapUrl: nor("sparse_grass"),
      roughnessMapUrl: rough("sparse_grass"), aoMapUrl: ao("sparse_grass"),
      normalScale: 0.6, uvScaleX: 3, uvScaleY: 3, uvScaleZ: 3,
      projection: "triplanar",
    },
  },
  {
    name: "Moon Dusted 01",
    category: "Ground",
    base_color: "#c8c4b8",
    roughness: 0.97,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("moon_dusted_01"), normalMapUrl: nor("moon_dusted_01"),
      roughnessMapUrl: rough("moon_dusted_01"), aoMapUrl: ao("moon_dusted_01"),
      normalScale: 0.5, uvScaleX: 2, uvScaleY: 2, uvScaleZ: 2,
      projection: "triplanar",
    },
  },
  {
    name: "Overgrown Concrete Pavers",
    category: "Exterior",
    base_color: "#6a7858",
    roughness: 0.93,
    metalness: 0.0,
    properties: {
      albedoMapUrl: diff("overgrown_concrete_pavers"), normalMapUrl: nor("overgrown_concrete_pavers"),
      roughnessMapUrl: rough("overgrown_concrete_pavers"), aoMapUrl: ao("overgrown_concrete_pavers"),
      normalScale: 0.85, uvRepeatX: 2, uvRepeatY: 2,
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
