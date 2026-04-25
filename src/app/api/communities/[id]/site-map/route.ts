import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { uploadToR2 } from "@/lib/r2";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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

  const ext    = file.name.split(".").pop() ?? "png";
  const key    = `community-site-maps/${id}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let publicUrl: string;
  try {
    publicUrl = await uploadToR2(key, buffer, file.type);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("communities") as any)
    .update({ site_map_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ url: publicUrl });
}
