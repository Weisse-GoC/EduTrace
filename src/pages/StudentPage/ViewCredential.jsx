import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { getApplicationsByStudentId } from '../../services/supabaseClient';
import { Loader2, ArrowLeft, Clock, ShieldCheck, FileText, XCircle } from 'lucide-react';

export default function ViewCredential() {
    const navigate = useNavigate();
    const { user, authLoading } = useAuth();

    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchApplications = useCallback(async () => {
        if (!user?.id) return;
        try {
            const data = await getApplicationsByStudentId(user.id);
            setApplications(data);
        } catch (err) {
            console.error("Application Status Fetch Error:", err);
            setApplications([]);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (authLoading) return;
        fetchApplications();

        if (!user?.id) return;

        // Real-time listener — refetches when registrar updates the application status
        // Row disappears automatically when status moves outside the filtered three
        const channel = supabase
            .channel(`view_credential_status:${user.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'student_applications',
                filter: `user_id=eq.${user.id}`
            }, () => {
                fetchApplications();
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [authLoading, user?.id, fetchApplications]);

    if (loading || authLoading) return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
            <Loader2 className="animate-spin text-indigo-600" size={48} />
            <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Application Status...</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans">
            <div className="max-w-3xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/student/dashboard')} className="group flex items-center gap-2">
                        <div className="p-2 rounded-xl group-hover:bg-indigo-50 transition-colors">
                            <ArrowLeft size={20} className="text-slate-500" />
                        </div>
                        <span className="font-black uppercase text-[10px] tracking-widest text-slate-500">Back to Dashboard</span>
                    </button>
                </div>

                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">
                        Application <span className="text-indigo-600">Status</span>
                    </h1>
                    <p className="text-slate-400 font-bold text-[10px] tracking-[0.4em] uppercase">
                        Disappears once fully processed
                    </p>
                </div>

                {/* Status List */}
                {applications.length === 0 ? (
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-20 text-center">
                        <ShieldCheck className="mx-auto text-emerald-400 mb-4" size={40} />
                        <p className="text-slate-400 font-black uppercase text-xs tracking-widest">
                            All applications processed
                        </p>
                        <p className="text-slate-300 font-bold text-[10px] uppercase tracking-widest mt-1">
                            Check your vault for issued documents
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {applications.map((app, index) => {
                            const config = {
                                'Pending': {
                                    border: 'border-l-amber-400',
                                    bg: 'bg-amber-50',
                                    badge: 'bg-amber-100 text-amber-700 border-amber-200',
                                    dot: 'bg-amber-400',
                                    icon: <Clock size={18} className="text-amber-500" />,
                                    ping: false
                                },
                                'Verified': {
                                    border: 'border-l-indigo-400',
                                    bg: 'bg-indigo-50',
                                    badge: 'bg-indigo-100 text-indigo-700 border-indigo-200',
                                    dot: 'bg-indigo-500',
                                    icon: <ShieldCheck size={18} className="text-indigo-500" />,
                                    ping: true
                                },
                                'To_be_Issued': {
                                    border: 'border-l-blue-400',
                                    bg: 'bg-blue-50',
                                    badge: 'bg-blue-100 text-blue-700 border-blue-200',
                                    dot: 'bg-blue-400',
                                    icon: <FileText size={18} className="text-blue-500" />,
                                    ping: true
                                },
                                'Rejected': {
                                    border: 'border-l-red-400',
                                    bg: 'bg-red-50',
                                    badge: 'bg-red-100 text-red-700 border-red-200',
                                    dot: 'bg-red-400',
                                    icon: <XCircle size={18} className="text-red-500" />,
                                    ping: false
                                },
                            };
                            const c = config[app.status] || config['Pending'];

                            return (
                                <div
                                    key={app.application_id || `app-${index}`}
                                    className={`${c.bg} border-l-4 ${c.border} rounded-3xl p-6 shadow-sm flex items-center justify-between gap-4`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-white rounded-2xl shadow-sm">
                                            {c.icon}
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-black uppercase text-sm text-slate-800 tracking-tight">
                                                {app.document_type || 'Document Request'}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                {app.purpose || '—'} · {app.created_at ? new Date(app.created_at).toLocaleDateString() : 'N/A'}
                                                {app.status === 'Rejected' && app.rejection_reason && (
                                                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                                                        Reason: {app.rejection_reason || 'N/A'}
                                                </p>
                                                )}
                                            </p>
                                            <p>
                                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Application ID:</span> <span className="text-[10px] font-mono text-slate-500">{app.application_id}</span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border ${c.badge} shrink-0`}>
                                        <div className={`w-1.5 h-1.5 ${c.dot} rounded-full ${c.ping ? 'animate-ping' : ''}`}></div>
                                        <span className="text-[9px] font-black uppercase tracking-tighter">
                                            {app.status === 'To_be_Issued' ? 'To Be Issued' : app.status}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

            </div>
        </div>
    );
}