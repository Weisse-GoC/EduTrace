import { useState } from 'react';
import { CheckCircle2, FileSearch, XCircle, Clock, ShieldCheck, Upload, FileCheck } from 'lucide-react';

const StaffRequestCard = ({ 
    req, 
    isExpanded, 
    onToggleExpand, 
    onToggleClearance, 
    onUpdateStatus,
    updatingClearance
}) => {
    // --- LOCAL STATE FOR MANUAL UPLOAD ---
    const [selectedFile, setSelectedFile] = useState(null);

    const record = req.student_records || {};
    const studentName = record.full_name || req.student_name || "Unknown Student";
    const studentId = record.student_id || req.student_id || "N/A";
    const status = req.status?.toLowerCase();

    // FIXED: Removed dangling documentType comparison
    const isFullyCleared = 
        req.is_cleared_accounting && 
        req.is_cleared_library && 
        req.is_cleared_dean && 
        req.is_cleared_registrar;

    return (
        <div 
            className={`group bg-white rounded-[3.5rem] transition-all duration-500 border-2 ${
                isExpanded ? 'border-indigo-500 shadow-2xl scale-[1.01]' : 'border-transparent shadow-sm hover:shadow-md'
            }`}
        >
            {/* CARD HEADER */}
            <div className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-8 flex-1">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-3xl bg-slate-900 flex items-center justify-center text-white italic font-black text-xl shadow-lg">
                            {studentName.charAt(0)}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-white ${
                            status === 'verified' ? 'bg-emerald-500' : 
                            status === 'minted' || status === 'issued' ? 'bg-indigo-600' : 
                            status === 'rejected' ? 'bg-red-500' : 'bg-amber-400'
                        }`} />
                    </div>
                    <div>
                        <h3 className="font-black text-2xl text-slate-800 uppercase italic tracking-tighter leading-none group-hover:text-indigo-600 transition-colors">
                            {studentName}
                        </h3>
                        <div className="flex items-center gap-3 mt-3">
                            <span className="text-[9px] font-black uppercase px-3 py-1.5 bg-slate-100 rounded-lg text-slate-500 tracking-wider">
                                SN: {studentId}
                            </span>
                            <span className="text-[9px] font-black uppercase px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg tracking-wider">
                                {req.document_type || 'General Request'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button 
                        onClick={onToggleExpand}
                        className="px-8 py-4 bg-slate-50 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-slate-900 hover:text-white transition-all duration-300"
                    >
                        <FileSearch size={16}/> {isExpanded ? 'Minimize' : 'Verify Details'}
                    </button>
                    
                    <div className={`min-w-30 text-center px-6 py-4 rounded-2xl font-black uppercase text-[10px] text-white shadow-lg ${
                        status === 'verified' ? 'bg-emerald-500 shadow-emerald-100' : 
                        status === 'rejected' ? 'bg-red-500 shadow-red-100' : 
                        status === 'minted' || status === 'issued' ? 'bg-indigo-600 shadow-indigo-100' : 'bg-amber-400 shadow-amber-100'
                    }`}>
                        {req.status}
                    </div>
                </div>
            </div>

            {/* EXPANDED PANEL */}
            {isExpanded && (
                <div className="p-10 bg-slate-50/50 rounded-b-[3.5rem] border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        
                        {/* LEFT COLUMN: CLEARANCE SECTION */}
                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-2">
                                <ShieldCheck size={14} className="text-indigo-500" />
                                Step 1: Institutional Clearance
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {[
                                    { label: 'Accounting Dept', field: 'is_cleared_accounting' },
                                    { label: 'University Library', field: 'is_cleared_library' },
                                    { label: 'Dean\'s Office', field: 'is_cleared_dean' },
                                    { label: 'Registrar Review', field: 'is_cleared_registrar' }
                                ].map((dept) => {
                                    const isUpdating = updatingClearance === `${req.application_id}:${dept.field}`;
                                    return (
                                        <button 
                                            key={dept.field}
                                            disabled={status !== 'pending' || isUpdating}
                                            onClick={() => onToggleClearance(req.application_id, dept.field, req[dept.field])}
                                            className={`p-5 rounded-2xl border-2 flex items-center justify-between transition-all duration-300 ${
                                                req[dept.field] 
                                                ? 'bg-white border-emerald-500 text-emerald-600 shadow-md' 
                                                : 'bg-white/50 border-slate-200 text-slate-400 grayscale'
                                            } ${status !== 'pending' || isUpdating ? 'cursor-default opacity-80' : 'hover:border-indigo-300 hover:scale-[1.02]'}`}
                                        >
                                            <span className="font-black text-[10px] uppercase italic tracking-tight text-left">{dept.label}</span>
                                            {isUpdating ? <Clock size={18} className="animate-spin" /> : req[dept.field] ? <CheckCircle2 size={18} /> : <div className="w-4 h-4 rounded-full border-2 border-slate-200" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: DECISION CENTER & UPLOAD */}
                        <div className="flex flex-col justify-end space-y-4">
                            {status === 'pending' ? (
                                <div className="space-y-4">
                                    {isFullyCleared ? (
                                        <div className="bg-white p-6 rounded-3xl border-2 border-indigo-100 shadow-xl shadow-indigo-50/50 animate-in zoom-in-95 duration-500">
                                            <p className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-4 flex items-center gap-2">
                                                <Upload size={14} /> Step 2: Final Document Upload
                                            </p>
                                            
                                            <label className={`flex items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                                                selectedFile ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-indigo-400'
                                            }`}>
                                                <input 
                                                    type="file" 
                                                    className="hidden" 
                                                    accept=".pdf" 
                                                    onChange={(e) => setSelectedFile(e.target.files[0])} 
                                                />
                                                {selectedFile ? <FileCheck size={24} className="animate-bounce" /> : <Upload size={24} />}
                                                <span className="font-black text-xs uppercase tracking-tighter">
                                                    {selectedFile ? selectedFile.name : 'Select PDF to Upload'}
                                                </span>
                                            </label>

                                            <div className="flex gap-3 mt-6">
                                                <button 
                                                    disabled={!selectedFile}
                                                    onClick={() => onUpdateStatus(req.application_id, 'Verified', studentName, studentId, req.user_id, selectedFile)}
                                                    className="flex-1 py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl hover:bg-indigo-600 transition-all disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed"
                                                >
                                                    Push to Head
                                                </button>
                                                <button 
                                                    onClick={() => onUpdateStatus(req.application_id, 'Rejected', studentName, studentId, req.user_id)}
                                                    className="px-6 py-5 border-2 border-slate-100 text-slate-300 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] hover:border-red-500 hover:text-red-500 transition-all"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-12 rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center text-center">
                                            <Clock className="text-slate-200 mb-4" size={48} />
                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Complete clearances to unlock upload</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className={`p-8 rounded-4xl border-2 text-center flex flex-col items-center gap-3 ${
                                    status === 'verified' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                    status === 'rejected' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                                }`}>
                                    {status === 'rejected' ? <XCircle size={32} /> : <CheckCircle2 size={32} />}
                                    <p className="font-black uppercase text-xs tracking-[0.2em]">
                                        {status === 'verified' ? 'Awaiting Head Review' : status === 'rejected' ? 'Application Refused' : 'Application Processed'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffRequestCard;