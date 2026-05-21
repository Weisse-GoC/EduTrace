import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabaseClient';
import { ShieldCheck, LogOut, Bell } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  // Memoized count updater for reliability
  const updateCount = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('read', false);
    
    setUnreadCount(count || 0);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Initial load
    const fetchInitialCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('read', false);
      setUnreadCount(count || 0);
    };
    fetchInitialCount();

    const channel = supabase
      .channel(`navbar-notifs-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`
        },
        () => {
          updateCount(); // Update on change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, updateCount]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <nav className="w-full bg-[#1e293b] text-white p-4 shadow-2xl flex justify-between items-center px-8 sticky top-0 z-100 border-b border-slate-700/50 backdrop-blur-md bg-opacity-95">
      <Link to="/" className="flex items-center gap-3 group">
        <div className="bg-indigo-500/20 p-2 rounded-xl group-hover:bg-indigo-500/30 transition-all">
          <ShieldCheck className="text-indigo-400" size={24} />
        </div>
        <h1 className="text-xl font-black tracking-tighter uppercase italic leading-none">
          Edu<span className="text-indigo-400">Trace</span>
        </h1>
      </Link>

      {user && (
        <div className="flex items-center gap-6">
          {/* SOPHISTICATED BELL ICON WITH BUBBLE */}
          <Link 
            to="/notifications" 
            className="relative p-2.5 rounded-2xl bg-slate-800/50 hover:bg-slate-700 border border-slate-700 transition-all group"
          >
            <Bell size={20} className="text-slate-400 group-hover:text-indigo-400 transition-colors" />
            
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 bg-rose-500 flex items-center justify-center rounded-full text-[10px] font-black animate-in zoom-in border-2 border-[#1e293b]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          <div className="flex items-center gap-4 border-l border-slate-700 pl-6">
            <div className="text-right hidden md:block">
              <p className="text-[9px] font-black uppercase text-indigo-400 tracking-widest">Active Operator</p>
              <p className="text-[11px] text-slate-400 font-mono italic">{user.email.split('@')[0]}</p>
            </div>
            
            <button 
              onClick={handleLogout} 
              className="p-2.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl transition-all shadow-lg hover:shadow-rose-500/20"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}