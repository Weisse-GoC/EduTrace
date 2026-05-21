//src/pages/Sharedfiles/General/Settings.jsx
import { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../services/supabaseClient'; 
import { 
    KeyRound, ShieldCheck, Mail, AlertCircle, 
    ArrowRight, User, Fingerprint, Activity,
    ShieldAlert, LogOut
} from 'lucide-react';

export default function Settings() {
    const { user, userData, signOut } = useAuth();
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);

    const handlePasswordReset = async () => {
        if (!user?.email) return;
        
        setLoading(true);
        setStatus(null);
        try {
            // 1. Trigger the Supabase Auth Reset (Sends email)
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, {
                redirectTo: `${window.location.origin}/update-password`,
            });

            if (resetError) throw resetError;
            
            // 2. LOG THE ACTIVITY (Real-time feed sync)
            await supabase.from('activity_logs').insert({
                action: "SECURITY_AUTH_RESET_REQUEST",
                details: { 
                    method: "Institutional Email",
                    node: "Registrar Settings Console",
                    adminName: userData?.fullName || "Authorized User"
                },
                user_id: user.id,
                role: userData?.role || 'student'
            });

            setStatus('success');
        } catch (error) {
            console.error("Reset Error:", error);
            setStatus('error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto py-12 px-6 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 font-sans">
            
            {/* 1. HERO PROFILE SECTION */}
            <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-indigo-100">
                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/20 rounded-full blur-[100px] -mr-32 -mt-32"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                    <div className="relative">
                        <div className="w-28 h-28 bg-linear-to-tr from-indigo-600 to-violet-500 rounded-[2.5rem] rotate-6 flex items-center justify-center shadow-2xl ring-4 ring-white/10">
                            <User size={48} className="text-white -rotate-6" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-2 rounded-2xl border-4 border-slate-900 shadow-lg">
                            <ShieldCheck size={18} className="text-white" />
                        </div>
                    </div>
                    <div className="text-center md:text-left">
                        <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none">
                            {userData?.fullName || "Vault User"}
                        </h1>
                        <div className="flex flex-col md:flex-row items-center gap-4 mt-4">
                            <p className="text-indigo-400 font-black text-[10px] tracking-[0.4em] uppercase bg-indigo-500/10 px-4 py-2 rounded-full border border-indigo-500/20">
                                ID: {userData?.schoolId || user?.id?.substring(0, 12)}
                            </p>
                            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">• Account Settings</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* 2. SECURITY CONTROLS (Main Column) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-[3rem] p-10 shadow-sm border border-slate-100 transition-all duration-500">
                        <div className="flex items-center gap-4 mb-10">
                            <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 shadow-inner">
                                <Fingerprint size={28} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">Access Control</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Authentication & Authorization</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Password Reset Card */}
                            <div className="group flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 hover:border-indigo-200 transition-all">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <KeyRound size={16} className="text-indigo-600" />
                                        <h4 className="font-black text-slate-900 uppercase text-sm tracking-tight italic">Credential Reset</h4>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed max-w-sm font-medium">
                                        Trigger a secure magic link to your institutional email. This will invalidate current sessions for security.
                                    </p>
                                </div>
                                <button
                                    onClick={handlePasswordReset}
                                    disabled={loading}
                                    className="w-full md:w-auto whitespace-nowrap bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl shadow-slate-200 active:scale-95"
                                >
                                    {loading ? "Syncing Ledger..." : "Update Credentials"}
                                    <ArrowRight size={14} />
                                </button>
                            </div>

                            {/* Status Notifications */}
                            {status === 'success' && (
                                <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-500">
                                    <div className="p-2 bg-emerald-500 rounded-lg">
                                        <Mail className="text-white" size={16} />
                                    </div>
                                    <p className="text-emerald-800 font-black text-[10px] uppercase tracking-widest">
                                        Security link dispatched to inbox
                                    </p>
                                </div>
                            )}

                            {status === 'error' && (
                                <div className="p-5 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-4 animate-in shake duration-500">
                                    <ShieldAlert className="text-rose-500" size={24} />
                                    <p className="text-rose-800 font-black text-[10px] uppercase tracking-widest">
                                        Critical: Reset Protocol Failed. Contact Admin.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Logout Option */}
                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-rose-50 text-rose-500 rounded-xl">
                                <LogOut size={20} />
                            </div>
                            <p className="text-sm font-bold text-slate-700">End Session</p>
                        </div>
                        <button 
                            onClick={signOut}
                            className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-600 transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>

                {/* 3. SYSTEM MANIFEST (Sidebar) */}
                <div className="space-y-6">
                    <div className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-sm space-y-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full blur-3xl"></div>
                        
                        <div className="flex items-center gap-2 text-slate-400 relative z-10">
                            <Activity size={16} className="text-indigo-600" />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em]">System Manifest</h3>
                        </div>

                        <div className="space-y-4 relative z-10">
                            <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100 space-y-2">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Node Channel</span>
                                <p className="text-xs font-mono font-bold text-slate-800 break-all bg-white p-3 rounded-xl border border-slate-50">
                                    {user?.email}
                                </p>
                            </div>

                            <div className="p-5 rounded-3xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Vault Integrity</span>
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                                        <div className="absolute inset-0 w-3 h-3 bg-emerald-500 rounded-full animate-ping opacity-75"></div>
                                    </div>
                                    <p className="text-xs font-black text-indigo-900 uppercase tracking-tight italic">Status: Optimal</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="pt-6 border-t border-slate-50 relative z-10">
                            <p className="text-[10px] text-slate-400 font-bold leading-relaxed italic text-center uppercase tracking-tighter">
                                All changes are logged to the <br />
                                <span className="text-indigo-600">Institutional Audit Ledger</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}