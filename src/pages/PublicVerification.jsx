import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; 
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
    ArrowLeft,
    Layers
} from 'lucide-react';

export default function PublicVerification() {
    const { id } = useParams(); 
    const navigate = useNavigate(); 
    const [status, setStatus] = useState('loading'); 
    const [docData, setDocData] = useState(null);
    const [documents, setDocuments] = useState([]); 
    const [selectedDoc, setSelectedDoc] = useState(null); 
    const [blockchainData, setBlockchainData] = useState(null);
    const [showBackButton, setShowBackButton] = useState(false); 
    const [downloadConfirmed, setDownloadConfirmed] = useState(false); 

    // --- SECURE LIVE STREAMING & CACHE STATE ---
    const [decryptedUrls, setDecryptedUrls] = useState({}); 
    const [isDecrypting, setIsDecrypting] = useState(false);
    
    // The master persistent cache tracking { [cid]: objectUrl }
    const urlsRef = useRef({});

    // Dynamic helper to extract the active document's decrypted URL from state
    const currentDecryptedUrl = selectedDoc ? decryptedUrls[selectedDoc.cid] : null;

    // Parses custom bundle structure "Name:CID || Name:CID"
    const parseCustomIpfsBundle = (ipfsCid) => {
        if (!ipfsCid) return [];
        const rawItems = String(ipfsCid).split('||');
        return rawItems.map(item => {
            const cleanItem = item.trim();
            const colonIndex = cleanItem.indexOf(':');
            if (colonIndex !== -1) {
                const name = cleanItem.substring(0, colonIndex).trim();
                const cid = cleanItem.substring(colonIndex + 1).trim();
                if (name && cid) return { name, cid };
            }
            return { name: "System Verified Asset", cid: cleanItem };
        }).filter(doc => doc.cid.length > 0);
    };

    // 1. Initial Cryptographic Verification & On-Chain Integrity Check
    useEffect(() => {
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

                const parsedList = parseCustomIpfsBundle(data.ipfs_cid || data.file_url);
                setDocuments(parsedList);
                if (parsedList.length > 0) {
                    setSelectedDoc(parsedList[0]);
                }

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

    // 2. MASTER UNMOUNT CLEANUP: Erase all memory leaks when the user leaves the page entirely
    useEffect(() => {
        return () => {
            // Revoke every single blob URL generated during this viewing session
            Object.values(urlsRef.current).forEach(url => {
                if (url) URL.revokeObjectURL(url);
            });
        };
    }, []);

    // 3. Secure Live View Cache Streamer (Prevents redundant decryption roundtrips)
    useEffect(() => {
        if (!selectedDoc) return;

        // HIT CACHE: If this CID has already been decrypted, skip the network request entirely!
        if (urlsRef.current[selectedDoc.cid]) {
            setIsDecrypting(false);
            return;
        }
        
        let active = true;

        const fetchDecryptedAsset = async () => {
            setIsDecrypting(true);

            try {
                const { data: { session } } = await supabase.auth.getSession();
                
                const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ipfs-upload?cid=${selectedDoc.cid}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`
                    }
                });

                if (!response.ok) throw new Error("Decryption function failed");

                const blob = await response.blob();
                
                if (active) {
                    const localUrl = URL.createObjectURL(blob);
                    
                    // Simultaneously write to persistent Ref Cache AND React UI State
                    urlsRef.current[selectedDoc.cid] = localUrl;
                    setDecryptedUrls(prev => ({ ...prev, [selectedDoc.cid]: localUrl }));
                }
            } catch (error) {
                console.error("Error decrypting document for live view:", error);
            } finally {
                if (active) setIsDecrypting(false);
            }
        };

        fetchDecryptedAsset();

        return () => {
            active = false;
            // NOTE: We no longer revoke the localUrl here. It stays alive inside urlsRef.current!
        };
    }, [selectedDoc]); 

    const isImageAsset = (name) => {
        return name ? /\.(jpeg|jpg|gif|png|webp|avif)$/i.test(name) : false;
    };

    // 4. Decrypted Download Pipeline Utility
    const triggerFileDownload = async (doc) => {
        if (!doc) return;
        
        let targetUrl = urlsRef.current[doc.cid];

        // If it isn't cached yet (e.g., downloading via a batch export without previewing first)
        if (!targetUrl) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                
                const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ipfs-upload?cid=${doc.cid}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`
                    }
                });
                
                const blob = await response.blob();
                targetUrl = URL.createObjectURL(blob);
                
                // Backfill the cache so the user can preview it instantly without re-fetching later
                urlsRef.current[doc.cid] = targetUrl;
                setDecryptedUrls(prev => ({ ...prev, [doc.cid]: targetUrl }));
            } catch (error) {
                console.error("Download decryption pipeline failed", error);
                return;
            }
        }

        const link = document.createElement('a');
        link.href = targetUrl;
        link.target = '_blank';
        const ext = isImageAsset(doc.name) ? 'png' : 'pdf';
        link.download = `Verified-${doc.name.replace(/\s+/g, '-')}-${id ? id.substring(0, 6) : 'ASSET'}.${ext}`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadAll = async () => {
        if (!downloadConfirmed || documents.length === 0) return;
        
        for (let i = 0; i < documents.length; i++) {
            await triggerFileDownload(documents[i]);
            await new Promise(resolve => setTimeout(resolve, 300)); 
        }
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#030712] p-6 font-mono selection:bg-cyan-500/20 selection:text-cyan-400">
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-3xl animate-pulse"></div>
                    <Loader2 className="animate-spin text-cyan-400 relative z-10" size={64} />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">[ RUNNING INTEGRITY_CHECK ]</h3>
                <p className="text-cyan-500/60 font-bold uppercase tracking-[0.2em] text-[10px]">Querying Arbitrum L2 Ledger Pipeline...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#030712] text-slate-100 py-16 px-4 font-mono relative overflow-hidden selection:bg-indigo-500/30 selection:text-indigo-200">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-size-[4rem_4rem] pointer-events-none"></div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-250 h-75 bg-indigo-500/5 blur-[150px] rounded-full pointer-events-none"></div>

            <div className="max-w-3xl mx-auto relative z-10">
                
                <div className="h-6 mb-6 flex items-center">
                    {showBackButton && (
                        <button 
                            onClick={() => navigate(-1)}
                            className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-cyan-400 border border-transparent hover:border-cyan-500/20 hover:bg-cyan-950/30 px-3 py-1.5 rounded-md transition-all group"
                        >
                            <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform text-cyan-400" /> SYS://RETURN_TO_CONSOLE
                        </button>
                    )}
                </div>

                <div className="text-center mb-12 border-b border-slate-800 pb-8 relative">
                    <div className="absolute bottom-0 left-0 w-8 h-px bg-cyan-500"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-px bg-indigo-500"></div>
                    
                    <div className="inline-flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)] mb-6">
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">NET_NODE: ACTIVE_SECURE</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-widest text-white uppercase italic">
                        EDUTRACE // <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500 font-sans tracking-normal font-black">VERIFY.sys</span>
                    </h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-2">SECURE CRYPTOGRAPHIC LEDGER READOUT</p>
                </div>

                {status === 'verified' ? (
                    <div className="space-y-6">
                        <div className="bg-slate-900/60 backdrop-blur-xl rounded-4xl p-6 md:p-10 border border-indigo-500/20 shadow-[0_0_50px_-12px_rgba(99,102,241,0.15)] relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none"></div>
                            
                            <div className="flex flex-col items-center text-center mb-10 border-b border-slate-800/60 pb-8">
                                <div className="w-16 h-16 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl flex items-center justify-center text-emerald-400 mb-4 shadow-[0_0_20px_rgba(16,185,129,0.15)] shadow-inner">
                                    <ShieldCheck size={36} strokeWidth={2} />
                                </div>
                                <h2 className="text-2xl font-black text-white uppercase tracking-wider">INTEGRITY_PASSED</h2>
                                <p className="text-emerald-400 text-[9px] font-bold uppercase tracking-[0.25em] mt-2 flex items-center gap-1.5">
                                    <Lock size={10} /> RECORD MATCHES ARBITRUM L2 ROOT HASH
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/50 p-6 rounded-2xl border border-slate-800/80 mb-8">
                                <div className="space-y-1.5">
                                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">// IDENTITY_TARGET</p>
                                    <div className="text-white font-bold text-base tracking-wide font-sans">{docData?.student_name}</div>
                                </div>
                                <div className="space-y-1.5">
                                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">// ISSUING_AUTHORITY</p>
                                    <div className="flex items-center gap-2 text-slate-300 font-bold text-sm font-sans">
                                        <Building2 size={14} className="text-indigo-400" />
                                        University of the Cordilleras
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">// BUNDLE_CONTAINS</p>
                                    <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
                                        <GraduationCap size={14} className="text-cyan-400" />
                                        {documents.length} Secure Asset File(s)
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">// TIMESTAMP_RECORDED</p>
                                    <div className="flex items-center gap-2 text-slate-300 font-bold text-xs">
                                        <Calendar size={14} className="text-indigo-400" />
                                        {docData?.issued_at ? new Date(docData.issued_at).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'N/A'}
                                    </div>
                                </div>
                            </div>

                            <div className="mb-8 space-y-3">
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">// SELECT ARCHIVE TARGET RESOURCE</p>
                                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                                    {documents.map((doc) => {
                                        const isCurrent = selectedDoc?.name === doc.name;
                                        return (
                                            <button
                                                key={doc.name}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedDoc(doc);
                                                    setDownloadConfirmed(false); 
                                                }}
                                                className={`w-full flex items-center justify-between p-3.5 px-5 rounded-xl border text-left text-xs uppercase tracking-wider transition-all ${
                                                    isCurrent 
                                                        ? 'bg-linear-to-r from-indigo-950/50 to-slate-900 border-indigo-500/60 text-white shadow-[0_0_15px_rgba(99,102,241,0.1)]' 
                                                        : 'bg-slate-950/30 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                                                }`}
                                            >
                                                <span className="truncate max-w-[80%] font-bold">{doc.name}</span>
                                                <div className="flex items-center gap-3 shrink-0 text-[9px] font-mono tracking-widest">
                                                    {isCurrent && <span className="text-cyan-400 font-bold text-[8px] bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">STREAM_MOUNTED</span>}
                                                    <span className="text-slate-600">{doc.cid.substring(0, 6)}...</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* SECURE LIVE PREVIEW PLAYBACK AREA */}
                            {selectedDoc && (
                                <div className="space-y-4 mb-8">
                                    <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 tracking-wider">
                                        <p className="uppercase">SANDBOX://PREVIEWING: {selectedDoc.name}</p>
                                        <a 
                                            href={currentDecryptedUrl || '#'} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className={`flex items-center gap-1 hover:underline ${currentDecryptedUrl ? 'text-cyan-400' : 'text-slate-600 cursor-not-allowed pointer-events-none'}`}
                                        >
                                            SECURE_DECRYPTED_LINK <ExternalLink size={10} />
                                        </a>
                                    </div>
                                    
                                    <div className="w-full h-110 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner relative flex items-center justify-center p-1">
                                        {isDecrypting ? (
                                            <div className="flex flex-col items-center gap-4 text-cyan-400">
                                                <Loader2 className="animate-spin" size={40} />
                                                <span className="text-[10px] uppercase tracking-widest font-bold animate-pulse">Decrypting Secure Asset...</span>
                                            </div>
                                        ) : !currentDecryptedUrl ? (
                                            <span className="text-slate-600 text-xs uppercase tracking-widest">Failed to load payload stream</span>
                                        ) : isImageAsset(selectedDoc.name) ? (
                                            <img 
                                                src={currentDecryptedUrl} 
                                                alt="Decoded Ledger View Frame" 
                                                className="w-full h-full object-contain bg-slate-950 rounded-xl"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <iframe 
                                                src={`${currentDecryptedUrl}#toolbar=0`} 
                                                title="Ledger Document Preview Matrix" 
                                                className="w-full h-full border-none rounded-xl bg-white invert-[0.88] hue-rotate-180" 
                                            />
                                        )}
                                    </div>

                                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-4">
                                        <label className="flex items-start gap-3 cursor-pointer group select-none">
                                            <div className="relative mt-0.5 shrink-0">
                                                <input 
                                                    type="checkbox" 
                                                    checked={downloadConfirmed}
                                                    onChange={(e) => setDownloadConfirmed(e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-4 h-4 bg-slate-900 border border-slate-700 peer-checked:border-cyan-400 rounded transition-all flex items-center justify-center peer-checked:bg-cyan-950/60">
                                                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-sm scale-0 peer-checked:scale-100 transition-transform"></div>
                                                </div>
                                            </div>
                                            <span className="text-[10px] leading-tight font-bold text-slate-400 group-hover:text-slate-300 uppercase tracking-wide">
                                                I confirm downloading this decrypted asset copy. I recognize it contains cryptographic verification stamps linking back to hash record {selectedDoc.cid.substring(0,8)}.
                                            </span>
                                        </label>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <button 
                                                type="button"
                                                disabled={!downloadConfirmed || isDecrypting}
                                                onClick={() => triggerFileDownload(selectedDoc)}
                                                className={`flex items-center justify-center gap-2.5 py-4 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${
                                                    downloadConfirmed && !isDecrypting
                                                        ? 'bg-linear-to-r from-cyan-500 to-indigo-600 text-white hover:opacity-90 shadow-lg shadow-indigo-950/40 cursor-pointer active:translate-y-px' 
                                                        : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed opacity-50'
                                                }`}
                                            >
                                                <Download size={14} /> EXPORT_SELECTED_ASSET
                                            </button>

                                            <button 
                                                type="button"
                                                disabled={!downloadConfirmed}
                                                onClick={handleDownloadAll}
                                                className={`flex items-center justify-center gap-2.5 py-4 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${
                                                    downloadConfirmed 
                                                        ? 'bg-slate-800 border border-indigo-500/40 text-indigo-300 hover:bg-slate-700/80 cursor-pointer active:translate-y-px' 
                                                        : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed opacity-50'
                                                }`}
                                            >
                                                <Layers size={14} /> EXPORT_ALL_ASSETS_BATCH
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-slate-950/80 rounded-2xl p-5 border border-slate-800/80">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-[9px] font-bold uppercase tracking-widest text-slate-500">// ON-CHAIN_PROOF</h3>
                                    <span className="bg-indigo-950/60 text-indigo-400 border border-indigo-500/30 text-[8px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider">ARB_SEPOLIA_TESTNET</span>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-[7px] text-slate-500 uppercase font-bold mb-1 opacity-80">VERIFICATION_HASH_ROOT (SHA-256)</p>
                                        <p className="text-[9px] font-mono break-all text-cyan-400/90 leading-relaxed bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl">
                                            {blockchainData?.hash}
                                        </p>
                                    </div>
                                    {blockchainData?.tx && (
                                        <a
                                            href={`${import.meta.env.VITE_ARB_EXPLORER_URL}${blockchainData.tx}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors group"
                                        >
                                            EXPLORE_LEDGER_BLOCKTRANSACTION <ExternalLink size={10} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-900/40 backdrop-blur-md rounded-4xl p-12 shadow-2xl border border-rose-500/30 shadow-rose-950/10 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-2 h-32 bg-rose-500/20 shadow-[0_0_20px_rgba(239,68,68,0.5)]"></div>
                        <div className="w-16 h-16 bg-rose-950/30 border border-rose-500/40 rounded-2xl flex items-center justify-center text-rose-500 mx-auto mb-6 ring-1 ring-rose-900/20 shadow-inner shadow-rose-500/5">
                            <ShieldAlert size={36} strokeWidth={2} />
                        </div>
                        <h2 className="text-xl font-black text-white uppercase tracking-widest">[ SECURITY_ALERT: CRITICAL ]</h2>
                        <p className="text-rose-400/80 text-[10px] uppercase font-bold tracking-wider mt-1">VERIFICATION_FAILED_OR_TAMPERED</p>
                        
                        <p className="text-slate-400 text-xs leading-relaxed max-w-md mx-auto mt-6 font-sans">
                            This asset lookup request failed on-chain signature cross-examination. Either data parameters have changed locally, or the cryptographic certificate signature route has missing registration tracks inside the active block scope.
                        </p>
                        <button 
                            onClick={() => window.location.reload()}
                            className="mt-8 text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-cyan-400 border border-slate-800 hover:border-cyan-500/30 bg-slate-950/40 px-5 py-2.5 rounded-xl transition-all"
                        >
                            SYS_RELOAD_LOOKUP_PIPELINE
                        </button>
                    </div>
                )}
            </div>
            
            <div className="mt-12 text-center pointer-events-none opacity-40">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.4em]">SYSTEM_EDUTRACE // LEDGER_CORE_v2.06_RELEASE</p>
            </div>
        </div>
    );
}