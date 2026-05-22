import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabaseClient'; 
import Sidebar from '../components/Sidebar'; 
import Notification from '../components/Notification'; 
import {
    LayoutDashboard,
    Search,
    Bell,
    Activity,
    Settings
} from 'lucide-react';

export default function StaffLayout() {
    const { logout, profile, role } = useAuth(); 
    const [pendingCount, setPendingCount] = useState(0);
    const [isLoggingOut, setIsLoggingOut] = useState(false); 
    const navigate = useNavigate();
    const location = useLocation();
    
    // FETCH UNREAD NOTIFICATIONS COUNT (Sync with the Bell Badge)
    const fetchNotificationCount = useCallback(async () => {
        if (!profile) return 0;
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('recipient_id', profile.id)
            .eq('read', false);

        return error ? 0 : (count || 0);
    }, [profile]);

    useEffect(() => {
        if (!profile || isLoggingOut) return;

        const loadCount = async () => {
            const count = await fetchNotificationCount();
            setPendingCount(count);
        };

        loadCount();

        // Realtime listener for NEW notifications
        const channel = supabase
            .channel(`staff-badge-sync:${profile.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'notifications',
                filter: `recipient_id=eq.${profile.id}`
            }, async () => {
                const count = await fetchNotificationCount();
                setPendingCount(count);
            })
            .subscribe();

        return () => { 
            supabase.removeChannel(channel); 
        };
    }, [profile, isLoggingOut, fetchNotificationCount]);

    const handleLogout = async () => {
        setIsLoggingOut(true); 
        await logout(); 
        navigate('/auth', { replace: true });
    };

    const navLinks = [
        { to: '/staff/dashboard', icon: LayoutDashboard, label: 'Overview' },
        { to: '/staff/lookup', icon: Search, label: 'Student Lookup' },
        // UPDATE THIS LINE:
        { to: '/staff/history', icon: Activity, label: 'Audit Logs' }, 
        { to: '/staff/settings', icon: Settings, label: 'Settings' },
    ];

    if (role && role !== 'staff' && role !== 'registrar') {
        return <div className="p-20 text-center font-black text-3xl">UNAUTHORIZED</div>;
    }

    if (isLoggingOut) return null;

    return (
        <div className="flex h-screen bg-[#F8FAFC]">
            {/* The Toast Service (Invisible unless a new notification pops) */}
            <Notification /> 
            
            <Sidebar
                navLinks={navLinks}
                onLogout={handleLogout}
            />

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white border-b border-slate-100 p-6 flex justify-between items-center z-10">
                    <div>
                        <h1 className="text-xs font-black uppercase tracking-widest text-slate-400">System Link: Active</h1>
                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1">
                            {profile?.department || 'Registrar Division'}
                        </p>
                    </div>

                    <div className="flex items-center space-x-6">
                        {/* THE BELL: Dynamic Badge Logic */}
                        <button 
                            onClick={() => navigate('/staff/verify')}
                            className={`p-2.5 rounded-2xl transition-all relative group ${
                                location.pathname === '/staff/verify' 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                                : 'bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600'
                            }`}
                        >
                            <Bell size={20} />
                            
                            {pendingCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm animate-in zoom-in duration-300">
                                    {pendingCount > 99 ? '99+' : pendingCount}
                                </span>
                            )}
                        </button>
                        
                        <div className="flex items-center gap-3 pl-6 border-l border-slate-100">
                            <div className="text-right hidden md:block">
                                <p className="text-[11px] font-black text-slate-900 uppercase">{profile?.full_name}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase italic">Level 1 Staff</p>
                            </div>
                            <img 
                                src={`https://ui-avatars.com/api/?name=${profile?.full_name || 'S'}&background=4f46e5&color=fff&bold=true`} 
                                className="w-10 h-10 rounded-xl shadow-sm border border-slate-100" 
                                alt="avatar"
                            />
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-auto p-8">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}