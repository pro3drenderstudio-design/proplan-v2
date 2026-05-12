import { CameraCoords } from "@/utils/sketchfab-camera";

// =============================================================================
// ModelConfigurations
// =============================================================================
export interface ModelCameras {
  blueprint?: CameraCoords;
  interior?: CameraCoords;
  exterior?: CameraCoords;
  overrides?: Record<string, CameraCoords>;
}

export interface ModelNodeGroups {
  roof?: string;
  level1?: string;
  level2?: string;
  level3?: string;
}

export interface ModelConfiguration {
  id: string;
  model_id: string;
  model_name: string | null;
  cameras: ModelCameras;
  node_groups: ModelNodeGroups;
  created_at: string;
}

// =============================================================================
// option_groups
// =============================================================================
export type PhaseColumn = "blueprint" | "interior" | "exterior";

export interface OptionGroup {
  id: string;
  name: string;
  phase: PhaseColumn;
  sort_order: number;
  created_at: string;
}

// =============================================================================
// variables
// =============================================================================
export interface Variable {
  id: string;
  group_id: string;               // FK → option_groups.id
  marketing_name: string;
  node_names: string[];           // Sketchfab node names toggled by this option
  price_impact: number;           // dollar amount added to running total
  is_default: boolean;
  sort_order: number;
  created_at: string;
}

// Convenience type returned by joins (variables + its parent group)
export interface VariableWithGroup extends Variable {
  option_groups: Pick<OptionGroup, "name" | "phase">;
}

// =============================================================================
// geometry_rules
// =============================================================================
export type GeometryRuleAction = "hide" | "show" | "require" | "exclude";

export interface GeometryRule {
  id: string;
  trigger_variable_id: string;    // FK → variables.id
  target_variable_id: string;     // FK → variables.id
  action: GeometryRuleAction;
  created_at: string;
}

// =============================================================================
// projects
// =============================================================================
export interface SceneRenderSettings {
  envLightType?: "preset" | "hdri" | "none";
  envLightPreset?: string;
  envLightHdriUrl?: string;
  hdriIntensity?: number;
  hdriBackgroundBrightness?: number;
  hdriRotation?: number;
  hdriContrast?: number;
  bgType?: "env" | "color" | "sky";
  bgColor?: string;
  ambientIntensity?: number;
  sunIntensity?: number;
  sunColor?: string;
  sunElevationDeg?: number;
  sunAzimuthDeg?: number;
  sunDistance?: number;
  shadows?: boolean;
  shadowRadius?: number;
  skyDomeLights?: boolean;
  skyDomeLightIntensity?: number;
  skyDomeLightColor?: string;
  skyDomeLightShadows?: boolean;
  showClouds?: boolean;
  cloudOpacity?: number;
  cloudSpeed?: number;
  cloudColor?: string;
  cloudHeight?: number;
  cloudCount?: number;
  ssao?: boolean;
  bloom?: boolean;
  groundPlane?: boolean;
  groundColor?: string;
  groundSize?: number;
  showGrid?: boolean;
  skyPreset?: string;
  skyTurbidity?: number;
  skyRayleigh?: number;
  skyMieCoeff?: number;
  skyMieDirectionalG?: number;
  skyRotation?: number;
  skyBrightness?: number;
  showStars?: boolean;
  fogEnabled?: boolean;
  fogColor?: string;
  fogNear?: number;
  fogFar?: number;
  aoRadius?: number;
  aoSamples?: number;
  aoIntensity?: number;
  aaMode?: "none" | "smaa";
  pathTracing?: boolean;
  pathTracingBounces?: number;
  cameraFov?: number;
  architecturalMode?: boolean;
  rotateSpeed?: number;
  panSpeed?: number;
  zoomSpeed?: number;
  screenSpacePanning?: boolean;
  // Structural visibility
  roofNodes?: string[];
  level1Nodes?: string[];
  level2Nodes?: string[];
  level3Nodes?: string[];
  // Buyer-facing messaging
  welcomeMessage?: string;
  exteriorMessage?: string;
  interiorMessage?: string;
}

export interface ProjectCameraDefaults {
  blueprint?: CameraCoords;
  interior?: CameraCoords;
  exterior?: CameraCoords;
  _settings?: SceneRenderSettings;
  _meshOverrides?: unknown;
  _meshBaseMats?: Record<string, string>;
  _glbMatOverrides?: Record<string, { base_color: string; roughness: number; metalness: number; properties?: unknown }>;
}

