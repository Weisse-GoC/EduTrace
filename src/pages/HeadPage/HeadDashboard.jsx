import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { fetchHeadDashboardData } from '../../services/headDashboardService';
// 1. ADD useAuth to imports
import { useAuth } from '../../hooks/useAuth'; 
import {
    Loader2, UserCheck, Award,
    AlertCircle, LayoutDashboard,
    Activity, Fingerprint, Database, Zap,
    LogOut // 2. Add LogOut icon
} from 'lucide-react';

export default function HeadDashboard() {
    const navigate = useNavigate();
    // 3. GRAB logout from useAuth
    const { logout } = useAuth(); 
    const [pendingApplications, setPendingApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isLive, setIsLive] = useState(false);
    const [stats, setStats] = useState({ pending: 0, issued: 0, processing: 0, failed: 0 });
    const isMounted = useRef(true);

    // ... (fetchDashboardData and useEffect logic remain the same) ...

    const fetchDashboardData = useCallback(async (silent = false) => {
        if (!silent && isMounted.current) {
            setLoading(true);
        }

        try {
            const { pendingApplications, stats } = await fetchHeadDashboardData();

            if (isMounted.current) {
                setPendingApplications(pendingApplications);
                setStats(stats);
            }
        } catch (err) {
            console.error("Dashboard Fetch Error:", err);
        } finally {
            if (!silent && isMounted.current) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        isMounted.current = true;
        fetchDashboardData();

        const handleVisibilityRefresh = () => {
            if (document.visibilityState === 'visible') {
                fetchDashboardData(true);
            }
        };

        const handleWindowFocus = () => {
            fetchDashboardData(true);
        };

        const channel = supabase
            .channel('head_issuance_sync')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'student_applications' 
            }, () => {
                fetchDashboardData(true);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED' && isMounted.current) setIsLive(true);
                if (status === 'CHANNEL_ERROR' && isMounted.current) setIsLive(false);
                if (status === 'TIMED_OUT' && isMounted.current) setIsLive(false);
                if (status === 'CLOSED' && isMounted.current) setIsLive(false);
            });

        document.addEventListener('visibilitychange', handleVisibilityRefresh);
        window.addEventListener('focus', handleWindowFocus);

        return () => {
            isMounted.current = false;
            document.removeEventListener('visibilitychange', handleVisibilityRefresh);
            window.removeEventListener('focus', handleWindowFocus);
            supabase.removeChannel(channel);
        };
    }, [fetchDashboardData]);

    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            {/* 4. ADDED HEADER BAR FOR LOGOUT */}
            <nav className="max-w-7xl mx-auto px-8 lg:px-12 py-6 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-xs">ET</div>
                    <span className="font-black uppercase tracking-tighter text-slate-900">Head Terminal</span>
                </div>
                <button 
                    onClick={logout}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:text-rose-500 hover:border-rose-100 hover:bg-rose-50 transition-all tracking-widest"
                >
                    <LogOut size={14} /> Exit System
                </button>
            </nav>

            <main className="max-w-7xl mx-auto p-8 lg:p-12 pt-0">
                
                {/* Authority Status Banner */}
                <div className="mb-10 flex items-center justify-between p-6 bg-white border-l-4 border-emerald-500 rounded-3xl shadow-xl shadow-slate-100">
                    <div className="flex items-center gap-5">
                        <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600">
                            <UserCheck size={24} />
                        </div>
                        <div>
                            <p className="font-black text-slate-900 uppercase text-xs tracking-widest">Authority Active</p>
                            <p className="text-slate-500 text-sm font-medium">Head Registrar session is authenticated. Arbitrum L2 node connection established.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-black uppercase text-slate-400">Signature Verified</span>
                    </div>
                </div>

                {/* ... (Rest of the stats and queue cards remain the same) ... */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                            <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600"><Activity size={20} /></div>
                            <span className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest ${isLive ? 'text-emerald-500' : 'text-slate-300'}`}>
                                <Zap size={10} className={isLive ? 'animate-pulse' : ''} /> {isLive ? 'Live Sync Active' : 'Offline'}
                            </span>
                        </div>
                        <p className="text-4xl font-black text-slate-900">{stats.pending}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2 italic">Awaiting Final Approval</p>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <div className="bg-amber-50 p-3 rounded-2xl text-amber-600 w-fit mb-4"><Loader2 size={20} className="animate-spin" /></div>
                        <p className="text-4xl font-black text-slate-900">{stats.processing}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2 italic">Processing on Blockchain</p>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600 w-fit mb-4"><Award size={20} /></div>
                        <p className="text-4xl font-black text-slate-900">{stats.minted || 0}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2 italic">Successfully Minted</p>
                    </div>

                    <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-100 relative overflow-hidden group border border-slate-800">
                        <Fingerprint className="absolute -right-5 -top-5 text-indigo-500/10 group-hover:text-indigo-500/20 transition-all duration-700" size={180} />
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div className="bg-white/10 p-3 rounded-2xl text-indigo-400 w-fit"><Database size={20} /></div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[8px] font-mono text-emerald-400">GAS: 0.001 GWEI</span>
                                    <span className="text-[8px] font-mono text-indigo-400">BLOCK: 4291...</span>
                                </div>
                            </div>
                            <p className="text-xl font-black italic uppercase tracking-tighter text-indigo-100 leading-tight">L2 Network<br/>Terminal</p>
                            <div className="mt-4 flex items-center gap-2">
                                <div className="h-1 w-12 bg-indigo-500/30 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-400 animate-[loading_2s_infinite]" />
                                </div>
                                <p className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest">Node: Arbitrum Sepolia</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between mb-8 px-4">
                    <div className="flex items-center gap-3">
                        <LayoutDashboard className="text-indigo-600" size={20} />
                        <h3 className="font-black text-xs uppercase tracking-[0.4em] text-slate-400 italic">Issuance Queue</h3>
                    </div>
                </div>

                {loading ? (
                    <div className="bg-white rounded-[4rem] p-32 text-center border border-slate-100 shadow-sm">
                        <Loader2 className="animate-spin text-indigo-600 mx-auto mb-6" size={40} />
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Syncing Verified Queue...</h2>
                    </div>
                ) : pendingApplications.length === 0 ? (
                    <div className="bg-white rounded-[4rem] p-32 text-center border border-slate-100 shadow-sm">
                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <UserCheck size={40} className="text-slate-200" />
                        </div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Queue Clear</h2>
                        <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">There are no applications currently marked as 'Verified for Issuance' by Staff.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {pendingApplications.map(app => (
                            <div 
                                key={app.application_id} 
                                className="group bg-white p-2 rounded-[3rem] border border-slate-100 hover:border-indigo-200 transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-50 flex flex-col md:flex-row items-center justify-between"
                            >
                                <div className="flex items-center gap-8 p-6">
                                    <div className="w-20 h-20 bg-slate-50 rounded-4xl flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                                        <Fingerprint size={32} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-widest">Verified for Issuance</span>
                                            <span className="text-[9px] font-bold text-slate-300 font-mono tracking-tighter">APP_ID: {app.application_id ? app.application_id.substring(0, 8) : 'N/A'}</span>
                                        </div>
                                        <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">
                                            {app.student_records?.full_name || 'Incomplete Profile'}
                                        </h4>
                                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                                            {app.student_records?.course} • {app.student_records?.student_id}
                                        </p>
                                    </div>
                                </div>

                                <div className="p-6 md:pr-10">
                                    <button 
                                        onClick={() => navigate(`/head/mint/${app.application_id}`)}
                                        className="relative overflow-hidden px-10 py-5 bg-slate-900 rounded-4xl group/btn shadow-xl shadow-slate-200 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                                    >
                                        <div className="relative z-10 flex items-center gap-3 text-white">
                                            <Zap size={18} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Issue and Approve</span>
                                        </div>
                                        <div className="absolute inset-0 bg-indigo-600 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}