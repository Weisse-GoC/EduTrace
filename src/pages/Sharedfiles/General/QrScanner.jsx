import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scanner } from '@yudiel/react-qr-scanner'; 
import { supabase } from '../../../services/supabaseClient';
import { 
    ShieldCheck, 
    ShieldAlert, 
    Camera, 
    Loader2, 
    ArrowLeft, 
    Fingerprint 
} from 'lucide-react';

export default function QrScanner() { 
    const [scanResult, setScanResult] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState(null); 
    const navigate = useNavigate();



    const handleScan = async (result) => {
        if (!result || result.length === 0) return;

        const data = result[0].rawValue; 
        setScanResult(data);
        setIsScanning(false);
        setVerificationStatus('checking');

        try {
            // 1. Extract ID from URL (the last part of the path)
            const urlParts = data.split('/');
            const credentialId = urlParts[urlParts.length - 1]; 

            // 2. Fetch the real credential from Supabase
            const { data: credential, error } = await supabase
                .from('credentials')
                .select('*')
                .eq('id', credentialId)
                .maybeSingle();

            if (error || !credential) {
                setVerificationStatus('error');
                return;
            }

            // 3. Cryptographic Integrity Check
            // For now, let's verify if the record simply exists and is valid
            const status = credential.file_hash ? 'verified' : 'mismatch';
            setVerificationStatus(status);

            // 4. Log Activity in Supabase
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from('activity_logs').insert({
                user_id: user?.id,
                action: 'QR_VERIFICATION',
                details: { credentialId, status },
                role: 'registrar'
            });

        } catch (error) {
            console.error("Scanner Error:", error);
            setVerificationStatus('error');
        }
    };

    const renderStatus = () => {
        const styles = {
            checking: "bg-blue-50 text-blue-700 border-blue-100",
            verified: "bg-emerald-50 text-emerald-700 border-emerald-100",
            mismatch: "bg-rose-50 text-rose-700 border-rose-100",
            error: "bg-slate-50 text-slate-700 border-slate-100"
        };

        const currentStyle = styles[verificationStatus] || styles.error;

        switch (verificationStatus) {
            case 'checking': 
                return (
                    <div className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 ${currentStyle}`}>
                        <Loader2 className="animate-spin" />
                        <p className="font-black uppercase text-[10px] tracking-widest text-center">Verifying Ledger Integrity...</p>
                    </div>
                );
            case 'verified': 
                return (
                    <div className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 ${currentStyle}`}>
                        <ShieldCheck size={40} />
                        <p className="font-black uppercase text-sm tracking-tight text-center">Authentic Record Found</p>
                        <button onClick={() => navigate(`/verify/${scanResult.split('/').pop()}`)} className="text-[10px] font-bold underline uppercase">View Full Details</button>
                    </div>
                );
            case 'mismatch': 
                return (
                    <div className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 ${currentStyle}`}>
                        <ShieldAlert size={40} />
                        <p className="font-black uppercase text-sm tracking-tight text-center">Integrity Mismatch</p>
                    </div>
                );
            case 'error': 
                return (
                    <div className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 ${currentStyle}`}>
                        <Fingerprint size={40} className="opacity-20" />
                        <p className="font-black uppercase text-[10px] tracking-widest text-center text-slate-400">Scan QR to begin verification</p>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="p-8 max-w-2xl mx-auto min-h-screen bg-[#FBFBFE]">
            <button 
                onClick={() => navigate(-1)} 
                className="mb-8 flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-black uppercase text-[10px] tracking-widest transition-all"
            >
                <ArrowLeft size={16} /> Back to Dashboard
            </button>

            <div className="text-center mb-10">
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">
                    QR <span className="text-indigo-600">Validator</span>
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Instant Credential Verification</p>
            </div>
            
            <div className="flex flex-col items-center gap-8">
                {isScanning ? (
                    <div className="w-full max-w-sm aspect-square border-8 border-white rounded-[3rem] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] ring-1 ring-slate-100">
                        <Scanner
                            onScan={handleScan}
                            onError={(err) => console.error(err)}
                            constraints={{ facingMode: 'environment' }} 
                        />
                    </div>
                ) : (
                    <button
                        onClick={() => {setIsScanning(true); setVerificationStatus(null);}}
                        className="group relative flex flex-col items-center justify-center w-64 h-64 bg-white rounded-[3rem] border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all duration-500 shadow-sm"
                    >
                        <div className="p-5 bg-slate-900 text-white rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                            <Camera size={32} />
                        </div>
                        <span className="font-black uppercase text-[10px] tracking-widest text-slate-500">Initialize Scanner</span>
                    </button>
                )}

                <div className="w-full max-w-sm">
                    {renderStatus() || (
                        <div className="p-10 rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center opacity-40">
                             <Fingerprint size={48} className="text-slate-300" />
                        </div>
                    )}
                </div>

                {scanResult && (
                    <div className="w-full bg-slate-900 p-4 rounded-2xl overflow-hidden shadow-inner">
                        <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-1">Decoded Payload</p>
                        <p className="text-[10px] font-mono text-slate-400 truncate">{scanResult}</p>
                    </div>
                )}
            </div>
        </div>
    );
}