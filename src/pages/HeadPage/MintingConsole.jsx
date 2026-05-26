import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient'; 
import { useAuth } from '../../hooks/useAuth';
import { Loader2, Zap, AlertCircle, FileText, ExternalLink, ChevronDown } from 'lucide-react';

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

export default function MintingConsole() {
    const { docId } = useParams(); 
    const navigate = useNavigate();
    const { profile } = useAuth();
    
    const [appData, setAppData] = useState(null);
    const [documents, setDocuments] = useState([]); // Will store array of { name, cid }
    const [activeDocName, setActiveDocName] = useState(null); // Tracks open accordion panel
    
    // Decrypted blob URLs mapped by CID
    const [decryptedUrls, setDecryptedUrls] = useState({});
    const [isDecrypting, setIsDecrypting] = useState(false);

    // ADDED: The master persistent cache tracking { [cid]: objectUrl }
    const urlsRef = useRef({});

    const [loading, setLoading] = useState(true);
    const [isMinting, setIsMinting] = useState(false);
    const [mintingStep, setMintingStep] = useState('');

    // Parses your explicit "Name:CID || Name:CID" format
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
            
            return { name: "Credential Document Asset", cid: cleanItem };
        }).filter(doc => doc.cid.length > 0);
    };

    // FIXED: Hits your secure Supabase Edge Function instead of bypassing it
    const handleAccordionToggle = async (doc) => {
        const isCurrentlyOpen = activeDocName === doc.name;
        
        if (isCurrentlyOpen) {
            setActiveDocName(null);
            return;
        }

        setActiveDocName(doc.name);

        // ADDED: Synchronous Ref Cache Check. Skip if already fetched and decrypted!
        if (urlsRef.current[doc.cid]) {
            // Just in case the state missed it, sync it back up
            if (!decryptedUrls[doc.cid]) {
                setDecryptedUrls(prev => ({ ...prev, [doc.cid]: urlsRef.current[doc.cid] }));
            }
            return;
        }

        setIsDecrypting(true);
        try {
            // 1. Fetch current session token to pass to the Edge Function headers
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || supabase.supabaseKey;

            // 2. Call your Supabase Edge Function GET endpoint
            const response = await fetch(
                `${supabase.supabaseUrl}/functions/v1/ipfs-upload?cid=${doc.cid}`, 
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) throw new Error(`Edge Function responded with status: ${response.status}`);

            // 3. Collect the clean, decrypted PDF stream directly as a Blob
            const pdfBlob = await response.blob();
            
            // 4. Create local object URL for the sandboxed iframe
            const localUrl = URL.createObjectURL(pdfBlob);
            
            // ADDED: Write to persistent Ref Cache AND React UI State synchronously
            urlsRef.current[doc.cid] = localUrl;
            setDecryptedUrls(prev => ({ ...prev, [doc.cid]: localUrl }));
        } catch (error) {
            console.error("Failed to route decryption through Edge Function:", error);
            alert("Could not load and decrypt document. Check console logs.");
        } finally {
            setIsDecrypting(false);
        }
    };

    // FIXED: Clean up memory leaks from local blob URLs ONLY on component unmount
    useEffect(() => {
        return () => {
            Object.values(urlsRef.current).forEach(url => {
                if (url) URL.revokeObjectURL(url);
            });
        };
    }, []); // Empty dependency array ensures this only runs when the user leaves the page entirely

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
                    .eq('application_id', docId)
                    .maybeSingle();
                
                if (appError) throw appError;

                if (application) {
                    application.student_records = Array.isArray(application.student_records)
                        ? application.student_records[0]
                        : application.student_records;

                    const parsedList = parseCustomIpfsBundle(application.ipfs_cid);
                    setDocuments(parsedList);
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

    const handleIssueAndMint = async () => {
        const recipientId = appData?.student_records?.id;
        const ipfsCid = appData?.ipfs_cid;

        if (!recipientId || !ipfsCid) {
            return alert("Error: Missing Student Record ID or IPFS CID. Cannot mint.");
        }
        
        if (!window.confirm("Authorize Blockchain Minting to Arbitrum Sepolia?")) return;

        setIsMinting(true);
        setMintingStep('Initiating L2 Transaction...');
        
        try {
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
            setMintingStep('Success! Transaction Hash: ' + returnedHash.substring(0, 10) + '...');
            
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
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">L2 Issuance Terminal — Bundle ID: {docId.substring(0, 8)}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Left Section: Dynamic Accordion List */}
                <div className="lg:col-span-8 space-y-4">
                    {documents.length === 0 ? (
                        <div className="bg-white rounded-[3rem] border border-slate-200 p-20 text-center">
                            <AlertCircle className="text-slate-400 mx-auto mb-4" size={48} />
                            <p className="text-slate-500 font-black uppercase text-xs tracking-widest">No IPFS Assets Decoded</p>
                        </div>
                    ) : (
                        documents.map((doc) => {
                            const isOpen = activeDocName === doc.name;
                            
                            // Formats the raw link to force a download of the encrypted blob
                            const safeFileName = encodeURIComponent(doc.name.replace(/\s+/g, '_')) + '_ENCRYPTED.enc';
                            const gatewayUrl = `${IPFS_GATEWAY}${doc.cid}?filename=${safeFileName}`;

                            return (
                                <div 
                                    key={doc.name} 
                                    className={`bg-white rounded-[2.5rem] border transition-all duration-200 overflow-hidden ${
                                        isOpen ? 'border-indigo-300 shadow-xl shadow-indigo-100/40' : 'border-slate-200 shadow-sm'
                                    }`}
                                >
                                    {/* Dropdown Header Trigger */}
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

                                    {/* Live View Dropdown Iframe Content */}
                                    {isOpen && (
                                        <div className="p-4 bg-slate-100 border-t border-slate-100 relative min-h-100">
                                            {(!decryptedUrls[doc.cid] || isDecrypting) ? (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 rounded-3xl z-10">
                                                    <Loader2 className="animate-spin text-indigo-600 mb-2" size={32} />
                                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Decrypting Asset...</p>
                                                </div>
                                            ) : (
                                                <iframe
                                                    src={`${decryptedUrls[doc.cid]}#toolbar=0`}
                                                    className="w-full h-150 rounded-3xl bg-white border border-slate-200 shadow-inner"
                                                    title={`Live View - ${doc.name}`}
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Right Section: Metadata Audit & Control */}
                <div className="lg:col-span-4 bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl flex flex-col justify-between border border-slate-800 sticky top-10">
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
                                    <p className="text-[9px] text-white/30 uppercase tracking-widest mb-2 font-black">Bundle Count</p>
                                    <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest">
                                        {documents.length} Certificates
                                    </p>
                                </div>
                            </div>

                            <div>
                                <p className="text-[9px] text-white/30 uppercase tracking-widest mb-2 font-black">Raw Mapping Value</p>
                                <p className="text-[8px] font-mono text-slate-500 break-all bg-black/40 p-3 rounded-xl border border-white/5 max-h-28 overflow-y-auto">
                                    {appData.ipfs_cid}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <button 
                            onClick={handleIssueAndMint}
                            disabled={isMinting || documents.length === 0}
                            className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-4xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-900/20"
                        >
                            {isMinting ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                            {isMinting ? "Processing Transaction..." : "Authorize & Mint Bundle"}
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