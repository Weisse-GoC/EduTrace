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
    const { applicationId, recipientUuid, cid, issuerId, studentName, documentType, schoolId } = await req.json()

    // 1. Setup Provider/Wallet
    const provider = new ethers.JsonRpcProvider(Deno.env.get('ARB_RPC_URL'))
    const wallet = new ethers.Wallet(Deno.env.get('MASTER_WALLET_PRIVATE_KEY')!, provider)
    
    // 2. The contract expects an 'address'
    // We use the wallet address as the owner of this record on the ledger
    const contractAddr = Deno.env.get('CONTRACT_ADDRESS')!
    const ABI = ["function issueCredential(address recipient, string memory cid) public returns (bytes32)"]
    const contract = new ethers.Contract(contractAddr, ABI, wallet)

    // 3. Execute Transaction 
    // We pass the MASTER wallet address as the recipient (or you can use the student's 
    // public address if you store it in your DB)
    const tx = await contract.issueCredential(wallet.address, cid)
    const receipt = await tx.wait()

    // 4. Update Database
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
      blockchain_hash: receipt.logs[0].topics[1], // Directly extracting the indexed fileHash topic from logs
      file_url: `https://gateway.pinata.cloud/ipfs/${cid}`,
      ipfs_cid: cid,
      status: 'Issued'
    }, { onConflict: 'application_id' })

    if (dbError) throw dbError

    await supabase.from('student_applications').update({ status: 'Issued' }).eq('application_id', applicationId)

    return new Response(JSON.stringify({ success: true, txHash: receipt.hash }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error("MINTING ERROR:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})