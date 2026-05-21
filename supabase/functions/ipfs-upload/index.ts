import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file) throw new Error("No file provided")

    // PINATA UPLOAD LOGIC
    const pinataJwt = Deno.env.get("PINATA_JWT")
    const pinataFormData = new FormData()
    pinataFormData.append('file', file)
    
    const pinataRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${pinataJwt}` },
      body: pinataFormData
    })

    const pinataData = await pinataRes.json()
    if (!pinataRes.ok) throw new Error(pinataData.error || "Pinata Upload Failed")

    return new Response(
      JSON.stringify({ success: true, cid: pinataData.IpfsHash }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    )
  }
})