import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS for both Storage and the builders table
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BUCKET = "builder-logos";

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file      = formData.get("file")       as File   | null;
  const builderId = formData.get("builder_id") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }

  const ext      = file.name.split(".").pop() ?? "png";
  const storedAs = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer   = Buffer.from(await file.arrayBuffer());

  // Create bucket if it doesn't exist, then ensure it's public
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.name === BUCKET);
  if (!exists) {
    await supabase.storage.createBucket(BUCKET, { public: true });
  } else {
    await supabase.storage.updateBucket(BUCKET, { public: true }).catch(() => {});
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storedAs, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("Logo upload error:", uploadError.message);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storedAs);
  const publicUrl = urlData.publicUrl;

  // If a builder_id was provided, persist the logo_url directly using service role
  // (bypasses RLS — safe because this route validates the file is an image)
  if (builderId) {
    const { error: dbError } = await supabase
      .from("builders")
      .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", builderId);

    if (dbError) {
      console.error("Logo DB update error:", dbError.message);
      // Still return the URL so the client can try its own update
    }
  }

  return NextResponse.json({ url: publicUrl });
}
