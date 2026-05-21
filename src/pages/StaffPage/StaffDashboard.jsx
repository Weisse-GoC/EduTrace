import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../services/supabaseClient'; 
import { logActivity } from '../../utils/logActivity';
import { useAuth } from '../../hooks/useAuth';
import { 
    Search, Loader2, AlertCircle, Users, 
    Clock, CheckCircle, LayoutGrid, 
    Filter, RefreshCw
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
    const isMounted = useRef(true);

    const stats = useMemo(() => {
        return {
            total: requests.length,
            pending: requests.filter(r => r.status === 'Pending').length,
            verified: requests.filter(r => r.status === 'Verified').length,
            issued: requests.filter(r => r.status === 'Minted' || r.status === 'Issued').length,
            rejected: requests.filter(r => r.status === 'Rejected').length
        };
    }, [requests]);

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
                        full_name,
                        student_id,
                        course,
                        email
                    )
                `)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            if (isMounted.current) setRequests(data || []);
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

            setRequests(prev => prev.map((req) =>
                req.application_id === applicationId ? { ...req, [field]: nextValue } : req
            ));
        } catch (error) {
            setActionError(error?.message || "Update failed.");
        } finally {
            setUpdatingClearance("");
        }
    };

    const handleUpdateStatus = async (applicationId, newStatus, studentName, studentId, studentAuthId, selectedFile = null) => {
        if (!profile) return;
        
        try {
            setActionError("");
            setIsProcessingAction(true); 

            const targetReq = requests.find(r => r.application_id === applicationId);
            if (!targetReq) throw new Error("Request record not found.");

            let ipfsCid = null;

            // 1. IPFS Upload logic
            if (newStatus === 'Verified' && selectedFile) {
                const formData = new FormData();
                formData.append('file', selectedFile);

                const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ipfs-upload`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
                    body: formData
                });

                const result = await response.json();
                if (!result.success) throw new Error(result.error || "IPFS Upload Failed");
                ipfsCid = result.cid;
            }

            const timestamp = new Date().toISOString();

            // 2. Update Application Status
            const { error: appError } = await supabase
                .from('student_applications')
                .update({ 
                    status: newStatus,
                    ipfs_cid: ipfsCid,
                    completed_at: timestamp 
                })
                .eq('application_id', applicationId);

            if (appError) throw appError;

            // 3. Create Credential Record (FIXED: Added application_id to prevent 23503 Conflict)
            if (newStatus === 'Verified' && ipfsCid) {
                const { error: credError } = await supabase
                    .from('credentials')
                    .insert([{
                        application_id: applicationId, // CRITICAL FIX
                        issuer_id: profile.id,
                        recipient_id: studentAuthId,
                        student_name: studentName,
                        school_id: studentId,
                        document_type: targetReq.document_type,
                        ipfs_cid: ipfsCid,
                        status: 'Verified',
                        issued_at: timestamp
                    }]);
                
                if (credError) throw credError;
            }

            // 4. Update UI State Locally
            setRequests(prev => prev.map(req => 
                req.application_id === applicationId ? { ...req, status: newStatus, ipfs_cid: ipfsCid, completed_at: timestamp } : req
            ));
            setExpandedId(null);

            await logActivity({
                userId: profile.id,
                action: `VERIFIED_DOC_UPLOADED`,
                targetStudentId: studentId,
                targetStudentName: studentName,
                details: { ipfs_cid: ipfsCid, docType: targetReq.document_type }
            });

        } catch (error) {
            console.error("FLOW FAILED:", error);
            setActionError(`System Error: ${error.message}`);
        } finally {
            setIsProcessingAction(false);
        }
    };

    const filteredRequests = requests.filter(req => {
        const searchLower = searchTerm.toLowerCase();
        const name = req.student_name?.toLowerCase() || ""; 
        const sid = req.student_id?.toLowerCase() || "";    
        const matchesSearch = name.includes(searchLower) || sid.includes(searchLower);
        const matchesStatus = statusFilter === "All" || req.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0F172A]">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                <p className="text-indigo-400 font-black uppercase tracking-[0.5em] text-[10px] mt-6">Initializing Staff Terminal</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-6 py-10 space-y-10 animate-in fade-in duration-500">
            {isProcessingAction && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center">
                    <div className="bg-white p-12 rounded-[3rem] shadow-2xl flex flex-col items-center text-center max-w-sm">
                        <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mb-6" />
                        <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-2 text-slate-900">Uploading to IPFS</h2>
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest leading-relaxed">Securing certificate on the decentralized web. Do not refresh.</p>
                    </div>
                </div>
            )}

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">Registry Node 01</span>
                        {isSyncing && <RefreshCw size={12} className="text-indigo-400 animate-spin" />}
                    </div>
                    <h1 className="text-6xl font-black text-slate-900 tracking-tighter uppercase italic">
                        Verification <span className="text-indigo-600">Queue</span>
                    </h1>
                </div>

                <div className="flex bg-white p-1.5 rounded-4xl shadow-sm border border-slate-100 overflow-x-auto">
                    {["All", "Pending", "Verified", "Approved", "Rejected"].map((tab) => (
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

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Total Workload" value={stats.total} icon={<Users size={20}/>} color="indigo" />
                <StatCard label="Awaiting Review" value={stats.pending} icon={<Clock size={20}/>} color="amber" />
                <StatCard label="Ready for Head" value={stats.verified} icon={<CheckCircle size={20}/>} color="emerald" />
                <StatCard label="Processed" value={stats.issued} icon={<LayoutGrid size={20}/>} color="slate" />
            </div>

            {(fetchError || actionError) && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-4xl px-6 py-5 flex items-start gap-4">
                    <AlertCircle className="mt-0.5 shrink-0" size={18} />
                    <div>
                        <p className="font-black uppercase tracking-[0.2em] text-[10px] mb-1">System Alert</p>
                        <p className="font-bold text-sm">{fetchError || actionError}</p>
                    </div>
                </div>
            )}

            <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={22} />
                <input 
                    type="text" 
                    placeholder="Filter by Student ID or Name..." 
                    className="w-full pl-16 pr-8 py-6 rounded-[2.5rem] bg-white border border-slate-100 shadow-sm focus:ring-8 focus:ring-indigo-500/5 outline-none font-bold text-slate-700 transition-all placeholder:text-slate-300"
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                />
            </div>

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
                            onToggleExpand={() => setExpandedId(expandedId === req.application_id ? null : req.application_id)}
                            onUpdateStatus={handleUpdateStatus}
                            onToggleClearance={handleToggleClearance}
                            updatingClearance={updatingClearance}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, color }) {
    const colors = {
        indigo: "bg-indigo-600 shadow-indigo-100",
        amber: "bg-amber-500 shadow-amber-100",
        emerald: "bg-emerald-500 shadow-emerald-100",
        slate: "bg-slate-900 shadow-slate-100"
    };
    
    return (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-50 shadow-sm hover:shadow-md transition-shadow">
            <div className={`${colors[color]} w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg`}>
                {icon}
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</p>
            <p className="text-4xl font-black text-slate-900 mt-1">{value}</p>
        </div>
    );
}