import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../services/supabaseClient'; 
import { useAuth } from '../../../hooks/useAuth';
import { ShieldCheck, Loader2, KeyRound, UserCircle } from 'lucide-react';

export default function Login() {
    const navigate = useNavigate();
    // FIXED: The AuthProvider exports 'loading', not 'authLoading'
    const { user, role, loading } = useAuth(); 
    
    const [idInput, setIdInput] = useState(''); 
    const [password, setPassword] = useState('');
    const [localLoading, setLocalLoading] = useState(false); // Renamed to avoid conflict with auth loading
    const [error, setError] = useState('');

    // --- REDIRECT GUARD ---
    useEffect(() => {
        // Only redirect if auth is NOT loading and we have a confirmed user/role
        if (!loading && user && role) {
            const userRole = role.toLowerCase();
            const dashboardMap = {
                student: '/student/dashboard',
                staff: '/staff/dashboard',
                head: '/head/dashboard',
                admin: '/admin/dashboard'
            };
            
            const target = dashboardMap[userRole] || '/';
            console.log(`User already logged in as ${userRole}. Redirecting...`);
            navigate(target, { replace: true });
        }
    }, [user, role, loading, navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLocalLoading(true);
        setError('');
        
        try {
            // 1. DATABASE LOOKUP
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('email')
                .eq('school_id', idInput.trim().toUpperCase())
                .single();

            if (profileError || !profileData) {
                throw new Error("University ID not found. Please contact the Registrar.");
            }

            // 2. SUPABASE AUTHENTICATION
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: profileData.email,
                password: password,
            });
            
            if (authError) throw authError;

            // Success! AuthContext will trigger the redirect via the useEffect above.
            
        } catch (err) {
            console.error("Login Error:", err);
            
            if (err.message.includes("Invalid login credentials")) {
                setError("Invalid ID or password. Please try again.");
            } else if (err.message.includes("Email not confirmed")) {
                setError("Account exists but email is not verified.");
            } else {
                setError(err.message || "An error occurred during sign-in.");
            }
            setLocalLoading(false); 
        }
    };

    // If the AUTH is loading (checking session), show a small indicator or nothing
    if (loading && !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4 font-sans relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600"></div>
            
            <div className="w-full max-w-md bg-white p-8 md:p-12 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] border border-gray-100 relative z-10">
                
                <div className="flex flex-col items-center mb-10 text-center">
                    <div className="w-16 h-16 bg-indigo-50 rounded-3xl flex items-center justify-center mb-4 shadow-sm shadow-indigo-100">
                        <ShieldCheck className="text-indigo-600" size={32} />
                    </div>
                    <h2 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic">
                        EduTrace<span className="text-indigo-600">.</span>
                    </h2>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-2">
                        Institutional Verification Portal
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 rounded-xl flex items-center gap-3">
                        <p className="text-rose-700 font-bold text-[10px] uppercase tracking-tight">{error}</p>
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                            <UserCircle size={14} /> University ID Number
                        </label>
                        <input 
                            type="text" 
                            placeholder="e.g. 21-4070-481"
                            autoComplete="username"
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all font-mono text-slate-700 placeholder:text-slate-300"
                            value={idInput}
                            onChange={(e) => setIdInput(e.target.value)}
                            required 
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                            <KeyRound size={14} /> Portal Password
                        </label>
                        <input 
                            type="password" 
                            placeholder="••••••••"
                            autoComplete="current-password"
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all text-slate-700 placeholder:text-slate-300"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required 
                        />
                    </div>

                    <button 
                        type="submit"
                        disabled={localLoading}
                        className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-indigo-600 active:scale-[0.98] transition-all flex justify-center items-center gap-2 shadow-xl shadow-indigo-100 disabled:bg-slate-200 disabled:text-slate-400 mt-4"
                    >
                        {localLoading ? (
                            <><Loader2 className="animate-spin" size={18} /> Authenticating</>
                        ) : (
                            "Sign In to Portal"
                        )}
                    </button>
                </form>

                <div className="mt-10 text-center">
                    <button 
                        type="button"
                        onClick={() => alert("Please visit the ICT office or contact support.")}
                        className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hover:text-indigo-600 transition-colors"
                    >
                        Trouble logging in?
                    </button>
                </div>
            </div>

            <div className="absolute bottom-6 text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">
                Secure Blockchain Infrastructure
            </div>
        </div>
    );
}