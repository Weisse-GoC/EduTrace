import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  PDFDocument, 
  rgb, 
  PDFName, 
  PDFDict, 
  PDFOperator, 
  pushGraphicsState, 
  popGraphicsState 
} from "https://esm.sh/pdf-lib@1.17.1";
import QRCode from "https://esm.sh/qrcode@1.5.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { cid, docStatus, applicationId } = await req.json();
    if (!cid) return new Response("Missing cid", { status: 400 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch unencrypted plain source PDF
    // Fetch raw encrypted bytes directly from Pinata
    const ipfsRes = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
    if (!ipfsRes.ok) throw new Error(`IPFS fetch failed: ${ipfsRes.status}`);

    const combined = new Uint8Array(await ipfsRes.arrayBuffer());
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    const aesSecret = Deno.env.get("AES_SECRET_KEY")!;
    const keyMaterial = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(aesSecret));
    const cryptoKey = await crypto.subtle.importKey(
      "raw", keyMaterial, { name: "AES-GCM" }, false, ["decrypt"]
    );

    const pdfBytes = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      encryptedData
    );

    // 2. Storage Asset Downloader
    const fetchAsset = async (path: string) => {
      const { data, error } = await supabase.storage
        .from("institutional_assets")
        .download(path);
      if (error) throw new Error(`Asset fetch failed: ${path} — ${error.message}`);
      return await data.arrayBuffer();
    };

    // 3. Smart Format Parser
    const embedImageSafely = async (pdfDocInstance: any, arrayBuffer: ArrayBuffer) => {
      const u8 = new Uint8Array(arrayBuffer);
      if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47) {
        return await pdfDocInstance.embedPng(arrayBuffer);
      }
      if (u8[0] === 0xFF && u8[1] === 0xD8) {
        return await pdfDocInstance.embedJpg(arrayBuffer);
      }
      throw new Error("Unsupported image format. Must be valid PNG or JPG.");
    };

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    // ── REGISTER NATIVE BLEND STATE DICTIONARY ──────────────────────────────
    const multiplyGStateRef = pdfDoc.context.register(
      pdfDoc.context.obj({
        Type: 'ExtGState',
        BM: 'Multiply',     
        ca: 0.30,           
        CA: 0.30,
      })
    );

    // ── DYNAMIC WATERMARK TILING MATRIX ──────────────────────────────────────
    const wmBytes = await fetchAsset("watermarks/watermark/Watermark_Sample.jpg");
    const wmImage = await embedImageSafely(pdfDoc, wmBytes);

    const TILE_SCALE = 0.22; 
    const tileDims = wmImage.scale(TILE_SCALE);

    for (const page of pages) {
      const { width: pw, height: ph } = page.getSize();
      
      const resources = page.node.Resources();
      if (!resources.has(PDFName.of('ExtGState'))) {
        resources.set(PDFName.of('ExtGState'), pdfDoc.context.obj({}));
      }
      const extGStateDict = resources.lookup(PDFName.of('ExtGState'), PDFDict);
      
      const stateKey = `GS_WM_MULTIPLY`;
      extGStateDict.set(PDFName.of(stateKey), multiplyGStateRef);

      page.pushOperators(
        pushGraphicsState(),
        PDFOperator.of('gs', [PDFName.of(stateKey)])
      );

      // Run matrix loop to clone across X and Y axes
      for (let x = 0; x < pw; x += tileDims.width) {
        for (let y = 0; y < ph; y += tileDims.height) {
          page.drawImage(wmImage, {
            x: x,
            y: y,
            width: tileDims.width - 0.05, // Retain the +1 grid line bleed fix
            height: tileDims.height - 0.06,
          });
        }
      }

      page.pushOperators(popGraphicsState());
    }

    // ── STAMPS ────────────────────────────────────────────────────────────────
    const stampFileMap: Record<string, string> = {
      L1_Issued: "watermarks/stamp/L1_Stamp/L1 Stamp.jpeg",
      Issued:    "watermarks/stamp/L2_Stamp/head stamp sample.png",
    };
    const stampPath = stampFileMap[docStatus];

    if (stampPath) {
      const stampBytes = await fetchAsset(stampPath);
      const stampImage = await embedImageSafely(pdfDoc, stampBytes);
      
      // Forces stamp width to 120 units and keeps aspect ratio perfectly proportional
      const TARGET_WIDTH = 120;
      const adaptiveScale = TARGET_WIDTH / stampImage.width;
      const stampDims = stampImage.scale(adaptiveScale);

      firstPage.drawImage(stampImage, {
        x: width - stampDims.width - 30,
        y: 30,
        width: stampDims.width,
        height: stampDims.height,
        opacity: 0.95,
      });
    }

    // ── QR CODE GENERATOR & VERIFICATION NOTICE ──────────────────────────────
    if (applicationId) {
      const verificationUrl = `https://edutracetestuc.netlify.app/verify/${applicationId}`;

      const qrDataUrl: string = await QRCode.toDataURL(verificationUrl, {
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
        color: rgb(0.4, 0.4, 0.4),
      });

      firstPage.drawText(verificationUrl, {
        x: qrX,
        y: qrY - 22,
        size: 5,
        color: rgb(0.55, 0.55, 0.55),
      });

      // ── RED TOP-BANNER VERIFICATION STAMP ──────────────────────────────────
      const noticeText = "Copy provided link and paste in edutracetestuc.netlify.app/verify-portal for verification.";
      const fontSize = 8;
      
      // Embed standard Helvetica Bold to calculate dimensions dynamically
      const helveticaFont = await pdfDoc.embedFont("Helvetica-Bold");
      const textWidth = helveticaFont.widthOfTextAtSize(noticeText, fontSize);
      
      // Align completely center horizontally, and push down slightly from the very top boundary
      const textX = (width - textWidth) / 2;
      const textY = height - 15;

      firstPage.drawText(noticeText, {
        x: textX,
        y: textY,
        size: fontSize,
        font: helveticaFont,
        color: rgb(0.85, 0.15, 0.15),
      });
    }

    // ── COMPILE AND RESPOND ───────────────────────────────────────────────────
    const stampedBytes = await pdfDoc.save();

    return new Response(stampedBytes, {
      headers: {
        ...CORS,
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=stamped_document.pdf",
      },
    });
  } catch (err) {
    console.error("stamp-pdf error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});