export interface Project {
  id: string;
  name: string;
  slug?: string;
  company_slug?: string;
  sketchfab_uid: string;
  // R3F viewer fields (v3) — present when project uses GLB instead of Sketchfab
  model_url?: string | null;        // public URL to GLB in Supabase storage
  model_storage_path?: string | null; // storage path for deletion/versioning
  scene_graph?: SceneNode[] | null; // cached mesh tree from GLB scan
  env_preset?: string | null;       // HDR environment preset name
  // Controls which viewer buyers see. null = legacy auto (r3f if model_url, else sketchfab)
  viewer_mode?: "sketchfab" | "r3f" | null;
  base_price: number;
  beds: number;
  baths: number;
  floors?: number;
  sqft?: number;
  home_type?: string;
  description?: string;
  thumbnail_url?: string;
  notes?: string;
  status?: "pending_review" | "in_development" | "in_review" | "live" | "archived";
  views_count?: number;
  camera_defaults: ProjectCameraDefaults;
  created_at: string;
  updated_at: string;
}

// Scene graph node returned from GLB scan
export interface SceneNode {
  name: string;
  type: "Mesh" | "Group" | "Object3D";
  children?: SceneNode[];
}

// =============================================================================
// project_requests
// =============================================================================
export interface RequestCategoryOption {
  name: string;
  price: number;
}

export interface RequestCategory {
  name: string;
  phase: "blueprint" | "interior" | "exterior";
  options: RequestCategoryOption[];
}

