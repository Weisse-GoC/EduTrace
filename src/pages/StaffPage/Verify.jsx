//src/pages/StaffPage/Verify.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { CheckCircle, XCircle, Clock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Verify() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchPending = async () => {
            setLoading(true);
            const { data } = await supabase
                .from('student_applications')
                .select('*')
                .eq('status', 'Pending')
                .order('created_at', { ascending: false });
            setRequests(data || []);
            setLoading(false);
        };
        fetchPending();
    }, []);

    const handleNavigateToDashboard = () => {
        navigate('/staff/dashboard');
    };

    return (
        <div className="max-w-6xl mx-auto space-y-10">
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">
                    Verification <span className="text-indigo-600">Queue</span>
                </h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">
                    Pending Document Requests Awaiting Staff Review
                </p>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-indigo-600" size={40} />
                </div>
            ) : requests.length === 0 ? (
                <div className="text-center py-24 bg-white rounded-[4rem] border-2 border-dashed border-slate-100">
                    <CheckCircle className="mx-auto text-slate-200 mb-6" size={60} />
                    <p className="text-slate-400 font-black uppercase text-xs tracking-[0.2em]">
                        All requests have been processed
                    </p>
                    <p className="text-slate-300 text-[10px] font-bold uppercase tracking-widest mt-2">
                        Verification queue is clear
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-600 rounded-2xl text-white">
                                <AlertCircle size={20} />
                            </div>
                            <div>
                                <p className="font-black text-indigo-900 uppercase text-sm">Action Required</p>
                                <p className="text-indigo-700 text-xs">Navigate to the dashboard to process these requests</p>
                            </div>
                        </div>
                        <button
                            onClick={handleNavigateToDashboard}
                            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-900 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
                        >
                            Go to Dashboard <ArrowRight size={14} />
                        </button>
                    </div>

                    <div className="grid gap-4">
                        {requests.map(req => (
                            <div key={req.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                                <div className="flex flex-wrap items-center justify-between gap-6">
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-600 border-2 border-amber-100">
                                            <Clock size={28} />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-slate-900 uppercase tracking-tight text-xl group-hover:text-indigo-600 transition-colors">
                                                {req.student_name}
                                            </h3>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="text-[9px] font-black uppercase px-3 py-1.5 bg-slate-100 rounded-lg text-slate-500 tracking-wider">
                                                    ID: {req.student_id}
                                                </span>
                                                <span className="text-[9px] font-black uppercase px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg tracking-wider">
                                                    {req.document_type}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="px-6 py-4 bg-amber-100 text-amber-700 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
                                            <Clock size={16} /> Pending Review
                                        </div>
                                        <button
                                            onClick={handleNavigateToDashboard}
                                            className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 transition-all flex items-center gap-2"
                                        >
                                            Process <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
