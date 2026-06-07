import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { 
    XCircle, Clock, AlertCircle, Loader2, 
    RotateCcw, ChevronDown, ChevronUp, Flame, 
    MessageSquare, CheckCircle
} from 'lucide-react';

export default function Verify() {
    const [rejectedRequests, setRejectedRequests] = useState([]);
    const [overdueRequests, setOverdueRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overdue');
    const [expandedId, setExpandedId] = useState(null);
    const [reopenReason, setReopenReason] = useState({});
    const [isProcessing, setIsProcessing] = useState(null);

    const getDaysOld = (createdAt) => {
        const diff = new Date() - new Date(createdAt);
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    };

    const getOverdueSeverity = (days) => {
        if (days >= 5) return { 
            label: 'Critical', 
            class: 'bg-rose-100 text-rose-600 border-rose-200', 
            dot: 'bg-rose-500',
            border: 'border-l-rose-500'
        };
        if (days >= 3) return { 
            label: 'Overdue', 
            class: 'bg-amber-100 text-amber-600 border-amber-200', 
            dot: 'bg-amber-500',
            border: 'border-l-amber-500'
        };
        return { 
            label: 'Pending', 
            class: 'bg-slate-100 text-slate-500 border-slate-200', 
            dot: 'bg-slate-400',
            border: 'border-l-slate-300'
        };
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [{ data: rejected }, { data: pending }] = await Promise.all([
                supabase
                    .from('student_applications')
                    .select('*')
                    .eq('status', 'Rejected')
                    .order('completed_at', { ascending: false }),
                supabase
                    .from('student_applications')
                    .select('*')
                    .eq('status', 'Pending')
                    .order('created_at', { ascending: true })
            ]);

            setRejectedRequests(rejected || []);
            // Only show requests older than 2 days in overdue
            setOverdueRequests(
                (pending || []).filter(r => getDaysOld(r.created_at) >= 2)
            );
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleReopen = async (applicationId) => {
        const reason = reopenReason[applicationId]?.trim();
        if (!reason) return alert('Please enter a reopen reason before submitting.');

        setIsProcessing(applicationId);
        try {
            const { error } = await supabase
                .from('student_applications')
                .update({ 
                    status: 'Pending',
                    rejection_reason: `[REOPENED] ${reason}`,
                    reopened_at: new Date().toISOString()
                })
                .eq('application_id', applicationId);

            if (error) throw error;

            setRejectedRequests(prev => prev.filter(r => r.application_id !== applicationId));
            setExpandedId(null);
        } catch (err) {
            console.error('Reopen failed:', err);
            alert('Failed to reopen request.');
        } finally {
            setIsProcessing(null);
        }
    };

    const tabs = [
        { id: 'overdue', label: 'Overdue Queue', count: overdueRequests.length, icon: <Flame size={14}/> },
        { id: 'rejected', label: 'Rejected Manager', count: rejectedRequests.length, icon: <XCircle size={14}/> },
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-10">

            {/* Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">
                    Request <span className="text-indigo-600">Monitor</span>
                </h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">
                    Overdue Queue · Rejected Request Manager
                </p>
            </div>

            {/* Tabs */}
            <div className="flex bg-white p-1.5 rounded-4xl shadow-sm border border-slate-100 w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-8 py-3 rounded-2xl text-[10px] font-black uppercase transition-all tracking-widest ${
                            activeTab === tab.id
                                ? 'bg-slate-900 text-white shadow-xl shadow-slate-200'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                        <span className={`ml-1 px-2 py-0.5 rounded-full text-[9px] font-black ${
                            activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-indigo-600" size={40} />
                </div>
            ) : (
                <>
                    {/* ── OVERDUE QUEUE ── */}
                    {activeTab === 'overdue' && (
                        <div className="space-y-4">
                            {overdueRequests.length === 0 ? (
                                <div className="text-center py-24 bg-white rounded-[4rem] border-2 border-dashed border-slate-100">
                                    <CheckCircle className="mx-auto text-slate-200 mb-6" size={60} />
                                    <p className="text-slate-400 font-black uppercase text-xs tracking-[0.2em]">
                                        No overdue requests
                                    </p>
                                </div>
                            ) : (
                                overdueRequests.map(req => {
                                    const days = getDaysOld(req.created_at);
                                    const severity = getOverdueSeverity(days);
                                    return (
                                        <div 
                                            key={req.application_id} 
                                            className={`bg-white p-8 rounded-[2.5rem] border border-slate-100 border-l-4 ${severity.border} shadow-sm hover:shadow-xl transition-all`}
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-6">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-14 h-14 bg-slate-50 rounded-3xl flex items-center justify-center">
                                                        <Clock size={24} className="text-slate-400" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-slate-900 uppercase tracking-tight text-lg">
                                                            {req.student_name}
                                                        </h3>
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            <span className="text-[9px] font-black uppercase px-2 py-1 bg-slate-100 rounded-lg text-slate-500">
                                                                {req.student_id}
                                                            </span>
                                                            <span className="text-[9px] font-black uppercase px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg">
                                                                {req.document_type}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-[10px] font-black uppercase ${severity.class}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${severity.dot} animate-pulse`} />
                                                        {severity.label} · {days}d
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* ── REJECTED MANAGER ── */}
                    {activeTab === 'rejected' && (
                        <div className="space-y-4">
                            {rejectedRequests.length === 0 ? (
                                <div className="text-center py-24 bg-white rounded-[4rem] border-2 border-dashed border-slate-100">
                                    <CheckCircle className="mx-auto text-slate-200 mb-6" size={60} />
                                    <p className="text-slate-400 font-black uppercase text-xs tracking-[0.2em]">
                                        No rejected requests
                                    </p>
                                </div>
                            ) : (
                                rejectedRequests.map(req => {
                                    const isExpanded = expandedId === req.application_id;
                                    return (
                                        <div 
                                            key={req.application_id}
                                            className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden transition-all"
                                        >
                                            {/* Card Header */}
                                            <div className="p-8 flex flex-wrap items-center justify-between gap-6">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-14 h-14 bg-rose-50 rounded-3xl flex items-center justify-center">
                                                        <XCircle size={24} className="text-rose-400" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-slate-900 uppercase tracking-tight text-lg">
                                                            {req.student_name}
                                                        </h3>
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            <span className="text-[9px] font-black uppercase px-2 py-1 bg-slate-100 rounded-lg text-slate-500">
                                                                {req.student_id}
                                                            </span>
                                                            <span className="text-[9px] font-black uppercase px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg">
                                                                {req.document_type}
                                                            </span>
                                                        </div>
                                                        {req.rejection_reason && (
                                                            <p className="text-[10px] text-rose-400 font-bold mt-2 flex items-center gap-1.5">
                                                                <AlertCircle size={10} />
                                                                {req.rejection_reason}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => setExpandedId(isExpanded ? null : req.application_id)}
                                                    className="flex items-center gap-2 px-6 py-3 bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all border border-slate-100"
                                                >
                                                    <RotateCcw size={13} />
                                                    Reopen
                                                    {isExpanded ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                                                </button>
                                            </div>

                                            {/* Reopen Panel */}
                                            {isExpanded && (
                                                <div className="px-8 pb-8 pt-0 border-t border-slate-50 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pt-6 flex items-center gap-2">
                                                        <MessageSquare size={12} />
                                                        Reason for reopening
                                                    </p>
                                                    <textarea
                                                        rows={3}
                                                        placeholder="e.g. Student submitted missing requirements, reconsider request..."
                                                        value={reopenReason[req.application_id] || ''}
                                                        onChange={(e) => setReopenReason(prev => ({
                                                            ...prev,
                                                            [req.application_id]: e.target.value
                                                        }))}
                                                        className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 resize-none transition-all"
                                                    />
                                                    <div className="flex justify-end gap-3">
                                                        <button
                                                            onClick={() => setExpandedId(null)}
                                                            className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={() => handleReopen(req.application_id)}
                                                            disabled={isProcessing === req.application_id}
                                                            className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-slate-900 disabled:bg-slate-200 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-indigo-100"
                                                        >
                                                            {isProcessing === req.application_id 
                                                                ? <><Loader2 size={13} className="animate-spin"/> Processing...</>
                                                                : <><RotateCcw size={13}/> Confirm Reopen</>
                                                            }
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}