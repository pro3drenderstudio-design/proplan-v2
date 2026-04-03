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
export interface ProjectCameraDefaults {
  blueprint?: CameraCoords;
  interior?: CameraCoords;
  exterior?: CameraCoords;
}

export interface Project {
  id: string;
  name: string;
  slug?: string;
  company_slug?: string;
  sketchfab_uid: string;
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
  status: "pending_review" | "in_development" | "in_review" | "live" | "archived";
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
}

// =============================================================================
// options
// =============================================================================
export interface Option {
  id: string;
  category_id: string;
  friendly_name: string;
  node_list: string[];
  node_conditions: Record<string, string>; // { node_name: required_option_id }
  price_impact: number;
  sort_order: number;
  thumbnail_url?: string;
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
  max_projects: number;
  max_monthly_quotes: number;
  max_storage_gb: number;
  active_projects_count: number;
  monthly_quotes_count: number;
  storage_used_gb: number;
  client_since: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// team_members
// =============================================================================
export type TeamRole = "super_admin" | "manager" | "editor" | "viewer" | "customer_service" | "artist";

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
export interface Community {
  id: string;
  company_slug: string | null;
  name: string;
  slug: string;
  description: string | null;
  site_map_url: string | null;
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
  created_at: string;
  updated_at: string;
}

export interface CommunityWithLots extends Community {
  lots: Lot[];
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
