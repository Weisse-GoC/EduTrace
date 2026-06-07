import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import QRCode from "https://esm.sh/qrcode@1.5.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Crypto helpers ────────────────────────────────────────────────────────────
const getCryptoKey = async (secret: string) => {
  const encoded = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return await crypto.subtle.importKey(
    "raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]
  );
};

// ── Bake QR + preview notice into first page only ────────────────────────────
const bakePreviewLayer = async (
  pdfBytes: ArrayBuffer,
  applicationId: string,
  baseUrl: string
): Promise<Uint8Array> => {
  const verifyUrl = `${baseUrl}/verify/${applicationId}`;

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { width, height } = firstPage.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // ── QR Code ────────────────────────────────────────────────────────────────
  const qrDataUrl: string = await QRCode.toDataURL(verifyUrl, {
    width: 200,
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "H",
  });

  const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, "");
  const binaryString = atob(base64Data);
  const qrBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    qrBytes[i] = binaryString.charCodeAt(i);
  }

  const qrImage = await pdfDoc.embedPng(qrBytes.buffer);
  const qrSize = 80;
  const qrX = 20;
  const qrY = height - qrSize - 20;

  // White backing so QR is readable on any document background
  firstPage.drawRectangle({
    x: qrX - 4,
    y: qrY - 28,
    width: qrSize + 8,
    height: qrSize + 32,
    color: rgb(1, 1, 1),
    opacity: 0.88,
  });

  firstPage.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
    opacity: 1,
  });

  firstPage.drawText("Scan to verify", {
    x: qrX,
    y: qrY - 12,
    size: 7,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  firstPage.drawText(verifyUrl, {
    x: qrX,
    y: qrY - 22,
    size: 4.5,
    font: fontRegular,
    color: rgb(0.5, 0.5, 0.5),
  });

  // ── "NOT OFFICIAL" top banner ──────────────────────────────────────────────
  const bannerHeight = 22;
  firstPage.drawRectangle({
    x: 0,
    y: height - bannerHeight,
    width: width,
    height: bannerHeight,
    color: rgb(0.78, 0.08, 0.08),
    opacity: 0.92,
  });

  const bannerLine1 = "NOT AN OFFICIAL COPY — FOR PREVIEW PURPOSES ONLY";
  const bannerLine1Size = 7.5;
  const bannerLine1Width = font.widthOfTextAtSize(bannerLine1, bannerLine1Size);

  firstPage.drawText(bannerLine1, {
    x: (width - bannerLine1Width) / 2,
    y: height - 10,
    size: bannerLine1Size,
    font,
    color: rgb(1, 1, 1),
    opacity: 1,
  });

  const bannerLine2 = "Download the official stamped copy via the verification portal to obtain the authenticated document.";
  const bannerLine2Size = 5;
  const bannerLine2Width = fontRegular.widthOfTextAtSize(bannerLine2, bannerLine2Size);

  firstPage.drawText(bannerLine2, {
    x: (width - bannerLine2Width) / 2,
    y: height - 19,
    size: bannerLine2Size,
    font: fontRegular,
    color: rgb(1, 0.85, 0.85),
    opacity: 0.95,
  });

  return await pdfDoc.save();
};

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const aesSecret = Deno.env.get("AES_SECRET_KEY");
  if (!aesSecret) {
    return new Response(
      JSON.stringify({ error: "AES_SECRET_KEY not configured" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  const appBaseUrl = Deno.env.get("APP_BASE_URL") ?? "https://edutracetestuc.netlify.app";

  try {
    // ── UPLOAD (POST) ─────────────────────────────────────────────────────────
    if (req.method === "POST") {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (!file) throw new Error("No file provided");

      const cryptoKey = await getCryptoKey(aesSecret);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        cryptoKey,
        await file.arrayBuffer()
      );

      const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encryptedBuffer), iv.length);

      const pinataFormData = new FormData();
      pinataFormData.append("file", new File([combined], "doc.enc"));

      const pinataRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: { Authorization: `Bearer ${Deno.env.get("PINATA_JWT")}` },
        body: pinataFormData,
      });

      const pinataData = await pinataRes.json();
      return new Response(
        JSON.stringify({ success: true, cid: pinataData.IpfsHash }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // ── PREVIEW DECRYPT (GET) ─────────────────────────────────────────────────
    if (req.method === "GET") {
      const url = new URL(req.url);
      const cid = url.searchParams.get("cid");
      const applicationId = url.searchParams.get("applicationId");
      const rawPreview = url.searchParams.get("raw") === "true"; // ← add this

      if (!cid) throw new Error("Missing CID");

      const ipfsRes = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
      if (!ipfsRes.ok) throw new Error(`IPFS gateway error: ${ipfsRes.status}`);

      const combined = new Uint8Array(await ipfsRes.arrayBuffer());
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);
      const cryptoKey = await getCryptoKey(aesSecret);
      const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, data);

      // Skip banner if raw=true (head/staff internal views)
      const outputPdf = (!rawPreview && applicationId)
        ? await bakePreviewLayer(decrypted, applicationId, appBaseUrl)
        : new Uint8Array(decrypted); // ← clean PDF, no banner

      return new Response(outputPdf, {
        headers: {
          ...CORS,
          "Content-Type": "application/pdf",
          "Content-Disposition": "inline",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    return new Response("Method not allowed", { status: 405, headers: CORS });

  } catch (error) {
    console.error("ipfs-upload error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});