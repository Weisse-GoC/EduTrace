import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../services/supabaseClient'; 
import { useAuth } from '../../hooks/useAuth';
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus';
import { 
    Search, Loader2, AlertCircle, Users, 
    Clock, CheckCircle, LayoutGrid, 
    Filter, RefreshCw, XCircle, FileText 
} from 'lucide-react';
import StaffRequestCard from './StaffRequestCard'; 

export default function StaffDashboard() {
    const { profile } = useAuth();
    const [requests, setRequests] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("All"); 
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [fetchError, setFetchError] = useState("");
    const [actionError, setActionError] = useState("");
    const [updatingClearance, setUpdatingClearance] = useState("");
    const [isProcessingAction, setIsProcessingAction] = useState(false);
    // Dynamic overlay label for IPFS upload vs minting
    const [processingOverlay, setProcessingOverlay] = useState({
        title: 'Processing',
        subtitle: 'Please wait. Do not refresh.'
    });
    const isMounted = useRef(true);

    const stats = useMemo(() => ({
        total: requests.length,
        pending: requests.filter(r => r.status === 'Pending').length,
        verified: requests.filter(r => r.status === 'Verified').length,
        issued: requests.filter(r => ['Minted', 'Issued', 'L1_Issued'].includes(r.status)).length,
        rejected: requests.filter(r => r.status === 'Rejected').length,
        to_be_issued: requests.filter(r => r.status === 'To_be_Issued').length  
    }), [requests]);

    const fetchRequests = useCallback(async (silent = false) => {
        if (!isMounted.current) return;
        if (!silent) setLoading(true);
        if (silent) setIsSyncing(true);

        try {
            if (isMounted.current) setFetchError("");

            const { data, error } = await supabase
                .from('student_applications')
                .select(`
                    *,
                    student_records!user_id (
                        id,
                        full_name,
                        student_id,
                        course,
                        email
                    )
                `)
                .order('created_at', { ascending: false });
            
            if (error) throw error;

            // Normalize the joined relation to always be an object, not an array
            const normalized = (data || []).map(app => ({
                ...app,
                student_records: Array.isArray(app.student_records)
                    ? app.student_records[0]
                    : app.student_records
            }));

            if (isMounted.current) setRequests(normalized);
        } catch (error) {
            console.error("[StaffOps] Fetch Failure:", error);
            if (isMounted.current) {
                setRequests([]);
                setFetchError(error?.message || "Unable to load verification queue.");
            }
        } finally {
            if (isMounted.current) {
                setLoading(false);
                setIsSyncing(false);
            }
        }
    }, []);

    const handleSilentRefresh = useCallback(() => {
        fetchRequests(true);
    }, [fetchRequests]);

    useRefreshOnFocus(handleSilentRefresh);

    useEffect(() => {
        isMounted.current = true;
        fetchRequests();

        const channel = supabase
            .channel('staff_ledger_sync')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'student_applications' 
            }, () => fetchRequests(true))
            .subscribe();

        return () => {
            isMounted.current = false;
            supabase.removeChannel(channel);
        };
    }, [fetchRequests]);

    const handleToggleClearance = async (applicationId, field, currentValue) => {
        const actionKey = `${applicationId}:${field}`;
        const nextValue = !currentValue;

        try {
            setActionError("");
            setUpdatingClearance(actionKey);

            const { error } = await supabase
                .from('student_applications')
                .update({ [field]: nextValue })
                .eq('application_id', applicationId);

            if (error) throw error;

            setRequests(prev => prev.map(req =>
                req.application_id === applicationId ? { ...req, [field]: nextValue } : req
            ));
        } catch (error) {
            setActionError(error?.message || "Clearance update failed.");
        } finally {
            setUpdatingClearance("");
        }
    };

    // Parses "CERTIFICATION: DocA, DocB" format into an array of doc names
    const getRequiredDocsList = (docTypeString) => {
        if (!docTypeString) return ["Document"];
        if (docTypeString.toUpperCase().includes("CERTIFICATION:")) {
            const parts = docTypeString.split(/:/i);
            if (parts[1]) return parts[1].split(",").map(item => item.trim()).filter(Boolean);
        }
        return [docTypeString];
    };

    // ─────────────────────────────────────────────────────────────────────────
    // STATUS UPDATE — handles both issuance routes.
    // Both routes upload to IPFS first; they differ only in the resulting status:
    //   Verified     = staff uploads + forwards to head for minting in Prepare.jsx
    //   To_be_Issued = staff uploads + will mint themselves via Issue to Student
    // ─────────────────────────────────────────────────────────────────────────
    const handleUpdateStatus = async (applicationId, newStatus, studentName, studentId, studentAuthId, filesMap = {}) => {
        if (!profile) return;

        // Guard against explicit null being passed from the card
        const safeFilesMap = filesMap || {};

        try {
            setActionError("");
            setIsProcessingAction(true);

            const targetReq = requests.find(r => r.application_id === applicationId);
            if (!targetReq) throw new Error("Request record not found.");

            let ipfsCid = null;

            // ── IPFS UPLOAD: fires for both routes when files are attached ───
            // Verified   = staff uploads + pushes to head for minting
            // To_be_Issued = staff uploads + will mint themselves via Issue to Student
            if ((newStatus === 'Verified' || newStatus === 'To_be_Issued') && Object.keys(safeFilesMap).length > 0) {
                setProcessingOverlay({
                    title: 'Uploading to IPFS',
                    subtitle: 'Securing certificates on the decentralized web. Do not refresh.'
                });

                const requiredDocs = getRequiredDocsList(targetReq.document_type);

                const uploadPromises = requiredDocs.map(async (docName) => {
                    const targetFile = safeFilesMap[docName];
                    if (!targetFile) throw new Error(`Missing attachment for: ${docName}`);

                    const formData = new FormData();
                    formData.append('file', targetFile);

                    const response = await fetch(
                        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ipfs-upload`,
                        {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
                            body: formData
                        }
                    );

                    const result = await response.json();
                    if (!result.success) throw new Error(result.error || `IPFS failure on ${docName}`);
                    return { docName, cid: result.cid };
                });

                const uploadResults = await Promise.all(uploadPromises);

                ipfsCid = uploadResults.length === 1
                    ? uploadResults[0].cid
                    : uploadResults.map(r => `${r.docName}:${r.cid}`).join(' || ');
            }

            const timestamp = new Date().toISOString();

            // ── DB UPDATE: build payload conditionally ───────────────────────
            // - Verified + CID:     status + ipfs_cid + completed_at
            // - To_be_Issued + CID: status + ipfs_cid + completed_at
            // - Rejected:           status + completed_at
            const updatePayload = { status: newStatus };
            if (ipfsCid) {
                updatePayload.ipfs_cid = ipfsCid;
                updatePayload.completed_at = timestamp;
            } else if (newStatus === 'Rejected') {
                updatePayload.completed_at = timestamp;
                updatePayload.rejection_reason = safeFilesMap?.rejectionReason || null;
            }

            const { error: appError } = await supabase
                .from('student_applications')
                .update(updatePayload)
                .eq('application_id', applicationId);

            if (appError) throw appError;

            // ── CREDENTIAL LOG: insert whenever IPFS CID is secured ─────────
            if ((newStatus === 'Verified' || newStatus === 'To_be_Issued') && ipfsCid) {
                const { error: credError } = await supabase
                    .from('credentials')
                    .insert([{
                        application_id: applicationId,
                        issuer_id: profile.id,
                        recipient_id: studentAuthId,
                        student_name: studentName,
                        school_id: studentId,
                        document_type: targetReq.document_type,
                        ipfs_cid: ipfsCid,
                        status: 'Staged',
                        issued_at: timestamp
                    }]);

                if (credError) throw credError;
            }

            // Optimistic local state update
            setRequests(prev => prev.map(req =>
                req.application_id === applicationId
                    ? { ...req, ...updatePayload }
                    : req
            ));
            setExpandedId(null);

        } catch (error) {
            console.error("FLOW FAILED:", error);
            setActionError(`System Error: ${error.message}`);
        } finally {
            setIsProcessingAction(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // MINT REQUEST — invoked by "Issue to Student" button on To_be_Issued cards.
    // Calls the mint-credential edge function then updates status to L1_Issued.
    // ─────────────────────────────────────────────────────────────────────────
    const handleMintRequest = async (applicationId) => {
        if (!profile) return;

        try {
            setActionError("");
            setIsProcessingAction(true);
            setProcessingOverlay({
                title: 'Processing Transaction',
                subtitle: 'Authorizing mint on Arbitrum Sepolia. Do not refresh.'
            });

            const targetReq = requests.find(r => r.application_id === applicationId);
            if (!targetReq) throw new Error("Request record not found.");

            const ipfsCid = targetReq.ipfs_cid;
            if (!ipfsCid) throw new Error("No IPFS CID found. Run 'Push for Issuance' first.");

            const recipientId = targetReq.student_records?.id || targetReq.user_id;

            const { data, error } = await supabase.functions.invoke('mint-credential', {
                body: {
                    applicationId,
                    recipientUuid: recipientId,
                    cid: ipfsCid
                }
            });

            if (error) {
                const msg = error.context?.message || error.message || "Unknown minting error";
                throw new Error(msg);
            }

            // Only write to DB after on-chain confirmation
            const { error: dbError } = await supabase
                .from('student_applications')
                .update({ status: 'L1_Issued' })
                .eq('application_id', applicationId);

            if (dbError) throw dbError;

            // Mark credential log as fully issued
            await supabase
                .from('credentials')
                .update({ status: 'Issued' })
                .eq('application_id', applicationId);

            setRequests(prev => prev.map(req =>
                req.application_id === applicationId
                    ? { ...req, status: 'L1_Issued' }
                    : req
            ));
            setExpandedId(null);

        } catch (error) {
            console.error("MINTING FAILED:", error);
            setActionError(`Minting Error: ${error.message}`);
        } finally {
            setIsProcessingAction(false);
        }
    };

    const filteredRequests = requests.filter(req => {
        const searchLower = searchTerm.toLowerCase();
        // Search in nested student_records (normalized) as well as flat fields
        const name = (req.student_records?.full_name || req.student_name || "").toLowerCase();
        const sid = (req.student_records?.student_id || req.student_id || "").toLowerCase();
        const matchesSearch = name.includes(searchLower) || sid.includes(searchLower);
        const matchesStatus = statusFilter === "All"  || (statusFilter === "Processed" 
        ? ['Minted', 'Issued', 'L1_Issued'].includes(req.status) 
        : req.status === statusFilter);
        return matchesSearch && matchesStatus;
    });

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0F172A]">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                <p className="text-indigo-400 font-black uppercase tracking-[0.5em] text-[10px] mt-6">
                    Initializing Staff Terminal
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-6 py-10 space-y-10 animate-in fade-in duration-500">

            {/* ── Full-screen processing overlay ───────────────────────────── */}
            {isProcessingAction && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center">
                    <div className="bg-white p-12 rounded-[3rem] shadow-2xl flex flex-col items-center text-center max-w-sm">
                        <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mb-6" />
                        <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-2 text-slate-900">
                            {processingOverlay.title}
                        </h2>
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest leading-relaxed">
                            {processingOverlay.subtitle}
                        </p>
                    </div>
                </div>
            )}

            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                            Registry Node 01
                        </span>
                        {isSyncing && <RefreshCw size={12} className="text-indigo-400 animate-spin" />}
                    </div>
                    <h1 className="text-6xl font-black text-slate-900 tracking-tighter uppercase italic">
                        Verification <span className="text-indigo-600">Queue</span>
                    </h1>
                </div>

                <div className="flex bg-white p-1.5 rounded-4xl shadow-sm border border-slate-100 overflow-x-auto">
                    {["All", "Pending", "Verified", "To_be_Issued", "Rejected", "Processed"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setStatusFilter(tab)}
                            className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase transition-all tracking-widest whitespace-nowrap ${
                                statusFilter === tab
                                    ? "bg-slate-900 text-white shadow-xl shadow-slate-200"
                                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Stat cards ───────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-2">
            {[
                { label: "Total workload",  value: stats.total,         color: "#7F77DD", delay: "0s" },
                { label: "Awaiting review", value: stats.pending,       color: "#EF9F27", delay: "0.3s" },
                { label: "Ready for head",  value: stats.verified,      color: "#1D9E75", delay: "0.6s" },
                { label: "To be issued",    value: stats.to_be_issued,  color: "#378ADD", delay: "0.9s" },
                { label: "Processed",       value: stats.issued,        color: "#2C2C2A", delay: "1.2s" },
                { label: "Rejected",        value: stats.rejected,      color: "#E24B4A", delay: "1.5s" },
            ].map(({ label, value, color, delay }) => (
                <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-100 bg-white text-sm font-bold whitespace-nowrap">
                <span
                    className="w-2 h-2 rounded-full shrink-0 animate-pulse"
                    style={{ backgroundColor: color, animationDelay: delay }}
                />
                <span className="text-slate-700 text-xs uppercase tracking-wide">{label}</span>
                <span className="text-slate-400 text-xs">{value}</span>
                </div>
            ))}
            </div>

            {/* ── Error banner ─────────────────────────────────────────────── */}
            {(fetchError || actionError) && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-4xl px-6 py-5 flex items-start gap-4">
                    <AlertCircle className="mt-0.5 shrink-0" size={18} />
                    <div>
                        <p className="font-black uppercase tracking-[0.2em] text-[10px] mb-1">System Alert</p>
                        <p className="font-bold text-sm">{fetchError || actionError}</p>
                    </div>
                </div>
            )}

            {/* ── Search ───────────────────────────────────────────────────── */}
            <div className="relative group">
                <Search
                    className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors"
                    size={22}
                />
                <input
                    type="text"
                    placeholder="Filter by Student ID or Name..."
                    className="w-full pl-16 pr-8 py-6 rounded-[2.5rem] bg-white border border-slate-100 shadow-sm focus:ring-8 focus:ring-indigo-500/5 outline-none font-bold text-slate-700 transition-all placeholder:text-slate-300"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* ── Request list ─────────────────────────────────────────────── */}
            <div className="space-y-4 pb-20">
                {filteredRequests.length === 0 ? (
                    <div className="py-32 bg-white rounded-[4rem] border-2 border-dashed border-slate-100 flex flex-col items-center">
                        <Filter className="text-slate-100 mb-4" size={64} />
                        <p className="text-slate-400 font-black uppercase text-xs tracking-[0.3em]">No records found</p>
                    </div>
                ) : (
                    filteredRequests.map(req => (
                        <StaffRequestCard
                            key={req.application_id}
                            req={req}
                            isExpanded={expandedId === req.application_id}
                            onToggleExpand={() => setExpandedId(
                                expandedId === req.application_id ? null : req.application_id
                            )}
                            onUpdateStatus={handleUpdateStatus}
                            onToggleClearance={handleToggleClearance}
                            onMintAsset={handleMintRequest}   // ← minting hook wired in
                            updatingClearance={updatingClearance}
                        />
                    ))
                )}
            </div>
        </div>
    );
}