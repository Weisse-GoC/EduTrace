import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
// Centralized notification abstract services hook layout
import { supabase, getUnreadNotificationCount } from '../services/supabaseClient'; 
import Sidebar from '../components/Sidebar'; 
import Notification from '../components/Notification'; 
import { LayoutDashboard, CloudUpload, Settings, UserCircle, Bell, Fingerprint } from 'lucide-react';

export default function StudentLayout() {
    const { logout, profile, role } = useAuth(); 
    const [notifCount, setNotifCount] = useState(0);
    const navigate = useNavigate();
    
    useEffect(() => {
        if (!profile?.id) return;

        const studentId = profile.id;
        let isMounted = true;
        let channel;

        // 1. Fetch unread notification badges using our cleaner abstraction service helper
        const fetchNotifs = async () => {
            try {
                const count = await getUnreadNotificationCount(studentId);
                if (isMounted) {
                    setNotifCount(count);
                }
            } catch (err) {
                console.error("Failed to sync notification updates:", err);
            }
        };

        fetchNotifs();

        // 2. Set up realtime postgres change stream for immediate notification alerts
        channel = supabase
            .channel(`student-notifs:${studentId}`)
            .on(
                'postgres_changes',
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'notifications', 
                    filter: `recipient_id=eq.${studentId}` 
                },
                () => {
                    if (isMounted) fetchNotifs(); 
                }
            )
            .subscribe();

        return () => {
            isMounted = false;
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [profile]);

    const navLinks = [
        { to: '/student/dashboard', icon: LayoutDashboard, label: 'Overview' },
        { to: '/student/upload', icon: CloudUpload, label: 'Application' }, 
        { to: '/student/profile', icon: UserCircle, label: 'My Profile' }, 
        { to: '/student/settings', icon: Settings, label: 'Settings' },
    ];

    const handleLogout = async () => {
        try {
            await logout(); 
            navigate('/auth', { replace: true });
        } catch (error) {
            console.error("Logout execution failed:", error);
        }
    };

    // Role Guard: Prevent unauthorized non-student actors
    if (role && role !== 'student') {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
                <Fingerprint size={64} className="text-slate-200 mb-4" />
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Unauthorized Access Area</h2>
                <button onClick={() => navigate(-1)} className="mt-4 text-indigo-600 font-bold text-xs underline">
                    Return to previous node
                </button>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-white font-sans">
            <Notification /> 
            <Sidebar navLinks={navLinks} onLogout={handleLogout} />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header Container Area */}
                <header className="bg-slate-900 text-white p-5 flex justify-between items-center z-10 select-none">
                    <div 
                        className="flex items-center gap-4 cursor-pointer group" 
                        onClick={() => navigate('/student/dashboard')}
                    >
                        <div className="w-10 h-10 bg-indigo-500 text-white rounded-2xl flex items-center justify-center font-black shadow-lg shadow-indigo-500/20 group-hover:rotate-6 transition-transform">
                            ET
                        </div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tighter italic">
                                EduTrace<span className="text-indigo-400">.</span>
                            </h1>
                            {profile?.school_id && (
                                <p className="text-[9px] text-indigo-300 font-black uppercase tracking-widest leading-none mt-1">
                                    ID: {profile.school_id}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        {/* Alert Badges Trigger */}
                        <button 
                            onClick={() => navigate('/student/notifications')} 
                            className="p-2.5 bg-slate-800 hover:bg-indigo-600 rounded-2xl transition-all group relative border border-slate-700"
                            title="Notifications Center"
                        >
                            <Bell size={20} className="text-slate-300 group-hover:text-white group-hover:animate-swing" />
                            {notifCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-lg border-2 border-slate-900 shadow-lg animate-pulse">
                                    {notifCount}
                                </span>
                            )}
                        </button>

                        {/* Interactive Avatar Node */}
                        <div 
                            className="w-10 h-10 rounded-2xl bg-indigo-100 border-2 border-slate-800 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform overflow-hidden"
                            onClick={() => navigate('/student/profile')}
                        >
                            <img 
                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || 'Student')}&background=4f46e5&color=fff&bold=true`} 
                                alt="Student Avatar Profile Node" 
                            />
                        </div>
                    </div>
                </header>

                {/* Main Dashboard Application Viewports */}
                <main className="flex-1 overflow-auto bg-[#F8FAFC]">
                    <div className="p-8 max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}