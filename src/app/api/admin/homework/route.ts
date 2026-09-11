import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/admin";
import type { Subject } from "@/lib/types";

function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } | null {
  const match = /^data:(image\/[\w+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const mime = match[1];
  const b64 = match[2];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext = mime.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  return { blob: new Blob([bytes], { type: mime }), ext };
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Ej behörig" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    userId?: string;
    title?: string;
    subject?: Subject;
    dueDate?: string;
    description?: string;
    helpNeeded?: string;
    pageHints?: string;
    extractedText?: string;
    photoDataUrl?: string;
  } | null;

  if (!body?.userId || !body.title?.trim() || !body.dueDate || !body.subject) {
    return NextResponse.json(
      { error: "Användare, titel, ämne och datum krävs" },
      { status: 400 },
    );
  }

  try {
    const supabase = createServiceClient();
    const id = crypto.randomUUID();
    let photoPath: string | null = null;

    if (body.photoDataUrl?.startsWith("data:image")) {
      const parsed = dataUrlToBlob(body.photoDataUrl);
      if (parsed) {
        photoPath = `${body.userId}/${id}.${parsed.ext}`;
        const { error: upErr } = await supabase.storage
          .from("homework-photos")
          .upload(photoPath, parsed.blob, {
            upsert: true,
            contentType: parsed.blob.type,
          });
        if (upErr) {
          return NextResponse.json({ error: upErr.message }, { status: 400 });
        }
      }
    }

    const { error } = await supabase.from("homeworks").insert({
      id,
      user_id: body.userId,
      title: body.title.trim(),
      subject: body.subject,
      due_date: body.dueDate,
      status: "todo",
      description: body.description?.trim() || "",
      help_needed: body.helpNeeded?.trim() || "",
      page_hints: body.pageHints?.trim() || "",
      extracted_text:
        body.extractedText?.trim() ||
        body.description?.trim() ||
        `Läxa: ${body.title}. Ämne: ${body.subject}.`,
      reminder_enabled: true,
      photo_path: photoPath,
      created_at: new Date().toISOString(),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Serverfel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
