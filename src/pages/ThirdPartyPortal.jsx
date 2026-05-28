import { useState } from 'react';
import { Search, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // Bring in the router

export default function ThirdPartyPortal() {
    const [inputValue, setInputValue] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate(); // Initialize navigation

    const handleVerify = (e) => {
        e.preventDefault();
        setError('');
        
        const input = inputValue.trim();
        if (!input) {
            setError("Please enter a link or document ID.");
            return;
        }

        try {
            let extractedId = null;

            if (input.startsWith('http://') || input.startsWith('https://')) {
                const url = new URL(input);
                
                // Try query params first
                extractedId = url.searchParams.get('cid') || url.searchParams.get('id');
                
                // Fallback to URL path
                if (!extractedId) {
                    const pathSegments = url.pathname.split('/').filter(Boolean);
                    extractedId = pathSegments[pathSegments.length - 1];
                }
            } else {
                // Raw ID input
                extractedId = input;
            }

            if (extractedId) {
                // THE FIX: Actually redirect them to the verification route!
                navigate(`/verify/${extractedId}`);
            } else {
                setError("Could not extract a valid ID from that input.");
            }

        } catch (err) {
            setError("Could not parse that link. Please check the format and try again.");
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-lg w-full bg-slate-800 rounded-2xl shadow-xl border border-slate-700 p-8">
                
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/10 mb-4">
                        <Search className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">
                        Credential Verification
                    </h1>
                    <p className="text-slate-400">
                        Paste the student's shared document link, QR code payload, or Verification ID to view the live asset.
                    </p>
                </div>

                <form onSubmit={handleVerify} className="space-y-4">
                    <div>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <LinkIcon className="h-5 w-5 text-slate-500" />
                            </div>
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                className="block w-full pl-10 pr-3 py-3 border border-slate-600 rounded-lg bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                                placeholder="e.g., https://yoursite.com/verify/123e4567..."
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center text-rose-400 text-sm bg-rose-400/10 p-3 rounded-lg">
                            <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 transition-colors"
                    >
                        Verify Document
                    </button>
                </form>
            </div>
        </div>
    );
}