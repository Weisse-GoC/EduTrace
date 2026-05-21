import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient'; 
import { useAuth } from '../../hooks/useAuth';
import { Loader2, Zap, AlertCircle, FileText, ExternalLink } from 'lucide-react';

// Replace this with your preferred IPFS gateway
const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

export default function MintingConsole() {
    const { docId } = useParams(); // docId contains your application_id string
    const navigate = useNavigate();
    const { profile } = useAuth();
    
    const [appData, setAppData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isMinting, setIsMinting] = useState(false);
    const [mintingStep, setMintingStep] = useState('');

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                setLoading(true);
                const { data: application, error: appError } = await supabase
                    .from('student_applications')
                    .select(`
                        *,
                        student_records!user_id (*)
                    `)
                    // FIXED: Changed from 'id' to 'application_id' to match your renamed schema
                    .eq('application_id', docId)
                    .maybeSingle();
                
                if (appError) throw appError;
                setAppData(application);
            } catch (error) {
                console.error("Fetch failure:", error.message);
            } finally {
                setLoading(false);
            }
        };

        if (docId) fetchDetails();
    }, [docId]);

    const handleIssueAndMint = async () => {
        const recipientId = appData?.student_records?.id
        const ipfsCid = appData?.ipfs_cid;

        if (!recipientId || !ipfsCid) {
            return alert("Error: Missing Student Record ID or IPFS CID. Cannot mint.");
        }
        
        if (!window.confirm("Authorize Blockchain Minting to Arbitrum Sepolia?")) return;

        setIsMinting(true);
        setMintingStep('Initiating L2 Transaction...');
        
       try {
            // Invoke the Edge Function
            const { data, error } = await supabase.functions.invoke('mint-credential', {
                body: { 
                    applicationId: docId,
                    recipientUuid: recipientId,
                    cid: ipfsCid
                }
            });

            if (error) {
                const errorDetails = error.context?.message || error.message || "Unknown Minting Error";
                throw new Error(errorDetails);
            }

            // READS 'txHash' OR 'hash' SAFELY
            const returnedHash = data?.txHash || data?.hash || "SUCCESS";
            
            // ACTUALLY USES 'returnedHash' HERE
            setMintingStep('Success! Transaction Hash: ' + returnedHash.substring(0, 10) + '...');
            
            // Wait briefly so user sees the success state
            setTimeout(() => navigate('/head/dashboard'), 3000);

        } catch (err) {
            console.error("Critical Minting Failure:", err);
            setMintingStep(`Failed: ${err.message}`);
            setIsMinting(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <Loader2 className="animate-spin text-indigo-600" size={40} />
        </div>
    );

    if (!appData) return (
        <div className="p-20 text-center flex flex-col items-center gap-4">
            <AlertCircle className="text-red-500" size={48} />
            <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-800">Application not found</h2>
                <button onClick={() => navigate(-1)} className="text-indigo-600 font-bold underline">Go Back</button>
            </div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto p-10">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Final Authority Review</h1>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">L2 Issuance Terminal — Document ID: {docId.substring(0, 8)}</p>
                </div>
                <a 
                    href={`${IPFS_GATEWAY}${appData.ipfs_cid}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                    Open Original in IPFS <ExternalLink size={14} />
                </a>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Real IPFS File Preview */}
                <div className="lg:col-span-8 bg-slate-200 rounded-[3rem] border border-slate-300 overflow-hidden shadow-inner flex items-center justify-center min-h-175">
                    {appData.ipfs_cid ? (
                        <iframe
                            src={`${IPFS_GATEWAY}${appData.ipfs_cid}#toolbar=0`}
                            className="w-full h-175 border-none"
                            title="IPFS Document Preview"
                        />
                    ) : (
                        <div className="text-center p-10">
                            <AlertCircle className="text-slate-400 mx-auto mb-4" size={48} />
                            <p className="text-slate-500 font-bold uppercase text-xs">No IPFS Asset Linked</p>
                        </div>
                    )}
                </div>

                {/* Right: Metadata Audit & Control */}
                <div className="lg:col-span-4 bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl flex flex-col justify-between border border-slate-800">
                    <div>
                        <div className="flex items-center gap-3 mb-8">
                            <div className="bg-indigo-500/20 p-2 rounded-xl text-indigo-400">
                                <FileText size={20} />
                            </div>
                            <h3 className="text-xs font-black uppercase text-indigo-400 tracking-[0.2em]">Metadata Audit</h3>
                        </div>
                        
                        <div className="space-y-6 mb-10 border-y border-white/5 py-8">
                            <div>
                                <p className="text-[9px] text-white/30 uppercase tracking-widest mb-2 font-black">Student Name</p>
                                <p className="text-lg font-bold text-white italic tracking-tight">
                                    {appData.student_records?.full_name || 'NOT FOUND'}
                                </p>
                            </div>
                            
                            <div>
                                <p className="text-[9px] text-white/30 uppercase tracking-widest mb-2 font-black">Academic Program</p>
                                <p className="text-sm font-bold text-slate-300">
                                    {appData.student_records?.course || 'UNSPECIFIED'}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <p className="text-[9px] text-white/30 uppercase tracking-widest mb-2 font-black">Student ID</p>
                                    <p className="text-xs font-mono font-bold text-emerald-400">
                                        {appData.student_records?.student_id}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[9px] text-white/30 uppercase tracking-widest mb-2 font-black">Doc Type</p>
                                    <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest">
                                        {appData.document_type}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <p className="text-[9px] text-white/30 uppercase tracking-widest mb-2 font-black">Content Identifier (CID)</p>
                                <p className="text-[9px] font-mono text-slate-500 break-all bg-black/40 p-3 rounded-xl border border-white/5">
                                    {appData.ipfs_cid}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <button 
                            onClick={handleIssueAndMint}
                            disabled={isMinting || !appData.ipfs_cid}
                            className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-4xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-900/20"
                        >
                            {isMinting ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                            {isMinting ? "Processing Transaction..." : "Authorize & Mint to L2"}
                        </button>
                        
                        {isMinting && (
                            <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl">
                                <p className="text-center text-[9px] text-indigo-400 animate-pulse uppercase font-black tracking-widest">
                                    {mintingStep}
                                </p>
                            </div>
                        )}
                        
                        <p className="text-[8px] text-center text-white/20 uppercase font-bold tracking-widest">
                            Authorized By: Head Registrar ({profile?.id?.substring(0,8) || 'SYSTEM'})
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}