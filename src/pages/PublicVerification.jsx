// src/pages/PublicVerification.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // 👈 Added useNavigate
import { supabase } from '../services/supabaseClient'; 
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../blockchain/config';
import { 
    ShieldCheck, 
    ShieldAlert, 
    Loader2, 
    ExternalLink, 
    GraduationCap, 
    Building2, 
    Calendar, 
    Download,
    Lock,
    ArrowLeft // 👈 Added ArrowLeft icon
} from 'lucide-react';

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

export default function PublicVerification() {
    const { id } = useParams(); 
    const navigate = useNavigate(); // 👈 Initialize navigation hook
    const [status, setStatus] = useState('loading'); 
    const [docData, setDocData] = useState(null);
    const [blockchainData, setBlockchainData] = useState(null);
    const [showBackButton, setShowBackButton] = useState(false); // 👈 Context tracker

    useEffect(() => {
        // Check if the user came from within the app or a direct external scan
        const dynamicHistory = window.history.state?.idx > 0;
        const internalReferrer = document.referrer.includes(window.location.host);
        
        if (dynamicHistory || internalReferrer) {
            setShowBackButton(true);
        }

        const verifyDocument = async () => {
            try {
                const { data, error } = await supabase
                    .from('credentials')
                    .select('*')
                    .eq('application_id', id)
                    .maybeSingle(); 

                if (error || !data) {
                    console.error("Database fetch error or row empty:", error);
                    setStatus('failed');
                    return;
                }

                setDocData(data);

                const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_ARBITRUM_RPC);
                const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
                
                const isAuthentic = await contract.verifyDocument(data.blockchain_hash);

                if (isAuthentic) {
                    setBlockchainData({
                        hash: data.blockchain_hash, 
                        tx: data.tx_hash            
                    });
                    setStatus('verified');
                } else {
                    console.warn("On-chain verification failed for hash:", data.blockchain_hash);
                    setStatus('failed');
                }
            } catch (error) {
                console.error("Verification Error:", error);
                setStatus('failed');
            }
        };

        if (id) verifyDocument();
    }, [id]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6">
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-indigo-100 rounded-full blur-2xl animate-pulse"></div>
                    <Loader2 className="animate-spin text-indigo-600 relative z-10" size={64} />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2">Verifying Integrity</h3>
                <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px]">Querying Arbitrum Decentralized Ledger</p>
            </div>
        );
    }

    const isImageAsset = (urlOrCid) => {
        return urlOrCid ? /\.(jpeg|jpg|gif|png|webp|avif)$/i.test(urlOrCid) : false;
    };

    const finalAssetUrl = docData?.file_url?.startsWith('http') 
        ? docData.file_url 
        : `${IPFS_GATEWAY}${docData?.file_url || docData?.ipfs_cid}`;

    return (
        <div className="min-h-screen bg-[#F8FAFC] py-16 px-4 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            <div className="max-w-2xl mx-auto">
                
                {/* Context-Dependent Back Button row */}
                <div className="h-6 mb-4 flex items-center">
                    {showBackButton && (
                        <button 
                            onClick={() => navigate(-1)}
                            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-800 transition-colors group"
                        >
                            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Return To Console
                        </button>
                    )}
                </div>

                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 mb-6">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Node Status: Online</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic">
                        EduTrace <span className="text-indigo-600">Verify.</span>
                    </h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Immutable Credential Proof</p>
                </div>

                {status === 'verified' ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-1000 fill-mode-both">
                        <div className="bg-white rounded-[3rem] p-8 md:p-14 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.06)] border border-slate-100 relative overflow-hidden">
                            <ShieldCheck className="absolute -top-16 -right-16 text-emerald-500 opacity-[0.03]" size={350} />

                            <div className="flex flex-col items-center text-center mb-12">
                                <div className="w-20 h-20 bg-emerald-50 rounded-4xl flex items-center justify-center text-emerald-600 mb-6 shadow-inner ring-1 ring-emerald-100">
                                    <ShieldCheck size={44} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter italic">Authentic Record</h2>
                                <p className="text-emerald-600 text-[10px] font-black uppercase tracking-[0.2em] mt-3 flex items-center gap-2">
                                    <Lock size={12} /> Cryptographically Verified via Arbitrum L2
                                </p>
                            </div>

                            {/* Data Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-y border-slate-50 py-12 my-10">
                                <div className="space-y-3">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Graduate Name</p>
                                    <div className="text-slate-800 font-bold text-lg leading-tight">{docData.student_name}</div>
                                </div>
                                <div className="space-y-3">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Issuing Body</p>
                                    <div className="flex items-center gap-3 text-slate-800 font-bold text-lg">
                                        <Building2 size={18} className="text-indigo-600" />
                                        University of the Cordilleras
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Document Type</p>
                                    <div className="flex items-center gap-3 text-slate-800 font-bold text-lg">
                                        <GraduationCap size={18} className="text-indigo-600" />
                                        {docData.document_type}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Date Issued</p>
                                    <div className="flex items-center gap-3 text-slate-800 font-bold text-lg">
                                        <Calendar size={18} className="text-indigo-600" />
                                        {docData.issued_at ? new Date(docData.issued_at).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'N/A'}
                                    </div>
                                </div>
                            </div>

                            {/* Document Live View & Download Panel */}
                            <div className="mb-12 space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Document Preview</p>
                                    <a 
                                        href={finalAssetUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-700 transition-colors"
                                    >
                                        IPFS Origin Asset <ExternalLink size={12} />
                                    </a>
                                </div>
                                
                                <div className="w-full h-120 bg-slate-50 rounded-3xl overflow-hidden border border-slate-200/60 shadow-inner relative flex items-center justify-center">
                                    {isImageAsset(finalAssetUrl) ? (
                                        <img 
                                            src={finalAssetUrl} 
                                            alt="Verified Credential Frame" 
                                            className="w-full h-full object-contain p-2 bg-white"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <iframe 
                                            src={`${finalAssetUrl}#toolbar=0`} 
                                            title="Credential Content Stream" 
                                            className="w-full h-full border-none bg-white"
                                        />
                                    )}
                                </div>

                                <a 
                                    href={finalAssetUrl} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    download={`EduTrace-Verified-Credential-${id?.substring(0, 8)}.png`}
                                    className="w-full flex items-center justify-center gap-3 py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-slate-200 hover:bg-indigo-600 hover:-translate-y-0.5 transition-all active:scale-95"
                                >
                                    <Download size={16} /> Download File Copy
                                </a>
                            </div>

                            {/* Blockchain Box */}
                            <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">On-Chain Evidence</h3>
                                    <span className="bg-indigo-100 text-indigo-700 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Arbitrum Sepolia</span>
                                </div>
                                <div className="space-y-5">
                                    <div>
                                        <p className="text-[9px] text-slate-400 uppercase font-black mb-2 opacity-60">File Hash (SHA-256)</p>
                                        <p className="text-[11px] font-mono break-all text-indigo-900 leading-relaxed bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                                            {blockchainData.hash}
                                        </p>
                                    </div>
                                    <a
                                        href={`${import.meta.env.VITE_ARB_EXPLORER_URL}${blockchainData.tx}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 hover:text-indigo-800 transition-colors group"
                                    >
                                        Inspect Transaction <ExternalLink size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-[3rem] p-12 md:p-20 shadow-2xl border-t-12 border-rose-500 text-center animate-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 bg-rose-50 rounded-[2.5rem] flex items-center justify-center text-rose-500 mx-auto mb-8 ring-1 ring-rose-100">
                            <ShieldAlert size={56} strokeWidth={2.5} />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Verification Failed</h2>
                        <p className="text-slate-500 mt-6 font-medium leading-relaxed max-w-sm mx-auto">
                            This credential record was not found on the Arbitrum blockchain. It may be invalid, tampered with, or hasn't been finalized on the ledger.
                        </p>
                        <button 
                            onClick={() => window.location.reload()}
                            className="mt-10 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                            Retry Verification
                        </button>
                    </div>
                )}
            </div>
            
            <div className="mt-12 text-center">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">Powered by EduTrace Blockchain Infrastructure</p>
            </div>
        </div>
    );
}