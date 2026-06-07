import { useState, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Sidebar from '../components/Sidebar'; 
import Notification from '../components/Notification'; 
import {
    LayoutDashboard,
    Search,
    Activity,
    Settings,
    AlertTriangle
} from 'lucide-react';

export default function StaffLayout() {
    const { logout, profile, role } = useAuth(); 
    const [isLoggingOut, setIsLoggingOut] = useState(false); 
    const navigate = useNavigate();

    const handleLogout = async () => {
        setIsLoggingOut(true); 
        await logout(); 
        navigate('/auth', { replace: true });
    };

    const navLinks = [
        { to: '/staff/dashboard', icon: LayoutDashboard, label: 'Overview' },
        { to: '/staff/lookup', icon: Search, label: 'Lookup' },
        { to: '/staff/verify', icon: AlertTriangle, label: 'Monitor' },
        { to: '/staff/history', icon: Activity, label: 'Audit Logs' },
        { to: '/staff/settings', icon: Settings, label: 'Settings' },
    ];

    if (role && role !== 'staff' && role !== 'registrar') {
        return <div className="p-20 text-center font-black text-3xl">UNAUTHORIZED</div>;
    }

    if (isLoggingOut) return null;

    return (
        <div className="flex h-screen bg-[#F8FAFC]">
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