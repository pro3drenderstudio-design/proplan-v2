import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { uploadToR2 } from "@/lib/r2";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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

  const ext    = file.name.split(".").pop() ?? "png";
  const key    = `builder-logos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let publicUrl: string;
  try {
    publicUrl = await uploadToR2(key, buffer, file.type);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Logo R2 upload error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (builderId) {
    const { error: dbError } = await supabase
      .from("builders")
      .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", builderId);

    if (dbError) console.error("Logo DB update error:", dbError.message);
  }

  return NextResponse.json({ url: publicUrl });
}
