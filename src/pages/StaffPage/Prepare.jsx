// src/pages/StaffPage/Prepare.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { 
    FileSearch, CheckCircle2, Send, Loader2, Upload, FileCheck, AlertCircle
} from 'lucide-react';

export default function StaffPrepare() {
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submittingId, setSubmittingId] = useState(null);
    const [selectedFiles, setSelectedFiles] = useState({});
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

    const handleFileChange = (requestId, file) => {
        if (file && file.type !== "application/pdf") {
            alert("Please select a valid PDF file.");
            return;
        }
        setSelectedFiles(prev => ({ ...prev, [requestId]: file }));
    };

    const handleForwardToHead = async (requestId) => {
        const file = selectedFiles[requestId];
        // Find the specific request data from the local state
        const targetReq = queue.find(r => r.application_id === requestId);
        
        if (!file) return alert("Please upload the soft copy first.");
        if (!targetReq) return alert("Request data sync error.");

        setSubmittingId(requestId);
        setError("");

        try {
            // 1. UPLOAD TO IPFS
            const formData = new FormData();
            formData.append('file', file);

            const ipfsRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ipfs-upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
                body: formData
            });

            if (!ipfsRes.ok) throw new Error("Edge Function communication failed.");
            
            const ipfsData = await ipfsRes.json();
            if (!ipfsData.success) throw new Error(ipfsData.error || "IPFS Upload Failed");

            const timestamp = new Date().toISOString();

            // 2. UPDATE APPLICATION STATUS
            const { error: updateError } = await supabase
                .from('student_applications')
                .update({
                    status: 'Ready for Minting',
                    ipfs_cid: ipfsData.cid,
                    staff_verified_at: timestamp
                })
                .eq('application_id', requestId);

            if (updateError) throw updateError;

            // 3. LOG TO CREDENTIALS TABLE
            const { error: credError } = await supabase
                .from('credentials')
                .insert([{
                    application_id: requestId,
                    ipfs_cid: ipfsData.cid,
                    student_id: targetReq.student_records?.student_id || targetReq.student_id,
                    document_type: targetReq.document_type,
                    status: 'Pending Minting'
                }]);

            if (credError) throw credError;

            // 4. CLEANUP UI
            setQueue(prev => prev.filter(r => r.application_id !== requestId));
            setSelectedFiles(prev => {
                const updated = { ...prev };
                delete updated[requestId];
                return updated;
            });

        } catch (err) {
            console.error("Verification error:", err);
            setError(`Submission failed: ${err.message}`);
        } finally {
            setSubmittingId(null);
        }
    };

    return (
        <div className="max-w-6xl mx-auto px-6 py-10 space-y-10 animate-in fade-in duration-700">
            <div>
                <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic">
                    Staff <span className="text-indigo-600">Review</span>
                </h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">
                    Final IPFS Preparation & Protocol Dispatch
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
                <div className="grid grid-cols-1 gap-6">
                    {queue.map(req => (
                        <div key={req.application_id} className="bg-white p-8 rounded-[3rem] border border-slate-50 shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all duration-300 flex flex-wrap items-center justify-between gap-8">
                            <div className="flex items-center gap-8">
                                <div className="w-20 h-20 bg-slate-900 rounded-4xl flex items-center justify-center text-white shadow-2xl shadow-indigo-200/50">
                                    <FileSearch size={32} />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 uppercase tracking-tighter text-2xl italic">
                                        {req.student_records?.full_name || 'Anonymous Student'}
                                    </h3>
                                    <div className="flex gap-2 mt-2">
                                        <span className="text-[9px] font-black uppercase px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg tracking-widest">
                                            {req.document_type}
                                        </span>
                                        <span className="text-[9px] font-black uppercase px-3 py-1.5 bg-slate-100 text-slate-400 rounded-lg tracking-widest">
                                            ID: {req.student_records?.student_id || req.student_id}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 flex-1 lg:flex-none justify-end">
                                <label className={`flex items-center gap-3 px-6 py-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                                    selectedFiles[req.application_id] 
                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-600 shadow-lg shadow-emerald-100' 
                                    : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-indigo-400 hover:text-indigo-600'
                                }`}>
                                    <input 
                                        type="file" 
                                        className="hidden" 
                                        accept=".pdf"
                                        onChange={(e) => handleFileChange(req.application_id, e.target.files[0])} 
                                    />
                                    {selectedFiles[req.application_id] ? <FileCheck size={20} className="animate-bounce" /> : <Upload size={20} />}
                                    <span className="text-[11px] font-black uppercase tracking-tighter">
                                        {selectedFiles[req.application_id] ? selectedFiles[req.application_id].name.slice(0, 20) + '...' : 'Attach PDF Soft Copy'}
                                    </span>
                                </label>

                                <button 
                                    onClick={() => handleForwardToHead(req.application_id)}
                                    disabled={submittingId === req.application_id || !selectedFiles[req.application_id]}
                                    className="px-10 py-5 bg-slate-900 text-white rounded-3xl font-black uppercase text-[11px] tracking-[0.2em] hover:bg-indigo-600 shadow-2xl shadow-slate-200 disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none transition-all flex items-center gap-3"
                                >
                                    {submittingId === req.application_id ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <Send size={16} />
                                    )}
                                    Push to Head
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}