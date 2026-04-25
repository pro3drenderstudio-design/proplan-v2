/**
 * POST /api/admin/seed-kitchen-materials
 *
 * Adds 30 kitchen-specific materials to the ProPlan library.
 * Safe to run multiple times — skips any name that already exists.
 *
 * Usage:
 *   Invoke-WebRequest -Method POST -Uri http://localhost:3000/api/admin/seed-kitchen-materials
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
function metal(id: string) { return `${PH}/${id}/${id}_metal_2k.jpg`; }

const KITCHEN_MATERIALS = [

  // ══════════════════════════════════════════════════════════════════
  //  COUNTERTOPS
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Calacatta Gold Marble",
    category: "Countertops",
    base_color: "#f5ede0",
    roughness: 0.06,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("marble_01"),
      normalMapUrl:    nor("marble_01"),
      roughnessMapUrl: rough("marble_01"),
      aoMapUrl:        ao("marble_01"),
      normalScale: 0.25,
      clearcoat: 0.85,
      clearcoatRoughness: 0.04,
      uvRepeatX: 1, uvRepeatY: 1,
    },
  },
  {
    name: "Statuario Marble Slab",
    category: "Countertops",
    base_color: "#f2f0ec",
    roughness: 0.09,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("marble_01"),
      normalMapUrl:    nor("marble_01"),
      roughnessMapUrl: rough("marble_01"),
      aoMapUrl:        ao("marble_01"),
      normalScale: 0.35,
      clearcoat: 0.70,
      clearcoatRoughness: 0.06,
      uvRepeatX: 1, uvRepeatY: 0.75,
    },
  },
  {
    name: "Crisp White Quartz",
    category: "Countertops",
    base_color: "#f8f7f5",
    roughness: 0.05,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("clay_plaster"),
      normalMapUrl:    nor("clay_plaster"),
      roughnessMapUrl: rough("clay_plaster"),
      aoMapUrl:        ao("clay_plaster"),
      normalScale: 0.15,
      clearcoat: 0.90,
      clearcoatRoughness: 0.03,
      uvRepeatX: 1, uvRepeatY: 1,
    },
  },
  {
    name: "Concrete Grey Quartz",
    category: "Countertops",
    base_color: "#8c8c8c",
    roughness: 0.08,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brushed_concrete_2"),
      normalMapUrl:    nor("brushed_concrete_2"),
      roughnessMapUrl: rough("brushed_concrete_2"),
      aoMapUrl:        ao("brushed_concrete_2"),
      normalScale: 0.20,
      clearcoat: 0.75,
      clearcoatRoughness: 0.05,
      uvRepeatX: 1, uvRepeatY: 1,
    },
  },
  {
    name: "Black Galaxy Granite",
    category: "Countertops",
    base_color: "#111111",
    roughness: 0.05,
    metalness: 0.10,
    properties: {
      albedoMapUrl:    diff("granite_tile_02"),
      normalMapUrl:    nor("granite_tile_02"),
      roughnessMapUrl: rough("granite_tile_02"),
      aoMapUrl:        ao("granite_tile_02"),
      normalScale: 0.20,
      clearcoat: 0.88,
      clearcoatRoughness: 0.03,
      colorTint: true,
      uvRepeatX: 1, uvRepeatY: 1,
    },
  },
  {
    name: "Travertine Countertop",
    category: "Countertops",
    base_color: "#d8c8a8",
    roughness: 0.35,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("clay_floor_001"),
      normalMapUrl:    nor("clay_floor_001"),
      roughnessMapUrl: rough("clay_floor_001"),
      aoMapUrl:        ao("clay_floor_001"),
      normalScale: 0.80,
      uvRepeatX: 1, uvRepeatY: 1,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  METALS — hardware, appliances, fixtures
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Brushed Stainless Steel",
    category: "Other",
    base_color: "#b4b4b4",
    roughness: 0.22,
    metalness: 0.96,
    properties: {
      albedoMapUrl:    diff("metal_plate"),
      normalMapUrl:    nor("metal_plate"),
      roughnessMapUrl: rough("metal_plate"),
      aoMapUrl:        ao("metal_plate"),
      metalnessMapUrl: metal("metal_plate"),
      normalScale: 0.60,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Polished Brushed Brass",
    category: "Other",
    base_color: "#c8a844",
    roughness: 0.32,
    metalness: 0.92,
    properties: {
      albedoMapUrl:    diff("metal_plate"),
      normalMapUrl:    nor("metal_plate"),
      roughnessMapUrl: rough("metal_plate"),
      aoMapUrl:        ao("metal_plate"),
      normalScale: 0.40,
      colorTint: true,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Warm Copper Fixture",
    category: "Other",
    base_color: "#b06428",
    roughness: 0.38,
    metalness: 0.90,
    properties: {
      albedoMapUrl:    diff("metal_plate"),
      normalMapUrl:    nor("metal_plate"),
      roughnessMapUrl: rough("metal_plate"),
      aoMapUrl:        ao("metal_plate"),
      normalScale: 0.40,
      colorTint: true,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Matte Black Hardware",
    category: "Other",
    base_color: "#1a1a1a",
    roughness: 0.55,
    metalness: 0.78,
    properties: {
      albedoMapUrl:    diff("metal_plate"),
      normalMapUrl:    nor("metal_plate"),
      roughnessMapUrl: rough("metal_plate"),
      aoMapUrl:        ao("metal_plate"),
      normalScale: 0.50,
      colorTint: true,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  BACKSPLASH & WALL TILE
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Classic White Subway 3×6",
    category: "Walls",
    base_color: "#f8f8f6",
    roughness: 0.06,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("ceramic_roof_01"),
      normalMapUrl:    nor("ceramic_roof_01"),
      roughnessMapUrl: rough("ceramic_roof_01"),
      aoMapUrl:        ao("ceramic_roof_01"),
      normalScale: 0.35,
      clearcoat: 0.90,
      clearcoatRoughness: 0.03,
      uvRepeatX: 5, uvRepeatY: 5,
    },
  },
  {
    name: "Sage Green Subway Tile",
    category: "Walls",
    base_color: "#7a9a78",
    roughness: 0.08,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("ceramic_roof_01"),
      normalMapUrl:    nor("ceramic_roof_01"),
      roughnessMapUrl: rough("ceramic_roof_01"),
      aoMapUrl:        ao("ceramic_roof_01"),
      normalScale: 0.35,
      clearcoat: 0.82,
      clearcoatRoughness: 0.04,
      colorTint: true,
      uvRepeatX: 5, uvRepeatY: 5,
    },
  },
  {
    name: "Deep Navy Kitchen Tile",
    category: "Walls",
    base_color: "#1e2e4a",
    roughness: 0.08,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("blue_floor_tiles_01"),
      normalMapUrl:    nor("blue_floor_tiles_01"),
      roughnessMapUrl: rough("blue_floor_tiles_01"),
      aoMapUrl:        ao("blue_floor_tiles_01"),
      normalScale: 0.45,
      clearcoat: 0.85,
      clearcoatRoughness: 0.04,
      colorTint: true,
      uvRepeatX: 5, uvRepeatY: 5,
    },
  },
  {
    name: "Terracotta Saltillo Tile",
    category: "Walls",
    base_color: "#c47050",
    roughness: 0.72,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brown_floor_tiles"),
      normalMapUrl:    nor("brown_floor_tiles"),
      roughnessMapUrl: rough("brown_floor_tiles"),
      aoMapUrl:        ao("brown_floor_tiles"),
      normalScale: 1.20,
      uvRepeatX: 5, uvRepeatY: 5,
    },
  },
  {
    name: "Marble Slab Backsplash",
    category: "Walls",
    base_color: "#f4f0ea",
    roughness: 0.08,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("marble_01"),
      normalMapUrl:    nor("marble_01"),
      roughnessMapUrl: rough("marble_01"),
      aoMapUrl:        ao("marble_01"),
      normalScale: 0.30,
      clearcoat: 0.75,
      clearcoatRoughness: 0.05,
      uvRepeatX: 2, uvRepeatY: 1,
    },
  },
  {
    name: "Handmade Zellige Tile",
    category: "Walls",
    base_color: "#f0ece4",
    roughness: 0.28,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("anti_skid_tiles"),
      normalMapUrl:    nor("anti_skid_tiles"),
      roughnessMapUrl: rough("anti_skid_tiles"),
      aoMapUrl:        ao("anti_skid_tiles"),
      normalScale: 1.00,
      clearcoat: 0.45,
      clearcoatRoughness: 0.12,
      uvRepeatX: 5, uvRepeatY: 5,
    },
  },
  {
    name: "Kitchen Slim Brick",
    category: "Walls",
    base_color: "#c06040",
    roughness: 0.88,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brick_floor"),
      normalMapUrl:    nor("brick_floor"),
      roughnessMapUrl: rough("brick_floor"),
      aoMapUrl:        ao("brick_floor"),
      normalScale: 2.20,
      uvRepeatX: 4, uvRepeatY: 4,
    },
  },
  {
    name: "Cement Encaustic Pattern",
    category: "Walls",
    base_color: "#b8b8b0",
    roughness: 0.62,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("checkered_pavement_tiles"),
      normalMapUrl:    nor("checkered_pavement_tiles"),
      roughnessMapUrl: rough("checkered_pavement_tiles"),
      aoMapUrl:        ao("checkered_pavement_tiles"),
      normalScale: 0.50,
      uvRepeatX: 4, uvRepeatY: 4,
    },
  },
  {
    name: "Warm Clay Plaster Wall",
    category: "Walls",
    base_color: "#d4b896",
    roughness: 0.82,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("clay_plaster"),
      normalMapUrl:    nor("clay_plaster"),
      roughnessMapUrl: rough("clay_plaster"),
      aoMapUrl:        ao("clay_plaster"),
      normalScale: 1.40,
      colorTint: true,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  FLOORING
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Rustic Oak Wide Plank",
    category: "Flooring",
    base_color: "#b87a40",
    roughness: 0.70,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brown_planks_08"),
      normalMapUrl:    nor("brown_planks_08"),
      roughnessMapUrl: rough("brown_planks_08"),
      aoMapUrl:        ao("brown_planks_08"),
      normalScale: 1.00,
      uvRepeatX: 2, uvRepeatY: 4,
    },
  },
  {
    name: "Character Hickory Plank",
    category: "Flooring",
    base_color: "#8a6040",
    roughness: 0.80,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brown_planks_09"),
      normalMapUrl:    nor("brown_planks_09"),
      roughnessMapUrl: rough("brown_planks_09"),
      aoMapUrl:        ao("brown_planks_09"),
      normalScale: 1.20,
      uvRepeatX: 2, uvRepeatY: 4,
    },
  },
  {
    name: "Limestone Large Format",
    category: "Flooring",
    base_color: "#d8d0c0",
    roughness: 0.52,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("clay_floor_001"),
      normalMapUrl:    nor("clay_floor_001"),
      roughnessMapUrl: rough("clay_floor_001"),
      aoMapUrl:        ao("clay_floor_001"),
      normalScale: 0.70,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Warm Brick Kitchen Floor",
    category: "Flooring",
    base_color: "#b85040",
    roughness: 0.92,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brick_floor_02"),
      normalMapUrl:    nor("brick_floor_02"),
      roughnessMapUrl: rough("brick_floor_02"),
      aoMapUrl:        ao("brick_floor_02"),
      normalScale: 2.00,
      uvRepeatX: 3, uvRepeatY: 3,
    },
  },
  {
    name: "Dark Slate Kitchen Floor",
    category: "Flooring",
    base_color: "#3c3c44",
    roughness: 0.88,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("cobblestone_floor_03"),
      normalMapUrl:    nor("cobblestone_floor_03"),
      roughnessMapUrl: rough("cobblestone_floor_03"),
      aoMapUrl:        ao("cobblestone_floor_03"),
      normalScale: 1.80,
      colorTint: true,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  CABINETRY
  // ══════════════════════════════════════════════════════════════════

  {
    name: "Shaker White Cabinet",
    category: "Cabinetry",
    base_color: "#f4f2ef",
    roughness: 0.62,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("clay_plaster"),
      normalMapUrl:    nor("clay_plaster"),
      roughnessMapUrl: rough("clay_plaster"),
      aoMapUrl:        ao("clay_plaster"),
      normalScale: 0.20,
      colorTint: true,
      uvRepeatX: 2, uvRepeatY: 2,
    },
  },
  {
    name: "Midnight Navy Cabinet",
    category: "Cabinetry",
    base_color: "#1c2840",
    roughness: 0.55,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("black_painted_planks"),
      normalMapUrl:    nor("black_painted_planks"),
      roughnessMapUrl: rough("black_painted_planks"),
      aoMapUrl:        ao("black_painted_planks"),
      normalScale: 0.30,
      colorTint: true,
      uvRepeatX: 2, uvRepeatY: 4,
    },
  },
  {
    name: "Sage Green Cabinet",
    category: "Cabinetry",
    base_color: "#6b8a68",
    roughness: 0.58,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("black_painted_planks"),
      normalMapUrl:    nor("black_painted_planks"),
      roughnessMapUrl: rough("black_painted_planks"),
      aoMapUrl:        ao("black_painted_planks"),
      normalScale: 0.30,
      colorTint: true,
      uvRepeatX: 2, uvRepeatY: 4,
    },
  },
  {
    name: "Natural Maple Cabinet",
    category: "Cabinetry",
    base_color: "#d4a060",
    roughness: 0.58,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brown_planks_04"),
      normalMapUrl:    nor("brown_planks_04"),
      roughnessMapUrl: rough("brown_planks_04"),
      aoMapUrl:        ao("brown_planks_04"),
      normalScale: 0.70,
      uvRepeatX: 2, uvRepeatY: 4,
    },
  },
  {
    name: "Satin Walnut Cabinet",
    category: "Cabinetry",
    base_color: "#3a2215",
    roughness: 0.52,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brown_planks_07"),
      normalMapUrl:    nor("brown_planks_07"),
      roughnessMapUrl: rough("brown_planks_07"),
      aoMapUrl:        ao("brown_planks_07"),
      normalScale: 0.80,
      uvRepeatX: 2, uvRepeatY: 4,
    },
  },
  {
    name: "Warm Concrete Wall Panel",
    category: "Walls",
    base_color: "#c8b8a4",
    roughness: 0.88,
    metalness: 0.0,
    properties: {
      albedoMapUrl:    diff("brushed_concrete_2"),
      normalMapUrl:    nor("brushed_concrete_2"),
      roughnessMapUrl: rough("brushed_concrete_2"),
      aoMapUrl:        ao("brushed_concrete_2"),
      normalScale: 1.00,
      colorTint: true,
      uvRepeatX: 1, uvRepeatY: 1,
    },
  },
];

export async function POST() {
  const supabase = db();

  const { data: existing } = await supabase
    .from("material_library")
    .select("name");
  const existingNames = new Set((existing ?? []).map((r: { name: string }) => r.name));

  const toInsert = KITCHEN_MATERIALS.filter(m => !existingNames.has(m.name));

  if (toInsert.length === 0) {
    return NextResponse.json({ message: "All kitchen materials already exist.", inserted: 0 });
  }

  const { data, error } = await supabase
    .from("material_library")
    .insert(toInsert)
    .select("name, category");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    message: `Seeded ${data?.length ?? 0} kitchen materials.`,
    inserted: data?.length ?? 0,
    skipped: KITCHEN_MATERIALS.length - toInsert.length,
    materials: data,
  });
}
