//src/pages/Sharedfiles/General/QrGenerator.jsx
import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Copy, Check, ArrowLeft, ShieldCheck, Share2 } from 'lucide-react';

export default function QrGenerator() {
    const { id } = useParams(); // Public verification parameter: application_id
    const navigate = useNavigate();
    const [copySuccess, setCopySuccess] = useState(false);

    // Creates the link pointing third parties straight to your PublicVerification screen
    const verificationUrl = useMemo(() => {
        if (id) {
            const baseUrl = window.location.origin;
            return `${baseUrl}/verify/${id}`;
        }
        return '';
    }, [id]);

    const handleCopy = () => {
        if (!verificationUrl) return;
        navigator.clipboard.writeText(verificationUrl);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    const handleDownload = () => {
        const svg = document.getElementById("qr-gen-svg");
        if (!svg) {
            console.error("QR Code SVG element not found in DOM");
            return;
        }

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();
        
        img.onload = () => {
            canvas.width = 2000;
            canvas.height = 2000;
            
            // Background fill
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw QR code with crisp vector scaling
            ctx.drawImage(img, 0, 0, 2000, 2000);
            
            const downloadLink = document.createElement("a");
            downloadLink.download = `EduTrace-Seal-${id?.substring(0, 8)}.png`;
            downloadLink.href = canvas.toDataURL("image/png");
            downloadLink.click();
        };
        
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    };

    return (
        <div className="p-8 flex flex-col items-center bg-[#F8FAFC] min-h-screen font-sans">
            <div className="w-full max-w-md">
                <button 
                    onClick={() => navigate(-1)} 
                    className="mb-8 flex items-center gap-2 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-indigo-600 transition-all group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
                    Back to Vault
                </button>

                <div className="bg-white p-10 rounded-[3rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.06)] border border-slate-100 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-full -mr-16 -mt-16"></div>

                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 bg-indigo-600 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-200">
                            <ShieldCheck size={32} />
                        </div>
                    </div>
                    
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Digital Seal</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-2 mb-10">
                        Official Verification QR
                    </p>
                    
                    <div className="bg-white p-6 border-12 border-slate-50 rounded-[2.5rem] shadow-inner mb-10 inline-block">
                        <QRCodeSVG 
                            id="qr-gen-svg"
                            value={verificationUrl} 
                            size={220} 
                            level="H" 
                            includeMargin={false}
                        />
                    </div>

                    <div className="bg-slate-50 p-5 rounded-2xl mb-10 border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Unique Access Link</p>
                        <p className="text-[11px] font-mono text-indigo-600 break-all bg-white p-3 rounded-xl border border-slate-100">
                            {verificationUrl || "Generating..."}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={handleCopy} 
                            className="flex items-center justify-center gap-2 py-5 bg-slate-50 text-slate-700 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-all active:scale-95"
                        >
                            {copySuccess ? <Check size={16} className="text-emerald-500"/> : <Copy size={16}/>}
                            {copySuccess ? 'Copied' : 'Copy Link'}
                        </button>
                        
                        <button 
                            onClick={handleDownload} 
                            className="flex items-center justify-center gap-2 py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 shadow-xl shadow-slate-200 transition-all active:scale-95"
                        >
                            <Download size={16}/> Save PNG
                        </button>
                    </div>
                </div>

                <div className="mt-10 text-center px-8">
                    <div className="flex justify-center gap-2 text-indigo-600 mb-3">
                        <Share2 size={14} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Employer Ready</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                        This QR code contains a unique cryptographic proof. 
                        Third parties scan this to verify the authenticity of your degree directly from the 
                        <span className="text-slate-600 font-bold"> Arbitrum Blockchain</span>.
                    </p>
                </div>
            </div>
        </div>
    );
}