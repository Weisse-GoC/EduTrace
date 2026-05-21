import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  LayoutDashboard, 
  FileCheck,     // Changed from History
  Settings, 
  LogOut, 
  ShieldCheck,
  Menu,
  X,
  Activity,
 
} from 'lucide-react';

export default function HeadLayout() {
    const { logout, profile } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/auth');
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    // Navigation items tailored for the Head of Institution
    const navItems = [
        { label: 'Registrar Overview', path: '/head/dashboard', icon: LayoutDashboard },
        { label: 'Issuance History', path: '/head/logs', icon: FileCheck },
        { label: 'Settings', path: '/head/settings', icon: Settings },
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex font-sans">
            {/* --- SIDEBAR (Desktop) --- */}
            <aside className="hidden lg:flex flex-col w-72 bg-slate-900 text-white p-6 fixed h-full z-50">
                <div className="flex items-center gap-3 mb-12 px-2">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tighter uppercase italic">
                            EduTrace<span className="text-indigo-500">.</span>
                        </h1>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em]">Head of Institution</p>
                    </div>
                </div>

                <nav className="flex-1 space-y-1.5">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${
                                isActive(item.path) 
                                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/20 translate-x-1' 
                                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                            }`}
                        >
                            <item.icon size={18} className={isActive(item.path) ? 'text-white' : 'group-hover:text-white transition-colors'} />
                            <span className="text-[11px] font-black uppercase tracking-widest">{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="mt-auto pt-6 border-t border-slate-800">
                    <button 
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3.5 w-full text-slate-500 hover:text-rose-400 transition-all group font-black uppercase text-[11px] tracking-widest"
                    >
                        <LogOut size={18} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* --- MAIN CONTENT AREA --- */}
            <main className="flex-1 lg:ml-72 min-h-screen flex flex-col">
                <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-8 sticky top-0 z-40">
                    <div className="flex items-center gap-4">
                        <button 
                            className="lg:hidden p-2 text-slate-900 bg-slate-100 rounded-lg"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            <Menu size={20} />
                        </button>
                        
                        <div className="hidden sm:flex items-center gap-2 px-4 py-1.5 bg-indigo-50 rounded-full border border-indigo-100">
                            <Activity size={12} className="text-indigo-500 animate-pulse" />
                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Registrar Head Portal Active</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">
                                {profile?.full_name || 'Authorized Head'}
                            </p>
                            <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">
                                {profile?.institution_name || 'University Registrar'}
                            </p>
                        </div>
                        <div className="w-10 h-10 bg-indigo-100 rounded-2xl border-2 border-white shadow-sm overflow-hidden">
                            <img 
                                src={`https://ui-avatars.com/api/?name=${profile?.full_name || 'Head'}&background=4f46e5&color=fff&bold=true`} 
                                alt="avatar" 
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>
                </header>

                <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
                    <Outlet />
                </div>
            </main>

            {/* --- MOBILE NAV (Overlay) --- */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-70 lg:hidden">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
                    <nav className="fixed top-0 left-0 bottom-0 w-72 bg-slate-900 p-8 flex flex-col shadow-2xl">
                        <div className="flex items-center justify-between mb-12">
                            <ShieldCheck className="text-indigo-500" size={32} />
                            <button onClick={() => setIsMobileMenuOpen(false)}><X className="text-white" /></button>
                        </div>
                        <div className="space-y-6">
                             {navItems.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={`flex items-center gap-4 font-black uppercase text-[10px] tracking-widest ${
                                        isActive(item.path) ? 'text-indigo-400' : 'text-slate-400'
                                    }`}
                                >
                                    <item.icon size={18} /> {item.label}
                                </Link>
                            ))}
                        </div>
                    </nav>
                </div>
            )}
        </div>
    );
}
