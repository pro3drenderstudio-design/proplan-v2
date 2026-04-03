"""
ProPlan Studio -- Bubble -> Supabase CSV Importer
================================================
Reads the four Bubble export CSVs and imports them into Supabase in
the correct FK order:  projects -> categories -> options -> geometry_rules

Usage:
    pip install supabase python-dotenv
    python import_data.py

The script is idempotent: re-running it upserts rather than duplicating rows.
"""

import csv
import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client, Client

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

# Directory containing the exported CSVs -- change if yours are elsewhere
CSV_DIR = Path(r"C:\Users\Abdul Malik\Downloads")

# Exact filenames (latest exports)
FILES = {
    "projects":    CSV_DIR / "export_All-Projects_2026-04-01_11-31-35.csv",
    "categories":  CSV_DIR / "export_All-Variable-Categories_2026-04-01_11-32-05.csv",
    "options":     CSV_DIR / "export_All-Variable-Maps_2026-04-01_11-32-10.csv",
    "geo_rules":   CSV_DIR / "export_All-Geometry-Rules_2026-04-01_11-31-11.csv",
}

# Map project names (as they appear in Parent_Project columns) to their
# Sketchfab model UIDs. Add more rows here when you add new models.
SKETCHFAB_UIDS: dict[str, str] = {
    "The Cypress": "3e7d27f2295043739399b6400593be10",
}

# ---------------------------------------------------------------------------
# Supabase client -- reads from .env.local in the project root
# ---------------------------------------------------------------------------