export interface ProjectRequest {
  id: string;
  project_name: string;
  home_type: string;
  floors: number;
  beds: number | null;
  baths: number | null;
  square_footage: number | null;
  budget_range: string | null;
  starting_price: number | null;
  description: string | null;
  categories_config: RequestCategory[] | null;
  status: "awaiting_payment" | "pending_review" | "in_development" | "in_review" | "live" | "archived";
  builder_id: string | null;
  payment_reminders_sent: number;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// leads
// =============================================================================
export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "lost";

export interface Lead {
  id: string;
  project_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  configuration: Record<string, unknown>;
  total_value: number;
  status: LeadStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// categories
// =============================================================================
export interface Category {
  id: string;
  project_id: string;
  name: string;
  phase: PhaseColumn;
  default_option: string | null;
  is_mandatory: boolean;
  camera_override: CameraCoords | null;
  sort_order: number;
  created_at: string;
  // Geometry rules: array of option IDs — this category is only shown when at least one is selected
  show_when?: string[] | null;
}

// =============================================================================
// options
// =============================================================================
export type OptionType = "visibility" | "material_variant" | "material_override";

export interface MaterialAssignment {
  mesh_name: string;
  material_id: string;
}

export interface Option {
  id: string;
  category_id: string;
  friendly_name: string;
  node_list: string[];
  node_conditions: Record<string, string>; // { node_name: required_option_id }
  price_impact: number;
  sort_order: number;
  thumbnail_url?: string;
  // R3F / v3 fields
  option_type?: OptionType;           // defaults to "visibility"
  variant_name?: string | null;       // for material_variant: KHR_materials_variants name
  material_id?: string | null;        // for material_override (legacy single-material)
  material_assignments?: MaterialAssignment[] | null; // per-mesh material override (replaces material_id)
  created_at: string;
}

// Extended physical properties for a material (stored as JSONB in material_library.properties)
export interface MaterialProperties {
  // Texture maps
  albedoMapUrl?:       string | null;
  normalMapUrl?:       string | null;
  normalScale?:        number;          // 0–3, default 1
  bumpMapUrl?:         string | null;
  bumpScale?:          number;          // 0–1, default 0.05
  roughnessMapUrl?:    string | null;
  glossinessMapUrl?:   string | null;  // inverse of roughness (white = smooth); used when roughnessMapUrl is absent
  metalnessMapUrl?:    string | null;
  aoMapUrl?:           string | null;
  aoIntensity?:        number;          // 0–2, default 1
  displacementMapUrl?: string | null;
  displacementScale?:  number;          // 0–1, default 0.05
  // Emissive
  emissiveColor?:      string;          // hex, default "#000000"
  emissiveIntensity?:  number;          // 0–5, default 0
  // Opacity
  opacity?:            number;          // 0–1, default 1
  // UV / projection
  uvProjection?:       "uv" | "triplanar" | "planar-top" | "planar-front" | "planar-side";
  uvScale?:            number;          // world-space scale for triplanar/planar (units per tile)
  uvScaleX?:           number;          // triplanar X-axis scale (left/right); falls back to uvScale
  uvScaleY?:           number;          // triplanar Y-axis scale (up/down); falls back to uvScale
  uvScaleZ?:           number;          // triplanar Z-axis scale (front/back); falls back to uvScale
  uvTriOffsetX?:       number;          // triplanar world-space offset X
  uvTriOffsetY?:       number;          // triplanar world-space offset Y
  uvTriOffsetZ?:       number;          // triplanar world-space offset Z
  uvTriRotation?:      number;          // triplanar rotation degrees (applied to all faces)
  uvRepeatX?:          number;          // UV mode tile X, default 1
  uvRepeatY?:          number;          // UV mode tile Y, default 1
  uvOffsetX?:          number;          // default 0
  uvOffsetY?:          number;          // default 0
  uvRotation?:         number;          // degrees, default 0
  // Albedo color behaviour
  colorTint?:          boolean;         // true = multiply base_color over albedo map; false (default) = white (map shows pure)
  albedoBrightness?:   number;          // 0–4, default 1 — multiplies albedo map brightness via color.multiplyScalar
  // Physical (MeshPhysicalMaterial)
  ior?:                number;          // 1–2.5, default 1.5
  clearcoat?:          number;          // 0–1, default 0
  clearcoatRoughness?: number;          // 0–1, default 0
  transmission?:       number;          // 0–1, default 0 (glass)
}

// Material folder (v9)
export interface MaterialFolder {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

// Material library entry (v3)
export interface MaterialLibraryEntry {
  id: string;
  name: string;
  category: string | null;       // "Exterior", "Flooring", "Countertops", etc.
  folder_id?: string | null;     // v9: optional organisational folder
  base_color: string;            // hex color
  roughness: number;
  metalness: number;
  normal_map_url: string | null;
  thumbnail_url: string | null;
  properties?: MaterialProperties; // v6: extended physical properties
  created_at: string;
}

// Saved buyer configuration (v3 — buyer portal)
export interface SavedConfiguration {
  id: string;
  project_id: string;
  lead_id: string | null;
  token: string;                 // unique URL token for portal link
  configuration: Record<string, string>; // categoryId → optionId
  total_price: number;
  thumbnail_url: string | null;
  phase_snapshot: string | null; // "exterior" | "interior" | "blueprint"
  lot_id: string | null;
  created_at: string;
  accessed_at: string | null;
}

// Quote record (v3 — replaces inline lead.configuration)
export interface Quote {
  id: string;
  lead_id: string;
  project_id: string;
  lot_id: string | null;
  configuration: Record<string, string>;
  base_price: number;
  options_total: number;
  lot_modifier: number;
  total_price: number;
  render_url: string | null;
  pdf_url: string | null;
  created_at: string;
}

// =============================================================================
// project_files
// =============================================================================
export interface ProjectFile {
  id: string;
  project_id: string | null;
  request_id: string | null;
  file_name: string;
  file_url: string;
  file_type: "cad" | "image" | "reference";
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

// Convenience type for a fully joined category with its options
export interface CategoryWithOptions extends Category {
  options: Option[];
}

// =============================================================================
// placed_shapes (stored per-project in camera_defaults._placedShapes)
// =============================================================================
export type ShapeType = "box" | "sphere" | "plane" | "cylinder" | "cone" | "torus";

export interface PlacedShapeData {
  id: string;
  shapeType: ShapeType;
  name: string;           // Object3D.name — add to an option's node_list for visibility control
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  roughness: number;
  metalness: number;
  opacity: number;
  wireframe?: boolean;
  parentMesh?: string;    // Mesh name this shape is parented to (position is relative to parent)
  material_id?: string;   // Material library entry ID — overrides inline color/roughness/metalness
}

// =============================================================================
// placed_props (stored per-project in camera_defaults._placedProps)
// =============================================================================
export interface PlacedPropData {
  id: string;              // nanoid
  propId: string;          // catalog entry id
  modelUrl: string;
  position: [number, number, number];
  rotation: [number, number, number];  // euler XYZ radians
  scale: [number, number, number];
}

export interface PlacedLight {
  id: string;
  type: "point" | "spot";
  position: [number, number, number];
  color: string;        // hex e.g. "#ffe8cc"
  intensity: number;    // 0–20
  distance: number;     // falloff range — 0 = infinite
  decay: number;        // 2 = physically correct
  castShadow: boolean;
  // Spot only
  angle?: number;       // radians, default π/6
  penumbra?: number;    // 0–1 edge softness
}

// Prop catalog entry (hardcoded catalog; no DB table needed)
export interface PropCatalogEntry {
  id: string;
  name: string;
  category: "tree" | "shrub" | "rock" | "grass" | "ground_cover" | "other";
  thumbnailUrl: string;
  modelUrl: string;
  defaultScale: [number, number, number];
}

// =============================================================================
// project_addons (stored per-project in camera_defaults._addons)
// =============================================================================
export interface ProjectAddon {
  id: string;
  name: string;
  modelUrl: string;
  storagePath?: string;
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
  visible: boolean;
}

// Camera bookmark — named camera position stored in camera_defaults._cameraBookmarks
export interface CameraBookmark {
  id: string;
  name: string;
  pos: [number, number, number];
  target: [number, number, number];
  fov: number;
}

// Annotation pin — 3D space comment stored in camera_defaults._annotations
export interface AnnotationPin {
  id: string;
  position: [number, number, number];
  text: string;
  color: string;
}

// =============================================================================
// geometry_rules (project-scoped)
// =============================================================================
export interface ProjectGeometryRule {
  id: string;
  project_id: string;
  node_id: string;
  parent_option_name: string;
  action: "hide" | "show";
  context: string | null;
  created_at: string;
}

// =============================================================================
// builders
// =============================================================================
export interface Builder {
  id: string;
  company_name: string;
  company_slug: string;
  website_url: string | null;
  primary_contact_name: string | null;
  contact_email: string | null;
  phone: string | null;
  plan_tier: "launch" | "studio" | "scale" | "starter" | "pro" | "enterprise";
  billing_cycle: "monthly" | "annually";
  billing_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  tax_id: string | null;
  ein: string | null;
  status: "active" | "inactive" | "suspended" | "trial";
  location: string | null;
  notes: string | null;
  logo_url: string | null;
  accent_color: string | null;
  billing_email: string | null;
  vat_tax_id: string | null;
  payment_method_last4: string | null;
  payment_method_type: string | null;
  payment_method_expiry: string | null;
  seats_included: number;
  seats_used: number;
  rendering_credits: number;
  rendering_credits_total: number;
  ai_credits_remaining: number;
  ai_credits_total: number;
  max_projects: number;
  max_communities: number;
  max_monthly_quotes: number;
  max_storage_gb: number;
  active_projects_count: number;
  active_communities_count: number;
  monthly_quotes_count: number;
  storage_used_gb: number;
  client_since: string;
  // Stripe
  stripe_customer_id:          string | null;
  stripe_subscription_id:      string | null;
  stripe_subscription_status:  string | null;  // active | trialing | past_due | canceled | paused
  current_period_end:          string | null;
  plan_id:                     string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// team_members
// =============================================================================
export type TeamRole = "super_admin" | "manager" | "editor" | "viewer" | "customer_service" | "artist" | "builder_admin" | "builder_member";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  permissions: Record<string, boolean>;
  builder_id: string | null;
  invite_token: string | null;
  invite_status: "pending" | "accepted";
  invite_sent_at: string | null;
  last_activity: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "super_admin" | "manager" | "editor" | "viewer" | "customer_service" | "artist" | "builder_admin" | "builder_member";
  builder_id: string | null;
  team_member_id: string | null;
  avatar_url: string | null;
  created_at: string;
}

// =============================================================================
// support_tickets
// =============================================================================
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export interface SupportTicket {
  id: string;
  builder_name: string | null;
  builder_email: string | null;
  subject: string;
  category: string;
  priority: TicketPriority;
  message: string;
  status: TicketStatus;
  assigned_to: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// communities + lots
// =============================================================================
export interface MapSettings {
  default_label_color?: string;  // hex, fallback when lot.text_color is null
  default_label_size?: number;   // pt, fallback when lot.label_font_size is null
  show_labels?: boolean;         // hide all lot labels when false
  stroke_width?: number;         // 1–5
}

export interface Community {
  id: string;
  company_slug: string | null;
  name: string;
  slug: string;
  description: string | null;
  site_map_url: string | null;
  map_settings: MapSettings | null;
  created_at: string;
  updated_at: string;
}

export type LotStatus = "available" | "reserved" | "sold";

export interface Lot {
  id: string;
  community_id: string;
  lot_number: string;
  status: LotStatus;
  project_id: string | null;
  /** Array of [x, y] percentage points (0–100) relative to the site map image */
  polygon: [number, number][];
  price_modifier: number;
  notes: string | null;
  text_color: string | null;
  label_x: number | null;
  label_y: number | null;
  label_font_size: number | null;
  cta_type:  "configurator" | "external" | "contact" | "none";
  cta_label: string | null;
  cta_url:   string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunityWithLots extends Community {
  lots: Lot[];
}

// =============================================================================
// plans
// =============================================================================
// =============================================================================
// addons + builder_addons
// =============================================================================
export type AddonSlug = "configurator" | "ai-renders" | "site-maps" | "traditional-renders";

export interface Addon {
  id:                         string;
  slug:                       AddonSlug;
  name:                       string;
  description:                string | null;
  monthly_price_cents:        number;
  included_units:             number | null;   // null = unlimited
  unit_label:                 string | null;   // 'renders' | 'AI credits'
  overage_block_size:         number | null;
  overage_block_price_cents:  number | null;
  setup_fee_cents:            number;          // per-community-request fee (site-maps)
  stripe_price_id_monthly:    string | null;
  stripe_price_id_annually:   string | null;
  show_when_locked:           boolean;
  sort_order:                 number;
  is_active:                  boolean;
  created_at:                 string;
  updated_at:                 string;
}

export interface BuilderAddon {
  id:                           string;
  builder_id:                   string;
  addon_slug:                   AddonSlug;
  stripe_subscription_item_id:  string | null;
  status:                       "active" | "canceled" | "past_due";
  credits_remaining:            number | null;
  credits_reset_at:             string | null;
  activated_at:                 string;
  canceled_at:                  string | null;
  created_at:                   string;
}

// =============================================================================
// site_map_requests
// =============================================================================
export type SiteMapRequestStatus =
  | "awaiting_payment"
  | "pending_review"
  | "in_progress"
  | "complete"
  | "archived";

export interface SiteMapRequest {
  id:                   string;
  builder_id:           string;
  community_name:       string;
  community_address:    string | null;
  estimated_lot_count:  number | null;
  phases:               number;
  plat_map_files:       { name: string; url: string; size: number }[];
  reference_links:      string[];
  style_notes:          string | null;
  target_date:          string | null;
  status:               SiteMapRequestStatus;
  setup_fee_cents:      number;
  stripe_session_id:    string | null;
  community_id:         string | null;
  admin_notes:          string | null;
  created_at:           string;
  updated_at:           string;
}

// =============================================================================
// crm_integrations
// =============================================================================
export type CrmType = "hubspot" | "followupboss" | "zapier" | "lasso" | "csv";

export interface CrmIntegration {
  id:           string;
  builder_id:   string;
  crm_type:     CrmType;
  api_key:      string | null;
  webhook_url:  string | null;
  portal_id:    string | null;
  config:       Record<string, unknown>;
  enabled:      boolean;
  last_sync_at: string | null;
  created_at:   string;
  updated_at:   string;
}

// =============================================================================
// Plan (legacy tiered plans — kept for existing builders)
// =============================================================================
export interface Plan {
  id:                         string;
  name:                       string;   // 'launch' | 'studio' | 'scale'
  display_name:               string;
  price_monthly:              number;   // cents
  price_annually:             number;   // cents
  rendering_credits_monthly:  number;   // -1 = unlimited
  ai_credits_monthly:         number;
  max_projects:               number;   // -1 = unlimited
  max_communities:            number;   // -1 = unlimited
  seats_included:             number;
  max_storage_gb:             number;
  includes_sitemaps:          boolean;
  stripe_price_id_monthly:    string | null;
  stripe_price_id_annually:   string | null;
  // Fees & credit packs (managed in admin)
  model_setup_fee:            number;   // cents, default $1,000
  extra_ai_pack_qty:          number;   // credits per top-up pack
  extra_ai_pack_price:        number;   // cents per pack
  extra_render_pack_qty:      number;   // renders per top-up pack
  extra_render_pack_price:    number;   // cents per pack
  is_active:                  boolean;
  sort_order:                 number;
  created_at:                 string;
  updated_at:                 string;
}

// =============================================================================
// render_requests
// =============================================================================
export type RenderRequestType     = "exterior_elevation" | "interior" | "aerial" | "floor_plan" | "custom";
export type RenderRequestPriority = "standard" | "rush";
export type RenderRequestStatus   =
  | "submitted"
  | "in_queue"
  | "in_production"
  | "ready_for_review"
  | "delivered"
  | "revision_requested"
  | "completed";

export interface RenderRequest {
  id:                        string;
  builder_id:                string;
  project_id:                string | null;
  type:                      RenderRequestType;
  configuration_notes:       string | null;
  reference_files:           string[];
  priority:                  RenderRequestPriority;
  credits_used:              number;
  status:                    RenderRequestStatus;
  revision_notes:            string | null;
  deliverable_urls:          string[];
  assigned_to:               string | null;
  admin_notes:               string | null;
  title:                     string | null;
  created_at:                string;
  delivered_at:              string | null;
  proposed_completion_date:  string | null;
  completion_date_status:    "none" | "proposed" | "accepted" | "declined" | "counter_proposed";
}

// =============================================================================
// render_messages
// =============================================================================
export interface RenderMessageAttachment {
  url:  string;
  name: string;
  type: string;   // mime type
  size: number;   // bytes
}

export interface RenderMessage {
  id:                string;
  render_request_id: string;
  sender_type:       "builder" | "admin";
  sender_id:         string;
  sender_name:       string;
  body:              string | null;
  attachments:       RenderMessageAttachment[];
  is_delivery:       boolean;
  created_at:        string;
}

// =============================================================================
// project_messages
// =============================================================================
export interface ProjectMessageAttachment {
  url:  string;
  name: string;
  type: string;
  size: number;
}

export interface ProjectMessage {
  id:          string;
  project_id:  string;
  sender_type: "builder" | "admin";
  sender_id:   string;
  sender_name: string;
  body:        string | null;
  attachments: ProjectMessageAttachment[];
  created_at:  string;
}

// =============================================================================
// variable_map
// =============================================================================
export interface VariableMapEntry {
  id: string;
  marketing_name: string;
  node_names: string[];
  price_impact: number;
  category: string;
  created_at: string;
}

// =============================================================================
// Supabase Database type
// =============================================================================
export interface Database {
  public: {
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Tables: {
      ModelConfigurations: {
        Row:    ModelConfiguration;
        Insert: Omit<ModelConfiguration, "id" | "created_at">;
        Update: Partial<Omit<ModelConfiguration, "id" | "created_at">>;
        Relationships: [];
      };
      option_groups: {
        Row:    OptionGroup;
        Insert: Omit<OptionGroup, "id" | "created_at">;
        Update: Partial<Omit<OptionGroup, "id" | "created_at">>;
        Relationships: [];
      };
      variables: {
        Row:    Variable;
        Insert: Omit<Variable, "id" | "created_at">;
        Update: Partial<Omit<Variable, "id" | "created_at">>;
        Relationships: [];
      };
      geometry_rules: {
        Row:    GeometryRule;
        Insert: Omit<GeometryRule, "id" | "created_at">;
        Update: Partial<Omit<GeometryRule, "id" | "created_at">>;
        Relationships: [];
      };
      variable_map: {
        Row:    VariableMapEntry;
        Insert: Omit<VariableMapEntry, "id" | "created_at">;
        Update: Partial<Omit<VariableMapEntry, "id" | "created_at">>;
        Relationships: [];
      };
      projects: {
        Row:    Project;
        Insert: Omit<Project, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Project, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      categories: {
        Row:    Category;
        Insert: Omit<Category, "id" | "created_at">;
        Update: Partial<Omit<Category, "id" | "created_at">>;
        Relationships: [];
      };
      options: {
        Row:    Option;
        Insert: Omit<Option, "id" | "created_at">;
        Update: Partial<Omit<Option, "id" | "created_at">>;
        Relationships: [];
      };
      project_geometry_rules: {
        Row:    ProjectGeometryRule;
        Insert: Omit<ProjectGeometryRule, "id" | "created_at">;
        Update: Partial<Omit<ProjectGeometryRule, "id" | "created_at">>;
        Relationships: [];
      };
      project_requests: {
        Row:    ProjectRequest;
        Insert: Omit<ProjectRequest, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<ProjectRequest, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      leads: {
        Row:    Lead;
        Insert: Omit<Lead, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Lead, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
    };
  };
}
