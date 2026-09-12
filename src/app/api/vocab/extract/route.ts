import { NextResponse } from "next/server";
import { extractVocabFromUpload } from "@/lib/tutor/openai";
import { parseVocabPaste } from "@/lib/ai-quiz";

export const runtime = "nodejs";
export const maxDuration = 60;

function isSavedAttachment(value?: string) {
  if (!value || !process.env.NEXT_PUBLIC_SUPABASE_URL) return false;
  try { const url = new URL(value); return url.protocol === "https:" && url.origin === new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin && url.pathname.startsWith("/storage/v1/object/sign/homework-photos/"); } catch { return false; }
}

type Body = {
  photoDataUrl?: string;
  pdfDataUrl?: string;
  pdfFileName?: string;
  extractedText?: string;
  languageFrom?: string;
  languageTo?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if ((body.photoDataUrl && !body.photoDataUrl.startsWith("data:image/") && !isSavedAttachment(body.photoDataUrl)) || (body.pdfDataUrl && !body.pdfDataUrl.startsWith("data:application/pdf") && !isSavedAttachment(body.pdfDataUrl))) {
      return NextResponse.json({ error: "Välj en uppladdad bild eller PDF från läxan." }, { status: 400 });
    }
    const hasFile =
      Boolean(body.photoDataUrl?.startsWith("data:image")) ||
      Boolean(body.pdfDataUrl?.startsWith("data:application/pdf")) ||
      isSavedAttachment(body.photoDataUrl) || isSavedAttachment(body.pdfDataUrl) ||
      Boolean(body.extractedText?.trim());

    if (!hasFile) {
      return NextResponse.json(
        { error: "Ladda upp en bild eller PDF av gloslistan." },
        { status: 400 },
      );
    }

    const ai = await extractVocabFromUpload({
      photoDataUrl: body.photoDataUrl,
      pdfDataUrl: body.pdfDataUrl,
      pdfFileName: body.pdfFileName,
      extractedText: body.extractedText,
      languageFromHint: body.languageFrom,
      languageToHint: body.languageTo,
    });

    if (ai?.pairs?.length) {
      return NextResponse.json({
        pairs: ai.pairs,
        languageFrom: ai.languageFrom || body.languageFrom,
        languageTo: ai.languageTo || body.languageTo,
        source: "ai",
      });
    }

    // Fallback: parse extracted PDF text as paste
    if (body.extractedText?.trim()) {
      const pairs = parseVocabPaste(body.extractedText);
      if (pairs.length) {
        return NextResponse.json({
          pairs,
          languageFrom: body.languageFrom,
          languageTo: body.languageTo,
          source: "local",
        });
      }
    }

    return NextResponse.json(
      {
        error:
          "Kunde inte läsa några glosor. Prova en tydligare bild eller klistra in text.",
      },
      { status: 422 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Något gick fel vid uppläsning av gloslistan." },
      { status: 500 },
    );
  }
}
