import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BUCKET = "project-files";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: requestId } = await params;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file     = formData.get("file") as File | null;
  const fileType = (formData.get("file_type") as string) ?? "image";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const storedAs = `requests/${requestId}/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, "_")}`;
  const buffer   = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storedAs, buffer, { contentType: file.type || "application/octet-stream", upsert: false });

  if (uploadError) {
    console.error("File upload error:", uploadError.message);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storedAs);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error: dbError } = await (supabase.from("project_files") as any)
    .insert({
      project_id: null,
      request_id: requestId,
      file_name:  file.name,
      file_url:   urlData.publicUrl,
      file_type:  fileType,
      mime_type:  file.type || null,
      size_bytes: file.size,
    })
    .select()
    .single();

  if (dbError) {
    console.error("project_files insert:", dbError.message);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(row);
}
