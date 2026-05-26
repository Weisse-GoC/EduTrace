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
    // --- MULTI-FILE STATE MAPPING ---
    const [cardFiles, setCardFiles] = useState({}); // Stores filename structures like: { [docName]: File }

    const record = req.student_records || {};
    const studentName = record.full_name || req.student_name || "Unknown Student";
    const studentId = record.student_id || req.student_id || "N/A";
    const status = req.status?.toLowerCase();

    // Clearance fields mapped directly to your database schema columns
    const isFullyCleared = 
        req.is_cleared_accounting && 
        req.is_cleared_library && 
        req.is_cleared_dean && 
        req.is_cleared_registrar;

    // Helper engine to break up strings like "Certification: Transcript, Diploma" into clean string matrices
    const getRequiredDocsList = (docTypeString) => {
        if (!docTypeString) return ["Document"];
        if (docTypeString.toUpperCase().includes("CERTIFICATION:")) {
            const parts = docTypeString.split(/:/i);
            if (parts[1]) {
                return parts[1].split(",").map(item => item.trim()).filter(Boolean);
            }
        }
        return [docTypeString];
    };

    const targetDocs = getRequiredDocsList(req.document_type);
    const totalUploadedCount = Object.keys(cardFiles).filter(key => cardFiles[key]).length;
    const isComplete = totalUploadedCount === targetDocs.length;

    const handleLocalFileChange = (docName, file) => {
        if (file && file.type !== "application/pdf") {
            alert("Please upload standard PDF documents only.");
            return;
        }
        setCardFiles(prev => ({ ...prev, [docName]: file }));
    };

    const handlePushToHead = () => {
        if (!isComplete) return;
        // Pass down the files map back up to the parent dashboard handleUpdateStatus logic block
        onUpdateStatus(req.application_id, 'Verified', studentName, studentId, req.user_id, cardFiles);
    };

    return (
        <div 
            className={`group bg-white rounded-[3.5rem] transition-all duration-500 border-2 ${
                isExpanded ? 'border-indigo-500 shadow-2xl scale-[1.01]' : 'border-transparent shadow-sm hover:shadow-md'
            }`}
        >
            {/* CARD HEADER */}
            <div className="p-8 flex flex-col md:flex-row items-center justify-between gap-6" onClick={onToggleExpand}>
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
                        <div className="flex items-center gap-3 mt-3" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[9px] font-black uppercase px-3 py-1.5 bg-slate-100 rounded-lg text-slate-500 tracking-wider">
                                SN: {studentId}
                            </span>
                            <span className="text-[9px] font-black uppercase px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg tracking-wider">
                                {req.document_type || 'General Request'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
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

                        {/* RIGHT COLUMN: MULTI-DOCUMENT DECISION CENTER & UPLOAD */}
                        <div className="flex flex-col justify-end space-y-4">
                            {status === 'pending' ? (
                                <div className="space-y-4">
                                    {isFullyCleared ? (
                                        <div className="bg-white p-6 rounded-3xl border-2 border-indigo-100 shadow-xl shadow-indigo-50/50 animate-in zoom-in-95 duration-500">
                                            <p className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-4 flex items-center gap-2">
                                                <Upload size={14} /> Step 2: Final Document Upload ({totalUploadedCount}/{targetDocs.length})
                                            </p>
                                            
                                            {/* Scrollable multi-document view workspace segment */}
                                            <div className="space-y-2 max-h-[220px] overflow-y-auto mb-4 pr-1">
                                                {targetDocs.map((docName) => {
                                                    const fileAttached = cardFiles[docName];
                                                    return (
                                                        <div 
                                                            key={docName} 
                                                            className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all duration-200 ${
                                                                fileAttached 
                                                                ? 'border-emerald-500 bg-emerald-50/30 text-emerald-900' 
                                                                : 'border-slate-100 bg-slate-50/50 text-slate-700'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                                {fileAttached ? (
                                                                    <FileCheck size={16} className="text-emerald-500 shrink-0" />
                                                                ) : (
                                                                    <Upload size={16} className="text-slate-300 shrink-0" />
                                                                )}
                                                                <div className="truncate">
                                                                    <p className="text-[10px] font-black uppercase text-slate-700 truncate">{docName}</p>
                                                                    {fileAttached && (
                                                                        <p className="text-[9px] font-bold text-emerald-600 truncate mt-0.5">
                                                                            ✓ {fileAttached.name}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <label className="cursor-pointer bg-slate-900 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-wide hover:bg-indigo-600 transition-colors shrink-0 ml-2">
                                                                <input 
                                                                    type="file" 
                                                                    className="hidden" 
                                                                    accept=".pdf" 
                                                                    onChange={(e) => handleLocalFileChange(docName, e.target.files[0])} 
                                                                />
                                                                {fileAttached ? 'Change' : 'Upload'}
                                                            </label>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            <div className="flex gap-3">
                                                <button 
                                                    disabled={!isComplete}
                                                    onClick={handlePushToHead}
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