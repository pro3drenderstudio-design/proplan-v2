/**
 * POST /api/admin/seed-nature-materials
 *
 * Adds 30 nature/ground/grass/landscape materials to the ProPlan library.
 * Safe to run multiple times — skips any name that already exists.
 *
 * Usage:
 *   Invoke-WebRequest -Method POST -Uri http://localhost:3000/api/admin/seed-nature-materials
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
function disp(id: string)  { return `${PH}/${id}/${id}_disp_2k.jpg`; }

const NATURE_MATERIALS = [

  // ══════════════════════════════════════════════════════════════════
  //  GRASS
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Lush Green Grass",
    category: "Grass",
    base_color: "#4a7c3f",
    roughness: 0.9,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("grass_path_2"),
      normalMapUrl:    nor("grass_path_2"),
      roughnessMapUrl: rough("grass_path_2"),
      aoMapUrl:        ao("grass_path_2"),
      normalScale: 0.6,
      uvScaleX: 4, uvScaleY: 4, uvScaleZ: 4,
      projection: "triplanar",
    },
  },
  {
    name: "Dry Summer Grass",
    category: "Grass",
    base_color: "#b8a45a",
    roughness: 0.95,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("dry_grass_ground"),
      normalMapUrl:    nor("dry_grass_ground"),
      roughnessMapUrl: rough("dry_grass_ground"),
      aoMapUrl:        ao("dry_grass_ground"),
      normalScale: 0.5,
      uvScaleX: 3, uvScaleY: 3, uvScaleZ: 3,
      projection: "triplanar",
    },
  },
  {
    name: "Wild Meadow Grass",
    category: "Grass",
    base_color: "#5e8a42",
    roughness: 0.92,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brown_mud_leaves_01"),
      normalMapUrl:    nor("brown_mud_leaves_01"),
      roughnessMapUrl: rough("brown_mud_leaves_01"),
      aoMapUrl:        ao("brown_mud_leaves_01"),
      normalScale: 0.7,
      uvScaleX: 3, uvScaleY: 3, uvScaleZ: 3,
      projection: "triplanar",
    },
  },
  {
    name: "Worn Grass Path",
    category: "Grass",
    base_color: "#7a6f48",
    roughness: 0.9,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("grass_path"),
      normalMapUrl:    nor("grass_path"),
      roughnessMapUrl: rough("grass_path"),
      aoMapUrl:        ao("grass_path"),
      normalScale: 0.55,
      uvScaleX: 3, uvScaleY: 3, uvScaleZ: 3,
      projection: "triplanar",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  GROUND / SOIL / DIRT
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Rocky Ground",
    category: "Ground",
    base_color: "#8a7a68",
    roughness: 0.95,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("rocky_ground_02"),
      normalMapUrl:    nor("rocky_ground_02"),
      roughnessMapUrl: rough("rocky_ground_02"),
      aoMapUrl:        ao("rocky_ground_02"),
      normalScale: 0.8,
      uvScaleX: 2, uvScaleY: 2, uvScaleZ: 2,
      projection: "triplanar",
    },
  },
  {
    name: "Forest Floor",
    category: "Ground",
    base_color: "#4a3a28",
    roughness: 0.97,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("forest_floor_01"),
      normalMapUrl:    nor("forest_floor_01"),
      roughnessMapUrl: rough("forest_floor_01"),
      aoMapUrl:        ao("forest_floor_01"),
      normalScale: 0.7,
      uvScaleX: 2, uvScaleY: 2, uvScaleZ: 2,
      projection: "triplanar",
    },
  },
  {
    name: "Mossy Forest Floor",
    category: "Ground",
    base_color: "#3d5c35",
    roughness: 0.9,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("mossy_cobblestone"),
      normalMapUrl:    nor("mossy_cobblestone"),
      roughnessMapUrl: rough("mossy_cobblestone"),
      aoMapUrl:        ao("mossy_cobblestone"),
      normalScale: 0.9,
      uvScaleX: 2, uvScaleY: 2, uvScaleZ: 2,
      projection: "triplanar",
    },
  },
  {
    name: "Brown Mud",
    category: "Ground",
    base_color: "#5c3d1e",
    roughness: 0.85,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brown_mud_dry_01"),
      normalMapUrl:    nor("brown_mud_dry_01"),
      roughnessMapUrl: rough("brown_mud_dry_01"),
      aoMapUrl:        ao("brown_mud_dry_01"),
      normalScale: 0.65,
      uvScaleX: 2, uvScaleY: 2, uvScaleZ: 2,
      projection: "triplanar",
    },
  },
  {
    name: "Cracked Dry Earth",
    category: "Ground",
    base_color: "#9a7a55",
    roughness: 0.97,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("cracked_soil_02"),
      normalMapUrl:    nor("cracked_soil_02"),
      roughnessMapUrl: rough("cracked_soil_02"),
      aoMapUrl:        ao("cracked_soil_02"),
      normalScale: 1.0,
      uvScaleX: 2, uvScaleY: 2, uvScaleZ: 2,
      projection: "triplanar",
    },
  },
  {
    name: "Sandy Soil",
    category: "Ground",
    base_color: "#c4a96b",
    roughness: 0.93,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("sandy_gravel_01"),
      normalMapUrl:    nor("sandy_gravel_01"),
      roughnessMapUrl: rough("sandy_gravel_01"),
      aoMapUrl:        ao("sandy_gravel_01"),
      normalScale: 0.5,
      uvScaleX: 3, uvScaleY: 3, uvScaleZ: 3,
      projection: "triplanar",
    },
  },
  {
    name: "Dark Topsoil",
    category: "Ground",
    base_color: "#2e2318",
    roughness: 0.96,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("aerial_ground_rock"),
      normalMapUrl:    nor("aerial_ground_rock"),
      roughnessMapUrl: rough("aerial_ground_rock"),
      aoMapUrl:        ao("aerial_ground_rock"),
      normalScale: 0.6,
      uvScaleX: 2, uvScaleY: 2, uvScaleZ: 2,
      projection: "triplanar",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  GRAVEL / PEBBLES
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Fine Gravel",
    category: "Gravel",
    base_color: "#9a9080",
    roughness: 0.92,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("gravel_02"),
      normalMapUrl:    nor("gravel_02"),
      roughnessMapUrl: rough("gravel_02"),
      aoMapUrl:        ao("gravel_02"),
      normalScale: 0.8,
      uvScaleX: 3, uvScaleY: 3, uvScaleZ: 3,
      projection: "triplanar",
    },
  },
  {
    name: "River Pebbles",
    category: "Gravel",
    base_color: "#7a7060",
    roughness: 0.75,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("pebble_creek_02"),
      normalMapUrl:    nor("pebble_creek_02"),
      roughnessMapUrl: rough("pebble_creek_02"),
      aoMapUrl:        ao("pebble_creek_02"),
      normalScale: 0.9,
      uvScaleX: 3, uvScaleY: 3, uvScaleZ: 3,
      projection: "triplanar",
    },
  },
  {
    name: "Crushed Stone Path",
    category: "Gravel",
    base_color: "#b8afa0",
    roughness: 0.94,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("gravel_path_01"),
      normalMapUrl:    nor("gravel_path_01"),
      roughnessMapUrl: rough("gravel_path_01"),
      aoMapUrl:        ao("gravel_path_01"),
      normalScale: 0.85,
      uvScaleX: 3, uvScaleY: 3, uvScaleZ: 3,
      projection: "triplanar",
    },
  },
  {
    name: "White Marble Chips",
    category: "Gravel",
    base_color: "#e8e4dc",
    roughness: 0.6,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("white_sand_01"),
      normalMapUrl:    nor("white_sand_01"),
      roughnessMapUrl: rough("white_sand_01"),
      aoMapUrl:        ao("white_sand_01"),
      normalScale: 0.5,
      uvScaleX: 4, uvScaleY: 4, uvScaleZ: 4,
      projection: "triplanar",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  SAND
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Desert Sand",
    category: "Sand",
    base_color: "#d4aa6b",
    roughness: 0.92,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("sand_01"),
      normalMapUrl:    nor("sand_01"),
      roughnessMapUrl: rough("sand_01"),
      uvScaleX: 4, uvScaleY: 4, uvScaleZ: 4,
      projection: "triplanar",
    },
  },
  {
    name: "Wet Beach Sand",
    category: "Sand",
    base_color: "#b8956a",
    roughness: 0.75,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("sandy_gravel_02"),
      normalMapUrl:    nor("sandy_gravel_02"),
      roughnessMapUrl: rough("sandy_gravel_02"),
      aoMapUrl:        ao("sandy_gravel_02"),
      normalScale: 0.4,
      uvScaleX: 3, uvScaleY: 3, uvScaleZ: 3,
      projection: "triplanar",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  ROCK / STONE (natural)
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Rough Cliff Rock",
    category: "Rock",
    base_color: "#7a7060",
    roughness: 0.97,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("rock_face"),
      normalMapUrl:    nor("rock_face"),
      roughnessMapUrl: rough("rock_face"),
      aoMapUrl:        ao("rock_face"),
      normalScale: 1.2,
      uvScaleX: 1, uvScaleY: 1, uvScaleZ: 1,
      projection: "triplanar",
    },
  },
  {
    name: "Granite Boulder",
    category: "Rock",
    base_color: "#8a8278",
    roughness: 0.85,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("granite_tile_02"),
      normalMapUrl:    nor("granite_tile_02"),
      roughnessMapUrl: rough("granite_tile_02"),
      aoMapUrl:        ao("granite_tile_02"),
      normalScale: 0.9,
      uvScaleX: 1.5, uvScaleY: 1.5, uvScaleZ: 1.5,
      projection: "triplanar",
    },
  },
  {
    name: "Layered Slate Rock",
    category: "Rock",
    base_color: "#5a5560",
    roughness: 0.88,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("layered_rock_01"),
      normalMapUrl:    nor("layered_rock_01"),
      roughnessMapUrl: rough("layered_rock_01"),
      aoMapUrl:        ao("layered_rock_01"),
      normalScale: 1.1,
      uvScaleX: 1, uvScaleY: 1, uvScaleZ: 1,
      projection: "triplanar",
    },
  },
  {
    name: "Mossy Rock",
    category: "Rock",
    base_color: "#5a6845",
    roughness: 0.92,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("mossy_rock_01"),
      normalMapUrl:    nor("mossy_rock_01"),
      roughnessMapUrl: rough("mossy_rock_01"),
      aoMapUrl:        ao("mossy_rock_01"),
      normalScale: 1.0,
      uvScaleX: 1.5, uvScaleY: 1.5, uvScaleZ: 1.5,
      projection: "triplanar",
    },
  },
  {
    name: "Sandstone Cliff",
    category: "Rock",
    base_color: "#c4956a",
    roughness: 0.93,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("sandstone_cracks_02"),
      normalMapUrl:    nor("sandstone_cracks_02"),
      roughnessMapUrl: rough("sandstone_cracks_02"),
      aoMapUrl:        ao("sandstone_cracks_02"),
      normalScale: 1.0,
      uvScaleX: 1.5, uvScaleY: 1.5, uvScaleZ: 1.5,
      projection: "triplanar",
    },
  },
  {
    name: "Volcanic Basalt",
    category: "Rock",
    base_color: "#2a2828",
    roughness: 0.88,
    metalness: 0.05,
    properties: {
      albedoMapUrl:    diff("dark_rocky_shore_02"),
      normalMapUrl:    nor("dark_rocky_shore_02"),
      roughnessMapUrl: rough("dark_rocky_shore_02"),
      aoMapUrl:        ao("dark_rocky_shore_02"),
      normalScale: 1.0,
      uvScaleX: 1.5, uvScaleY: 1.5, uvScaleZ: 1.5,
      projection: "triplanar",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  WATER / WETLANDS
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Still Water Surface",
    category: "Water",
    base_color: "#2a5a7a",
    roughness: 0.05,
    metalness: 0.1,
    properties: {
      albedoMapUrl:    diff("water_droplets"),
      normalMapUrl:    nor("water_droplets"),
      roughnessMapUrl: rough("water_droplets"),
      normalScale: 0.4,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      uvScaleX: 2, uvScaleY: 2, uvScaleZ: 2,
      projection: "triplanar",
    },
  },
  {
    name: "Wet Mud Shore",
    category: "Water",
    base_color: "#3d2e1a",
    roughness: 0.65,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("mud_cracked_dry_02"),
      normalMapUrl:    nor("mud_cracked_dry_02"),
      roughnessMapUrl: rough("mud_cracked_dry_02"),
      aoMapUrl:        ao("mud_cracked_dry_02"),
      normalScale: 0.8,
      uvScaleX: 2, uvScaleY: 2, uvScaleZ: 2,
      projection: "triplanar",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  BARK / WOOD (natural)
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Tree Bark",
    category: "Bark",
    base_color: "#4a3520",
    roughness: 0.95,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("bark_willow_02"),
      normalMapUrl:    nor("bark_willow_02"),
      roughnessMapUrl: rough("bark_willow_02"),
      aoMapUrl:        ao("bark_willow_02"),
      normalScale: 1.2,
      uvScaleX: 2, uvScaleY: 2, uvScaleZ: 2,
      projection: "triplanar",
    },
  },
  {
    name: "Birch Bark",
    category: "Bark",
    base_color: "#e8e0d0",
    roughness: 0.85,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("bark_brown_02"),
      normalMapUrl:    nor("bark_brown_02"),
      roughnessMapUrl: rough("bark_brown_02"),
      aoMapUrl:        ao("bark_brown_02"),
      normalScale: 0.9,
      uvScaleX: 2, uvScaleY: 2, uvScaleZ: 2,
      projection: "triplanar",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  LEAVES / MULCH
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Autumn Leaf Mulch",
    category: "Ground",
    base_color: "#7a4a20",
    roughness: 0.97,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("leaves_forest_ground"),
      normalMapUrl:    nor("leaves_forest_ground"),
      roughnessMapUrl: rough("leaves_forest_ground"),
      aoMapUrl:        ao("leaves_forest_ground"),
      normalScale: 0.7,
      uvScaleX: 3, uvScaleY: 3, uvScaleZ: 3,
      projection: "triplanar",
    },
  },
  {
    name: "Pine Needle Carpet",
    category: "Ground",
    base_color: "#4a3a25",
    roughness: 0.96,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("forest_leaves_02"),
      normalMapUrl:    nor("forest_leaves_02"),
      roughnessMapUrl: rough("forest_leaves_02"),
      aoMapUrl:        ao("forest_leaves_02"),
      normalScale: 0.6,
      uvScaleX: 3, uvScaleY: 3, uvScaleZ: 3,
      projection: "triplanar",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  SNOW / ICE
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Fresh Snow",
    category: "Snow",
    base_color: "#f0f2f5",
    roughness: 0.85,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("snow_field_aerial_01"),
      normalMapUrl:    nor("snow_field_aerial_01"),
      roughnessMapUrl: rough("snow_field_aerial_01"),
      normalScale: 0.3,
      uvScaleX: 3, uvScaleY: 3, uvScaleZ: 3,
      projection: "triplanar",
    },
  },
  {
    name: "Packed Ice",
    category: "Snow",
    base_color: "#c8e0ee",
    roughness: 0.1,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("ice_field"),
      normalMapUrl:    nor("ice_field"),
      roughnessMapUrl: rough("ice_field"),
      normalScale: 0.5,
      clearcoat: 0.9,
      clearcoatRoughness: 0.05,
      uvScaleX: 2, uvScaleY: 2, uvScaleZ: 2,
      projection: "triplanar",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  MISC OUTDOOR
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Weathered Concrete Slab",
    category: "Ground",
    base_color: "#9a9a94",
    roughness: 0.9,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("concrete_floor_06"),
      normalMapUrl:    nor("concrete_floor_06"),
      roughnessMapUrl: rough("concrete_floor_06"),
      aoMapUrl:        ao("concrete_floor_06"),
      normalScale: 0.5,
      uvScaleX: 2, uvScaleY: 2, uvScaleZ: 2,
      projection: "triplanar",
    },
  },
  {
    name: "Outdoor Paving Stone",
    category: "Ground",
    base_color: "#8a8478",
    roughness: 0.88,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("cobblestone_floor_06"),
      normalMapUrl:    nor("cobblestone_floor_06"),
      roughnessMapUrl: rough("cobblestone_floor_06"),
      aoMapUrl:        ao("cobblestone_floor_06"),
      normalScale: 0.8,
      uvScaleX: 2, uvScaleY: 2, uvScaleZ: 2,
      projection: "triplanar",
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

  const toInsert = NATURE_MATERIALS.filter(m => !existingNames.has(m.name));

  if (toInsert.length === 0) {
    return NextResponse.json({ message: "All nature materials already exist.", inserted: 0, skipped: NATURE_MATERIALS.length });
  }

  const { error: insertErr } = await supabase.from("material_library").insert(toInsert);

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({
    message: `Seeded ${toInsert.length} nature materials.`,
    inserted: toInsert.length,
    skipped: NATURE_MATERIALS.length - toInsert.length,
  });
}
