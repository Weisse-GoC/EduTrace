import { useState, useEffect } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { useAuth } from '../../../hooks/useAuth';
import { 
  Activity, User, Clock, Search, Database, List, Fingerprint, ShieldCheck, Wifi
} from 'lucide-react';

export default function ActivityHistory() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLive, setIsLive] = useState(false);

  // Styling helper for status types
  const getActionStyle = (status) => {
    if (!status || typeof status !== 'string') return 'bg-gray-50 text-gray-600 border-gray-100';
    const stat = status.toUpperCase();
    if (stat.includes('REJECTED') || stat.includes('DELETE')) 
        return 'bg-red-50 text-red-600 border-red-100';
    if (stat.includes('VERIFIED') || stat.includes('MINTED') || stat.includes('APPROVED') || stat.includes('ISSUED')) 
        return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (stat.includes('PENDING')) 
        return 'bg-blue-50 text-blue-600 border-blue-100';
    return 'bg-indigo-50 text-indigo-600 border-indigo-100';
  };

  useEffect(() => {
    if (!user) return;

    const fetchLogs = async () => {
      try {
        const { data, error } = await supabase
          .from('student_applications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;
        setLogs(data || []);
      } catch (err) {
        console.error("Error fetching logs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();

    // REAL-TIME SUBSCRIPTION: Listen for inserts and updates on student_applications
    const channel = supabase
      .channel('application_activity_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'student_applications' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setLogs((prev) => [payload.new, ...prev].slice(0, 100));
          } else if (payload.eventType === 'UPDATE') {
            setLogs((prev) => prev.map(log => 
                log.application_id === payload.new.application_id ? payload.new : log
            ));
          }
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

  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    return (
      String(log.student_id || "").toLowerCase().includes(term) ||
      String(log.student_name || "").toLowerCase().includes(term) ||
      String(log.status || "").toLowerCase().includes(term) ||
      String(log.document_type || "").toLowerCase().includes(term)
    );
  });

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white">
      <Activity className="animate-spin text-indigo-600 mb-4" size={48} />
      <span className="font-black uppercase tracking-[0.3em] text-xs text-gray-400">Syncing Ledger...</span>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-10 space-y-8 bg-[#fbfcfd] min-h-screen animate-in fade-in duration-500">
      
      {/* HEADER SECTION */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${isLive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
              <Wifi size={12} className={isLive ? "animate-pulse" : ""} />
              {isLive ? "Live Network Active" : "Static View"}
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Security Node: 001</span>
          </div>
          <h1 className="text-6xl font-black text-slate-900 tracking-tighter uppercase leading-none italic">Activity Log</h1>
          <p className="text-slate-400 font-medium">Monitoring staff actions and blockchain document requests.</p>
        </div>
        
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search Records, IDs, or Actions..." 
            className="w-full pl-12 pr-4 py-5 bg-white border border-slate-200 rounded-3xl shadow-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 outline-none transition-all text-sm font-semibold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      {/* QUICK STATS DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-4xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Active Entries</p>
            <p className="text-4xl font-black text-slate-800 tracking-tighter">{filteredLogs.length}</p>
        </div>
        <div className="bg-white p-8 rounded-4xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-indigo-500">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Processed Requests</p>
            <p className="text-4xl font-black text-indigo-600 tracking-tighter">
              {logs.filter(l => l.status !== 'Pending').length}
            </p>
        </div>
        <div className="bg-white p-8 rounded-4xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Database Integrity</p>
            <div className="flex items-center gap-2">
                <ShieldCheck className="text-emerald-500" size={24} />
                <p className="text-2xl font-black text-emerald-500 uppercase italic tracking-tighter">Verified</p>
            </div>
        </div>
      </div>

      {/* MAIN DATA TABLE */}
      <div className="bg-white rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg shadow-indigo-200">
                <List size={18} />
              </div>
              <span className="text-sm font-black uppercase tracking-widest text-slate-800">Transaction History</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100">Rolling Buffer: 100 Events</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Action & ID</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Origin (Source)</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Subject (Student)</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredLogs.map((log) => (
                <tr key={log.application_id} className="hover:bg-indigo-50/30 transition-all group">
                  
                  {/* Action & ID Column */}
                  <td className="p-6">
                    <div className="flex flex-col gap-2">
                      <span className={`w-fit px-4 py-1 rounded-full text-[10px] font-black uppercase border shadow-sm tracking-tight ${getActionStyle(log.status)}`}>
                        {log.status || "EVENT"}
                      </span>
                      <span className="text-[10px] font-mono text-slate-300 group-hover:text-indigo-400 transition-colors">
                        APP_ID: {log.application_id?.toString().substring(0, 18)}...
                      </span>
                    </div>
                  </td>

                  {/* Origin Column */}
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm group-hover:scale-110 transition-transform">
                        <Fingerprint size={24} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-700 leading-tight">
                          {log.form_source || "System Queue"}
                        </span>
                        <span className="text-[10px] font-black font-mono text-slate-400 uppercase tracking-tighter">
                          TYPE: {log.document_type || "DOC"}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Subject Column */}
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 group-hover:bg-white transition-colors">
                        <User size={24} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-800 leading-tight">
                          {log.student_name || "Unknown Identity"}
                        </span>
                        <span className="text-[10px] font-black font-mono text-indigo-500 tracking-tighter">
                          STU_ID: {log.student_id || "00-0000"}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Timestamp Column */}
                  <td className="p-6 text-right">
                    <div className="inline-flex flex-col items-end gap-1 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-white transition-colors">
                        <div className="flex items-center gap-2 text-slate-700">
                          <Clock size={12} className="text-indigo-500" />
                          <span className="text-xs font-black">
                            {log.created_at ? new Date(log.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : "Recently"}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          {log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : "Pending"}
                        </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredLogs.length === 0 && (
            <div className="p-32 text-center">
              <Database className="mx-auto text-slate-100 mb-6" size={80} />
              <p className="text-slate-300 font-black uppercase tracking-[0.4em] text-sm italic">No data detected in sector</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}