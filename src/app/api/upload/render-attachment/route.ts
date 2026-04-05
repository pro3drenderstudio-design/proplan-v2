import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Service-role client — bypasses RLS for storage operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);
  const path = `attachments/${Date.now()}-${file.name}`;

  // Ensure the bucket exists (create it if missing)
  const { error: bucketError } = await supabase.storage.getBucket("render-attachments");
  if (bucketError) {
    const { error: createError } = await supabase.storage.createBucket("render-attachments", { public: true });
    if (createError) {
      console.error("render-attachment: could not create bucket:", createError.message);
      return NextResponse.json({ error: "Storage bucket unavailable: " + createError.message }, { status: 500 });
    }
  }

  const { error: uploadError } = await supabase.storage
    .from("render-attachments")
    .upload(path, buffer, {
      contentType:  file.type || "application/octet-stream",
      upsert:       false,
    });

  if (uploadError) {
    console.error("render-attachment upload error:", uploadError.message);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from("render-attachments")
    .getPublicUrl(path);

  return NextResponse.json({
    url:  urlData.publicUrl,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
  });
}
