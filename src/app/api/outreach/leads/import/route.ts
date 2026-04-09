import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import type { CsvFieldMapping, ImportResult } from "@/types/outreach";

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest) {
  const formData  = await req.formData();
  const file      = formData.get("file") as File | null;
  const listId    = formData.get("list_id") as string | null;
  const mappingRaw = formData.get("mapping") as string | null;

  if (!file || !listId || !mappingRaw) {
    return NextResponse.json({ error: "file, list_id, and mapping are required" }, { status: 400 });
  }

  const mapping: CsvFieldMapping[] = JSON.parse(mappingRaw);
  const text = await file.text();
  const { data: rows } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const db = supabase();

  // Fetch unsubscribe list for fast lookup
  const { data: unsubs } = await db.from("outreach_unsubscribes").select("email");
  const unsubSet = new Set((unsubs ?? []).map((u) => u.email.toLowerCase()));

  const result: ImportResult = { imported: 0, skipped_unsubscribed: 0, skipped_duplicate: 0, errors: [] };
  const batch: Record<string, unknown>[] = [];
  const seenEmails = new Set<string>();

  for (const row of rows) {
    // Map CSV columns to lead fields
    const lead: Record<string, unknown> = { list_id: listId, custom_fields: {} };

    for (const map of mapping) {
      const value = row[map.csv_column]?.trim() ?? "";
      if (!value) continue;
      if (map.db_field.startsWith("custom:")) {
        const key = map.db_field.slice(7);
        (lead.custom_fields as Record<string, string>)[key] = value;
      } else {
        lead[map.db_field] = value;
      }
    }

    const email = (lead.email as string | undefined)?.toLowerCase();
    if (!email) { result.errors.push(`Row missing email: ${JSON.stringify(row)}`); continue; }
    if (unsubSet.has(email)) { result.skipped_unsubscribed++; continue; }
    if (seenEmails.has(email)) { result.skipped_duplicate++; continue; }

    seenEmails.add(email);
    lead.email = email;
    batch.push(lead);
  }

  // Bulk upsert in chunks of 500
  const CHUNK = 500;
  for (let i = 0; i < batch.length; i += CHUNK) {
    const chunk = batch.slice(i, i + CHUNK);
    const { error } = await db
      .from("outreach_leads")
      .upsert(chunk as never[], { onConflict: "email,list_id" });
    if (error) {
      result.errors.push(error.message);
    } else {
      result.imported += chunk.length;
    }
  }

  return NextResponse.json(result);
}
