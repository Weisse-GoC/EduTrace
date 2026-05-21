import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabaseClient';
import { 
    User, Mail, ShieldCheck, Award, Calendar, MapPin,
    LogOut, CheckCircle, Fingerprint, Activity, Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function StaffProfile() {
    const { profile, user, logout } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({ verified: 0, pending: 0 });

    useEffect(() => {
        const fetchStaffStats = async () => {
            if (!profile?.id) return;

            // Get count of records verified by this specific staff member from activity logs
            const { count: verifiedCount, error: verifiedError } = await supabase
                .from('activity_logs')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', profile.id)
                .eq('action', 'SET_STATUS_Verified');

            // Get count of pending requests in system
            const { count: pendingCount, error: pendingError } = await supabase
                .from('student_applications')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'Pending');

            if (!verifiedError) setStats(prev => ({ ...prev, verified: verifiedCount || 0 }));
            if (!pendingError) setStats(prev => ({ ...prev, pending: pendingCount || 0 }));
        };

        fetchStaffStats();
    }, [profile]);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/auth');
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    const memberSince = profile?.created_at 
        ? new Date(profile.created_at).getFullYear() 
        : "2024";

    return (
        <div className="max-w-5xl mx-auto p-6 lg:p-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* QUICK STATS ROW */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-xl shadow-slate-200/50">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Activity size={20}/></div>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Total Verified</span>
                    </div>
                    <p className="text-4xl font-black text-slate-800 italic tracking-tighter">{stats.verified}</p>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-xl shadow-slate-200/50">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><CheckCircle size={20}/></div>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">System Health</span>
                    </div>
                    <p className="text-4xl font-black text-emerald-500 italic tracking-tighter uppercase">Active</p>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-xl shadow-slate-200/50">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><Clock size={20}/></div>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Access Level</span>
                    </div>
                    <p className="text-4xl font-black text-slate-800 italic tracking-tighter">L-{profile?.can_mint ? '02' : '01'}</p>
                </div>
            </div>

            {/* PROFILE HEADER CARD */}
            <div className="relative bg-white rounded-[3.5rem] shadow-2xl shadow-indigo-100/40 border border-slate-100 overflow-hidden mb-10">
                <div className="absolute top-0 left-0 w-full h-32 bg-linear-to-r from-slate-900 to-indigo-950" />
                
                <div className="relative pt-16 pb-12 px-12 flex flex-col items-center md:items-end md:flex-row gap-8">
                    <div className="relative group">
                        <div className="w-40 h-40 bg-white rounded-[3rem] p-3 shadow-2xl transition-transform group-hover:scale-105 duration-500">
                            <div className="w-full h-full bg-slate-50 rounded-[2.2rem] flex items-center justify-center text-indigo-600 border border-slate-100 overflow-hidden">
                                <img 
                                    src={`https://ui-avatars.com/api/?name=${profile?.full_name || 'Staff'}&background=0f172a&color=ffffff&bold=true&size=256`} 
                                    alt="Profile" 
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-indigo-600 border-4 border-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg">
                            <ShieldCheck size={24} className="text-white" />
                        </div>
                    </div>

                    <div className="flex-1 text-center md:text-left pt-4">
                        <h1 className="text-4xl font-black text-slate-800 uppercase italic tracking-tighter">
                            {profile?.full_name || "Staff Member"}
                        </h1>
                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{profile?.department || "University Registrar Office"}</p>
                    </div>

                    <div className="pt-4">
                        <button 
                            onClick={handleLogout}
                            className="flex items-center gap-3 bg-slate-900 text-white px-10 py-5 rounded-4xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl active:scale-95"
                        >
                            <LogOut size={18} /> Terminate Session
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100 border-t border-slate-100">
                    {[
                        { icon: Mail, label: "Institutional Email", value: user?.email },
                        { icon: Award, label: "Privilege Level", value: profile?.can_mint ? "Level 2 - Admin/Issuer" : "Level 1 - Registrar Staff" },
                        { icon: Fingerprint, label: "Employee ID", value: profile?.employee_id || 'UC-2026-STAFF' },
                        { icon: Calendar, label: "Member Since", value: `Academic Year ${memberSince}` }
                    ].map((item, i) => (
                        <div key={i} className="bg-white p-10 flex items-start gap-6 hover:bg-slate-50/50 transition-colors group">
                            <div className="p-4 bg-slate-50 rounded-2xl text-slate-400 group-hover:text-indigo-600 transition-colors">
                                <item.icon size={22} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{item.label}</p>
                                <p className="font-bold text-slate-800 text-lg tracking-tight">{item.value || 'Not Set'}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* BLOCKCHAIN AUTHORIZATION SECTION */}
            <div className="bg-slate-900 rounded-[3.5rem] p-12 text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl -mr-20 -mt-20" />
                
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
                    <div className="flex-1">
                        <h3 className="text-3xl font-black uppercase italic tracking-tighter mb-4">Security Clearance</h3>
                        <p className="text-slate-400 text-sm mb-8 leading-relaxed font-medium">
                            {profile?.can_mint 
                              ? "Your cryptographic identity is authorized for **Minting & Issuance**. You have authority to commit educational records to the Arbitrum Blockchain."
                              : "You are currently in **Verification Mode**. You can validate institutional data, but final on-chain commitment requires L-02 authorization."}
                        </p>
                        
                        <div className="flex flex-wrap gap-4">
                            <div className="bg-white/5 border border-white/10 px-6 py-4 rounded-3xl">
                                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-1">Status</p>
                                <p className="text-xs font-mono font-bold tracking-widest text-emerald-400">AUTHORIZED_ALPHA</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 px-6 py-4 rounded-3xl">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Node Access</p>
                                <p className="text-xs font-mono font-bold tracking-widest uppercase">{profile?.can_mint ? 'Write/Mint' : 'Read/Verify'}</p>
                            </div>
                        </div>
                    </div>
                    <div className="hidden md:block">
                         <div className="w-48 h-48 border-2 border-white/10 rounded-full flex items-center justify-center relative">
                            <div className="absolute inset-0 border-2 border-dashed border-indigo-500/30 rounded-full animate-[spin_20s_linear_infinite]" />
                            <Fingerprint size={80} className="text-indigo-500 opacity-50" />
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
}