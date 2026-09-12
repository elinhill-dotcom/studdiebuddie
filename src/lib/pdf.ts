"use client";

import * as pdfjs from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export async function extractTextFromPdf(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const parts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? String(item.str) : ""))
      .filter(Boolean)
      .join(" ");
    if (line.trim()) parts.push(line.trim());
  }

  return parts.join("\n\n").trim();
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(reader.error || new Error("Kunde inte läsa fil"));
    reader.readAsDataURL(file);
  });
}

/**
 * Krymper stora telefonbilder så de får plats i ett API-anrop (JPEG).
 * Telefonkameror tar ofta 5–12 MB. Håll data-URL:en under 1 MB så att
 * även mobilens kamera fungerar med Next.js request-gränsen.
 */
export async function compressImageToDataUrl(
  file: File,
  opts?: { maxEdge?: number; quality?: number; maxBytes?: number },
): Promise<string> {
  const maxEdge = opts?.maxEdge ?? 1400;
  const quality = opts?.quality ?? 0.68;
  const maxBytes = opts?.maxBytes ?? 750_000;

  const bitmap = await createImageBitmap(file);
  try {
    let { width, height } = bitmap;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Kunde inte rita bilden");
    ctx.drawImage(bitmap, 0, 0, width, height);

    let q = quality;
    let dataUrl = canvas.toDataURL("image/jpeg", q);
    // Sänk kvalitet om data-URL fortfarande är för stor
    while (dataUrl.length * 0.75 > maxBytes && q > 0.45) {
      q -= 0.08;
      dataUrl = canvas.toDataURL("image/jpeg", q);
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}