ENV_PATH = Path(__file__).parent / ".env.local"
load_dotenv(ENV_PATH)

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
# Import requires the service role key to bypass RLS -- never use this in the browser
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    sys.exit(
        "ERROR: SUPABASE_SERVICE_ROLE_KEY not found in .env.local\n"
        "Get it from: Supabase Dashboard -> Project Settings -> API -> service_role\n"
        f"Expected .env.local at: {ENV_PATH}"
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ---------------------------------------------------------------------------
# Cleaning helpers
# ---------------------------------------------------------------------------

def parse_camera(raw: str) -> dict | None:
    """
    Converts Bubble camera strings into a CameraCoords object.

    Input:  "1.965,-1.289,41.802|1.980,-0.563,-4.387"
    Output: { "pos": [1.965, -1.289, 41.802], "target": [1.980, -0.563, -4.387] }

    Returns None if the string is empty or malformed.
    """
    raw = raw.strip()
    if not raw:
        return None

    parts = raw.split("|")
    if len(parts) != 2:
        print(f"  WARN: unexpected camera format, skipping: {raw!r}")
        return None

    try:
        pos    = [float(v) for v in parts[0].split(",")]
        target = [float(v) for v in parts[1].split(",")]
    except ValueError:
        print(f"  WARN: could not parse camera floats, skipping: {raw!r}")
        return None

    if len(pos) != 3 or len(target) != 3:
        print(f"  WARN: camera coords not 3-dimensional, skipping: {raw!r}")
        return None

    return {"pos": pos, "target": target}


def parse_node_list(raw: str) -> list[str]:
    """
    Splits Bubble's comma-separated node strings into a clean array.

    Input:  "Level 1 Floor Dark Walnut_Flooring Dark Walnut_0 , Level 1 Grass_Grass_0 "
    Output: ["Level 1 Floor Dark Walnut_Flooring Dark Walnut_0", "Level 1 Grass_Grass_0"]

    Handles both ' , ' (with spaces) and ',' (no spaces).
    """
    if not raw or not raw.strip():
        return []

    # Bubble exports use " , " (space-comma-space) as the delimiter
    nodes = [n.strip() for n in re.split(r"\s*,\s*", raw) if n.strip()]
    return nodes


def read_csv(path: Path) -> list[dict]:
    """Reads a CSV file and returns a list of row dicts, skipping empty rows."""
    if not path.exists():
        sys.exit(f"ERROR: CSV not found: {path}")

    rows = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Skip entirely empty rows (common in Bubble exports)
            if any(v.strip() for v in row.values()):
                rows.append(row)

    print(f"  Read {len(rows)} rows from {path.name}")
    return rows


# ---------------------------------------------------------------------------
# Import steps
# ---------------------------------------------------------------------------

def import_projects() -> dict[str, str]:
    """
    Inserts/upserts projects. Returns { project_name -> uuid } for FK resolution.

    The Bubble Projects CSV has no Name column -- the project name is inferred
    from the unique Parent_Project values in the Variable-Maps file.
    Camera fields are parsed from Blueprint and Exterior; Interior defaults to
    None since that column is absent in the export.
    """
    print("\n[1/4] Importing projects...")

    proj_rows = read_csv(FILES["projects"])
    var_rows  = read_csv(FILES["options"])

    # Derive unique project names from Variable-Maps
    project_names = sorted({r["Parent_Project"].strip() for r in var_rows if r["Parent_Project"].strip()})
    print(f"  Found {len(project_names)} unique project name(s): {project_names}")

    # There's one Projects CSV row -- attempt to pair it with each project name
    # by position (Bubble exports one row per project in the same order)
    name_to_uuid: dict[str, str] = {}

    for i, name in enumerate(project_names):
        csv_row = proj_rows[i] if i < len(proj_rows) else {}

        # Parse cameras
        cam_blueprint = parse_camera(csv_row.get("Camera_Position_Blueprint", ""))
        cam_exterior  = parse_camera(csv_row.get("Camera_Position_Exterior", ""))

        camera_defaults: dict = {}
        if cam_blueprint:
            camera_defaults["blueprint"] = cam_blueprint
        if cam_exterior:
            camera_defaults["exterior"] = cam_exterior

        uid = SKETCHFAB_UIDS.get(name)
        if not uid:
            print(f"  WARN: No Sketchfab UID for project '{name}'. Add it to SKETCHFAB_UIDS. Skipping.")
            continue

        payload = {
            "name":             name,
            "sketchfab_uid":    uid,
            "base_price":       float(csv_row.get("Base_Price", 0) or 0),
            "beds":             int(float(csv_row.get("Beds", 0) or 0)),
            "baths":            float(csv_row.get("Bathrooms", 0) or 0),
            "camera_defaults":  camera_defaults,
        }

        result = (
            supabase.table("projects")
            .upsert(payload, on_conflict="sketchfab_uid")
            .execute()
        )

        inserted_id = result.data[0]["id"]
        name_to_uuid[name] = inserted_id
        print(f"  OK Project '{name}' -> {inserted_id}")

    return name_to_uuid


def import_categories(project_map: dict[str, str]) -> dict[tuple[str, str], str]:
    """
    Inserts/upserts categories linked to their parent project.
    Returns { (project_name, category_name) -> uuid } for option FK resolution.
    """
    print("\n[2/4] Importing categories...")

    rows = read_csv(FILES["categories"])
    category_map: dict[tuple[str, str], str] = {}

    for row in rows:
        # Resolve project -- categories reference project via Builder_Owner (Bubble ID)
        # We match by looking up all projects and finding the one whose name appears
        # in the options file for this same Builder_Owner. For single-project imports
        # we can use the first available project_id.
        if len(project_map) == 1:
            project_name = next(iter(project_map))
        else:
            # Multi-project: Bubble doesn't store project name in categories CSV,
            # so we fall back to the first project. Extend this logic if needed.
            project_name = next(iter(project_map))
            print(f"  WARN: Multi-project import -- assigning all categories to '{project_name}'")

        project_id = project_map.get(project_name)
        if not project_id:
            print(f"  WARN: No project ID found, skipping category '{row['Name']}'")
            continue

        cam_override = parse_camera(row.get("Camera_Override", ""))
        is_mandatory = row.get("Is_Mandatory", "").strip().lower() in ("yes", "true", "1")
        phase_raw    = row.get("Phase", "").strip().lower()

        if phase_raw not in ("blueprint", "interior", "exterior"):
            print(f"  WARN: Unknown phase '{phase_raw}' for category '{row['Name']}', skipping.")
            continue

        cat_name = row["Name"].strip()
        payload = {
            "project_id":      project_id,
            "name":            cat_name,
            "phase":           phase_raw,
            "default_option":  row.get("Default_Option", "").strip() or None,
            "is_mandatory":    is_mandatory,
            "camera_override": cam_override,
        }

        # Check if already exists, update if so, insert if not
        existing = (
            supabase.table("categories")
            .select("id")
            .eq("project_id", project_id)
            .eq("name", cat_name)
            .execute()
        )
        if existing.data:
            inserted_id = existing.data[0]["id"]
            supabase.table("categories").update(payload).eq("id", inserted_id).execute()
        else:
            result = supabase.table("categories").insert(payload).execute()
            inserted_id = result.data[0]["id"]

        category_map[(project_name, cat_name)] = inserted_id
        print(f"  OK Category '{cat_name}' ({phase_raw}) -> {inserted_id}")

    return category_map


def import_options(
    project_map: dict[str, str],
    category_map: dict[tuple[str, str], str],
) -> None:
    """Inserts/upserts options, splitting Node_Show into a text array."""
    print("\n[3/4] Importing options...")

    rows = read_csv(FILES["options"])
    skipped = 0

    for row in rows:
        project_name  = row.get("Parent_Project", "").strip()
        category_name = row.get("Category", "").strip()
        friendly_name = row.get("Friendly_Name", "").strip()

        if not friendly_name:
            skipped += 1
            continue

        # Resolve category FK
        cat_id = category_map.get((project_name, category_name))
        if not cat_id:
            # Category may not have been imported yet (e.g. new category not in categories CSV)
            # Attempt a live lookup
            project_id = project_map.get(project_name)
            if project_id:
                result = (
                    supabase.table("categories")
                    .select("id")
                    .eq("project_id", project_id)
                    .eq("name", category_name)
                    .single()
                    .execute()
                )
                if result.data:
                    cat_id = result.data["id"]
                    category_map[(project_name, category_name)] = cat_id

        if not cat_id:
            print(f"  WARN: Category '{category_name}' not found for option '{friendly_name}', skipping.")
            skipped += 1
            continue

        node_list    = parse_node_list(row.get("Node_Show", ""))
        price_impact = float(row.get("Price_Addon", 0) or 0)

        payload = {
            "category_id":   cat_id,
            "friendly_name": friendly_name,
            "node_list":     node_list,
            "price_impact":  price_impact,
        }

        existing = (
            supabase.table("options")
            .select("id")
            .eq("category_id", cat_id)
            .eq("friendly_name", friendly_name)
            .execute()
        )
        if existing.data:
            supabase.table("options").update(payload).eq("id", existing.data[0]["id"]).execute()
        else:
            supabase.table("options").insert(payload).execute()
        print(f"  OK Option '{friendly_name}' ({len(node_list)} nodes)")

    if skipped:
        print(f"  Skipped {skipped} row(s) with missing data.")


def import_geometry_rules(project_map: dict[str, str]) -> None:
    """Inserts/upserts geometry rules linked to their parent project."""
    print("\n[4/4] Importing geometry rules...")

    rows = read_csv(FILES["geo_rules"])
    skipped = 0

    for row in rows:
        project_name = row.get("Project", "").strip()
        node_id      = row.get("Node_ID", "").strip()
        parent_opt   = row.get("Parent_Option", "").strip()
        context      = row.get("Required_Context", "").strip() or None

        if not node_id:
            skipped += 1
            continue

        project_id = project_map.get(project_name)
        if not project_id:
            print(f"  WARN: Unknown project '{project_name}' for rule on node '{node_id}', skipping.")
            skipped += 1
            continue

        payload = {
            "project_id":          project_id,
            "node_id":             node_id,
            "parent_option_name":  parent_opt,  # empty string = "always hide" rule
            "action":              "hide",       # Bubble rules are always hide rules
            "context":             context,
        }

        existing = (
            supabase.table("geometry_rules")
            .select("id")
            .eq("project_id", project_id)
            .eq("node_id", node_id)
            .eq("parent_option_name", parent_opt or "")
            .execute()
        )
        if existing.data:
            supabase.table("geometry_rules").update(payload).eq("id", existing.data[0]["id"]).execute()
        else:
            supabase.table("geometry_rules").insert(payload).execute()
        print(f"  OK Rule: hide '{node_id}'" + (f" when '{parent_opt}'" if parent_opt else " (always)"))

    if skipped:
        print(f"  Skipped {skipped} row(s) with missing data.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    print("=" * 60)
    print("ProPlan Studio -- Bubble -> Supabase Importer")
    print("=" * 60)

    # Validate all files exist before starting
    for label, path in FILES.items():
        if not path.exists():
            sys.exit(f"ERROR: Missing file for '{label}': {path}")

    project_map  = import_projects()

    if not project_map:
        sys.exit("No projects imported -- check SKETCHFAB_UIDS mapping and re-run.")

    category_map = import_categories(project_map)
    import_options(project_map, category_map)
    import_geometry_rules(project_map)

    print("\n" + "=" * 60)
    print("Import complete.")
    print("=" * 60)


if __name__ == "__main__":
    main()
