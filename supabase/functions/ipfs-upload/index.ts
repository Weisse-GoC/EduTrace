import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const aesSecret = Deno.env.get("AES_SECRET_KEY");
  if (!aesSecret) throw new Error("AES_SECRET_KEY not configured");

  // Helper: Derive 32-byte key from your passphrase
  const getCryptoKey = async () => {
    const encoded = new TextEncoder().encode(aesSecret);
    const hash = await crypto.subtle.digest("SHA-256", encoded);
    return await crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  };

  try {
    // --- UPLOAD (POST) ---
    if (req.method === 'POST') {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (!file) throw new Error("No file provided");

      const cryptoKey = await getCryptoKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encryptedBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, await file.arrayBuffer());
      
      const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encryptedBuffer), iv.length);

      const pinataFormData = new FormData();
      pinataFormData.append('file', new File([combined], "doc.enc"));
      
      const pinataRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${Deno.env.get("PINATA_JWT")}` },
        body: pinataFormData
      });

      const pinataData = await pinataRes.json();
      return new Response(JSON.stringify({ success: true, cid: pinataData.IpfsHash }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- DOWNLOAD (GET) ---
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const cid = url.searchParams.get("cid");
      if (!cid) throw new Error("Missing CID");

      const ipfsRes = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
      const combined = new Uint8Array(await ipfsRes.arrayBuffer());
      
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);
      const cryptoKey = await getCryptoKey();
      
      const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, data);

      return new Response(decrypted, {
        headers: { ...corsHeaders, "Content-Type": "application/pdf" }
      });
    }

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 400, headers: corsHeaders });
  }
});