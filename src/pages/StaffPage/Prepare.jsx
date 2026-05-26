// src/pages/StaffPage/Prepare.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { 
    FileSearch, CheckCircle2, Send, Loader2, Upload, FileCheck, AlertCircle, FileText, Minimize2, ShieldCheck
} from 'lucide-react';

export default function StaffPrepare() {
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submittingId, setSubmittingId] = useState(null);
    const [selectedFiles, setSelectedFiles] = useState({}); // { [requestId]: { [docName]: File } }
    const [error, setError] = useState("");

    useEffect(() => { 
        fetchVerifiedQueue(); 
    }, []);

    const fetchVerifiedQueue = async () => {
        setLoading(true);
        setError("");
        try {
            const { data, error: fetchError } = await supabase
                .from('student_applications')
                .select('*, student_records(*)')
                .eq('status', 'Verified')
                .order('created_at', { ascending: true });

            if (fetchError) throw fetchError;
            setQueue(data || []);
        } catch (err) {
            console.error("Fetch error:", err);
            setError("Failed to load the verification queue.");
        } finally {
            setLoading(false);
        }
    };

    // Parses string structures like "Certification: Attendance, GWA" into arrays
    const getRequiredDocsList = (docTypeString) => {
        if (!docTypeString) return ["Document"];
        if (docTypeString.toUpperCase().includes("CERTIFICATION:")) {
            const parts = docTypeString.split(/:/i);
            if (parts[1]) {
                return parts[1].split(",").map(item => item.trim()).filter(Boolean);
            }
        }
        return [docTypeString];
    };

    const handleFileChange = (requestId, docName, file) => {
        if (file && file.type !== "application/pdf") {
            alert("Please select a valid PDF file.");
            return;
        }
        setSelectedFiles(prev => ({
            ...prev,
            [requestId]: {
                ...(prev[requestId] || {}),
                [docName]: file
            }
        }));
    };

    const handleForwardToHead = async (requestId) => {
        const targetReq = queue.find(r => r.application_id === requestId);
        if (!targetReq) return alert("Request data sync error.");

        const requiredDocs = getRequiredDocsList(targetReq.document_type);
        const uploadedForReq = selectedFiles[requestId] || {};

        const missingDocs = requiredDocs.filter(doc => !uploadedForReq[doc]);
        if (missingDocs.length > 0) {
            return alert(`Missing uploads for: ${missingDocs.join(', ')}`);
        }

        setSubmittingId(requestId);
        setError("");

        try {
            // Upload all selected PDFs concurrently to IPFS (Edge Function handles AES Encryption)
            const uploadPromises = requiredDocs.map(async (docName) => {
                const targetFile = uploadedForReq[docName];
                const formData = new FormData();
                formData.append('file', targetFile);

                const ipfsRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ipfs-upload`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
                    body: formData
                });

                if (!ipfsRes.ok) throw new Error(`IPFS upload failed on: ${docName}`);
                const ipfsData = await ipfsRes.json();
                if (!ipfsData.success) throw new Error(ipfsData.error || `IPFS error on ${docName}`);

                return { docName, cid: ipfsData.cid };
            });

            const uploadResults = await Promise.all(uploadPromises);

            let finalCidString = "";
            if (uploadResults.length === 1) {
                finalCidString = uploadResults[0].cid;
            } else {
                finalCidString = uploadResults.map(res => `${res.docName}:${res.cid}`).join(' || ');
            }

            const timestamp = new Date().toISOString();

            // Update local DB tables
            const { error: updateError } = await supabase
                .from('student_applications')
                .update({
                    status: 'Ready for Minting',
                    ipfs_cid: finalCidString,
                    staff_verified_at: timestamp
                })
                .eq('application_id', requestId);

            if (updateError) throw updateError;

            const { error: credError } = await supabase
                .from('credentials')
                .insert([{
                    application_id: requestId,
                    ipfs_cid: finalCidString,
                    student_id: targetReq.student_records?.student_id || targetReq.student_id,
                    document_type: targetReq.document_type,
                    status: 'Pending Minting'
                }]);

            if (credError) throw credError;

            setQueue(prev => prev.filter(r => r.application_id !== requestId));
            setSelectedFiles(prev => {
                const updated = { ...prev };
                delete updated[requestId];
                return updated;
            });

        } catch (err) {
            console.error("Workflow tracking exception:", err);
            setError(`Submission failed: ${err.message}`);
        } finally {
            setSubmittingId(null);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-10 space-y-10 font-sans">
            <div>
                <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic">
                    Staff <span className="text-indigo-600">Review</span>
                </h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">
                    Final Secure IPFS Preparation & Protocol Dispatch
                </p>
            </div>

            {error && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3 text-rose-600 text-xs font-bold uppercase tracking-tight">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <Loader2 className="animate-spin text-indigo-600" size={48} />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accessing Ledger...</p>
                </div>
            ) : queue.length === 0 ? (
                <div className="text-center py-32 bg-white rounded-[4rem] border-2 border-dashed border-slate-100 shadow-sm">
                    <CheckCircle2 className="mx-auto text-slate-200 mb-6" size={64} />
                    <p className="text-slate-400 font-black uppercase text-xs tracking-[0.4em]">Queue Cleared: No Pending Reviews</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {queue.map(req => {
                        const targetDocs = getRequiredDocsList(req.document_type);
                        const currentUploads = selectedFiles[req.application_id] || {};
                        const totalUploadedCount = Object.keys(currentUploads).filter(key => currentUploads[key]).length;
                        const isComplete = totalUploadedCount === targetDocs.length;

                        return (
                            <div key={req.application_id} className="bg-white border-4 border-indigo-600/30 rounded-[3rem] p-8 shadow-sm flex flex-col gap-8">
                                
                                {/* TOP BLOCK HEADER ROW */}
                                <div className="flex items-center justify-between border-b border-slate-100 pb-6 flex-wrap gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center text-white text-2xl font-black uppercase">
                                            {(req.student_records?.full_name || req.student_name || 'J')[0]}
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black tracking-tighter text-indigo-600 uppercase italic">
                                                {req.student_records?.full_name || req.student_name || 'John Doe'}
                                            </h2>
                                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                                SN: {req.student_records?.student_id || req.student_id || '123-4567-890'}
                                            </p>
                                        </div>
                                        <div className="ml-4 max-w-xl bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2">
                                            <p className="text-[9px] font-black uppercase tracking-wider text-indigo-700 wrap-break-word">
                                                {req.document_type}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button className="flex items-center gap-2 px-4 py-2 border-2 border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:bg-slate-50">
                                            <Minimize2 size={14} /> Minimize
                                        </button>
                                        <span className="px-5 py-2.5 bg-amber-400 text-white text-[10px] font-black uppercase rounded-xl tracking-wider shadow-sm">
                                            {req.status || 'PENDING'}
                                        </span>
                                    </div>
                                </div>

                                {/* TWO COLUMN GRID SYSTEM */}
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                    
                                    {/* STEP 1: INSTITUTIONAL CLEARANCE */}
                                    <div className="lg:col-span-5 space-y-4">
                                        <div className="flex items-center gap-2 text-indigo-600">
                                            <CheckCircle2 size={16} />
                                            <h4 className="text-[11px] font-black uppercase tracking-widest">Step 1: Institutional Clearance</h4>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {['Accounting Dept', 'University Library', 'Dean\'s Office', 'Registrar Review'].map(dept => (
                                                <div key={dept} className="p-4 border-2 border-emerald-500 bg-emerald-50/20 rounded-2xl flex items-center justify-between text-emerald-700">
                                                    <span className="text-[10px] font-black uppercase italic tracking-tight">{dept}</span>
                                                    <CheckCircle2 size={16} className="text-emerald-600" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* STEP 2: DYNAMIC FILE CHECKLIST UPLOAD COMPONENT */}
                                    <div className="lg:col-span-7 flex flex-col gap-4 border border-slate-100 bg-slate-50/50 p-6 rounded-[2.5rem]">
                                        <div className="flex items-center gap-2 text-indigo-600">
                                            <ShieldCheck size={16} />
                                            <h4 className="text-[11px] font-black uppercase tracking-widest">Step 2: Secure Document Upload</h4>
                                        </div>

                                        {/* Nested vertical listing viewport */}
                                        <div className="space-y-2.5 max-h-65 overflow-y-auto pr-2 custom-scrollbar">
                                            {targetDocs.map((docName) => {
                                                const fileInstance = currentUploads[docName];
                                                
                                                return (
                                                    <div 
                                                        key={docName}
                                                        className={`flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all duration-200 ${
                                                            fileInstance 
                                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm shadow-emerald-100' 
                                                            : 'border-slate-200 bg-white text-slate-700'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                                                            <div className={`p-2 rounded-xl shrink-0 ${fileInstance ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                                {fileInstance ? <FileCheck size={14} /> : <FileText size={14} />}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-[10px] font-black uppercase tracking-tight truncate" title={docName}>{docName}</p>
                                                                {fileInstance && (
                                                                    <p className="text-[9px] font-bold text-emerald-600 truncate mt-0.5">
                                                                        ✓ {fileInstance.name}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <label className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border transition-all cursor-pointer font-black text-[9px] uppercase tracking-wide shrink-0 ${
                                                            fileInstance 
                                                            ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700' 
                                                            : 'bg-slate-900 border-slate-900 text-white hover:bg-indigo-600 hover:border-indigo-600'
                                                        }`}>
                                                            <input 
                                                                type="file" 
                                                                className="hidden" 
                                                                accept=".pdf"
                                                                onChange={(e) => handleFileChange(req.application_id, docName, e.target.files[0])} 
                                                            />
                                                            <Upload size={12} />
                                                            {fileInstance ? 'Change' : 'Upload'}
                                                        </label>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Action buttons panel aligned underneath the list layout */}
                                        <div className="flex gap-3 mt-2 border-t border-slate-200/60 pt-4">
                                            <button 
                                                onClick={() => handleForwardToHead(req.application_id)}
                                                disabled={submittingId === req.application_id || !isComplete}
                                                className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] hover:bg-indigo-600 shadow-xl disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                                            >
                                                {submittingId === req.application_id ? (
                                                    <>
                                                        <Loader2 size={16} className="animate-spin" />
                                                        Encrypting & Pushing... ({totalUploadedCount}/{targetDocs.length})
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send size={14} />
                                                        Push to Head ({totalUploadedCount}/{targetDocs.length})
                                                    </>
                                                )}
                                            </button>
                                            
                                            <button className="px-6 py-4 border-2 border-slate-200 text-slate-400 rounded-2xl font-black uppercase text-[11px] tracking-wider hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors">
                                                Reject
                                            </button>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}