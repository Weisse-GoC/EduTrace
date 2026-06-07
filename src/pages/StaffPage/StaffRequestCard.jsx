// src/pages/StaffPage/StaffRequestCard.jsx
import { useState } from 'react';
import {
    CheckCircle2, FileSearch, XCircle, Clock,
    ShieldCheck, Upload, FileCheck, Send, Zap
} from 'lucide-react';

const StaffRequestCard = ({
    req = {},
    isExpanded,
    onToggleExpand,
    onToggleClearance,
    onUpdateStatus,
    onMintAsset,
    updatingClearance,
}) => {
    const [cardFiles, setCardFiles] = useState({});
    const [isProcessing, setIsProcessing] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejectInput, setShowRejectInput] = useState(false);

    const record      = req.student_records || {};
    const studentName = record.full_name  || req.student_name || "Unknown Student";
    const studentId   = record.student_id || req.student_id   || "N/A";

    const status = req.status?.toLowerCase() || 'pending';

    const docTypeString = req.document_type?.toLowerCase() || '';

    const requiresHeadReview =
        docTypeString.includes('transcript') ||
        docTypeString.includes('grades')     ||
        docTypeString.includes('diploma');

    const isFullyCleared =
        req.is_cleared_accounting &&
        req.is_cleared_library    &&
        req.is_cleared_dean       &&
        req.is_cleared_registrar;

    const getRequiredDocsList = (inputStr) => {
        if (!inputStr) return ["Document"];
        if (inputStr.toUpperCase().includes("CERTIFICATION:")) {
            const parts = inputStr.split(/:/i);
            if (parts[1]) return parts[1].split(",").map(s => s.trim()).filter(Boolean);
        }
        return [inputStr];
    };

    const targetDocs         = getRequiredDocsList(req.document_type);
    const totalUploadedCount = Object.keys(cardFiles).filter(k => cardFiles[k]).length;
    const isComplete         = totalUploadedCount === targetDocs.length;

    const handleLocalFileChange = (docName, file, event) => {
        if (file && file.type !== "application/pdf") {
            alert("Please upload standard PDF documents only.");
            if (event) event.target.value = '';
            return;
        }
        setCardFiles(prev => ({ ...prev, [docName]: file }));
        if (event) event.target.value = '';
    };

    const handlePushToHead = async () => {
        if (!isComplete) return;
        setIsProcessing(true);
        try {
            await onUpdateStatus(
                req.application_id, 'Verified',
                studentName, studentId, req.user_id,
                cardFiles
            );
        } catch (err) {
            console.error("Push to Head failed:", err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePushForIssuance = async () => {
        if (!isComplete) return;
        setIsProcessing(true);
        try {
            await onUpdateStatus(
                req.application_id, 'To_be_Issued',
                studentName, studentId, req.user_id,
                cardFiles
            );
        } catch (err) {
            console.error("Push for Issuance failed:", err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFinalIssuance = async () => {
        setIsProcessing(true);
        try {
            if (onMintAsset) {
                await onMintAsset(req.application_id);
            } else {
                await onUpdateStatus(
                    req.application_id, 'L1_Issued',
                    studentName, studentId, req.user_id, {}
                );
            }
        } catch (err) {
            console.error("Minting failed:", err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = () => {
        if (!showRejectInput) return setShowRejectInput(true);
        if (!rejectionReason.trim()) return;
        onUpdateStatus(req.application_id, 'Rejected', studentName, studentId, req.user_id, { rejectionReason });
    };

    // Reusable reject block
    const rejectBlock = (
        <div className="flex flex-col gap-2">
            {showRejectInput && (
                <textarea
                    rows={2}
                    placeholder="Reason for rejection..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full p-3 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-red-300 resize-none"
                />
            )}
            <button
                disabled={isProcessing}
                onClick={handleReject}
                className="px-6 py-5 border-2 border-slate-100 text-slate-300 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] hover:border-red-500 hover:text-red-500 transition-all disabled:opacity-40"
            >
                {showRejectInput ? 'Confirm Reject' : 'Reject'}
            </button>
        </div>
    );

    const dotColor = {
        verified:     'bg-emerald-500',
        to_be_issued: 'bg-sky-500',
        rejected:     'bg-red-500',
        minted:       'bg-indigo-600',
        issued:       'bg-indigo-600',
        l1_issued:    'bg-indigo-600',
    }[status] || 'bg-amber-400';

    const badgeColor = {
        verified:     'bg-emerald-500 shadow-emerald-100',
        to_be_issued: 'bg-sky-500 shadow-sky-100',
        rejected:     'bg-red-500 shadow-red-100',
        minted:       'bg-indigo-600 shadow-indigo-100',
        issued:       'bg-indigo-600 shadow-indigo-100',
        l1_issued:    'bg-indigo-600 shadow-indigo-100',
    }[status] || 'bg-amber-400 shadow-amber-100';

    return (
        <div className={`group bg-white rounded-[3.5rem] transition-all duration-500 border-2 ${
            isExpanded
                ? 'border-indigo-500 shadow-2xl scale-[1.01]'
                : 'border-transparent shadow-sm hover:shadow-md'
        }`}>

            {/* ── Card header ─────────────────────────────────────────────── */}
            <div
                className="p-8 flex flex-col md:flex-row items-center justify-between gap-6 cursor-pointer"
                onClick={onToggleExpand}
            >
                <div className="flex items-center gap-8 flex-1">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-3xl bg-slate-900 flex items-center justify-center text-white italic font-black text-xl shadow-lg">
                            {studentName.charAt(0)}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-white ${dotColor}`} />
                    </div>

                    <div>
                        <h3 className="font-black text-2xl text-slate-800 uppercase italic tracking-tighter leading-none group-hover:text-indigo-600 transition-colors">
                            {studentName}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 mt-3" onClick={e => e.stopPropagation()}>
                            <span className="text-[9px] font-black uppercase px-3 py-1.5 bg-slate-100 rounded-lg text-slate-500 tracking-wider">
                                SN: {studentId}
                            </span>
                            <span className="text-[9px] font-black uppercase px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg tracking-wider">
                                {req.document_type || 'General Request'}
                            </span>
                            {requiresHeadReview && (
                                <span className="text-[9px] font-black uppercase px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg tracking-wider border border-amber-200">
                                    Head Review Required
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={onToggleExpand}
                        className="px-8 py-4 bg-slate-50 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-slate-900 hover:text-white transition-all duration-300"
                    >
                        <FileSearch size={16} />
                        {isExpanded ? 'Minimize' : 'Verify Details'}
                    </button>

                    <div className={`min-w-32 text-center px-6 py-4 rounded-2xl font-black uppercase text-[10px] text-white shadow-lg ${badgeColor}`}>
                        {req.status || 'Pending'}
                    </div>
                </div>
            </div>

            {/* ── Expanded panel ──────────────────────────────────────────── */}
            {isExpanded && (
                <div className="p-10 bg-slate-50/50 rounded-b-[3.5rem] border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

                        {/* LEFT — Clearance toggles */}
                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-2">
                                <ShieldCheck size={14} className="text-indigo-500" />
                                Step 1: Institutional Clearance
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {[
                                    { label: 'Accounting Dept',    field: 'is_cleared_accounting' },
                                    { label: 'University Library',  field: 'is_cleared_library' },
                                    { label: "Dean's Office",       field: 'is_cleared_dean' },
                                    { label: 'Registrar Review',    field: 'is_cleared_registrar' },
                                ].map(dept => {
                                    const isUpdating = updatingClearance === `${req.application_id}:${dept.field}`;
                                    const isCleared  = !!req[dept.field];

                                    return (
                                        <button
                                            key={dept.field}
                                            disabled={status !== 'pending' || isUpdating || isProcessing}
                                            onClick={() => onToggleClearance(req.application_id, dept.field, req[dept.field])}
                                            className={`p-5 rounded-2xl border-2 flex items-center justify-between transition-all duration-300 ${
                                                isCleared
                                                    ? 'bg-white border-emerald-500 text-emerald-600 shadow-md'
                                                    : 'bg-white/50 border-slate-200 text-slate-400 grayscale'
                                            } ${status !== 'pending' || isUpdating || isProcessing
                                                ? 'cursor-default opacity-80'
                                                : 'hover:border-indigo-300 hover:scale-[1.02]'
                                            }`}
                                        >
                                            <span className="font-black text-[10px] uppercase italic tracking-tight text-left">
                                                {dept.label}
                                            </span>
                                            {isUpdating
                                                ? <Clock size={18} className="animate-spin" />
                                                : isCleared
                                                    ? <CheckCircle2 size={18} />
                                                    : <div className="w-4 h-4 rounded-full border-2 border-slate-200" />
                                            }
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* RIGHT — Decision center */}
                        <div className="flex flex-col justify-end">

                            {status === 'pending' && isFullyCleared ? (

                                requiresHeadReview ? (
                                    <div className="bg-white p-6 rounded-3xl border-2 border-amber-100 shadow-xl shadow-amber-50/50 animate-in zoom-in-95 duration-500">
                                        <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest mb-4 flex items-center gap-2">
                                            <Upload size={14} /> Step 2: Attach & Forward ({totalUploadedCount}/{targetDocs.length})
                                        </p>

                                        <div className="space-y-2 max-h-56 overflow-y-auto mb-4 pr-1">
                                            {targetDocs.map((docName, index) => {
                                                const fileAttached = cardFiles[docName];
                                                return (
                                                    <div
                                                        key={`${docName}-${index}`}
                                                        className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all duration-200 ${
                                                            fileAttached
                                                                ? 'border-emerald-500 bg-emerald-50/30'
                                                                : 'border-slate-100 bg-slate-50/50'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                            {fileAttached
                                                                ? <FileCheck size={16} className="text-emerald-500 shrink-0" />
                                                                : <Upload size={16} className="text-slate-300 shrink-0" />
                                                            }
                                                            <div className="truncate">
                                                                <p className="text-[10px] font-black uppercase text-slate-700 truncate">
                                                                    {docName}
                                                                </p>
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
                                                                disabled={isProcessing}
                                                                onChange={e => handleLocalFileChange(docName, e.target.files[0], e)}
                                                            />
                                                            {fileAttached ? 'Change' : 'Upload'}
                                                        </label>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-4">
                                            Files upload to IPFS, then head reviews and authorises minting.
                                        </p>
                                        <div className="flex gap-3">
                                            <button
                                                disabled={!isComplete || isProcessing}
                                                onClick={handlePushToHead}
                                                className="flex-1 py-5 bg-slate-900 hover:bg-amber-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                {isProcessing
                                                    ? <><Clock size={16} className="animate-spin" /> Uploading to IPFS...</>
                                                    : <><Send size={16} /> Push to Head</>
                                                }
                                            </button>
                                            {rejectBlock}
                                        </div>
                                    </div>

                                ) : (

                                    <div className="bg-white p-6 rounded-3xl border-2 border-indigo-100 shadow-xl shadow-indigo-50/50 animate-in zoom-in-95 duration-500">
                                        <p className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-4 flex items-center gap-2">
                                            <Upload size={14} /> Step 2: Attach Documents ({totalUploadedCount}/{targetDocs.length})
                                        </p>

                                        <div className="space-y-2 max-h-56 overflow-y-auto mb-4 pr-1">
                                            {targetDocs.map((docName, index) => {
                                                const fileAttached = cardFiles[docName];
                                                return (
                                                    <div
                                                        key={`${docName}-${index}`}
                                                        className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all duration-200 ${
                                                            fileAttached
                                                                ? 'border-emerald-500 bg-emerald-50/30'
                                                                : 'border-slate-100 bg-slate-50/50'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                            {fileAttached
                                                                ? <FileCheck size={16} className="text-emerald-500 shrink-0" />
                                                                : <Upload size={16} className="text-slate-300 shrink-0" />
                                                            }
                                                            <div className="truncate">
                                                                <p className="text-[10px] font-black uppercase text-slate-700 truncate">
                                                                    {docName}
                                                                </p>
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
                                                                disabled={isProcessing}
                                                                onChange={e => handleLocalFileChange(docName, e.target.files[0], e)}
                                                            />
                                                            {fileAttached ? 'Change' : 'Upload'}
                                                        </label>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                disabled={!isComplete || isProcessing}
                                                onClick={handlePushForIssuance}
                                                className="flex-1 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-indigo-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                {isProcessing
                                                    ? <><Clock size={16} className="animate-spin" /> Uploading to IPFS...</>
                                                    : <><Upload size={16} /> Push for Issuance</>
                                                }
                                            </button>
                                            {rejectBlock}
                                        </div>
                                    </div>
                                )

                            ) : status === 'to_be_issued' ? (

                                <div className="bg-white p-6 rounded-3xl border-2 border-emerald-100 shadow-xl shadow-emerald-50/50 animate-in zoom-in-95 duration-500">
                                    <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest mb-2 flex items-center gap-2">
                                        <Zap size={14} /> Step 3: Authorise & Mint
                                    </p>
                                    <p className="text-slate-500 font-bold text-[11px] leading-relaxed mb-5">
                                        Document is IPFS-secured and staged. Authorise blockchain minting
                                        to deliver the credential directly to the student's wallet.
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            disabled={isProcessing}
                                            onClick={handleFinalIssuance}
                                            className="flex-1 py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-emerald-500/30 transition-all duration-300 disabled:opacity-40 flex items-center justify-center gap-2"
                                        >
                                            {isProcessing
                                                ? <><Clock size={16} className="animate-spin" /> Minting...</>
                                                : <><Zap size={16} /> Issue to Student</>
                                            }
                                        </button>
                                        {rejectBlock}
                                    </div>
                                </div>

                            ) : status === 'verified' && requiresHeadReview ? (

                                <div className="p-8 rounded-3xl border-2 border-amber-100 bg-amber-50 text-amber-700 text-center flex flex-col items-center gap-3">
                                    <Clock size={32} className="animate-pulse" />
                                    <p className="font-black uppercase text-xs tracking-[0.2em]">
                                        Forwarded to Department Head
                                    </p>
                                    <p className="text-[10px] font-medium text-amber-600/80 max-w-xs">
                                        Pending head review and authorisation before minting.
                                    </p>
                                </div>

                            ) : status === 'pending' && !isFullyCleared ? (

                                <div className="flex flex-col gap-4">
                                    <div className="p-12 rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center text-center">
                                        <Clock className="text-slate-200 mb-4" size={48} />
                                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
                                            Complete all clearances to unlock upload
                                        </p>
                                    </div>
                                    {rejectBlock}
                                </div>

                            ) : (

                                <div className={`p-8 rounded-3xl border-2 text-center flex flex-col items-center gap-3 ${
                                    status === 'rejected'
                                        ? 'bg-red-50 border-red-100 text-red-700'
                                        : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                                }`}>
                                    {status === 'rejected'
                                        ? <XCircle size={32} />
                                        : <CheckCircle2 size={32} />
                                    }
                                    <p className="font-black uppercase text-xs tracking-[0.2em]">
                                        {status === 'rejected' ? 'Application Refused' : 'Application Processed'}
                                    </p>
                                    {status === 'rejected' && req.rejection_reason && (
                                        <p className="text-xs font-bold text-red-400 max-w-xs">
                                            {req.rejection_reason}
                                        </p>
                                    )}
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