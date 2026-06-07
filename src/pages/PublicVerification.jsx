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
    Layers,
    Hash,
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
    const [isDownloading, setIsDownloading] = useState(false);
    const [decryptedUrls, setDecryptedUrls] = useState({});
    const [isDecrypting, setIsDecrypting] = useState(false);

    const urlsRef = useRef({});
    const currentDecryptedUrl = selectedDoc ? decryptedUrls[selectedDoc.cid] : null;

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
            return { name: 'System Verified Asset', cid: cleanItem };
        }).filter(doc => doc.cid.length > 0);
    };

    // 1. Cryptographic verification
    useEffect(() => {
        const dynamicHistory = window.history.state?.idx > 0;
        const internalReferrer = document.referrer.includes(window.location.host);
        if (dynamicHistory || internalReferrer) setShowBackButton(true);

        const verifyDocument = async () => {
            try {
                const { data, error } = await supabase
                    .from('credentials')
                    .select('*')
                    .eq('application_id', id)
                    .maybeSingle();

                if (error || !data) { setStatus('failed'); return; }

                setDocData(data);
                const parsedList = parseCustomIpfsBundle(data.ipfs_cid || data.file_url);
                setDocuments(parsedList);
                if (parsedList.length > 0) setSelectedDoc(parsedList[0]);

                const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_ARBITRUM_RPC);
                const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
                const isAuthentic = await contract.verifyDocument(data.blockchain_hash);

                if (isAuthentic) {
                    setBlockchainData({ hash: data.blockchain_hash, tx: data.tx_hash });
                    setStatus('verified');
                } else {
                    setStatus('failed');
                }
            } catch (error) {
                console.error('Verification Error:', error);
                setStatus('failed');
            }
        };

        if (id) verifyDocument();
    }, [id]);

    // 2. Cleanup
    useEffect(() => {
        return () => {
            Object.values(urlsRef.current).forEach(url => { if (url) URL.revokeObjectURL(url); });
        };
    }, []);

    // 3. Preview streamer — GET now passes applicationId so backend bakes QR + notice
    useEffect(() => {
        if (!selectedDoc) return;
        if (urlsRef.current[selectedDoc.cid]) {
            setIsDecrypting(false);
            return;
        }

        let active = true;

        const fetchDecryptedAsset = async () => {
            setIsDecrypting(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const response = await fetch(
                    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ipfs-upload?cid=${selectedDoc.cid}&applicationId=${id}`,
                    {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`
                        }
                    }
                );

                if (!response.ok) throw new Error('Decryption function failed');
                const blob = await response.blob();

                if (active) {
                    const localUrl = URL.createObjectURL(blob);
                    urlsRef.current[selectedDoc.cid] = localUrl;
                    setDecryptedUrls(prev => ({ ...prev, [selectedDoc.cid]: localUrl }));
                }
            } catch (error) {
                console.error('Error decrypting document for live view:', error);
            } finally {
                if (active) setIsDecrypting(false);
            }
        };

        fetchDecryptedAsset();
        return () => { active = false; };
    }, [selectedDoc]);

    const isImageAsset = (name) => name ? /\.(jpeg|jpg|gif|png|webp|avif)$/i.test(name) : false;

    // 4. Stamped download
    const triggerFileDownload = async (doc) => {
        if (!doc || !docData) return;
        setIsDownloading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stamp-pdf`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                    },
                    body: JSON.stringify({
                        cid: doc.cid,
                        docStatus: docData.status,
                        applicationId: id,
                    }),
                }
            );

            if (!response.ok) throw new Error('Stamp pipeline failed');
            const blob = await response.blob();
            const stampedUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = stampedUrl;
            link.download = `Verified-${doc.name.replace(/\s+/g, '-')}-${id?.substring(0, 6)}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(stampedUrl), 5000);
        } catch (err) {
            console.error('Download stamping failed:', err);
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadAll = async () => {
        if (!downloadConfirmed || documents.length === 0) return;
        for (let i = 0; i < documents.length; i++) {
            await triggerFileDownload(documents[i]);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    };

    // ── LOADING ───────────────────────────────────────────────────────────────
    if (status === 'loading') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#0d1117] p-6">
                <div className="relative mb-6">
                    <Loader2 className="animate-spin text-teal-400/80" size={44} strokeWidth={1.5} />
                </div>
                <p className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-[0.3em]">
                    Querying integrity ledger…
                </p>
            </div>
        );
    }

    // ── MAIN ──────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#0d1117] text-slate-300 font-mono relative overflow-hidden">

            {/* Subtle grid background */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(148,163,184,0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(148,163,184,0.03) 1px, transparent 1px)
                    `,
                    backgroundSize: '48px 48px',
                }}
            />

            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-teal-500/40 to-transparent" />

            <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">

                {/* Back button */}
                <div className="h-8 mb-8 flex items-center">
                    {showBackButton && (
                        <button
                            onClick={() => navigate(-1)}
                            className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-teal-400 transition-colors group"
                        >
                            <ArrowLeft size={11} className="group-hover:-translate-x-0.5 transition-transform" />
                            Return
                        </button>
                    )}
                </div>

                {/* Header */}
                <div className="mb-10 pb-8 border-b border-slate-800">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                        <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-teal-400/70">
                            Node active · Arbitrum L2
                        </span>
                    </div>
                    <h1 className="text-2xl font-black uppercase tracking-tight text-slate-100">
                        EduTrace
                        <span className="text-teal-400 font-light"> / </span>
                        <span className="text-slate-400 font-normal text-xl">verify</span>
                    </h1>
                    <p className="text-[10px] text-slate-600 uppercase tracking-[0.25em] mt-1.5">
                        Cryptographic credential verification system
                    </p>
                </div>

                {/* ── VERIFIED ─────────────────────────────────────────── */}
                {status === 'verified' ? (
                    <div className="space-y-5">

                        {/* Status badge */}
                        <div className="flex items-center gap-4 p-5 bg-emerald-950/20 border border-emerald-800/30 rounded-2xl">
                            <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-700/40 flex items-center justify-center shrink-0">
                                <ShieldCheck size={20} className="text-emerald-400" strokeWidth={2} />
                            </div>
                            <div>
                                <p className="text-emerald-400 text-sm font-black uppercase tracking-wider">Integrity passed</p>
                                <p className="text-emerald-700 text-[9px] font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1">
                                    <Lock size={8} /> Record matches on-chain root hash
                                </p>
                            </div>
                        </div>

                        {/* Credential info */}
                        <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl p-5 grid grid-cols-2 gap-5">
                            <InfoField
                                label="Identity target"
                                value={docData?.student_name}
                                full
                            />
                            <InfoField
                                label="Issuing authority"
                                value="University of the Cordilleras"
                                icon={<Building2 size={11} className="text-slate-500" />}
                            />
                            <InfoField
                                label="Bundle assets"
                                value={`${documents.length} file(s)`}
                                icon={<GraduationCap size={11} className="text-slate-500" />}
                            />
                            <InfoField
                                label="Timestamp"
                                value={docData?.issued_at
                                    ? new Date(docData.issued_at).toLocaleDateString(undefined, { dateStyle: 'medium' })
                                    : 'N/A'}
                                icon={<Calendar size={11} className="text-slate-500" />}
                            />
                        </div>

                        {/* Document selector */}
                        {documents.length > 1 && (
                            <div className="space-y-2">
                                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest px-1">
                                    Select asset
                                </p>
                                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                    {documents.map((doc) => {
                                        const isCurrent = selectedDoc?.name === doc.name;
                                        return (
                                            <button
                                                key={doc.name}
                                                type="button"
                                                onClick={() => { setSelectedDoc(doc); setDownloadConfirmed(false); }}
                                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left text-[11px] transition-all ${
                                                    isCurrent
                                                        ? 'bg-teal-950/30 border-teal-700/50 text-teal-300'
                                                        : 'bg-slate-900/40 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                                                }`}
                                            >
                                                <span className="font-bold uppercase tracking-wide truncate max-w-[75%]">{doc.name}</span>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {isCurrent && (
                                                        <span className="text-[8px] font-bold text-teal-500 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800/40 uppercase tracking-wider">
                                                            Active
                                                        </span>
                                                    )}
                                                    <span className="text-slate-700 text-[9px] font-mono">{doc.cid.substring(0, 8)}…</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Live preview */}
                        {selectedDoc && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                                        Preview · {selectedDoc.name}
                                    </p>
                                    <a
                                        href={currentDecryptedUrl || '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                                            currentDecryptedUrl
                                                ? 'text-teal-500 hover:text-teal-300'
                                                : 'text-slate-700 pointer-events-none'
                                        }`}
                                    >
                                        Open <ExternalLink size={9} />
                                    </a>
                                </div>

                                {/* Preview frame */}
                                <div className="w-full h-120 bg-[#080c10] rounded-2xl border border-slate-800/60 overflow-hidden relative flex items-center justify-center">
                                    {isDecrypting ? (
                                        <div className="flex flex-col items-center gap-3 text-slate-500">
                                            <Loader2 className="animate-spin text-teal-400/60" size={32} strokeWidth={1.5} />
                                            <span className="text-[10px] uppercase tracking-widest font-bold animate-pulse">
                                                Decrypting…
                                            </span>
                                        </div>
                                    ) : !currentDecryptedUrl ? (
                                        <span className="text-slate-700 text-[11px] uppercase tracking-widest">
                                            Failed to load stream
                                        </span>
                                    ) : isImageAsset(selectedDoc.name) ? (
                                        <img
                                            src={currentDecryptedUrl}
                                            alt="Document preview"
                                            className="w-full h-full object-contain"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <iframe
                                            src={`${currentDecryptedUrl}#toolbar=0`}
                                            title="Document preview"
                                            className="w-full h-full border-none"
                                            style={{ background: '#fff' }}
                                        />
                                    )}
                                </div>

                                {/* Download section */}
                                <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 space-y-4">
                                    {/* Confirmation checkbox */}
                                    <label className="flex items-start gap-3 cursor-pointer group select-none">
                                        <div className="relative mt-0.5 shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={downloadConfirmed}
                                                onChange={(e) => setDownloadConfirmed(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-4 h-4 bg-slate-950 border border-slate-700 peer-checked:border-teal-500/70 rounded transition-all flex items-center justify-center peer-checked:bg-teal-950/50">
                                                <div className="w-1.5 h-1.5 bg-teal-400 rounded-sm scale-0 peer-checked:scale-100 transition-transform" />
                                            </div>
                                        </div>
                                        <span className="text-[10px] leading-relaxed font-bold text-slate-500 group-hover:text-slate-400 uppercase tracking-wide">
                                            I confirm this download. The exported file contains cryptographic stamps
                                            linked to hash record <span className="text-slate-400 font-mono">{selectedDoc.cid.substring(0, 10)}…</span>
                                        </span>
                                    </label>

                                    {/* Download buttons */}
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <button
                                            type="button"
                                            disabled={!downloadConfirmed || isDecrypting || isDownloading}
                                            onClick={() => triggerFileDownload(selectedDoc)}
                                            className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${
                                                downloadConfirmed && !isDecrypting && !isDownloading
                                                    ? 'bg-teal-500/10 border border-teal-500/30 text-teal-300 hover:bg-teal-500/20 hover:border-teal-400/50 cursor-pointer'
                                                    : 'bg-slate-900/60 text-slate-700 border border-slate-800 cursor-not-allowed'
                                            }`}
                                        >
                                            {isDownloading
                                                ? <><Loader2 size={12} className="animate-spin" /> Stamping…</>
                                                : <><Download size={12} /> Export selected</>
                                            }
                                        </button>

                                        <button
                                            type="button"
                                            disabled={!downloadConfirmed || isDownloading}
                                            onClick={handleDownloadAll}
                                            className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${
                                                downloadConfirmed && !isDownloading
                                                    ? 'bg-slate-800/60 border border-slate-700/50 text-slate-300 hover:bg-slate-700/60 cursor-pointer'
                                                    : 'bg-slate-900/60 text-slate-700 border border-slate-800 cursor-not-allowed'
                                            }`}
                                        >
                                            {isDownloading
                                                ? <><Loader2 size={12} className="animate-spin" /> Processing…</>
                                                : <><Layers size={12} /> Export all</>
                                            }
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* On-chain proof */}
                        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                                    <Hash size={10} /> On-chain proof
                                </p>
                                <span className="text-[8px] font-bold text-slate-600 bg-slate-800/60 border border-slate-700/40 px-2 py-0.5 rounded uppercase tracking-wider">
                                    Arb Sepolia
                                </span>
                            </div>

                            <div>
                                <p className="text-[8px] text-slate-600 uppercase tracking-widest mb-2 font-bold">
                                    SHA-256 root hash
                                </p>
                                <p className="text-[9px] font-mono break-all text-teal-400/70 leading-relaxed bg-slate-950/60 border border-slate-800/60 p-3.5 rounded-xl">
                                    {blockchainData?.hash}
                                </p>
                            </div>

                            {blockchainData?.tx && (
                                <a
                                    href={`${import.meta.env.VITE_ARB_EXPLORER_URL}${blockchainData.tx}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-teal-400 transition-colors group"
                                >
                                    View block transaction
                                    <ExternalLink size={9} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </a>
                            )}
                        </div>
                    </div>

                ) : (
                    // ── FAILED ────────────────────────────────────────────
                    <div className="bg-slate-900/40 border border-rose-900/40 rounded-2xl p-10 text-center space-y-5">
                        <div className="w-12 h-12 bg-rose-950/40 border border-rose-800/40 rounded-xl flex items-center justify-center text-rose-500 mx-auto">
                            <ShieldAlert size={24} strokeWidth={1.5} />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-slate-200 uppercase tracking-wider">Verification failed</h2>
                            <p className="text-rose-500/70 text-[10px] uppercase font-bold tracking-wider mt-1">
                                Record tampered or not found
                            </p>
                        </div>
                        <p className="text-slate-500 text-xs leading-relaxed max-w-sm mx-auto font-sans">
                            This credential could not be matched against the on-chain registry.
                            The document may have been altered or the application ID is invalid.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="text-[9px] font-bold uppercase tracking-widest text-slate-600 hover:text-teal-400 border border-slate-800 hover:border-teal-800/50 bg-slate-950/40 px-5 py-2.5 rounded-xl transition-all"
                        >
                            Retry lookup
                        </button>
                    </div>
                )}

                {/* Footer */}
                <div className="mt-12 pt-6 border-t border-slate-800/40 text-center">
                    <p className="text-[9px] font-bold text-slate-700 uppercase tracking-[0.35em]">
                        EduTrace · Ledger Core v2.06
                    </p>
                </div>
            </div>
        </div>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const InfoField = ({ label, value, icon, full }) => (
    <div className={full ? 'col-span-2' : ''}>
        <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-center gap-1.5">
            {icon}
            <span className="text-slate-300 text-[11px] font-bold tracking-wide">{value || '—'}</span>
        </div>
    </div>
);