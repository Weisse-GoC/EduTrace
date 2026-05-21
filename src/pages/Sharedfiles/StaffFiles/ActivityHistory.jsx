//src/pages/Sharedfiles/StaffFiles/ActivityHistory.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { useAuth } from '../../../hooks/useAuth';
import { 
    Clock, Search, FileText, ShieldCheck, 
    LogIn, Activity, Wifi, Database 
} from 'lucide-react';

export default function ActivityHistory() {
    const { user } = useAuth();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLive, setIsLive] = useState(false);

    useEffect(() => {
        if (!user) return;

        const fetchLogs = async () => {
            const { data, error } = await supabase
                .from('activity_logs')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching logs:", error);
            } else {
                setLogs(data.map(log => ({
                    ...log,
                    date: new Date(log.created_at).toLocaleString()
                })));
            }
            setLoading(false);
        };

        fetchLogs();

        // Realtime Subscription
        const channel = supabase
            .channel('activity_changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'activity_logs',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    const newLog = {
                        ...payload.new,
                        date: new Date(payload.new.created_at).toLocaleString()
                    };
                    setLogs((prev) => [newLog, ...prev]);
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') setIsLive(true);
            });

        return () => {
            supabase.removeChannel(channel);
            setIsLive(false);
        };
    }, [user]);

    const getActionTheme = (action = "") => {
        const act = action.toUpperCase();
        if (act.includes('ISSUE') || act.includes('MINT')) 
            return { icon: <ShieldCheck size={16}/>, color: "text-emerald-600 bg-emerald-50 border-emerald-100" };
        if (act.includes('LOGIN')) 
            return { icon: <LogIn size={16}/>, color: "text-blue-600 bg-blue-50 border-blue-100" };
        return { icon: <FileText size={16}/>, color: "text-indigo-600 bg-indigo-50 border-indigo-100" };
    };

    const filteredLogs = logs.filter(l => 
        (l.action || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.details?.message || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-5xl mx-auto p-6 lg:p-10 animate-in fade-in duration-700">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${isLive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400'}`}>
                            <Wifi size={10} className={isLive ? "animate-pulse" : ""} />
                            {isLive ? 'Live Sync Active' : 'Offline'}
                        </div>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Audit Trail</h1>
                    <p className="text-slate-500 text-sm font-medium">Your immutable ledger of blockchain interactions.</p>
                </div>

                <div className="relative w-full md:w-72 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
                    <input 
                        type="text" 
                        placeholder="Filter activities..." 
                        className="w-full pl-12 pr-5 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium text-sm"
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* LOGS TABLE */}
            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="p-20 text-center">
                        <Activity className="animate-spin mx-auto text-indigo-600 mb-4" size={32} />
                        <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Syncing with Node...</p>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="p-20 text-center">
                        <Database className="mx-auto text-slate-200 mb-4" size={48} />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No records found in this sequence</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Transaction</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Context/Details</th>
                                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredLogs.map((log) => {
                                    const theme = getActionTheme(log.action);
                                    return (
                                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="p-6">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-3 rounded-xl border shadow-sm ${theme.color}`}>
                                                        {theme.icon}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black uppercase tracking-tighter text-slate-700">
                                                            {log.action?.replace(/_/g, ' ')}
                                                        </span>
                                                        <span className="text-[9px] font-mono text-slate-400 group-hover:text-indigo-400 transition-colors">
                                                            ID: {log.id.toString().substring(0, 8)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <div className="flex flex-col gap-1">
                                                    <p className="text-sm font-bold text-slate-600">
                                                        {log.details?.message || log.details?.documentType || "System Event"}
                                                    </p>
                                                    {log.details?.txHash && (
                                                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-indigo-500 bg-indigo-50 w-fit px-2 py-0.5 rounded-md border border-indigo-100">
                                                            <span className="opacity-50">HASH:</span>
                                                            {log.details.txHash.substring(0, 20)}...
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <div className="flex items-center gap-3 text-slate-400">
                                                    <Clock size={14} className="text-slate-300" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-bold text-slate-600">{new Date(log.created_at).toLocaleDateString()}</span>
                                                        <span className="text-[10px] font-medium">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}