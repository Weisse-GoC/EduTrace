import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { FileText, Send, CheckCircle2, Loader2, ArrowLeft, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function ApplicationPortal() {
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    
    // UI State
    const [view, setView] = useState('selection'); // 'selection', 'form', 'success'
    const [formType, setFormType] = useState(null); // 'RECORDS' (Form 01) or 'DIPLOMA' (Form 02)
    const [loading, setLoading] = useState(false);
    const [claimData, setClaimData] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        documentType: '',
        purpose: '',
        mobileNumber: '',
        civilStatus: 'Single',
        course: '',
        yearGraduated: '',
        degreeTitle: '', 
    });

    // Sync profile data when it loads
    useEffect(() => {
        if (profile) {
            setFormData(prev => ({
                ...prev,
                course: profile.course || '',
            }));
        }
    }, [profile]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user || !profile) return;
        setLoading(true);

        try {
            const schoolId = profile?.sharedId;
            const fullName = profile?.fullName;
            
            // Logic to ensure document_type is never empty
            const finalDocType = formType === 'DIPLOMA' ? 'DIPLOMA' : formData.documentType;

            const { error } = await supabase
                .from('student_applications')
                .insert([{
                    user_id: user.id,
                    student_id: schoolId,
                    student_name: fullName,
                    document_type: finalDocType,
                    purpose: formType === 'DIPLOMA' ? `Graduation: ${formData.degreeTitle}` : formData.purpose,
                    mobile_number: formData.mobileNumber,
                    civil_status: formData.civilStatus,
                    course: formData.course,
                    year_graduated: formData.yearGraduated,
                    degree_title: formData.degreeTitle,
                    form_source: formType === 'RECORDS' ? 'UC-RO-FORM-01' : 'UC-RO-FORM-02',
                    status: "Pending"
                }]);

            if (error) throw error;

            setClaimData({
                controlNo: Math.floor(100000 + Math.random() * 900000),
                date: new Date().toLocaleDateString(),
                displayDoc: finalDocType
            });
            setView('success');
            
        } catch (error) {
            console.error("Submission Error:", error);
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- VIEW 1: SELECTION ---
    if (view === 'selection') {
        return (
            <div className="max-w-4xl mx-auto p-8 mt-10 font-sans">
                <div className="text-center mb-12">
                    <h1 className="text-3xl font-black text-slate-800 uppercase italic tracking-tighter">Registrar Gateway</h1>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Select the required application form</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <button 
                        onClick={() => { setFormType('RECORDS'); setView('form'); }}
                        className="group p-10 bg-white border-4 border-slate-900 rounded-[3rem] hover:bg-slate-900 transition-all text-left shadow-[12px_12px_0px_0px_rgba(15,23,42,1)]"
                    >
                        <FileText size={48} className="text-indigo-600 group-hover:text-white mb-6" />
                        <h2 className="text-2xl font-black uppercase italic group-hover:text-white">School Records</h2>
                        <p className="text-[10px] font-bold uppercase text-slate-400 mt-2 group-hover:text-slate-300">TOR, Transfer Credentials, Certifications</p>
                        <span className="inline-block mt-6 px-4 py-1 bg-slate-100 rounded-full text-[9px] font-black uppercase group-hover:bg-slate-800 text-slate-900">UC-RO-FORM-01</span>
                    </button>

                    <button 
                        onClick={() => { setFormType('DIPLOMA'); setView('form'); }}
                        className="group p-10 bg-white border-4 border-slate-900 rounded-[3rem] hover:bg-slate-900 transition-all text-left shadow-[12px_12px_0px_0px_rgba(15,23,42,1)]"
                    >
                        <CheckCircle2 size={48} className="text-emerald-600 group-hover:text-white mb-6" />
                        <h2 className="text-2xl font-black uppercase italic group-hover:text-white">Diploma</h2>
                        <p className="text-[10px] font-bold uppercase text-slate-400 mt-2 group-hover:text-slate-300">Degree & Graduation Title Application</p>
                        <span className="inline-block mt-6 px-4 py-1 bg-slate-100 rounded-full text-[9px] font-black uppercase group-hover:bg-slate-800 text-slate-900">UC-RO-FORM-02</span>
                    </button>
                </div>
            </div>
        );
    }

    // --- VIEW 3: SUCCESS / CLAIM SLIP ---
    if (view === 'success' && claimData) {
        return (
            <div className="max-w-2xl mx-auto p-12 bg-white border-4 border-slate-900 rounded-[3rem] mt-10 font-sans shadow-2xl relative overflow-hidden print:shadow-none print:border-2">
                <div className="absolute top-0 right-0 p-8 opacity-10 uppercase font-black text-4xl -rotate-12 select-none">Claim Slip</div>
                
                <div className="border-b-2 border-slate-100 pb-6 mb-8">
                    <h1 className="text-xl font-black uppercase italic tracking-tighter">University of the Cordilleras</h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Official Claim Slip - Digital Copy</p>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-10">
                    <div>
                        <label className="text-[9px] font-black text-slate-300 uppercase">Control Number</label>
                        <p className="font-mono font-bold text-lg text-indigo-600">#{claimData.controlNo}</p>
                    </div>
                    <div className="text-right">
                        <label className="text-[9px] font-black text-slate-300 uppercase">Date Filed</label>
                        <p className="font-bold">{claimData.date}</p>
                    </div>
                </div>

                <div className="space-y-4 mb-10 bg-slate-50 p-6 rounded-2xl">
                   <div className="flex justify-between border-b border-slate-200 pb-2">
                        <span className="text-[10px] font-black uppercase text-slate-400">Student</span>
                        <span className="text-xs font-bold uppercase">{profile?.fullName}</span>
                   </div>
                   <div className="flex justify-between border-b border-slate-200 pb-2">
                        <span className="text-[10px] font-black uppercase text-slate-400">Document</span>
                        <span className="text-xs font-bold uppercase">{claimData.displayDoc}</span>
                   </div>
                </div>

                <div className="flex gap-4 no-print">
                    <button onClick={() => window.print()} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2">
                        <Printer size={16}/> Print Slip
                    </button>
                    <button onClick={() => navigate('/student/dashboard')} className="flex-1 py-4 border-2 border-slate-900 rounded-2xl font-black uppercase text-[10px]">
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // --- VIEW 2: DYNAMIC FORM ---
    return (
        <div className="max-w-3xl mx-auto p-8 bg-white shadow-2xl rounded-[3rem] border border-slate-50 mt-10 font-sans mb-20">
            <button onClick={() => setView('selection')} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 hover:text-indigo-600 transition-colors">
                <ArrowLeft size={14} /> Back to selection
            </button>

            <div className="flex items-center gap-4 mb-10 border-b border-slate-100 pb-8">
                <div className={`p-4 rounded-3xl text-white shadow-xl ${formType === 'RECORDS' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
                    <FileText size={32} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter italic">
                        {formType === 'RECORDS' ? 'Records Application' : 'Diploma Application'}
                    </h1>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">
                        {formType === 'RECORDS' ? 'UC-RO-FORM-01' : 'UC-RO-FORM-02'}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Mobile Number</label>
                        <input type="text" className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 outline-none font-bold" value={formData.mobileNumber} onChange={(e) => setFormData({...formData, mobileNumber: e.target.value})} required />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Course</label>
                        <input type="text" className="w-full p-4 bg-slate-50 rounded-2xl font-bold opacity-70" value={formData.course} disabled />
                    </div>
                </div>

                {/* FORM 01 SPECIFIC */}
                {formType === 'RECORDS' && (
                    <div className="space-y-6">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Document Type</label>
                        <div className="grid grid-cols-2 gap-3">
                            {['Transcript of Records', 'Transfer Credential', 'Certification', 'Authentication'].map(doc => (
                                <div key={doc} onClick={() => setFormData({...formData, documentType: doc})} className={`p-4 border-2 rounded-2xl cursor-pointer font-black text-[10px] uppercase transition-all ${formData.documentType === doc ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-400'}`}>
                                    {doc}
                                </div>
                            ))}
                        </div>
                        <input type="text" placeholder="Purpose (e.g., Employment, Board Exam)" className="w-full p-5 bg-slate-900 text-white rounded-3xl font-bold outline-none" value={formData.purpose} onChange={(e) => setFormData({...formData, purpose: e.target.value})} required />
                    </div>
                )}

                {/* FORM 02 SPECIFIC */}
                {formType === 'DIPLOMA' && (
                    <div className="space-y-6">
                        <input type="text" placeholder="Degree / Title (e.g., BS in Network Security)" className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-emerald-500 rounded-3xl font-bold outline-none" value={formData.degreeTitle} onChange={(e) => setFormData({...formData, degreeTitle: e.target.value})} required />
                        <input type="text" placeholder="Date of Graduation" className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-emerald-500 rounded-3xl font-bold outline-none" value={formData.yearGraduated} onChange={(e) => setFormData({...formData, yearGraduated: e.target.value})} required />
                    </div>
                )}

                <button type="submit" disabled={loading} className={`w-full py-6 text-white font-black uppercase tracking-widest text-xs rounded-4xl shadow-2xl transition-all ${formType === 'RECORDS' ? 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700' : 'bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700'} disabled:bg-slate-100 flex items-center justify-center gap-3`}>
                    {loading ? <Loader2 className="animate-spin" /> : <><Send size={18} /> Submit Application</>}
                </button>
            </form>
        </div>
    );
}