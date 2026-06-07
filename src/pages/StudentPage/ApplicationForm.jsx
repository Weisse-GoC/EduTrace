import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabaseClient';
import {
    FileText, Send, Loader2, ArrowLeft,
    Download, ChevronDown, ChevronUp, GraduationCap,
    BookOpen, ClipboardList, User, LayoutDashboard
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const CERT_OPTIONS = [
    "Attendance", "Completion Cert", "Completion with Pending ROG",
    "English as Medium of Instruction", "Enrollment", "Grading System",
    "Graduation", "GWA", "Lacking Units", "NSTP Serial Number",
    "QATAR CERTIFICATE", "Units Earned"
];

const CIVIL_STATUS = ['Single', 'Married', 'Widowed', 'Separated'];

const PURPOSE_OPTIONS = [
    'Transfer', 'Employment', 'Reference',
    'Evaluation', 'Board/Bar Exam', 'Other'
];

const RECORD_DOCS = [
    'Transcript of Records',
    'Transfer Credential',
    'True Copy of Grades',
    'Certification',
    'Documentary Stamps',
    'Authentication',
    'CAV (for CHED/Red Ribbon)',
];

export default function ApplicationPortal() {
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const slipRef = useRef(null);

    const [view, setView] = useState('selection');
    const [formType, setFormType] = useState(null);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [claimData, setClaimData] = useState(null);
    const [isCertOpen, setIsCertOpen] = useState(false);
    const [selectedCerts, setSelectedCerts] = useState([]);

    // ── Records-only form state ───────────────────────────────────────────────
    const [recordsForm, setRecordsForm] = useState({
        documentType: '',
        purpose: '',
        otherPurpose: '',
        mobileNumber: '',
        civilStatus: 'Single',
        gender: '',
        course: '',
        yearGraduated: '',
        firstAttendance: '',
        lastAttendance: '',
    });

    // ── Diploma-only form state ───────────────────────────────────────────────
    const [diplomaForm, setDiplomaForm] = useState({
        mobileNumber: '',
    });

    // Pre-fill records course from profile
    useEffect(() => {
        if (profile) {
            setRecordsForm(prev => ({
                ...prev,
                course: profile.course || '',
            }));
        }
    }, [profile]);

    const handleRecordsField = (key, val) =>
        setRecordsForm(prev => ({ ...prev, [key]: val }));

    const handleCheckItem = (name) => {
        setSelectedCerts(prev =>
            prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]
        );
    };

    const handleSelectAll = (checked) => {
        setSelectedCerts(checked ? CERT_OPTIONS : []);
    };

    // ── Reset state when switching form type ─────────────────────────────────
    const handleSelectForm = (type) => {
        setFormType(type);
        setView('form');
        setClaimData(null);
        setSelectedCerts([]);
        setIsCertOpen(false);
        if (type === 'RECORDS') {
            setRecordsForm({
                documentType: '',
                purpose: '',
                otherPurpose: '',
                mobileNumber: '',
                civilStatus: 'Single',
                gender: '',
                course: profile?.course || '',
                yearGraduated: '',
                firstAttendance: '',
                lastAttendance: '',
            });
        } else {
            setDiplomaForm({ mobileNumber: '' });
        }
    };

    // ── Download slip ─────────────────────────────────────────────────────────
    const handleDownloadSlip = async () => {
        if (!slipRef.current) return;
        setDownloading(true);

        try {
            const isRec   = formType === 'RECORDS';
            const accent  = isRec ? '#3730a3' : '#065f46';
            const badgeBg = isRec ? '#eef2ff' : '#d1fae5';
            const badgeTx = isRec ? '#3730a3' : '#065f46';
            const badgeBd = isRec ? '#c7d2fe' : '#6ee7b7';

            const certPillsHtml = claimData.certList?.length
                ? claimData.certList.map(c =>
                    `<span style="display:inline-block;margin:2px 3px;padding:3px 10px;
                     border-radius:99px;background:#f1f5f9;color:#475569;
                     border:1px solid #cbd5e1;font-size:10px;font-weight:700;
                     font-family:Arial,sans-serif;letter-spacing:.05em;">${c}</span>`
                  ).join('')
                : '';

            const field = (label, value) => `
                <div style="margin-bottom:10px;">
                  <div style="font-size:9px;font-weight:700;color:#94a3b8;letter-spacing:.1em;
                       text-transform:uppercase;font-family:Arial,sans-serif;margin-bottom:2px;">${label}</div>
                  <div style="font-size:11px;font-weight:800;color:#1e293b;text-transform:uppercase;
                       letter-spacing:.04em;font-family:Arial,sans-serif;">${value || '—'}</div>
                </div>`;

            // ── Build slip HTML depending on form type ────────────────────────
            const studentInfoHtml = isRec ? `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;">
                    ${field('Student ID No.', profile?.sharedId)}
                    ${field('Date Filed', claimData.date)}
                    <div style="grid-column:1/-1">${field('Full Name', profile?.fullName)}</div>
                    ${field('Course', recordsForm.course)}
                    ${field('Year Graduated', recordsForm.yearGraduated)}
                    ${field('Contact No.', recordsForm.mobileNumber)}
                    ${field('Civil Status', recordsForm.civilStatus)}
                    ${recordsForm.firstAttendance ? field('First Attendance', recordsForm.firstAttendance) : ''}
                    ${recordsForm.lastAttendance  ? field('Last Attendance',  recordsForm.lastAttendance)  : ''}
                </div>
            ` : `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;">
                    ${field('Student ID No.', profile?.sharedId)}
                    ${field('Date Filed', claimData.date)}
                    <div style="grid-column:1/-1">${field('Full Name', profile?.fullName)}</div>
                    ${field('Contact No.', diplomaForm.mobileNumber)}
                </div>
            `;

            const documentHtml = isRec ? `
                <span style="display:inline-block;background:${badgeBg};color:${badgeTx};border:1px solid ${badgeBd};
                     border-radius:99px;padding:3px 14px;font-size:10px;font-weight:800;letter-spacing:.08em;
                     text-transform:uppercase;margin-bottom:10px;">
                    ${recordsForm.documentType}
                </span>
                ${certPillsHtml ? `<div style="margin-bottom:10px;">${certPillsHtml}</div>` : ''}
                ${field('Purpose', claimData.purpose)}
            ` : `
                <span style="display:inline-block;background:${badgeBg};color:${badgeTx};border:1px solid ${badgeBd};
                     border-radius:99px;padding:3px 14px;font-size:10px;font-weight:800;letter-spacing:.08em;
                     text-transform:uppercase;margin-bottom:10px;">
                    Diploma
                </span>
                <div style="margin-top:8px;">
                    ${field('Degree / Title', profile?.course)}
                </div>
            `;

            const procTime = isRec
                ? (recordsForm.documentType === 'Transcript of Records' ? '7 working days' : '3 working days')
                : 'Coordinate with the Registrar for diploma release schedule.';

            const slipHtml = `
              <div style="width:640px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;font-family:Arial,sans-serif;">
                <div style="background:${accent};padding:20px 28px;display:flex;justify-content:space-between;align-items:flex-start;">
                  <div>
                    <div style="color:rgba(255,255,255,.6);font-size:9px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;margin-bottom:4px;">University of Cordilleras</div>
                    <div style="color:#fff;font-size:18px;font-weight:900;text-transform:uppercase;letter-spacing:.03em;">Office of the Registrar</div>
                    <div style="color:rgba(255,255,255,.55);font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-top:4px;">${isRec ? 'UC-RO-FORM-01' : 'UC-RO-FORM-02'} · Advance Notice / Claim Slip</div>
                  </div>
                  <div style="text-align:right;">
                    <div style="color:rgba(255,255,255,.55);font-size:9px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;">Control No.</div>
                    <div style="color:#fff;font-size:26px;font-weight:900;font-family:monospace;">#${claimData.controlNo}</div>
                  </div>
                </div>
                <div style="background:#fffbeb;border-bottom:1px solid #fde68a;padding:12px 28px;display:flex;gap:12px;align-items:flex-start;">
                  <div style="width:16px;height:16px;border-radius:50%;background:#f59e0b;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;">
                    <span style="color:#fff;font-size:9px;font-weight:900;">!</span>
                  </div>
                  <p style="font-size:10px;font-weight:600;color:#92400e;line-height:1.7;margin:0;">
                    This is <span style="text-decoration:underline;">not</span> an official document.
                    Present this slip at the Registrar's window. The signed official document will be
                    released after verification of your application and payment of applicable fees.
                  </p>
                </div>
                <div style="padding:18px 28px;border-bottom:1px solid #f1f5f9;">
                  <div style="font-size:9px;font-weight:800;color:#94a3b8;letter-spacing:.2em;text-transform:uppercase;margin-bottom:14px;">Student Information</div>
                  ${studentInfoHtml}
                </div>
                <div style="padding:18px 28px;border-bottom:1px solid #f1f5f9;">
                  <div style="font-size:9px;font-weight:800;color:#94a3b8;letter-spacing:.2em;text-transform:uppercase;margin-bottom:14px;">Document Requested</div>
                  ${documentHtml}
                </div>
                <div style="background:#f8fafc;padding:14px 28px;border-bottom:1px solid #f1f5f9;display:flex;gap:12px;align-items:flex-start;">
                  <div style="width:20px;height:20px;border-radius:50%;background:#e2e8f0;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;">⏱</div>
                  <div>
                    <div style="font-size:12px;font-weight:800;color:#1e293b;margin-bottom:3px;">${procTime}</div>
                    <div style="font-size:9px;color:#94a3b8;line-height:1.5;">Applications not followed up within 30 days will be archived.</div>
                  </div>
                </div>
                <div style="padding:18px 28px;">
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 32px;margin-bottom:20px;">
                    <div><div style="border-bottom:1px solid #94a3b8;height:36px;margin-bottom:5px;"></div><div style="font-size:8px;font-weight:700;color:#94a3b8;text-align:center;letter-spacing:.06em;text-transform:uppercase;">Student Signature over Printed Name</div></div>
                    <div><div style="border-bottom:1px solid #94a3b8;height:36px;margin-bottom:5px;"></div><div style="font-size:8px;font-weight:700;color:#94a3b8;text-align:center;letter-spacing:.06em;text-transform:uppercase;">Date Received by Registrar</div></div>
                  </div>
                  <div style="border:1px dashed #cbd5e1;border-radius:12px;padding:16px 20px;">
                    <div style="font-size:8px;font-weight:800;color:#94a3b8;letter-spacing:.25em;text-transform:uppercase;text-align:center;margin-bottom:14px;">For Registrar Use Only</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 24px;">
                      <div><div style="border-bottom:1px solid #94a3b8;height:28px;margin-bottom:4px;"></div><div style="font-size:8px;font-weight:700;color:#94a3b8;text-align:center;text-transform:uppercase;">Verified by</div></div>
                      <div><div style="border-bottom:1px solid #94a3b8;height:28px;margin-bottom:4px;"></div><div style="font-size:8px;font-weight:700;color:#94a3b8;text-align:center;text-transform:uppercase;">Amount Paid (₱)</div></div>
                      <div><div style="border-bottom:1px solid #94a3b8;height:28px;margin-bottom:4px;"></div><div style="font-size:8px;font-weight:700;color:#94a3b8;text-align:center;text-transform:uppercase;">O.R. No.</div></div>
                    </div>
                  </div>
                </div>
              </div>`;

            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:660px;height:1px;border:none;visibility:hidden;';
            document.body.appendChild(iframe);
            const iDoc = iframe.contentDocument || iframe.contentWindow.document;
            iDoc.open();
            iDoc.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
                <style>*{box-sizing:border-box;margin:0;padding:0;}body{background:#fff;padding:10px;}</style>
                </head><body>${slipHtml}</body></html>`);
            iDoc.close();
            await new Promise(r => setTimeout(r, 300));
            const slipEl = iDoc.body.firstElementChild;
            const h = slipEl.offsetHeight + 20;
            iframe.style.height = h + 'px';
            await new Promise(r => setTimeout(r, 100));

            if (!window.html2canvas) {
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                    s.onload = resolve;
                    s.onerror = reject;
                    document.head.appendChild(s);
                });
            }

            const canvas = await window.html2canvas(slipEl, {
                scale: 3,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                windowWidth: 660,
            });
            document.body.removeChild(iframe);

            const link = document.createElement('a');
            link.download = `UC-RO-ClaimSlip-${claimData.controlNo}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

        } catch (err) {
            console.error('Download failed:', err);
            alert('Download failed: ' + err.message);
        } finally {
            setDownloading(false);
        }
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user || !profile) return;

        setLoading(true);
        try {
            let payload = {};

            if (formType === 'RECORDS') {
                if (!recordsForm.documentType) {
                    alert("Please select a document type.");
                    setLoading(false);
                    return;
                }
                if (recordsForm.documentType === 'Certification' && selectedCerts.length === 0) {
                    alert("Please select at least one certification type.");
                    setLoading(false);
                    return;
                }
                if (!recordsForm.gender) {
                    alert("Please select your gender.");
                    setLoading(false);
                    return;
                }

                const finalDocType = recordsForm.documentType === 'Certification'
                    ? `Certification: ${selectedCerts.join(', ')}`
                    : recordsForm.documentType;

                const finalPurpose = recordsForm.purpose === 'Other'
                    ? recordsForm.otherPurpose
                    : recordsForm.purpose;

                payload = {
                    user_id: user.id,
                    student_id: profile?.sharedId,
                    student_name: profile?.fullName,
                    document_type: finalDocType,
                    purpose: finalPurpose,
                    mobile_number: recordsForm.mobileNumber,
                    civil_status: recordsForm.civilStatus,
                    course: recordsForm.course,
                    year_graduated: recordsForm.yearGraduated,
                    form_source: 'UC-RO-FORM-01',
                    status: 'Pending',
                };
            } else {
                // DIPLOMA — minimal, self-contained
                payload = {
                    user_id: user.id,
                    student_id: profile?.sharedId,
                    student_name: profile?.fullName,
                    document_type: 'DIPLOMA',
                    purpose: 'Diploma Release',
                    mobile_number: diplomaForm.mobileNumber,
                    course: profile?.course || '',
                    form_source: 'UC-RO-FORM-02',
                    status: 'Pending',
                };
            }

            const { data: insertData, error } = await supabase
                .from('student_applications')
                .insert([payload])
                .select();

            if (error) throw error;

            const dbId = insertData?.[0]?.id;
            const controlNo = dbId
                ? String(dbId).padStart(6, '0')
                : String(Math.floor(100000 + Math.random() * 900000));

            setClaimData({
                controlNo,
                date: new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
                certList: formType === 'RECORDS' && recordsForm.documentType === 'Certification'
                    ? selectedCerts
                    : [],
                purpose: formType === 'RECORDS'
                    ? (recordsForm.purpose === 'Other' ? recordsForm.otherPurpose : recordsForm.purpose)
                    : '',
            });
            setView('success');
        } catch (err) {
            console.error("Submission Error:", err);
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // VIEW: SELECTION
    // ─────────────────────────────────────────────────────────────────────────
    if (view === 'selection') {
        return (
            <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 font-sans">
                <div className="w-full max-w-3xl space-y-10">
                    <div className="space-y-2">
                        <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">
                            Registrar <span className="text-indigo-600">Gateway</span>
                        </h1>
                        <p className="text-slate-400 font-bold text-[10px] tracking-[0.4em] uppercase">
                            Select the required application form
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button
                            onClick={() => handleSelectForm('RECORDS')}
                            className="group relative p-8 bg-white border border-slate-100 rounded-[2.5rem] hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50 transition-all text-left overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full opacity-0 group-hover:opacity-100 transition-all" />
                            <div className="relative space-y-6">
                                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl w-fit group-hover:scale-110 transition-transform">
                                    <BookOpen size={28} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black uppercase italic tracking-tight text-slate-900">School Records</h2>
                                    <p className="text-[10px] font-bold uppercase text-slate-400 mt-1 tracking-widest">
                                        TOR · Transfer Credentials · Certifications
                                    </p>
                                </div>
                                <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                                    UC-RO-FORM-01
                                </span>
                            </div>
                        </button>

                        <button
                            onClick={() => handleSelectForm('DIPLOMA')}
                            className="group relative p-8 bg-white border border-slate-100 rounded-[2.5rem] hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-50 transition-all text-left overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full opacity-0 group-hover:opacity-100 transition-all" />
                            <div className="relative space-y-6">
                                <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl w-fit group-hover:scale-110 transition-transform">
                                    <GraduationCap size={28} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black uppercase italic tracking-tight text-slate-900">Diploma</h2>
                                    <p className="text-[10px] font-bold uppercase text-slate-400 mt-1 tracking-widest">
                                        Degree · Graduation Title Application
                                    </p>
                                </div>
                                <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                                    UC-RO-FORM-02
                                </span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VIEW: SUCCESS — claim slip
    // ─────────────────────────────────────────────────────────────────────────
    if (view === 'success' && claimData) {
        const isRec    = formType === 'RECORDS';
        const accentBg = isRec ? 'bg-indigo-700' : 'bg-emerald-700';
        const procTime = isRec
            ? (recordsForm.documentType === 'Transcript of Records' ? '7 working days' : '3 working days')
            : 'Coordinate with the Registrar for diploma release schedule.';

        return (
            <div className="min-h-screen bg-[#f1f5f9] flex flex-col items-center justify-start p-6 font-sans">

                <div className="w-full max-w-lg flex items-center justify-between mb-6">
                    <button
                        onClick={() => navigate('/student/dashboard')}
                        className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-700 transition-colors"
                    >
                        <LayoutDashboard size={14} /> Dashboard
                    </button>
                    <button
                        onClick={handleDownloadSlip}
                        disabled={downloading}
                        className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all
                            ${isRec ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'}
                            disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {downloading
                            ? <><Loader2 size={13} className="animate-spin" /> Generating…</>
                            : <><Download size={13} /> Download Slip</>
                        }
                    </button>
                </div>

                <div
                    ref={slipRef}
                    className="w-full max-w-lg bg-white rounded-3xl overflow-hidden"
                    style={{ border: '1px solid #e2e8f0' }}
                >
                    {/* Header */}
                    <div className={`${accentBg} px-7 py-6`}>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-white/50 text-[9px] font-black uppercase tracking-[0.25em] mb-1">
                                    University of Cordilleras
                                </p>
                                <p className="text-white text-lg font-black uppercase tracking-tight">
                                    Office of the Registrar
                                </p>
                                <p className="text-white/60 text-[9px] font-bold uppercase tracking-widest mt-1">
                                    {isRec ? 'UC-RO-FORM-01' : 'UC-RO-FORM-02'} · Advance Notice / Application Slip
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-white/50 text-[9px] font-black uppercase tracking-widest">Control No.</p>
                                <p className="text-white text-2xl font-black font-mono mt-1">#{claimData.controlNo}</p>
                            </div>
                        </div>
                    </div>

                    {/* Not official banner */}
                    <div className="bg-amber-50 border-b border-amber-100 px-7 py-3 flex items-start gap-3">
                        <div className="w-4 h-4 rounded-full bg-amber-400 shrink-0 mt-0.5 flex items-center justify-center">
                            <span className="text-white text-[8px] font-black">!</span>
                        </div>
                        <p className="text-amber-700 text-[10px] font-bold leading-relaxed">
                            This is <span className="underline underline-offset-2">not</span> an official document.
                            Present this slip at the Registrar's window. The official form and additional information will be provided upon verification.
                        </p>
                    </div>

                    {/* Student info */}
                    <div className="px-7 py-5 border-b border-slate-100">
                        <SectionLabel>Student Information</SectionLabel>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-3">
                            <SlipField label="Student ID No." value={profile?.sharedId} />
                            <SlipField label="Date Filed" value={claimData.date} />
                            <div className="col-span-2">
                                <SlipField label="Full Name" value={profile?.fullName} />
                            </div>
                            {isRec ? (
                                <>
                                    <SlipField label="Course" value={recordsForm.course} />
                                    <SlipField label="Year Graduated" value={recordsForm.yearGraduated || '—'} />
                                    <SlipField label="Contact No." value={recordsForm.mobileNumber || '—'} />
                                    <SlipField label="Civil Status" value={recordsForm.civilStatus} />
                                    {recordsForm.firstAttendance && (
                                        <SlipField label="First Attendance" value={recordsForm.firstAttendance} />
                                    )}
                                    {recordsForm.lastAttendance && (
                                        <SlipField label="Last Attendance" value={recordsForm.lastAttendance} />
                                    )}
                                </>
                            ) : (
                                <SlipField label="Contact No." value={diplomaForm.mobileNumber || '—'} />
                            )}
                        </div>
                    </div>

                    {/* Document requested */}
                    <div className="px-7 py-5 border-b border-slate-100">
                        <SectionLabel>Document Requested</SectionLabel>

                        {isRec ? (
                            <div className="mt-3 space-y-3">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border
                                    ${recordsForm.documentType === 'Certification'
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                        : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                    {recordsForm.documentType}
                                </span>
                                {claimData.certList.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pl-1">
                                        {claimData.certList.map(c => (
                                            <span key={c} className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                                {c}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <SlipField label="Purpose" value={claimData.purpose} />
                            </div>
                        ) : (
                            <div className="mt-3 space-y-3">
                                <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                                    Diploma
                                </span>
                                <div className="mt-2">
                                    <SlipField label="Degree / Title" value={profile?.course} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Processing time */}
                    <div className="px-7 py-4 border-b border-slate-100 bg-slate-50">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center">
                                <span className="text-slate-500 text-[9px] font-black">⏱</span>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Processing Time</p>
                                <p className="text-slate-700 text-xs font-bold mt-0.5">{procTime}</p>
                                <p className="text-slate-400 text-[9px] mt-1 leading-relaxed">
                                    Applications not followed up within 30 days will be archived.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Signatures */}
                    <div className="px-7 py-5">
                        <div className="grid grid-cols-2 gap-6 mb-6">
                            <SignLine label="Student Signature over Printed Name" />
                            <SignLine label="Date Received by Registrar" />
                        </div>
                        <div className="border border-dashed border-slate-300 rounded-2xl p-4">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.25em] text-center mb-4">
                                For Registrar Use Only
                            </p>
                            <div className="grid grid-cols-3 gap-4">
                                <SignLine label="Verified by" />
                                <SignLine label="Amount to be Paid (₱)" />
                                <SignLine label="O.R. No." />
                            </div>
                        </div>
                    </div>
                </div>

                <p className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    Track your application from the dashboard
                </p>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VIEW: FORM
    // ─────────────────────────────────────────────────────────────────────────
    const isRecords = formType === 'RECORDS';

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 font-sans">
            <div className="max-w-2xl mx-auto space-y-6 pb-20">

                <button
                    onClick={() => setView('selection')}
                    className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                >
                    <ArrowLeft size={14} /> Back to selection
                </button>

                {/* Form header */}
                <div className={`p-8 ${isRecords ? 'bg-indigo-600' : 'bg-emerald-600'} rounded-[2.5rem] flex items-center gap-5`}>
                    <div className="p-4 bg-white/20 rounded-2xl">
                        {isRecords
                            ? <BookOpen size={32} className="text-white" />
                            : <GraduationCap size={32} className="text-white" />
                        }
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white uppercase italic tracking-tight">
                            {isRecords ? 'Records Application' : 'Diploma Application'}
                        </h1>
                        <p className="text-white/70 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
                            {isRecords ? 'UC-RO-FORM-01' : 'UC-RO-FORM-02'}
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* ── FORM 01 — SCHOOL RECORDS ─────────────────────── */}
                    {isRecords && (
                        <>
                            <FormSection title="Personal Info" icon={<User size={14} />} accent="indigo">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Full Name</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm text-slate-400 cursor-not-allowed"
                                            value={profile?.fullName || ''}
                                            disabled
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Student ID No.</label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm text-slate-400 cursor-not-allowed"
                                                value={profile?.sharedId || ''}
                                                disabled
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Course</label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm text-slate-400 cursor-not-allowed"
                                                value={recordsForm.course}
                                                disabled
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Mobile No.</label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all"
                                                value={recordsForm.mobileNumber}
                                                onChange={(e) => handleRecordsField('mobileNumber', e.target.value)}
                                                placeholder="09XX-XXX-XXXX"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Civil Status</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {CIVIL_STATUS.map(s => (
                                                    <button
                                                        key={s}
                                                        type="button"
                                                        onClick={() => handleRecordsField('civilStatus', s)}
                                                        className={`py-2.5 px-3 rounded-xl text-[10px] font-black uppercase border transition-all ${recordsForm.civilStatus === s
                                                            ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                                                            : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Gender</label>
                                        <div className="flex gap-3">
                                            {['Male', 'Female'].map(g => (
                                                <button
                                                    key={g}
                                                    type="button"
                                                    onClick={() => handleRecordsField('gender', g)}
                                                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase border transition-all ${recordsForm.gender === g
                                                        ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                                                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                                                >
                                                    {g}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </FormSection>

                            <FormSection title="Purpose of OTR / Certification" icon={<ClipboardList size={14} />} accent="indigo">
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {PURPOSE_OPTIONS.map(p => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => handleRecordsField('purpose', p)}
                                                className={`py-3 px-4 rounded-xl text-[10px] font-black uppercase border transition-all ${recordsForm.purpose === p
                                                    ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                                                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                    {recordsForm.purpose === 'Other' && (
                                        <input
                                            type="text"
                                            placeholder="Please specify..."
                                            className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all"
                                            value={recordsForm.otherPurpose}
                                            onChange={(e) => handleRecordsField('otherPurpose', e.target.value)}
                                            required
                                        />
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">First Attendance in UC</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. June 2020"
                                                className="w-full px-4 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all"
                                                value={recordsForm.firstAttendance}
                                                onChange={(e) => handleRecordsField('firstAttendance', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Last Attendance in UC</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. March 2024"
                                                className="w-full px-4 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all"
                                                value={recordsForm.lastAttendance}
                                                onChange={(e) => handleRecordsField('lastAttendance', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Year Graduated</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. 2024"
                                                className="w-full px-4 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all"
                                                value={recordsForm.yearGraduated}
                                                onChange={(e) => handleRecordsField('yearGraduated', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </FormSection>

                            <FormSection title="Document/s Requested" icon={<FileText size={14} />} accent="indigo">
                                <div className="space-y-2">
                                    {RECORD_DOCS.map(doc => {
                                        const isCert = doc === 'Certification';
                                        const isSelected = recordsForm.documentType === doc;
                                        return (
                                            <div key={doc}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        handleRecordsField('documentType', doc);
                                                        if (isCert) setIsCertOpen(prev => !prev);
                                                        else setIsCertOpen(false);
                                                    }}
                                                    className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border text-left text-[10px] font-black uppercase tracking-wider transition-all ${isSelected
                                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                                                >
                                                    <span>{doc}</span>
                                                    {isCert && (
                                                        <span className="text-slate-400">
                                                            {isCertOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                        </span>
                                                    )}
                                                </button>
                                                {isCert && isCertOpen && (
                                                    <div className="mt-2 p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 max-h-64 overflow-y-auto">
                                                        <label className="flex items-center gap-3 pb-3 border-b border-slate-200 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                                checked={selectedCerts.length === CERT_OPTIONS.length}
                                                                onChange={(e) => handleSelectAll(e.target.checked)}
                                                            />
                                                            <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Select All</span>
                                                        </label>
                                                        {CERT_OPTIONS.map(name => (
                                                            <label key={name} className="flex items-center gap-3 cursor-pointer group">
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                                    checked={selectedCerts.includes(name)}
                                                                    onChange={() => handleCheckItem(name)}
                                                                />
                                                                <span className="text-[10px] font-bold uppercase text-slate-600 group-hover:text-indigo-600 transition-colors tracking-wide">
                                                                    {name}
                                                                </span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </FormSection>
                        </>
                    )}

                    {/* ── FORM 02 — DIPLOMA ─────────────────────────────── */}
                    {!isRecords && (
                        <FormSection title="Application Details" icon={<GraduationCap size={14} />} accent="emerald">
                            <div className="space-y-4">
                                {/* Auto-filled read-only fields */}
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Full Name</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm text-slate-400 cursor-not-allowed"
                                        value={profile?.fullName || ''}
                                        disabled
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Student ID No.</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm text-slate-400 cursor-not-allowed"
                                            value={profile?.sharedId || ''}
                                            disabled
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Degree / Title</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm text-slate-400 cursor-not-allowed"
                                            value={profile?.course || ''}
                                            disabled
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Date Applied</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm text-slate-400 cursor-not-allowed"
                                            value={new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                            disabled
                                        />
                                    </div>
                                    {/* Only manual field */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Mobile No.</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 outline-none transition-all"
                                            value={diplomaForm.mobileNumber}
                                            onChange={(e) => setDiplomaForm({ mobileNumber: e.target.value })}
                                            placeholder="09XX-XXX-XXXX"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Info note */}
                                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4 flex items-start gap-3">
                                    <div className="w-4 h-4 rounded-full bg-emerald-400 shrink-0 mt-0.5 flex items-center justify-center">
                                        <span className="text-white text-[8px] font-black">i</span>
                                    </div>
                                    <p className="text-emerald-700 text-[10px] font-bold leading-relaxed">
                                        The official diploma application form will be provided at the Registrar's window.
                                        This slip serves as your advance notice only.
                                    </p>
                                </div>
                            </div>
                        </FormSection>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-5 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed
                            ${isRecords
                                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'}`}
                    >
                        {loading
                            ? <><Loader2 className="animate-spin" size={16} /> Submitting...</>
                            : <><Send size={16} /> Submit Application</>
                        }
                    </button>
                </form>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const FormSection = ({ title, icon, children, accent = 'indigo' }) => (
    <div className="bg-white border border-slate-100 rounded-4xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <span className={accent === 'emerald' ? 'text-emerald-600' : 'text-indigo-600'}>{icon}</span>
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</h3>
        </div>
        <div className="p-6">{children}</div>
    </div>
);

const SectionLabel = ({ children }) => (
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{children}</p>
);

const SlipField = ({ label, value }) => (
    <div>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-[11px] font-black text-slate-800 uppercase tracking-wide">{value || '—'}</p>
    </div>
);

const SignLine = ({ label }) => (
    <div>
        <div className="border-b border-slate-300 h-8 mb-1" />
        <p className="text-[8px] text-slate-400 text-center font-bold uppercase tracking-wider leading-tight">{label}</p>
    </div>
);