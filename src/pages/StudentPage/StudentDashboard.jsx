import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, getCredentialsByRecipientId, getApplicationsByStudentId } from '../../services/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus';
import { 
    Loader2, 
    Clock, 
    QrCode, 
    X,
    ShieldCheck,
    FileSearch,
    Search,
    Eye,
    FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom'; 
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI, getReadOnlyProvider } from '../../blockchain/config';

export default function StudentDashboard() {
    const { user } = useAuth();
    const [credentials, setCredentials] = useState([]);
    const [pendingCount, setPendingCount] = useState(0); // ◄ just the count, not the full list
    const [loading, setLoading] = useState(true);
    const [showToast, setShowToast] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const navigate = useNavigate();
    const isMounted = useRef(true);

    // Verifies a credential hash against the smart contract
    const checkBlockchainStatus = useCallback(async (fileHash) => {
        if (!fileHash || fileHash === "PENDING" || !fileHash.startsWith("0x") || fileHash.length < 66) {
            return { isVerified: false };
        }
        try {
            const provider = getReadOnlyProvider();
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
            const cleanHash = ethers.zeroPadValue(ethers.getBytes(fileHash), 32);
            const isVerified = await contract.verifyDocument(cleanHash);
            return { isVerified };
        } catch (err) {
            console.error("Blockchain check failed for hash:", fileHash, err);
            return { isVerified: false };
        }
    }, []);

    // Enriches raw credential rows with on-chain verification status
    const processCredentials = useCallback(async (rawDocs) => {
        const enriched = rawDocs.map((d) => ({ ...d, isValidating: true }));
        if (isMounted.current) setCredentials(enriched);

        const verifiedDocs = await Promise.all(enriched.map(async (doc) => {
            const chain = await checkBlockchainStatus(doc.blockchain_hash);
            return { 
                ...doc, 
                onChainStatus: chain.isVerified,
                isValidating: false 
            };
        }));

        if (isMounted.current) setCredentials(verifiedDocs);
    }, [checkBlockchainStatus]);

    // Only fetches the count for the stat card — full list lives in ViewCredential
    const fetchPendingCount = useCallback(async () => {
        if (!user?.id) return;
        try {
            const data = await getApplicationsByStudentId(user.id);
            if (isMounted.current) setPendingCount(data.length);
        } catch (error) {
            console.error("Pending Count Fetch Error:", error);
        }
    }, [user]);

    // Guards against fetching before the auth session is ready
    const fetchCredentials = useCallback(async (silent = false) => {
        if (!user?.id) {
            console.warn("Fetch blocked: User session context is not initialized yet.");
            return; 
        }
        if (!silent && isMounted.current) setLoading(true);
        try {
            const data = await getCredentialsByRecipientId(user.id);
            if (data && isMounted.current) await processCredentials(data);
        } catch (error) {
            console.error("Credential Fetch Abstraction Error:", error);
            if (isMounted.current) setCredentials([]);
        } finally {
            if (!silent && isMounted.current) setLoading(false);
        }
    }, [processCredentials, user]);

    // Runs silently on tab refocus so data stays fresh without a full reload
    const handleSilentRefresh = useCallback(() => {
        fetchCredentials(true);
        fetchPendingCount();
    }, [fetchCredentials, fetchPendingCount]);

    useRefreshOnFocus(handleSilentRefresh);

    useEffect(() => {
        isMounted.current = true;
        
        if (user?.id) {
            fetchCredentials();
            fetchPendingCount();

            // Listens for new issued credentials
            const credChannel = supabase
                .channel(`student_updates:${user.id}`)
                .on('postgres_changes', { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'credentials',
                    filter: `recipient_id=eq.${user.id}`
                }, (payload) => {
                    setShowToast(`New Document Issued: ${payload.new.document_type || 'Academic Record'}`);
                    fetchCredentials(true);
                })
                .subscribe();

            // Listens for application status changes — updates the count badge only
            const appChannel = supabase
                .channel(`application_updates:${user.id}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'student_applications',
                    filter: `user_id=eq.${user.id}`
                }, (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setShowToast(`Application Submitted: ${payload.new.document_type || 'Document Request'}`);
                    }
                    if (payload.eventType === 'UPDATE') {
                        setShowToast(`Status Updated: ${payload.new.document_type} → ${payload.new.status}`);
                    }
                    fetchPendingCount();
                })
                .subscribe();

            return () => {
                isMounted.current = false;
                supabase.removeChannel(credChannel);
                supabase.removeChannel(appChannel);
            };
        } else {
            if (isMounted.current) setLoading(true);
        }
    }, [fetchCredentials, fetchPendingCount, user?.id]);

    const filteredCreds = credentials.filter(c => 
        (c.document_type || "Unknown Document").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans">

            {/* Toast notification */}
            {showToast && (
                <div className="fixed top-24 right-6 z-50 animate-in slide-in-from-right-10">
                    <div className="bg-indigo-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4">
                        <ShieldCheck size={20} />
                        <span className="font-bold text-sm uppercase tracking-tight">{showToast}</span>
                        <button onClick={() => setShowToast(null)}><X size={16}/></button>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto px-4 pt-12 space-y-10">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-1">
                        <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">
                            Student <span className="text-indigo-600">Vault</span>
                        </h1>
                        <p className="text-slate-400 font-bold text-[10px] tracking-[0.4em] uppercase">Immutable Academic Ledger</p>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        {/* Navigates to the dedicated application status page */}
                        <button
                            onClick={() => navigate('/student/view-credential')}
                            className="relative flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-800 rounded-2xl hover:border-indigo-600 transition-all shadow-sm font-black uppercase text-[10px] tracking-widest shrink-0"
                        >
                            <Clock size={16} className="text-amber-500" />
                            My Applications
                            {/* Live count badge — disappears when no pending apps */}
                            {pendingCount > 0 && (
                                <span className="absolute -top-2 -right-2 bg-amber-400 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow">
                                    {pendingCount}
                                </span>
                            )}
                        </button>

                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="text"
                                placeholder="SEARCH ARCHIVES..."
                                value={searchTerm}
                                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold tracking-widest focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard label="Verified Assets" val={credentials.filter(c => c.onChainStatus).length} icon={ShieldCheck} color="text-emerald-600" bg="bg-emerald-50" />
                    <StatCard label="Pending Sync" val={credentials.filter(c => c.isValidating).length} icon={Clock} color="text-amber-600" bg="bg-amber-50" />
                    <StatCard label="Total Records" val={credentials.length} icon={FileSearch} color="text-indigo-600" bg="bg-indigo-50" />
                </div>

                {/* Credentials Table */}
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Document</th>
                                    <th className="px-8 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Issued</th>
                                    <th className="px-8 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Trust Status</th>
                                    <th className="px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr><td colSpan="4" className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-600" size={32} /></td></tr>
                                ) : filteredCreds.length === 0 ? (
                                    <tr><td colSpan="4" className="py-20 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">No Documents Found</td></tr>
                                ) : (
                                    filteredCreds.map((item, index) => {
                                        const stableKey = item.application_id ? String(item.application_id) : `row-index-${index}`;
                                        return (
                                            <tr key={stableKey} className="group hover:bg-slate-50/80 transition-all">
                                                <td className="px-8 py-6">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-black uppercase text-sm text-slate-800 group-hover:text-indigo-600 transition-colors">
                                                            {item.document_type || 'Academic Document'}
                                                        </span>
                                                        <span className="text-[10px] font-mono text-slate-300 truncate max-w-50">
                                                            {item.blockchain_hash || 'HASH_PENDING'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-center">
                                                    <span className="text-xs font-bold text-slate-500 uppercase italic">
                                                        {item.issued_at ? new Date(item.issued_at).toLocaleDateString() : 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6 text-center">
                                                    <StatusBadge item={item} />
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex justify-end gap-3">
                                                        <button
                                                            onClick={() => navigate(`/student/qr-generate/${item.application_id}`)}
                                                            className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-600 rounded-xl transition-all"
                                                            title="Generate QR"
                                                        >
                                                            <QrCode size={18} />
                                                        </button>
                                                        <button 
                                                            onClick={() => navigate(`/verify/${item.application_id || index}`)}
                                                            className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-600 rounded-xl transition-all" 
                                                            title="View Details"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}

// ===========================================
// SUB-COMPONENTS
// ===========================================

const StatCard = ({ label, val, icon: Icon, color, bg }) => (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
        <div className="flex items-center gap-5">
            <div className={`${bg} ${color} p-4 rounded-2xl group-hover:scale-110 transition-transform`}>
                <Icon size={24} />
            </div>
            <div>
                <h4 className="text-3xl font-black text-slate-800 tracking-tight">{val}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
            </div>
        </div>
    </div>
);

// Shows blockchain verification state for issued credentials
const StatusBadge = ({ item }) => {
    if (item.isValidating) return (
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-100 rounded-full animate-pulse">
            <Clock size={12} className="text-slate-400" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Syncing...</span>
        </div>
    );
    if (item.onChainStatus) return (
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div>
            <span className="text-[9px] font-black uppercase tracking-tighter">Verified On-Chain</span>
        </div>
    );
    return (
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
            <span className="text-[9px] font-black uppercase tracking-tighter">Not Found On-Chain</span>
        </div>
    );
};