import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient'; 
import { logActivity } from '../../utils/logActivity';
import { useAuth } from '../../hooks/useAuth';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../../blockchain/config';

import { 
    CheckCircle, XCircle, Loader, ArrowLeft, 
    ExternalLink, ShieldCheck, AlertTriangle, Trash2,
    Database, Globe, Fingerprint
} from 'lucide-react';

export default function VerificationResult() {
    const { docId } = useParams(); // This is the ID from the 'credentials' table
    const navigate = useNavigate();
    const { profile } = useAuth();
    
    const [credential, setCredential] = useState(null);
    const [onChainStatus, setOnChainStatus] = useState('pending'); 
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isRevoking, setIsRevoking] = useState(false);

    useEffect(() => {
        const verifyLogic = async () => {
            try {
                setLoading(true);
                
                // 1. Fetch from 'credentials' table and join 'student_records' via student_uuid
                const { data, error: sbError } = await supabase
                    .from('credentials')
                    .select(`
                        *,
                        student_records(
                            id,
                            full_name,
                            student_id,
                            course
                        )
                    `)
                    .eq('id', docId)
                    .single();

                if (sbError || !data) {
                    setError('Digital Anchor not found in the database. The record may have been deleted or never minted.');
                    return;
                }
                setCredential(data);

                // 2. Fetch from ARBITRUM SEPOLIA L2
                const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_ARBITRUM_RPC);
                const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

                // Your ABI shows verifyDocument returns only a bool
                // inputs: [_fileHash], outputs: [bool]
                const isVerified = await contract.verifyDocument(data.blockchain_hash);

                // Check both the Blockchain AND your Database 'Revoked' status
                if (data.status === 'Revoked') {
                    setOnChainStatus('revoked');
                } else if (isVerified) {
                    setOnChainStatus('verified');
                } else {
                    setOnChainStatus('unregistered');
                }

            } catch (err) {
                console.error("L2 Verification Error:", err);
                setError('L2 Network Timeout. Could not reach Arbitrum Sequencer.');
            } finally {
                setLoading(false);
            }
        };

        if (docId) verifyLogic();
    }, [docId]);

    const handleRevokeAction = async () => {
        const confirmMsg = "CRITICAL: Revoking this credential is permanent on the database. You must also execute the blockchain transaction to update the L2 state. Proceed?";
        if (!window.confirm(confirmMsg)) return;
        
        setIsRevoking(true);
        try {
            // 1. Update Credentials table status
            const { error: updateError } = await supabase
                .from('credentials')
                .update({ status: 'Revoked' })
                .eq('id', docId);

            if (updateError) throw updateError;

            // 2. Log activity
            await logActivity({
                actor_id: profile.id,
                action: 'REVOKE_CREDENTIAL_L2',
                target_id: credential.student_uuid,
                metadata: { 
                    tx_hash: credential.tx_hash,
                    reason: "Institutional Revocation" 
                }
            });
            
            alert("Database status updated. Please ensure you broadcast the revoke transaction to the L2 contract to invalidate the on-chain hash.");
            window.location.reload();
        } catch (err) {
            console.error("Revocation Error:", err);
            alert("Internal Database Error: Failed to update revocation status.");
        } finally {
            setIsRevoking(false);
        }
    };

    if (loading) return (
        <div className="h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
            <div className="relative">
                <Loader className="animate-spin text-indigo-600 mb-4" size={50} />
                <Globe className="absolute inset-0 m-auto text-indigo-200 animate-pulse" size={20} />
            </div>
            <p className="font-black text-slate-400 uppercase tracking-[0.3em] text-[10px] mt-4">Pinging Arbitrum L2 Sequencer...</p>
        </div>
    );

    if (error) return (
        <div className="max-w-md mx-auto mt-20 text-center p-12 bg-white rounded-[3rem] shadow-2xl border border-red-100">
            <XCircle className="w-20 h-20 mx-auto text-red-500 mb-6" />
            <h1 className="text-2xl font-black mb-4 uppercase italic tracking-tighter">Integrity Error</h1>
            <p className="text-slate-500 mb-8 font-medium text-sm leading-relaxed">{error}</p>
            <button onClick={() => navigate(-1)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all">Abort & Return</button>
        </div>
    );

    const isRecordInvalid = onChainStatus === 'revoked' || credential.status === 'Revoked';

    return (
        <div className="max-w-4xl mx-auto mt-10 p-6 mb-20">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 font-black uppercase text-[10px] mb-8 hover:text-indigo-600 transition-colors tracking-[0.2em]">
                <ArrowLeft size={14} /> Back to Authority Terminal
            </button>

            <div className="bg-white rounded-[4rem] shadow-2xl shadow-slate-200 overflow-hidden border border-slate-50">
                {/* Header Status Bar */}
                <div className={`p-16 text-center border-b transition-colors duration-700 ${isRecordInvalid ? 'bg-red-50' : 'bg-indigo-50/30'}`}>
                    {isRecordInvalid ? (
                        <>
                            <div className="relative inline-block">
                                <AlertTriangle className="w-24 h-24 mx-auto text-red-500 mb-4" />
                                <div className="absolute inset-0 animate-ping opacity-10"><AlertTriangle className="w-24 h-24 text-red-500" /></div>
                            </div>
                            <h1 className="text-5xl font-black text-red-600 uppercase tracking-tighter italic">Revoked</h1>
                            <p className="text-red-400 text-[10px] font-black uppercase mt-3 tracking-[0.4em]">Asset Access Terminated</p>
                        </>
                    ) : (
                        <>
                            <div className="bg-white w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-100">
                                <CheckCircle className="w-16 h-16 text-emerald-500" />
                            </div>
                            <h1 className="text-5xl font-black text-slate-900 uppercase tracking-tighter italic">Verified</h1>
                            <p className="text-emerald-500 text-[10px] font-black uppercase mt-3 tracking-[0.4em]">Arbitrum L2 Confirmed</p>
                        </>
                    )}
                </div>

                {/* Details Section */}
                <div className="p-16 space-y-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Recipient</label>
                            <p className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">
                                {credential.student_records?.full_name}
                            </p>
                            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-widest">
                                <Fingerprint size={14} /> {credential.student_records?.student_id}
                            </div>
                        </div>
                        <div className="space-y-2 md:text-right">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">L2 Network State</label>
                            <div className="flex items-center md:justify-end gap-3 mt-2">
                                <p className={`font-black uppercase text-[11px] tracking-widest ${onChainStatus === 'verified' ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {onChainStatus === 'verified' ? 'Active on Arbitrum' : 'Revoked by Contract'}
                                </p>
                                <div className={`w-3 h-3 rounded-full ${onChainStatus === 'verified' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]'}`} />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 border-t border-slate-50 pt-12">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Academic Program</label>
                            <p className="text-lg font-bold text-slate-700 uppercase">{credential.student_records?.course}</p>
                        </div>
                        <div className="md:text-right">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Timestamp (Issued)</label>
                            <p className="text-lg font-bold text-slate-700 font-mono">
                                {new Date(credential.created_at).toLocaleDateString()}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Database size={14} /> Transaction Proof (L2)
                            </label>
                            <button
                                onClick={() => window.open(`${import.meta.env.VITE_ARB_EXPLORER_URL}${credential.tx_hash}`, '_blank')}
                                className="text-indigo-600 hover:text-indigo-800 text-[10px] font-black uppercase tracking-widest flex items-center gap-1"
                            >
                                Arbiscan <ExternalLink size={12} />
                            </button>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-4xl font-mono text-[11px] break-all border border-slate-100 leading-relaxed text-slate-500 italic">
                            {credential.tx_hash}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 pt-6">
                        <button 
                            onClick={() => window.open(`https://gateway.pinata.cloud/ipfs/${credential.ipfs_cid}`, '_blank')}
                            className="flex-1 py-6 bg-slate-900 text-white rounded-4xl font-black uppercase text-[10px] tracking-[0.2em] hover:bg-indigo-600 flex items-center justify-center gap-3 transition-all shadow-xl hover:-translate-y-1 active:scale-95"
                        >
                            <ExternalLink size={18} /> View IPFS Asset
                        </button>
                        
                        {(!isRecordInvalid) && (
                            <button 
                                onClick={handleRevokeAction}
                                disabled={isRevoking}
                                className="px-10 py-6 bg-white text-red-600 rounded-4xl font-black uppercase text-[10px] tracking-[0.2em] hover:bg-red-50 transition-all flex items-center justify-center gap-3 border-2 border-red-50 disabled:opacity-50 active:scale-95 shadow-sm"
                            >
                                {isRevoking ? <Loader className="animate-spin" size={18} /> : <Trash2 size={18} />} 
                                Revoke Asset
                            </button>
                        )}
                    </div>
                </div>
            </div>
            
            <footer className="text-center mt-12 opacity-30">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-[1.5em] ml-[1.5em]">
                    Arbitrum L2 Secure Verification Node
                </p>
            </footer>
        </div>
    );
}