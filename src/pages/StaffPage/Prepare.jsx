// src/pages/StaffPage/Prepare.jsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient'; 
import { useAuth } from '../../hooks/useAuth';
import { 
  Loader2, 
  Zap, 
  AlertCircle, 
  FileText, 
  ExternalLink, 
  ChevronDown, 
  CheckCircle, 
  UploadCloud, 
  RefreshCw,
  CornerDownLeft,
  MessageSquare
} from 'lucide-react';

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

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
        return { name: "L1 Verifiable Document Asset", cid: cleanItem };
    }).filter(doc => doc.cid.length > 0);
};

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE CONTEXT
// This console handles the "Verified" route only:
//   Verified → Head Registrar reviews here → mints via "Authorize & Mint Bundle"
//   To_be_Issued → Staff mints directly from StaffDashboard (handleMintRequest)
//
// A "Returned" status means the Head has rejected the uploaded bundle.
// The ipfs_cid is cleared server-side; staff must re-upload and re-submit.
// ─────────────────────────────────────────────────────────────────────────────

export default function StaffIssuanceConsole() {
    const { docId } = useParams(); 
    const navigate = useNavigate();
    const { profile } = useAuth();
    
    const [appData, setAppData] = useState(null);
    const [documents, setDocuments] = useState([]); 
    const [activeDocName, setActiveDocName] = useState(null); 
    
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedCidString, setUploadedCidString] = useState(''); 

    const [decryptedUrls, setDecryptedUrls] = useState({});
    const [isDecrypting, setIsDecrypting] = useState(false);

    // Return flow state
    const [isReturning, setIsReturning] = useState(false);
    const [showReturnPanel, setShowReturnPanel] = useState(false);
    const [returnReason, setReturnReason] = useState('');
    
    const urlsRef = useRef({});
    const fileInputRef = useRef(null); 

    const [loading, setLoading] = useState(true);
    const [isMinting, setIsMinting] = useState(false);
    const [mintingStep, setMintingStep] = useState('');

    // ── Derived status helpers ────────────────────────────────────────────────
    const currentStatus = appData?.status;
    const isReturned    = currentStatus === 'Returned';
    const isAlreadyIssued = ['L1_Issued', 'Minted', 'Issued'].includes(currentStatus);
    // "To_be_Issued" cards are minted directly from the dashboard, not here
    const isToBeMintedHere = currentStatus === 'Verified' || currentStatus === 'L1_Issued';

    const handleFileChange = (e) => {
        if (e.target.files) {
            setSelectedFiles(Array.from(e.target.files));
        }
    };

    const clearRevocationUrls = () => {
        Object.values(urlsRef.current).forEach(url => {
            if (url) URL.revokeObjectURL(url);
        });
        urlsRef.current = {};
        setDecryptedUrls({});
    };

    const handleClearBundle = async () => {
        if (!window.confirm("Are you sure you want to clear this L1 batch? You will need to re-upload files.")) return;
        
        try {
            setLoading(true);
            const { error: clearError } = await supabase
                .from('student_applications')
                .update({ ipfs_cid: null })
                .eq('application_id', docId);

            if (clearError) throw clearError;

            setUploadedCidString('');
            setDocuments([]);
            setSelectedFiles([]);
            setActiveDocName(null);
            clearRevocationUrls();
            
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }

            setAppData(prev => prev ? { ...prev, ipfs_cid: null } : null);
        } catch (error) {
            console.error("Failed to clear bundle:", error);
            alert(`Reset error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // ── Return to Staff ───────────────────────────────────────────────────────
    // Sets status → "Returned", clears ipfs_cid so staff must re-upload,
    // and stores the reason in rejection_reason (prefixed [RETURNED]).
    // Verify.jsx "Returned by Head" tab surfaces these to staff.
    const handleReturnToStaff = async () => {
        const reason = returnReason.trim();
        if (!reason) return alert('Please enter a reason before returning.');

        if (!window.confirm("Return this application to staff for correction? The uploaded bundle will be cleared.")) return;

        setIsReturning(true);
        try {
            const { error } = await supabase
                .from('student_applications')
                .update({
                    status: 'Returned',
                    ipfs_cid: null,
                    rejection_reason: `[RETURNED] ${reason}`,
                    reopened_at: new Date().toISOString(),
                })
                .eq('application_id', docId);

            if (error) throw error;

            setAppData(prev => prev ? {
                ...prev,
                status: 'Returned',
                ipfs_cid: null,
                rejection_reason: `[RETURNED] ${reason}`,
            } : null);

            setUploadedCidString('');
            setDocuments([]);
            setActiveDocName(null);
            clearRevocationUrls();
            setShowReturnPanel(false);
            setReturnReason('');

            alert("Application returned to staff for correction.");
            navigate('/staff/dashboard');
        } catch (error) {
            console.error("Return failed:", error);
            alert(`Return failed: ${error.message}`);
        } finally {
            setIsReturning(false);
        }
    };

    const handleUploadToIpfs = async (e) => {
        e.preventDefault();
        if (selectedFiles.length === 0) return alert("Please select at least one document to upload.");

        setIsUploading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("Active session token not found. Please re-authenticate.");

            const uploadedSegments = [];

            for (const file of selectedFiles) {
                const formData = new FormData();
                formData.append('file', file); 

                const response = await fetch(
                    `${supabase.supabaseUrl}/functions/v1/ipfs-upload`, 
                    {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                    }
                );

                if (!response.ok) throw new Error(`Upload failed for ${file.name}`);
                const data = await response.json();
                const resolutionCid = data.cid || data.ipfsHash || data.hash || (data.data && data.data.cid);

                if (resolutionCid) {
                    uploadedSegments.push(`${file.name}:${resolutionCid}`);
                } else {
                    throw new Error(`Edge Function did not return a recognizable CID key for ${file.name}`);
                }
            }

            const newBundleString = uploadedSegments.join(' || ');

            const { error: updateError } = await supabase
                .from('student_applications')
                .update({ ipfs_cid: newBundleString })
                .eq('application_id', docId);

            if (updateError) throw updateError;

            setUploadedCidString(newBundleString);
            const parsedList = parseCustomIpfsBundle(newBundleString);
            setDocuments(parsedList);
            setAppData(prev => prev ? { ...prev, ipfs_cid: newBundleString } : null);
            
            alert("L1 Evidence logs uploaded successfully!");
        } catch (error) {
            console.error("IPFS Storage Pipeline Failure:", error);
            alert(`Process failed: ${error.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleAccordionToggle = async (doc) => {
        const isCurrentlyOpen = activeDocName === doc.name;
        if (isCurrentlyOpen) {
            setActiveDocName(null);
            return;
        }

        setActiveDocName(doc.name);

        if (urlsRef.current[doc.cid]) {
            if (!decryptedUrls[doc.cid]) {
                setDecryptedUrls(prev => ({ ...prev, [doc.cid]: urlsRef.current[doc.cid] }));
            }
            return;
        }

        setIsDecrypting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("Active session token not found.");

            const response = await fetch(
                `${supabase.supabaseUrl}/functions/v1/ipfs-upload?cid=${doc.cid}&raw=true`, 
                {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );

            if (!response.ok) throw new Error(`Edge Function responded with status: ${response.status}`);

            const pdfBlob = await response.blob();
            const localUrl = URL.createObjectURL(pdfBlob);
            
            urlsRef.current[doc.cid] = localUrl;
            setDecryptedUrls(prev => ({ ...prev, [doc.cid]: localUrl }));
        } catch (error) {
            console.error("Failed to load document:", error);
            alert("Could not load and decrypt document.");
        } finally {
            setIsDecrypting(false);
        }
    };

    useEffect(() => {
        return () => {
            Object.values(urlsRef.current).forEach(url => {
                if (url) URL.revokeObjectURL(url);
            });
        };
    }, []);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                setLoading(true);
                const { data: application, error: appError } = await supabase
                    .from('student_applications')
                    .select(`*, student_records!user_id (*)`)
                    .eq('application_id', docId)
                    .maybeSingle();
                
                if (appError) throw appError;

                if (application) {
                    application.student_records = Array.isArray(application.student_records)
                        ? application.student_records[0]
                        : application.student_records;

                    if (application.ipfs_cid) {
                        setUploadedCidString(application.ipfs_cid);
                        const parsedList = parseCustomIpfsBundle(application.ipfs_cid);
                        setDocuments(parsedList);
                    }
                }
                setAppData(application);
            } catch (error) {
                console.error("Fetch failure:", error.message);
            } finally {
                setLoading(false);
            }
        };

        if (docId) fetchDetails();
    }, [docId]);

    // ── MINT — only fires for the "Verified" route ────────────────────────────
    // "To_be_Issued" applications are minted directly from StaffDashboard
    // via handleMintRequest → they never land on this page.
    const handleIssueAndMint = async () => {
        const recipientId = appData?.student_records?.id;
        const ipfsCid = uploadedCidString || appData?.ipfs_cid;

        if (!recipientId || !ipfsCid) {
            alert("Error: Missing Student Record ID or IPFS CID configuration. Cannot mint.");
            return;
        }

        if (!window.confirm("Authorize Blockchain Minting to Arbitrum Sepolia?")) return;

        setIsMinting(true);
        setMintingStep('Initiating L1 Transaction...');
        
        try {
            // 1. Invoke the Web3 edge contract mint method sequence
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

            const returnedHash = data?.txHash || data?.hash || "SUCCESS";
            
            // 2. 🛡️ INTEGRITY SAFEGUARD: only update DB after on-chain confirmation
            setMintingStep('Validating transaction on-chain...');
            
            const { error: dbUpdateError } = await supabase
                .from('student_applications')
                .update({ status: 'L1_Issued' })
                .eq('application_id', docId);

            if (dbUpdateError) {
                throw new Error(`Blockchain minted (${returnedHash}), but DB status update failed: ${dbUpdateError.message}`);
            }

            // 3. Mark credential log as fully issued (mirrors dashboard handleMintRequest)
            await supabase
                .from('credentials')
                .update({ status: 'Issued' })
                .eq('application_id', docId);

            setMintingStep('Success! Transaction Hash: ' + returnedHash.substring(0, 10) + '...');
            alert("Asset successfully minted on Arbitrum and status registered to database!");
            
            setTimeout(() => navigate('/staff/dashboard'), 3000);
        } catch (err) {
            console.error("Critical Minting Failure:", err);
            setMintingStep(`Failed: ${err.message}`);
            alert(`Minting Process Failed: ${err.message}. Database state was protected and preserved.`);
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
                <h2 className="text-xl font-bold text-slate-800">Application record not found</h2>
                <button onClick={() => navigate(-1)} className="text-indigo-600 font-bold underline">Go Back</button>
            </div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto p-10">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Staff Verification & Issuance</h1>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Level 1 Processing Terminal — Bundle ID: {docId?.substring(0, 8)}</p>
                </div>

                {/* Status pill — reflects the full status vocabulary from Dashboard */}
                {currentStatus && (
                    <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        isAlreadyIssued    ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                        isReturned         ? 'bg-amber-50 text-amber-600 border-amber-200' :
                        currentStatus === 'Verified' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
                        'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                        {currentStatus.replace('_', ' ')}
                    </span>
                )}
            </div>

            {/* ── Returned banner — mirrors Verify.jsx "Returned by Head" info banner ── */}
            {isReturned && (
                <div className="flex items-start gap-3 p-5 bg-amber-50 border border-amber-200 rounded-3xl mb-6">
                    <CornerDownLeft size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
                            Returned by Head Registrar
                        </p>
                        <p className="text-[10px] font-bold text-amber-600 mt-0.5 leading-relaxed">
                            This application was returned. The uploaded bundle has been cleared.
                            {appData?.rejection_reason && (
                                <span className="block mt-1 text-amber-500">
                                    Reason: {appData.rejection_reason.replace('[RETURNED] ', '')}
                                </span>
                            )}
                        </p>
                    </div>
                </div>
            )}

            {/* ── Already issued banner ─────────────────────────────────────── */}
            {isAlreadyIssued && (
                <div className="flex items-start gap-3 p-5 bg-emerald-50 border border-emerald-200 rounded-3xl mb-6">
                    <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                            Credential Already Issued
                        </p>
                        <p className="text-[10px] font-bold text-emerald-600 mt-0.5 leading-relaxed">
                            This credential has been minted on-chain. Re-minting is disabled to protect the ledger state.
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* ── Left Column ──────────────────────────────────────────── */}
                <div className="lg:col-span-8 space-y-4">
                    {!uploadedCidString ? (
                        <div className="bg-white rounded-[3rem] border border-dashed border-slate-300 p-16 text-center shadow-sm">
                            <UploadCloud className="mx-auto text-slate-400 mb-4" size={52} />
                            <h3 className="font-black uppercase text-sm tracking-wider text-slate-700 mb-2">Upload Level 1 Verification Bundle</h3>
                            <p className="text-slate-400 text-xs mb-8 max-w-md mx-auto">Select file assets to bundle and securely load onto IPFS nodes before finalizing smart contracts.</p>
                            
                            <form onSubmit={handleUploadToIpfs} className="space-y-5 max-w-sm mx-auto">
                                <input 
                                    ref={fileInputRef}
                                    type="file" 
                                    multiple 
                                    onChange={handleFileChange}
                                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all cursor-pointer"
                                />
                                {selectedFiles.length > 0 && (
                                    <div className="text-left bg-slate-50 p-4 rounded-2xl text-[11px] space-y-1.5 text-slate-600 font-mono border border-slate-100">
                                        {selectedFiles.map((f, idx) => <div key={idx} className="truncate">• {f.name}</div>)}
                                    </div>
                                )}
                                <button
                                    type="submit"
                                    disabled={isUploading || selectedFiles.length === 0}
                                    className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 transition-colors flex items-center justify-center gap-2"
                                >
                                    {isUploading ? <Loader2 className="animate-spin" size={14} /> : null}
                                    {isUploading ? "Processing Node Upload..." : "Submit Bundle"}
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {documents.map((doc) => {
                                const isOpen = activeDocName === doc.name;
                                const safeFileName = encodeURIComponent(doc.name.replace(/\s+/g, '_')) + '_ENCRYPTED.enc';
                                const gatewayUrl = `${IPFS_GATEWAY}${doc.cid}?filename=${safeFileName}`;

                                return (
                                    <div 
                                        key={doc.name} 
                                        className={`bg-white rounded-[2.5rem] border transition-all duration-200 overflow-hidden ${
                                            isOpen ? 'border-indigo-300 shadow-xl shadow-indigo-100/40' : 'border-slate-200 shadow-sm'
                                        }`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleAccordionToggle(doc)}
                                            className="w-full flex items-center justify-between p-6 px-8 bg-slate-50 hover:bg-slate-100/70 transition-colors text-left"
                                        >
                                            <div className="flex items-center gap-4 max-w-[70%]">
                                                <div className={`p-2 rounded-xl transition-colors ${isOpen ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200/60 text-slate-400'}`}>
                                                    <FileText size={18} />
                                                </div>
                                                <span className="font-black text-slate-800 text-xs uppercase tracking-wider truncate block">
                                                    {doc.name}
                                                </span>
                                            </div>
                                            
                                            <div className="flex items-center gap-6 shrink-0">
                                                <a 
                                                    href={gatewayUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()} 
                                                    className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-400 hover:text-indigo-600 transition-colors tracking-widest"
                                                >
                                                    RAW IPFS <ExternalLink size={12} />
                                                </a>
                                                <ChevronDown 
                                                    size={16} 
                                                    className={`text-slate-400 transition-transform duration-200 transform ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} 
                                                />
                                            </div>
                                        </button>

                                        {isOpen && (
                                            <div className="p-4 bg-slate-100 border-t border-slate-100 relative min-h-125">
                                                {(!decryptedUrls[doc.cid] || isDecrypting) ? (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 rounded-3xl z-10">
                                                        <Loader2 className="animate-spin text-indigo-600 mb-2" size={32} />
                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Decrypting IPFS Stream...</p>
                                                    </div>
                                                ) : (
                                                    <iframe
                                                        src={`${decryptedUrls[doc.cid]}#toolbar=0`}
                                                        className="w-full h-125 rounded-3xl bg-white border border-slate-200 shadow-inner"
                                                        title={`Staff Preview - ${doc.name}`}
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ── Return to Staff panel ──────────────────────────────── */}
                    {/* Only show when there IS a bundle to review and it hasn't been issued yet */}
                    {uploadedCidString && !isAlreadyIssued && !isMinting && (
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setShowReturnPanel(v => !v)}
                                className="w-full flex items-center justify-between p-6 px-8 bg-slate-50 hover:bg-amber-50 transition-colors text-left"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-xl transition-colors ${showReturnPanel ? 'bg-amber-100 text-amber-600' : 'bg-slate-200/60 text-slate-400'}`}>
                                        <CornerDownLeft size={18} />
                                    </div>
                                    <div>
                                        <span className="font-black text-slate-800 text-xs uppercase tracking-wider block">
                                            Return to Staff
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-bold">
                                            Clear bundle and request a corrected re-upload
                                        </span>
                                    </div>
                                </div>
                                <ChevronDown 
                                    size={16} 
                                    className={`text-slate-400 transition-transform duration-200 ${showReturnPanel ? 'rotate-180 text-amber-500' : ''}`} 
                                />
                            </button>

                            {showReturnPanel && (
                                <div className="px-8 pb-8 pt-0 border-t border-slate-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pt-6 flex items-center gap-2">
                                        <MessageSquare size={12} />
                                        Reason for returning
                                    </p>
                                    <textarea
                                        rows={3}
                                        placeholder="e.g. Wrong document uploaded, TOR is missing page 2, please re-scan and resubmit..."
                                        value={returnReason}
                                        onChange={(e) => setReturnReason(e.target.value)}
                                        className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-300 focus:ring-4 focus:ring-amber-50 resize-none transition-all"
                                    />
                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={() => { setShowReturnPanel(false); setReturnReason(''); }}
                                            className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleReturnToStaff}
                                            disabled={isReturning || !returnReason.trim()}
                                            className="flex items-center gap-2 px-8 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-amber-100"
                                        >
                                            {isReturning
                                                ? <><Loader2 size={13} className="animate-spin" /> Returning...</>
                                                : <><CornerDownLeft size={13} /> Confirm Return</>
                                            }
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Right Column ─────────────────────────────────────────── */}
                <div className="lg:col-span-4 bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl flex flex-col justify-between border border-slate-800 lg:sticky lg:top-10">
                    <div>
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="bg-emerald-500/20 p-2 rounded-xl text-emerald-400">
                                    <CheckCircle size={20} />
                                </div>
                                <h3 className="text-xs font-black uppercase text-emerald-400 tracking-[0.2em]">Staff Audit Context</h3>
                            </div>
                            
                            {uploadedCidString && !isMinting && !isAlreadyIssued && (
                                <button 
                                    onClick={handleClearBundle}
                                    title="Reset current bundle configuration"
                                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                >
                                    <RefreshCw size={14} />
                                </button>
                            )}
                        </div>
                        
                        <div className="space-y-6 mb-10 border-y border-white/5 py-8">
                            <div>
                                <p className="text-[9px] text-white/30 uppercase tracking-widest mb-2 font-black">Student Holder</p>
                                <p className="text-lg font-bold text-white italic tracking-tight">
                                    {appData?.student_records?.full_name || 'NOT FOUND'}
                                </p>
                            </div>
                            
                            <div>
                                <p className="text-[9px] text-white/30 uppercase tracking-widest mb-2 font-black">Program Allocation</p>
                                <p className="text-sm font-bold text-slate-300">
                                    {appData?.student_records?.course || 'UNSPECIFIED'}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <p className="text-[9px] text-white/30 uppercase tracking-widest mb-2 font-black">System ID</p>
                                    <p className="text-xs font-mono font-bold text-emerald-400">
                                        {appData?.student_records?.student_id}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[9px] text-white/30 uppercase tracking-widest mb-2 font-black">Total Uploads</p>
                                    <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest">
                                        {documents.length} Files Linked
                                    </p>
                                </div>
                            </div>

                            {/* Routing indicator — clarifies which mint path applies */}
                            <div>
                                <p className="text-[9px] text-white/30 uppercase tracking-widest mb-2 font-black">Issuance Route</p>
                                <p className={`text-[10px] font-bold uppercase tracking-widest ${
                                    currentStatus === 'To_be_Issued'
                                        ? 'text-amber-400'
                                        : isAlreadyIssued
                                        ? 'text-emerald-400'
                                        : 'text-indigo-300'
                                }`}>
                                    {currentStatus === 'To_be_Issued'
                                        ? 'Staff Self-Issue (Dashboard)'
                                        : isAlreadyIssued
                                        ? 'Issued · Ledger Finalized'
                                        : 'Head Registrar Mint (This Page)'}
                                </p>
                            </div>

                            <div>
                                <p className="text-[9px] text-white/30 uppercase tracking-widest mb-2 font-black">Target L1 IPFS Array</p>
                                <p className="text-[8px] font-mono text-slate-500 break-all bg-black/40 p-3 rounded-xl border border-white/5 max-h-28 overflow-y-auto">
                                    {uploadedCidString || "Awaiting file upload execution..."}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ── Action Panel ─────────────────────────────────────── */}
                    <div className="space-y-4">

                        {/* To_be_Issued: redirect to dashboard rather than minting here */}
                        {currentStatus === 'To_be_Issued' && (
                            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
                                <p className="text-center text-[9px] text-amber-400 uppercase font-black tracking-widest leading-relaxed">
                                    This credential is queued for staff self-issue.
                                    Use "Issue to Student" on the dashboard.
                                </p>
                            </div>
                        )}

                        {/* Standard mint button — Verified route only */}
                        {currentStatus !== 'To_be_Issued' && (
                            <button 
                                onClick={handleIssueAndMint}
                                disabled={isMinting || !uploadedCidString || isAlreadyIssued} 
                                className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-4xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-900/20"
                            >
                                {isMinting ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                                {isAlreadyIssued
                                    ? 'Credential Finalized'
                                    : isMinting
                                    ? 'Processing Transaction...'
                                    : 'Authorize & Mint Bundle'}
                            </button>
                        )}
                        
                        {isMinting && (
                            <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl">
                                <p className="text-center text-[9px] text-indigo-400 animate-pulse uppercase font-black tracking-widest">
                                    {mintingStep}
                                </p>
                            </div>
                        )}
                        
                        <p className="text-[8px] text-center text-white/20 uppercase font-bold tracking-widest">
                            Authorized By: Staff ({profile?.id?.substring(0,8) || 'SYSTEM'})
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}