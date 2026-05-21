import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import {  } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { 
    User, Mail, Smartphone, Edit3, LogOut, 
    Loader2, ShieldCheck, BookOpen, Calendar, 
    Camera, Save, X 
} from 'lucide-react';

export default function StudentProfile() {
    const { user, signOut } = useAuth();
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    
    const [profile, setProfile] = useState({
        fullName: "",
        email: "",
        phoneNumber: "",
        role: "student",
        enrollmentDate: "",
        schoolId: "",
        photoURL: "" 
    });

    const [editData, setEditData] = useState({
        phoneNumber: "",
        photoURL: ""
    });

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            
            try {
                // Fetch from the profiles table linked to the Auth ID
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;

                if (data) {
                    const dateObj = new Date(data.created_at || user.created_at);
                    const dateString = dateObj.toLocaleDateString('en-US', {
                        month: 'long', day: 'numeric', year: 'numeric'
                    });

                    const combinedData = {
                        email: user.email,
                        fullName: data.full_name || "Authorized Student",
                        phoneNumber: data.phone_number || "Not Provided",
                        role: data.role || "student",
                        schoolId: data.school_id || user.id.slice(0, 8).toUpperCase(),
                        enrollmentDate: dateString,
                        photoURL: data.photo_url || ""
                    };

                    setProfile(combinedData);
                    setEditData({ 
                        phoneNumber: combinedData.phoneNumber,
                        photoURL: combinedData.photoURL 
                    });
                }
            } catch (err) {
                console.error("Profile Fetch Error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [user]);

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    phone_number: editData.phoneNumber,
                    photo_url: editData.photoURL
                })
                .eq('id', user.id);

            if (error) throw error;

            setProfile(prev => ({ 
                ...prev, 
                phoneNumber: editData.phoneNumber,
                photoURL: editData.photoURL 
            }));
            setIsEditing(false);
        } catch (error) {
            console.error("Save Error:", error);
            // TODO: Add proper error toast notification
        } finally {
            setLoading(false);
        }
    };

    if (loading && !isEditing) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[#f8fafc]">
                <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
                <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px] italic">Accessing Ledger...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans">
            <div className="max-w-5xl mx-auto">
                {/* HEADER */}
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">
                            Account <span className="text-indigo-600">Profile</span>
                        </h1>
                        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">Validated Student Node</p>
                    </div>
                    <button 
                        onClick={() => setIsEditing(!isEditing)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${
                            isEditing ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-indigo-600 text-white shadow-xl hover:bg-indigo-700'
                        }`}
                    >
                        {isEditing ? <><X size={14}/> Cancel</> : <><Edit3 size={14}/> Edit Profile</>}
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* LEFT COLUMN: THE ID CARD */}
                    <div className="lg:col-span-1">
                        <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group border-b-12 border-indigo-900">
                            {/* Decorative Background Icon */}
                            <div className="absolute -top-10 -right-10 p-8 opacity-10 rotate-12">
                                <ShieldCheck size={200} />
                            </div>
                            
                            <div className="relative z-10 flex flex-col items-center">
                                <div className="w-32 h-32 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border-4 border-white/20 mb-6 relative overflow-hidden shadow-inner">
                                    {profile.photoURL ? (
                                        <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={60} className="text-white/30" />
                                    )}
                                    {isEditing && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center cursor-pointer group-hover:bg-black/70 transition-all">
                                            <Camera size={24} className="text-white" />
                                        </div>
                                    )}
                                </div>
                                <h2 className="text-xl font-black text-center leading-tight mb-1 uppercase tracking-tighter">{profile.fullName}</h2>
                                <p className="text-indigo-200 font-bold text-[10px] tracking-[0.2em] uppercase mb-8">{profile.role}</p>
                                
                                <div className="bg-white p-4 rounded-3xl shadow-2xl mb-8 transform transition-transform hover:scale-105">
                                    {/* QR Code for offline verification by school security */}
                                    <QRCodeSVG value={`STUDENT_ID:${profile.schoolId}`} size={140} level="H" includeMargin={true} />
                                </div>
                                
                                <div className="w-full space-y-3 bg-black/10 p-5 rounded-2xl backdrop-blur-sm">
                                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-indigo-200">
                                        <span>Node ID</span>
                                        <span className="text-white font-mono">{profile.schoolId}</span>
                                    </div>
                                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-indigo-200">
                                        <span>Network Status</span>
                                        <span className="bg-emerald-400 text-emerald-950 px-2 py-0.5 rounded flex items-center gap-1 font-black">
                                            AUTHORIZED
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={signOut}
                            className="w-full mt-6 flex items-center justify-center gap-3 p-4 bg-white text-rose-500 font-black uppercase text-[10px] tracking-widest rounded-2xl border border-slate-100 hover:bg-rose-50 transition-all shadow-sm"
                        >
                            <LogOut size={16} /> Terminate Session
                        </button>
                    </div>

                    {/* RIGHT COLUMN: DATA FORM */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100">
                            <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-10 flex items-center gap-3">
                                <BookOpen size={16} /> Identity Metadata
                            </h3>

                            <form onSubmit={handleSave} className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                        <div className="relative">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                            <input 
                                                disabled
                                                value={profile.fullName}
                                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-400 cursor-not-allowed italic"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-1">Contact Link</label>
                                        <div className="relative">
                                            <Smartphone className={`absolute left-4 top-1/2 -translate-y-1/2 ${isEditing ? 'text-indigo-600' : 'text-slate-300'}`} size={18} />
                                            <input 
                                                disabled={!isEditing}
                                                value={isEditing ? editData.phoneNumber : profile.phoneNumber}
                                                onChange={(e) => setEditData({ ...editData, phoneNumber: e.target.value })}
                                                className={`w-full pl-12 pr-4 py-4 border-2 rounded-2xl transition-all font-bold text-slate-700 outline-none
                                                    ${isEditing ? 'bg-white border-indigo-100 focus:border-indigo-600' : 'bg-slate-50 border-transparent'}`}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Verified Email</label>
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                            <input 
                                                disabled
                                                value={profile.email}
                                                className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl font-bold text-slate-400 cursor-not-allowed"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Entry Timestamp</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                            <input 
                                                disabled
                                                value={profile.enrollmentDate}
                                                className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl font-bold text-slate-400 cursor-not-allowed"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {isEditing && (
                                    <button 
                                        type="submit"
                                        className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] shadow-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 mt-4"
                                    >
                                        <Save size={18} /> Commit Changes to Cloud
                                    </button>
                                )}
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}