import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react'; // Used directly inside the modal for a clean display
import { supabase, getCredentialById } from '../../services/supabaseClient';
import { useAuth } from '../../hooks/useAuth';

// BLOCKCHAIN INTEGRATION
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../../blockchain/config';
import { 
    Loader2, ShieldCheck, ArrowLeft, 
    Calendar, Fingerprint, Lock,
    Eye, AlertTriangle, QrCode, Download, Link2
} from 'lucide-react';

export default function ViewCredential() {
    const { credentialId } = useParams(); 
    const navigate = useNavigate();
    const { userId, authLoading } = useAuth();
    
    const [credentials, setCredentials] = useState(null);
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState(null);
    const [isVerified, setIsVerified] = useState(false);
    const [showQR, setShowQR] = useState(false);

    // 1. BLOCKCHAIN RE-VERIFICATION LIFECYCLE
    const verifyOnChain = useCallback(async (blockchainHash, dbStatus) => {
        if (dbStatus === 'Revoked' || !blockchainHash) return false;
        try {
            const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_ARBITRUM_RPC);
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
            const result = await contract.verifyDocument(blockchainHash);
            return result[0] && !result[1];
        } catch (err) {
            console.error("Arbitrum Verification Error:", err);
            return false;
        }
    }, []);

    const handleDownload = async () => {
        if (!credentials?.ipfs_cid) return;
        const url = `https://gateway.pinata.cloud/ipfs/${credentials.ipfs_cid}`;
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `Credential-${credentials.application_id || credentialId}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error("Download failed:", err);
        }
    };

    // Constructing verification URL safely
    const publicVerificationUrl = `${window.location.origin}/verify/${credentials?.application_id}`;

    // 2. LIFECYCLE MOUNT: SERVICE INTERACTION & REAL-TIME STREAMING
    useEffect(() => {
        let isMounted = true;
        let channel;
        if (authLoading) return;

        const fetchAndSubscribe = async () => {
            setLoading(true);
            try {
                const data = await getCredentialById(credentialId);

                if (!data) throw new Error("Credential record not found.");
                if (data.recipient_id !== userId) throw new Error("Unauthorized access to this ledger asset.");

                if (isMounted) {
                    setCredentials(data);
                    setVerifying(true);
                }
                
                const verified = await verifyOnChain(data.blockchain_hash, data.status);
                if (isMounted) {
                    setIsVerified(verified);
                    setVerifying(false);
                }

                // Attach real-time subscription channel
                channel = supabase
                    .channel(`credential_watch:${credentialId}`)
                    .on('postgres_changes', { 
                        event: 'UPDATE', 
                        schema: 'public', 
                        table: 'credentials', 
                        filter: `id=eq.${credentialId}` 
                    }, 
                    async (payload) => {
                        if (!isMounted) return;
                        setCredentials(payload.new);
                        const v = await verifyOnChain(payload.new.blockchain_hash, payload.new.status);
                        setIsVerified(v);
                    }).subscribe();

            } catch (err) {
                if (isMounted) setError(err.message);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchAndSubscribe();
        return () => { 
            isMounted = false; 
            if (channel) supabase.removeChannel(channel); 
        };
    }, [credentialId, userId, authLoading, verifyOnChain]);

    if (loading || authLoading) return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
            <Loader2 className="animate-spin text-indigo-600" size={60} />
            <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Ledger Data...</p>
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4 text-center">
            <AlertTriangle className="text-red-500 mb-4" size={48} />
            <h3 className="text-lg font-black uppercase tracking-tight text-slate-800">Access Revoked</h3>
            <p className="text-slate-500 text-xs mt-2 max-w-sm font-medium">{error}</p>
            <button onClick={() => navigate('/student/dashboard')} className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-md hover:bg-indigo-700 transition-all">
                Return to Safety
            </button>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <button onClick={() => navigate('/student/dashboard')} className="group flex items-center gap-2">
                        <div className="p-2 rounded-xl group-hover:bg-indigo-50"><ArrowLeft size={20} /></div>
                        <span className="font-black uppercase text-[10px] tracking-widest text-slate-500">Back to Dashboard</span>
                    </button>

                    <div className="flex flex-wrap gap-2">
                        {/* QR Toggle Action */}
                        <button 
                            onClick={() => setShowQR(!showQR)} 
                            className={`p-3 border rounded-xl transition-all shadow-sm ${showQR ? 'bg-indigo-50 border-indigo-600 text-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-600'}`}
                            title="Generate QR Code"
                        >
                            <QrCode size={18} />
                        </button>

                        {/* Download from IPFS */}
                        <button onClick={handleDownload} className="p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-600 transition-all shadow-sm">
                            <Download size={18} className="text-slate-600" />
                        </button>

                        {/* Eye Icon Action: Opens public verification layout route */}
                        <button 
                            onClick={() => window.open(`${window.location.origin}/verify/${credentials?.application_id}`, '_blank')}
                            className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-800 rounded-xl hover:border-indigo-600 transition-all shadow-sm font-black uppercase text-[10px] tracking-widest"
                        >
                            <Eye size={16} /> Live View
                        </button>

                        {/* Blockchain Explorer Redirect */}
                        <a
                            href={`${import.meta.env.VITE_ARB_EXPLORER_URL}${credentials?.blockchain_hash || credentials?.tx_hash}`}
                            target="_blank" rel="noreferrer"
                            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg font-black uppercase text-[10px] tracking-widest"
                        >
                            <Link2 size={16} /> Explorer
                        </a>
                    </div>
                </div>

                {/* QR Modal Overlay */}
                {showQR && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center relative border border-slate-100">
                            <button 
                                onClick={() => setShowQR(false)} 
                                className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 font-bold text-sm transition-colors"
                            >
                                ✕
                            </button>
                            <h3 className="font-black uppercase text-xs tracking-widest text-slate-800 mb-6">Credential Verification QR</h3>
                            
                            <div className="bg-slate-50 p-6 rounded-3xl inline-block mb-6 border border-slate-100 shadow-inner">
                                <QRCodeSVG 
                                    value={publicVerificationUrl} 
                                    size={200} 
                                    level="H" 
                                    includeMargin={false}
                                />
                            </div>
                            
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scan to verify on EduTrace</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-4 space-y-6">
                        
                        {/* Status Card */}
                        <div className="p-8 rounded-[2.5rem] border shadow-sm flex flex-col items-center text-center gap-4 bg-white">
                            <div className={`p-5 rounded-3xl ${credentials?.status === 'Issued' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                {verifying ? <Loader2 className="animate-spin" size={40} /> : <ShieldCheck size={40} />}
                            </div>
                            <div>
                                <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-800">
                                    {credentials?.status || 'Processing'}
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                    Database Record Status
                                </p>
                            </div>
                        </div>

                        {/* Metadata Details Container */}
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                            <h4 className="flex items-center gap-2 font-black text-indigo-600 uppercase text-[10px] tracking-[0.2em]">
                                <Fingerprint size={16} /> Security Hashes
                            </h4>
                            <div className="space-y-4">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">On-Chain Integrity</p>
                                    <div className="flex items-center gap-2">
                                        {isVerified ? (
                                            <span className="text-emerald-600 font-black text-[10px] uppercase flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div> Verified Secure
                                            </span>
                                        ) : (
                                            <span className="text-red-500 font-black text-[10px] uppercase flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div> Unverified Async
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Blockchain Hash</p>
                                    <code className="block break-all text-[10px] font-mono text-indigo-500">
                                        {credentials?.blockchain_hash || 'PENDING_LOG'}
                                    </code>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* PDF Document Preview Element */}
                    <div className="lg:col-span-8">
                        <div className="rounded-[2.5rem] shadow-2xl overflow-hidden border-8 border-slate-900 bg-slate-900">
                            <div className="p-4 flex items-center justify-between">
                                <div className="flex gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                </div>
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Document Preview</span>
                            </div>
                            <div className="bg-slate-200 min-h-[70vh]">
                                {credentials?.file_url || credentials?.ipfs_cid ? (
                                    <iframe
                                        src={credentials.file_url || `https://gateway.pinata.cloud/ipfs/${credentials.ipfs_cid}#toolbar=0`}
                                        className="w-full h-[70vh] bg-white"
                                        title="Credential Digital Twin"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-[70vh] text-slate-400 font-bold uppercase text-xs tracking-widest">
                                        No preview layout configuration available.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}