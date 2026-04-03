import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BUCKET = "community-site-maps";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "Invalid form data" }, { status: 400 }); }

  const file = formData.get("file") as File | null;
  if (!file)                           return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Must be an image" }, { status: 400 });

  const ext      = file.name.split(".").pop() ?? "png";
  const storedAs = `${id}/${Date.now()}.${ext}`;
  const buffer   = Buffer.from(await file.arrayBuffer());

  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some(b => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true });
  } else {
    await supabase.storage.updateBucket(BUCKET, { public: true }).catch(() => {});
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storedAs, buffer, { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storedAs);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("communities") as any)
    .update({ site_map_url: urlData.publicUrl, updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ url: urlData.publicUrl });
}
