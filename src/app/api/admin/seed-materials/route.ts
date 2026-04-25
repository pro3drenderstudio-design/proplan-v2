/**
 * POST /api/admin/seed-materials
 *
 * One-time seed for the ProPlan residential material library.
 * All textures sourced from Polyhaven (CC0). Skips any material whose name
 * already exists so it is safe to run multiple times.
 *
 * Usage:
 *   curl -X POST http://localhost:3000/api/admin/seed-materials
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── Polyhaven CDN helpers ─────────────────────────────────────────────────────

const PH = "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k";

function diff(id: string)  { return `${PH}/${id}/${id}_diff_2k.jpg`; }
function nor(id: string)   { return `${PH}/${id}/${id}_nor_gl_2k.jpg`; }
function rough(id: string) { return `${PH}/${id}/${id}_rough_2k.jpg`; }
function ao(id: string)    { return `${PH}/${id}/${id}_ao_2k.jpg`; }

// ─── Material definitions ──────────────────────────────────────────────────────

const MATERIALS = [

  // ══════════════════════════════════════════════════════════════════
  //  FLOORING — WOOD
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Light Oak Hardwood",
    category: "Flooring",
    base_color: "#c8955a",
    roughness: 0.75,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brown_planks_04"),
      normalMapUrl:    nor("brown_planks_04"),
      roughnessMapUrl: rough("brown_planks_04"),
      aoMapUrl:        ao("brown_planks_04"),
      normalScale: 1.0,
      uvRepeatX: 2, uvRepeatY: 4,
    },
  },
  {
    name: "Smoked Walnut Hardwood",
    category: "Flooring",
    base_color: "#3d2414",
    roughness: 0.80,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brown_planks_07"),
      normalMapUrl:    nor("brown_planks_07"),
      roughnessMapUrl: rough("brown_planks_07"),
      aoMapUrl:        ao("brown_planks_07"),
      normalScale: 1.2,
      uvRepeatX: 2, uvRepeatY: 4,
    },
  },
  {
    name: "Natural Pine Floor",
    category: "Flooring",
    base_color: "#d4a96a",
    roughness: 0.72,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brown_planks_03"),
      normalMapUrl:    nor("brown_planks_03"),
      roughnessMapUrl: rough("brown_planks_03"),
      aoMapUrl:        ao("brown_planks_03"),
      normalScale: 0.8,
      uvRepeatX: 2, uvRepeatY: 4,
    },
  },
  {
    name: "Aged Barn Wood",
    category: "Flooring",
    base_color: "#7a5a3a",
    roughness: 0.92,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brown_planks_05"),
      normalMapUrl:    nor("brown_planks_05"),
      roughnessMapUrl: rough("brown_planks_05"),
      aoMapUrl:        ao("brown_planks_05"),
      normalScale: 1.8,
      uvRepeatX: 2, uvRepeatY: 4,
    },
  },
  {
    name: "Teak Deck Flooring",
    category: "Flooring",
    base_color: "#9b6b35",
    roughness: 0.68,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("wood_floor_deck"),
      normalMapUrl:    nor("wood_floor_deck"),
      roughnessMapUrl: rough("wood_floor_deck"),
      aoMapUrl:        ao("wood_floor_deck"),
      normalScale: 0.8,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Honey Oak Veneer",
    category: "Flooring",
    base_color: "#c09050",
    roughness: 0.60,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("oak_veneer_01"),
      normalMapUrl:    nor("oak_veneer_01"),
      roughnessMapUrl: rough("oak_veneer_01"),
      aoMapUrl:        ao("oak_veneer_01"),
      normalScale: 0.6,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  FLOORING — STONE
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Calacatta Marble Floor",
    category: "Flooring",
    base_color: "#f5f0eb",
    roughness: 0.15,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("marble_01"),
      normalMapUrl:    nor("marble_01"),
      roughnessMapUrl: rough("marble_01"),
      aoMapUrl:        ao("marble_01"),
      normalScale: 0.4,
      uvRepeatX: 1, uvRepeatY: 1,
    },
  },
  {
    name: "Polished Granite Floor",
    category: "Flooring",
    base_color: "#6a6a6a",
    roughness: 0.20,
    metalness: 0.05,
    properties: {
      albedoMapUrl:    diff("granite_tile_02"),
      normalMapUrl:    nor("granite_tile_02"),
      roughnessMapUrl: rough("granite_tile_02"),
      aoMapUrl:        ao("granite_tile_02"),
      normalScale: 0.4,
      uvRepeatX: 1, uvRepeatY: 1,
    },
  },
  {
    name: "Brushed Concrete Floor",
    category: "Flooring",
    base_color: "#9a9a9a",
    roughness: 0.85,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brushed_concrete"),
      normalMapUrl:    nor("brushed_concrete"),
      roughnessMapUrl: rough("brushed_concrete"),
      aoMapUrl:        ao("brushed_concrete"),
      normalScale: 1.2,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Terracotta Floor Tile",
    category: "Flooring",
    base_color: "#c4714a",
    roughness: 0.72,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brown_floor_tiles"),
      normalMapUrl:    nor("brown_floor_tiles"),
      roughnessMapUrl: rough("brown_floor_tiles"),
      aoMapUrl:        ao("brown_floor_tiles"),
      normalScale: 1.0,
      uvRepeatX: 3, uvRepeatY: 3,
    },
  },
  {
    name: "Checkered Porcelain Tile",
    category: "Flooring",
    base_color: "#c8c8c8",
    roughness: 0.20,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("checkered_pavement_tiles"),
      normalMapUrl:    nor("checkered_pavement_tiles"),
      roughnessMapUrl: rough("checkered_pavement_tiles"),
      aoMapUrl:        ao("checkered_pavement_tiles"),
      normalScale: 0.5,
      uvRepeatX: 3, uvRepeatY: 3,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  COUNTERTOPS
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Polished Marble Countertop",
    category: "Countertops",
    base_color: "#f8f4f0",
    roughness: 0.05,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("marble_01"),
      normalMapUrl:    nor("marble_01"),
      roughnessMapUrl: rough("marble_01"),
      aoMapUrl:        ao("marble_01"),
      normalScale: 0.3,
      clearcoat: 0.6,
      clearcoatRoughness: 0.05,
      uvRepeatX: 1, uvRepeatY: 1,
    },
  },
  {
    name: "Leathered Granite Countertop",
    category: "Countertops",
    base_color: "#5a5a5a",
    roughness: 0.45,
    metalness: 0.05,
    properties: {
      albedoMapUrl:    diff("granite_tile_02"),
      normalMapUrl:    nor("granite_tile_02"),
      roughnessMapUrl: rough("granite_tile_02"),
      aoMapUrl:        ao("granite_tile_02"),
      normalScale: 1.0,
      uvRepeatX: 1, uvRepeatY: 1,
    },
  },
  {
    name: "Industrial Concrete Counter",
    category: "Countertops",
    base_color: "#888888",
    roughness: 0.88,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brushed_concrete_03"),
      normalMapUrl:    nor("brushed_concrete_03"),
      roughnessMapUrl: rough("brushed_concrete_03"),
      aoMapUrl:        ao("brushed_concrete_03"),
      normalScale: 1.2,
      uvRepeatX: 1, uvRepeatY: 1,
    },
  },
  {
    name: "Oak Butcher Block",
    category: "Countertops",
    base_color: "#b07d44",
    roughness: 0.65,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("oak_veneer_01"),
      normalMapUrl:    nor("oak_veneer_01"),
      roughnessMapUrl: rough("oak_veneer_01"),
      aoMapUrl:        ao("oak_veneer_01"),
      normalScale: 0.5,
      uvRepeatX: 1, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  WALLS
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Smooth Concrete Wall",
    category: "Walls",
    base_color: "#b0b0b0",
    roughness: 0.85,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brushed_concrete"),
      normalMapUrl:    nor("brushed_concrete"),
      roughnessMapUrl: rough("brushed_concrete"),
      aoMapUrl:        ao("brushed_concrete"),
      normalScale: 0.8,
      uvRepeatX: 1, uvRepeatY: 1,
    },
  },
  {
    name: "Textured Concrete Wall",
    category: "Walls",
    base_color: "#a0a0a0",
    roughness: 0.95,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("anti_slip_concrete"),
      normalMapUrl:    nor("anti_slip_concrete"),
      roughnessMapUrl: rough("anti_slip_concrete"),
      aoMapUrl:        ao("anti_slip_concrete"),
      normalScale: 1.8,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Classic Red Brick",
    category: "Walls",
    base_color: "#c25a3a",
    roughness: 0.92,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brick_wall_001"),
      normalMapUrl:    nor("brick_wall_001"),
      roughnessMapUrl: rough("brick_wall_001"),
      aoMapUrl:        ao("brick_wall_001"),
      normalScale: 2.5,
      uvRepeatX: 3, uvRepeatY: 3,
    },
  },
  {
    name: "Weathered Brick",
    category: "Walls",
    base_color: "#b8503a",
    roughness: 0.95,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brick_wall_002"),
      normalMapUrl:    nor("brick_wall_002"),
      roughnessMapUrl: rough("brick_wall_002"),
      aoMapUrl:        ao("brick_wall_002"),
      normalScale: 3.0,
      uvRepeatX: 3, uvRepeatY: 3,
    },
  },
  {
    name: "White Painted Brick",
    category: "Walls",
    base_color: "#f0ece8",
    roughness: 0.70,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brick_wall_003"),
      normalMapUrl:    nor("brick_wall_003"),
      roughnessMapUrl: rough("brick_wall_003"),
      aoMapUrl:        ao("brick_wall_003"),
      normalScale: 1.0,
      uvRepeatX: 3, uvRepeatY: 3,
    },
  },
  {
    name: "Charcoal Modern Brick",
    category: "Walls",
    base_color: "#3a3a3a",
    roughness: 0.88,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brick_wall_005"),
      normalMapUrl:    nor("brick_wall_005"),
      roughnessMapUrl: rough("brick_wall_005"),
      aoMapUrl:        ao("brick_wall_005"),
      normalScale: 2.0,
      uvRepeatX: 3, uvRepeatY: 3,
    },
  },
  {
    name: "Rustic Stone Brick",
    category: "Walls",
    base_color: "#8a7a6a",
    roughness: 0.95,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brick_wall_007"),
      normalMapUrl:    nor("brick_wall_007"),
      roughnessMapUrl: rough("brick_wall_007"),
      aoMapUrl:        ao("brick_wall_007"),
      normalScale: 3.5,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  BACKSPLASH / TILE
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Glossy White Ceramic Tile",
    category: "Walls",
    base_color: "#f8f8f8",
    roughness: 0.08,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("ceramic_roof_01"),
      normalMapUrl:    nor("ceramic_roof_01"),
      roughnessMapUrl: rough("ceramic_roof_01"),
      aoMapUrl:        ao("ceramic_roof_01"),
      normalScale: 0.4,
      clearcoat: 0.8,
      clearcoatRoughness: 0.05,
      uvRepeatX: 4, uvRepeatY: 4,
    },
  },
  {
    name: "Cobalt Blue Wall Tile",
    category: "Walls",
    base_color: "#4a7aaa",
    roughness: 0.12,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("blue_floor_tiles_01"),
      normalMapUrl:    nor("blue_floor_tiles_01"),
      roughnessMapUrl: rough("blue_floor_tiles_01"),
      aoMapUrl:        ao("blue_floor_tiles_01"),
      normalScale: 0.6,
      clearcoat: 0.7,
      clearcoatRoughness: 0.08,
      uvRepeatX: 4, uvRepeatY: 4,
    },
  },
  {
    name: "Anti-Slip Bathroom Tile",
    category: "Flooring",
    base_color: "#e0ddd8",
    roughness: 0.65,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("anti_skid_tiles"),
      normalMapUrl:    nor("anti_skid_tiles"),
      roughnessMapUrl: rough("anti_skid_tiles"),
      aoMapUrl:        ao("anti_skid_tiles"),
      normalScale: 1.2,
      uvRepeatX: 4, uvRepeatY: 4,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  EXTERIOR / LANDSCAPE
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Herringbone Brick Patio",
    category: "Exterior",
    base_color: "#c06040",
    roughness: 0.90,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brick_pavement_01"),
      normalMapUrl:    nor("brick_pavement_01"),
      roughnessMapUrl: rough("brick_pavement_01"),
      aoMapUrl:        ao("brick_pavement_01"),
      normalScale: 2.0,
      uvRepeatX: 3, uvRepeatY: 3,
    },
  },
  {
    name: "Cobblestone Pathway",
    category: "Exterior",
    base_color: "#8a8a7a",
    roughness: 0.90,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("cobblestone_01"),
      normalMapUrl:    nor("cobblestone_01"),
      roughnessMapUrl: rough("cobblestone_01"),
      aoMapUrl:        ao("cobblestone_01"),
      normalScale: 3.0,
      uvRepeatX: 3, uvRepeatY: 3,
    },
  },
  {
    name: "Smooth Cobblestone Court",
    category: "Exterior",
    base_color: "#7a7a6a",
    roughness: 0.80,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("cobblestone_02"),
      normalMapUrl:    nor("cobblestone_02"),
      roughnessMapUrl: rough("cobblestone_02"),
      aoMapUrl:        ao("cobblestone_02"),
      normalScale: 2.5,
      uvRepeatX: 3, uvRepeatY: 3,
    },
  },
  {
    name: "Cobblestone Entryway",
    category: "Exterior",
    base_color: "#6a6a5a",
    roughness: 0.85,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("cobblestone_floor_001"),
      normalMapUrl:    nor("cobblestone_floor_001"),
      roughnessMapUrl: rough("cobblestone_floor_001"),
      aoMapUrl:        ao("cobblestone_floor_001"),
      normalScale: 2.0,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Grey Cobblestone Drive",
    category: "Exterior",
    base_color: "#5a5a50",
    roughness: 0.88,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("cobblestone_floor_002"),
      normalMapUrl:    nor("cobblestone_floor_002"),
      roughnessMapUrl: rough("cobblestone_floor_002"),
      aoMapUrl:        ao("cobblestone_floor_002"),
      normalScale: 2.0,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Rough Cobblestone",
    category: "Exterior",
    base_color: "#7a7060",
    roughness: 0.95,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("cobblestone_03"),
      normalMapUrl:    nor("cobblestone_03"),
      roughnessMapUrl: rough("cobblestone_03"),
      aoMapUrl:        ao("cobblestone_03"),
      normalScale: 3.5,
      uvRepeatX: 3, uvRepeatY: 3,
    },
  },
  {
    name: "Blue Painted Accent Wood",
    category: "Walls",
    base_color: "#4a6a8a",
    roughness: 0.65,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("blue_painted_planks"),
      normalMapUrl:    nor("blue_painted_planks"),
      roughnessMapUrl: rough("blue_painted_planks"),
      aoMapUrl:        ao("blue_painted_planks"),
      normalScale: 0.8,
      uvRepeatX: 2, uvRepeatY: 4,
    },
  },
];

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST() {
  const supabase = db();

  // Fetch existing material names to avoid duplicates
  const { data: existing } = await supabase
    .from("material_library")
    .select("name");
  const existingNames = new Set((existing ?? []).map((r: { name: string }) => r.name));

  const toInsert = MATERIALS.filter(m => !existingNames.has(m.name));

  if (toInsert.length === 0) {
    return NextResponse.json({ message: "All materials already exist — nothing inserted.", inserted: 0 });
  }

  const { data, error } = await supabase
    .from("material_library")
    .insert(toInsert)
    .select("name, category");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    message: `Seeded ${data?.length ?? 0} materials.`,
    inserted: data?.length ?? 0,
    skipped: MATERIALS.length - toInsert.length,
    materials: data,
  });
}
