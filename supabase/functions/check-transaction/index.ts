import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { ethers } from "https://esm.sh/ethers@6.16.0"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // 1. Handle CORS (Keep this!)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 2. THE CRITICAL CHANGE: Use .json() NOT .formData()
    const { applicationId, recipientUuid, cid, credentialData } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const rpcUrl = Deno.env.get("ARBITRUM_RPC_URL")
    const privateKey = Deno.env.get("WALLET_PRIVATE_KEY") 
    const contractAddress = Deno.env.get("CONTRACT_ADDRESS")
    
    if (!rpcUrl || !privateKey || !contractAddress) throw new Error("Server configuration missing")

    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const wallet = new ethers.Wallet(privateKey, provider)
    const abi = ["function mint(address to, string memory uri) public returns (uint256)"]
    const contract = new ethers.Contract(contractAddress, abi, wallet)

    // 1. Blockchain Mint
    const tx = await contract.mint(recipientUuid, `ipfs://${cid}`)
    const receipt = await tx.wait()

    // 2. Insert into Credentials Table
    const { error: insertError } = await supabase.from('credentials').insert([{
      recipient_id: recipientUuid,
      issuer_id: credentialData.issuerId,
      student_name: credentialData.studentName,
      school_id: credentialData.schoolId,
      document_type: credentialData.documentType,
      tx_hash: receipt.hash,
      ipfs_cid: cid,
      block_number: receipt.blockNumber,
      status: 'Active'
    }])

    if (insertError) throw insertError

    // 3. Finalize Application Status
    await supabase.from('student_applications').update({ status: 'Issued' }).eq('id', applicationId)

    return new Response(JSON.stringify({ success: true, txHash: receipt.hash }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})