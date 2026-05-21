import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"
import { ethers } from "https://esm.sh/ethers@6.12.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { applicationId, recipientUuid, issuerId, cid, studentName, documentType, schoolId } = body

    // Initialize Provider and Wallet
    const provider = new ethers.JsonRpcProvider(Deno.env.get('ARB_RPC_URL'))
    const wallet = new ethers.Wallet(Deno.env.get('MASTER_WALLET_PRIVATE_KEY')!, provider)
    const contractAddr = Deno.env.get('CONTRACT_ADDRESS')!
    const ABI = ["function issueCredential(address recipient, string memory cid) public returns (uint256)"]
    const contract = new ethers.Contract(contractAddr, ABI, wallet)

    // Execute Transaction
    const tx = await contract.issueCredential(wallet.address, cid)
    const receipt = await tx.wait()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { error: dbError } = await supabase.from('credentials').upsert({
      application_id: applicationId,
      issuer_id: issuerId,
      recipient_id: recipientUuid,
      student_name: studentName,
      school_id: schoolId,
      document_type: documentType,
      tx_hash: receipt.hash,
      blockchain_hash: receipt.hash,
      file_url: `https://gateway.pinata.cloud/ipfs/${cid}`,
      ipfs_cid: cid,
      status: 'Issued'
    }, { onConflict: 'application_id' })

    if (dbError) throw dbError

    return new Response(JSON.stringify({ success: true, hash: receipt.hash }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
    
    const {error: updateError} = await supabase.from('student_applications') update({status:'Issued'}).eq('application_id', applicationId)
    if(updateError) throw updateError

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})