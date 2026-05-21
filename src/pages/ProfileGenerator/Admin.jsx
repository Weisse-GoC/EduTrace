import { useState } from "react";
import { supabase } from "../../services/supabaseClient"; 
import { UserPlus, Fingerprint, User, GraduationCap, Loader2, ShieldCheck } from "lucide-react";

export default function Admin() {
    const [formData, setFormData] = useState({
        schoolId: "",
        fullName: "",
        role: "student",
        course: "BSIT-Network and Security" 
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: "", text: "" });

        const schoolIdUpper = formData.schoolId.trim().toUpperCase();
        const generatedEmail = `${schoolIdUpper.toLowerCase()}@uc-bcf.edu.ph`;
        
        // In a real institutional app, you'd typically send a reset link,
        // but for development, we use a default password.
        const defaultPassword = "password123";

        try {
            /**
             * STEP 1: AUTH SIGNUP
             * We pass 'full_name', 'school_id', 'role', and 'course' in metadata.
             * The Database Trigger (on_auth_user_created) will see this metadata
             * and automatically populate 'profiles' and 'student/staff_records'.
             */
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: generatedEmail,
                password: defaultPassword,
                options: {
                    data: {
                        full_name: formData.fullName,
                        school_id: schoolIdUpper,
                        role: formData.role,
                        course: formData.role === 'student' ? formData.course : null
                    }
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("User creation failed.");

            setMessage({ 
                type: "success", 
                text: `Account Provisioned: ${schoolIdUpper}` 
            });
            
            // Clear identity fields but keep the course for batch processing
            setFormData(prev => ({ ...prev, schoolId: "", fullName: "" }));

        } catch (error) {
            console.error("Admin Provisioning Error:", error);
            setMessage({ 
                type: "error", 
                text: error.message || "Failed to create user."
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto p-8">
            <div className="text-center mb-8">
                <div className="inline-flex p-3 bg-indigo-50 rounded-2xl mb-4 text-indigo-600">
                    <ShieldCheck size={32} />
                </div>
                <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter italic">User Provisioning</h1>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">Institutional Control Panel</p>
            </div>

            <form onSubmit={handleCreateUser} className="bg-white p-8 rounded-4xl shadow-2xl shadow-slate-200/50 border border-slate-100 space-y-6">
                
                {/* School ID Input */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Institutional School ID</label>
                    <div className="relative">
                        <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                        <input 
                            type="text" required placeholder="e.g., 20-1234-567"
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl font-bold outline-none transition-all text-sm"
                            value={formData.schoolId}
                            onChange={(e) => setFormData({...formData, schoolId: e.target.value})}
                        />
                    </div>
                </div>

                {/* Name Input */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Full Legal Name</label>
                    <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                        <input 
                            type="text" required placeholder="John M. Doe"
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl font-bold outline-none transition-all text-sm"
                            value={formData.fullName}
                            onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                        />
                    </div>
                </div>

                {/* Role Toggle */}
                <div className="p-1.5 bg-slate-50 rounded-2xl grid grid-cols-3 gap-2">
                    <button 
                        type="button"
                        onClick={() => setFormData({...formData, role: 'student'})}
                        className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${formData.role === 'student' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                    >
                        Student
                    </button>
                    <button 
                        type="button"
                        onClick={() => setFormData({...formData, role: 'staff'})}
                        className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${formData.role === 'staff' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                    >
                        Staff
                    </button>
                    <button 
                        type="button"
                        onClick={() => setFormData({...formData, role: 'head'})}
                        className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${formData.role === 'head' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                    >
                        Head
                    </button>
                </div>

                {/* Conditional Course Input */}
                {formData.role === 'student' && (
                    <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Degree Program / Course</label>
                        <div className="relative">
                            <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input 
                                type="text"
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl font-bold outline-none transition-all text-sm"
                                value={formData.course}
                                onChange={(e) => setFormData({...formData, course: e.target.value})}
                            />
                        </div>
                    </div>
                )}

                {/* Submit Button */}
                <button 
                    type="submit" disabled={loading}
                    className="w-full py-5 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <><UserPlus size={18}/> Provision Account</>}
                </button>

                {/* Feedback Message */}
                {message.text && (
                    <div className={`p-4 rounded-2xl text-center text-[10px] font-black uppercase tracking-[0.2em] border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                        {message.text}
                    </div>
                )}
            </form>
        </div>
    );
}
