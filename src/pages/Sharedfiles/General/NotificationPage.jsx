import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { Bell, Clock, FileText, ShieldAlert, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function NotificationPage() {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // 1. Optimized Fetch Logic
    const fetchNotifications = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('recipient_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setHistory(data || []);

            // 2. Mark unread as read immediately upon viewing
            const unreadIds = data?.filter(n => !n.read).map(n => n.id);
            if (unreadIds && unreadIds.length > 0) {
                await supabase
                    .from('notifications')
                    .update({ read: true })
                    .in('id', unreadIds);
            }
        } catch (err) {
            console.error("Sync Error:", err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();

        // 3. Real-time Listener: Listen for NEW notifications targeting this user
        const setupRealtime = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const channel = supabase
                .channel(`user-notifications-${user.id}`)
                .on(
                    'postgres_changes',
                    { 
                        event: 'INSERT', 
                        schema: 'public', 
                        table: 'notifications',
                        filter: `recipient_id=eq.${user.id}` 
                    },
                    (payload) => {
                        // Add new notification to top of list
                        setHistory(prev => [payload.new, ...prev]);
                        // Mark it as read because the user is currently looking at the history page
                        supabase.from('notifications').update({ read: true }).eq('id', payload.new.id);
                    }
                )
                .subscribe();

            return channel;
        };

        const channelRef = setupRealtime();

        return () => {
            channelRef.then(channel => {
                if (channel) supabase.removeChannel(channel);
            });
        };
    }, [fetchNotifications]);

    // Helper: Simple Time Formatter
    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
    };

    return (
        <div className="p-8 max-w-4xl mx-auto min-h-screen bg-[#FBFBFE]">
            {/* Header Actions */}
            <div className="flex justify-between items-center mb-8">
                <button 
                    onClick={() => navigate(-1)} 
                    className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-black uppercase text-[10px] tracking-widest transition-all group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
                    Exit Archive
                </button>
                
                <button 
                    onClick={() => { setLoading(true); fetchNotifications(); }}
                    className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                    title="Force Refresh"
                >
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            <div className="flex items-center gap-5 mb-12">
                <div className="p-5 bg-slate-900 rounded-4xl text-white shadow-2xl shadow-slate-200">
                    <Bell size={32} />
                </div>
                <div>
                    <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter italic">
                        Notification <span className="text-indigo-600">History</span>
                    </h1>
                    <p className="text-slate-400 font-bold text-[10px] tracking-[0.3em] uppercase">
                        Encrypted Activity Ledger // System Logs
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="animate-spin text-indigo-600" size={40} />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Querying Database...</span>
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Bell className="text-slate-200" size={32} />
                        </div>
                        <p className="text-slate-400 font-black uppercase text-xs tracking-widest mb-8">
                            No logs found for your account
                        </p>
                        <button 
                            onClick={() => navigate('/dashboard')}
                            className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-900 hover:text-white transition-all"
                        >
                            Back to Safety
                        </button>
                    </div>
                ) : (
                    history.map((n) => (
                        <div 
                            key={n.id} 
                            className={`p-6 rounded-[2.5rem] border flex items-center justify-between transition-all duration-500 hover:shadow-2xl hover:shadow-slate-200/50 group ${
                                n.read 
                                ? 'bg-white/60 border-slate-100 opacity-80' 
                                : 'bg-white border-indigo-100 shadow-xl shadow-indigo-50/50 ring-2 ring-indigo-500/5'
                            }`}
                        >
                            <div className="flex items-center gap-6">
                                <div className={`p-4 rounded-2xl transition-transform group-hover:scale-110 duration-300 ${
                                    n.type === 'alert' || n.type === 'revoked' 
                                    ? 'bg-rose-50 text-rose-500' 
                                    : 'bg-indigo-50 text-indigo-500'
                                }`}>
                                    {n.type === 'alert' || n.type === 'revoked' ? <ShieldAlert size={24} /> : <FileText size={24} />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="font-black text-slate-800 uppercase text-xs tracking-tight">
                                            {n.title}
                                        </h3>
                                        {!n.read && (
                                            <span className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
                                        )}
                                    </div>
                                    <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-md">
                                        {n.message}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="text-right shrink-0">
                                <div className="flex items-center gap-2 text-slate-400 font-mono text-[9px] font-bold bg-slate-50 px-4 py-2 rounded-xl group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                                    <Clock size={12} />
                                    {formatTime(n.created_at)}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}