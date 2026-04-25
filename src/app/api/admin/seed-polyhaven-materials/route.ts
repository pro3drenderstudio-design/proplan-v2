/**
 * POST /api/admin/seed-polyhaven-materials
 *
 * Adds 25 specific Polyhaven materials to the ProPlan library.
 * Safe to run multiple times — skips any name that already exists.
 *
 * Usage:
 *   Invoke-WebRequest -Method POST -Uri http://localhost:3000/api/admin/seed-polyhaven-materials
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
    name: "Brick Pavement 03",
    category: "Exterior",
    base_color: "#9a6e58",
    roughness: 0.92,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brick_pavement_03"),
      normalMapUrl:    nor("brick_pavement_03"),
      roughnessMapUrl: rough("brick_pavement_03"),
      aoMapUrl:        ao("brick_pavement_03"),
      normalScale: 0.9,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Brick Pavement 02",
    category: "Exterior",
    base_color: "#a87a60",
    roughness: 0.9,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brick_pavement_02"),
      normalMapUrl:    nor("brick_pavement_02"),
      roughnessMapUrl: rough("brick_pavement_02"),
      aoMapUrl:        ao("brick_pavement_02"),
      normalScale: 0.85,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Herringbone Brick 03",
    category: "Exterior",
    base_color: "#b87a5a",
    roughness: 0.91,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("herringbone_brick_03"),
      normalMapUrl:    nor("herringbone_brick_03"),
      roughnessMapUrl: rough("herringbone_brick_03"),
      aoMapUrl:        ao("herringbone_brick_03"),
      normalScale: 0.9,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Red Brick",
    category: "Exterior",
    base_color: "#a84a35",
    roughness: 0.93,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("red_brick"),
      normalMapUrl:    nor("red_brick"),
      roughnessMapUrl: rough("red_brick"),
      aoMapUrl:        ao("red_brick"),
      normalScale: 1.0,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Whitewashed Brick",
    category: "Walls",
    base_color: "#e8e0d8",
    roughness: 0.88,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("whitewashed_brick"),
      normalMapUrl:    nor("whitewashed_brick"),
      roughnessMapUrl: rough("whitewashed_brick"),
      aoMapUrl:        ao("whitewashed_brick"),
      normalScale: 0.7,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Mixed Brick Wall",
    category: "Walls",
    base_color: "#9a7060",
    roughness: 0.92,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("mixed_brick_wall"),
      normalMapUrl:    nor("mixed_brick_wall"),
      roughnessMapUrl: rough("mixed_brick_wall"),
      aoMapUrl:        ao("mixed_brick_wall"),
      normalScale: 1.0,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Plaster Brick Pattern",
    category: "Walls",
    base_color: "#d8cfc0",
    roughness: 0.87,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("plaster_brick_pattern"),
      normalMapUrl:    nor("plaster_brick_pattern"),
      roughnessMapUrl: rough("plaster_brick_pattern"),
      aoMapUrl:        ao("plaster_brick_pattern"),
      normalScale: 0.6,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  WOOD FLOORING
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Plank Flooring 04",
    category: "Flooring",
    base_color: "#c8a068",
    roughness: 0.5,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("plank_flooring_04"),
      normalMapUrl:    nor("plank_flooring_04"),
      roughnessMapUrl: rough("plank_flooring_04"),
      aoMapUrl:        ao("plank_flooring_04"),
      normalScale: 0.4,
      clearcoat: 0.3,
      clearcoatRoughness: 0.3,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Oak Veneer",
    category: "Flooring",
    base_color: "#c4905a",
    roughness: 0.45,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("oak_veneer_01"),
      normalMapUrl:    nor("oak_veneer_01"),
      roughnessMapUrl: rough("oak_veneer_01"),
      aoMapUrl:        ao("oak_veneer_01"),
      normalScale: 0.35,
      clearcoat: 0.4,
      clearcoatRoughness: 0.25,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Wood Floor",
    category: "Flooring",
    base_color: "#b88850",
    roughness: 0.55,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("wood_floor"),
      normalMapUrl:    nor("wood_floor"),
      roughnessMapUrl: rough("wood_floor"),
      aoMapUrl:        ao("wood_floor"),
      normalScale: 0.4,
      clearcoat: 0.25,
      clearcoatRoughness: 0.35,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Worn Wood Floor",
    category: "Flooring",
    base_color: "#9a7848",
    roughness: 0.75,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("wood_floor_worn"),
      normalMapUrl:    nor("wood_floor_worn"),
      roughnessMapUrl: rough("wood_floor_worn"),
      aoMapUrl:        ao("wood_floor_worn"),
      normalScale: 0.6,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Laminate Floor 02",
    category: "Flooring",
    base_color: "#a88860",
    roughness: 0.35,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("laminate_floor_02"),
      normalMapUrl:    nor("laminate_floor_02"),
      roughnessMapUrl: rough("laminate_floor_02"),
      aoMapUrl:        ao("laminate_floor_02"),
      normalScale: 0.3,
      clearcoat: 0.6,
      clearcoatRoughness: 0.15,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Wood Chip Path",
    category: "Exterior",
    base_color: "#8a6040",
    roughness: 0.97,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("wood_chip_path"),
      normalMapUrl:    nor("wood_chip_path"),
      roughnessMapUrl: rough("wood_chip_path"),
      aoMapUrl:        ao("wood_chip_path"),
      normalScale: 0.8,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  STONE / TILE
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Granite Tile 04",
    category: "Flooring",
    base_color: "#7a7870",
    roughness: 0.25,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("granite_tile_04"),
      normalMapUrl:    nor("granite_tile_04"),
      roughnessMapUrl: rough("granite_tile_04"),
      aoMapUrl:        ao("granite_tile_04"),
      normalScale: 0.3,
      clearcoat: 0.5,
      clearcoatRoughness: 0.1,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Granite Tile",
    category: "Flooring",
    base_color: "#888078",
    roughness: 0.2,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("granite_tile"),
      normalMapUrl:    nor("granite_tile"),
      roughnessMapUrl: rough("granite_tile"),
      aoMapUrl:        ao("granite_tile"),
      normalScale: 0.3,
      clearcoat: 0.55,
      clearcoatRoughness: 0.08,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Stone Embedded Tiles",
    category: "Exterior",
    base_color: "#8a8278",
    roughness: 0.88,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("stone_embedded_tiles"),
      normalMapUrl:    nor("stone_embedded_tiles"),
      roughnessMapUrl: rough("stone_embedded_tiles"),
      aoMapUrl:        ao("stone_embedded_tiles"),
      normalScale: 1.0,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Rustic Stone Wall 02",
    category: "Walls",
    base_color: "#7a7268",
    roughness: 0.95,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("rustic_stone_wall_02"),
      normalMapUrl:    nor("rustic_stone_wall_02"),
      roughnessMapUrl: rough("rustic_stone_wall_02"),
      aoMapUrl:        ao("rustic_stone_wall_02"),
      normalScale: 1.1,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Ganges River Pebbles",
    category: "Exterior",
    base_color: "#8a8070",
    roughness: 0.78,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("ganges_river_pebbles"),
      normalMapUrl:    nor("ganges_river_pebbles"),
      roughnessMapUrl: rough("ganges_river_pebbles"),
      aoMapUrl:        ao("ganges_river_pebbles"),
      normalScale: 0.9,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  CONCRETE / HARD SURFACE
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Painted Concrete 02",
    category: "Walls",
    base_color: "#c8c0b8",
    roughness: 0.8,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("painted_concrete_02"),
      normalMapUrl:    nor("painted_concrete_02"),
      roughnessMapUrl: rough("painted_concrete_02"),
      aoMapUrl:        ao("painted_concrete_02"),
      normalScale: 0.45,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Gravel Concrete 03",
    category: "Exterior",
    base_color: "#9a9890",
    roughness: 0.92,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("gravel_concrete_03"),
      normalMapUrl:    nor("gravel_concrete_03"),
      roughnessMapUrl: rough("gravel_concrete_03"),
      aoMapUrl:        ao("gravel_concrete_03"),
      normalScale: 0.7,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Exterior Wall Cladding",
    category: "Exterior",
    base_color: "#c0b8aa",
    roughness: 0.85,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("exterior_wall_cladding"),
      normalMapUrl:    nor("exterior_wall_cladding"),
      roughnessMapUrl: rough("exterior_wall_cladding"),
      aoMapUrl:        ao("exterior_wall_cladding"),
      normalScale: 0.6,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  SPECIALTY FLOORING
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Old Linoleum Flooring",
    category: "Flooring",
    base_color: "#8a7a68",
    roughness: 0.65,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("old_linoleum_flooring_01"),
      normalMapUrl:    nor("old_linoleum_flooring_01"),
      roughnessMapUrl: rough("old_linoleum_flooring_01"),
      aoMapUrl:        ao("old_linoleum_flooring_01"),
      normalScale: 0.4,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Rubber Tiles",
    category: "Flooring",
    base_color: "#3a3835",
    roughness: 0.7,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("rubber_tiles"),
      normalMapUrl:    nor("rubber_tiles"),
      roughnessMapUrl: rough("rubber_tiles"),
      aoMapUrl:        ao("rubber_tiles"),
      normalScale: 0.5,
      uvRepeatX: 3, uvRepeatY: 3,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  ASPHALT
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Asphalt 07",
    category: "Exterior",
    base_color: "#2e2e2c",
    roughness: 0.96,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("asphalt_07"),
      normalMapUrl:    nor("asphalt_07"),
      roughnessMapUrl: rough("asphalt_07"),
      aoMapUrl:        ao("asphalt_07"),
      normalScale: 0.6,
      uvRepeatX: 3, uvRepeatY: 3,
    },
  },
  {
    name: "Asphalt 02",
    category: "Exterior",
    base_color: "#353532",
    roughness: 0.95,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("asphalt_02"),
      normalMapUrl:    nor("asphalt_02"),
      roughnessMapUrl: rough("asphalt_02"),
      aoMapUrl:        ao("asphalt_02"),
      normalScale: 0.55,
      uvRepeatX: 3, uvRepeatY: 3,
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
