import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom'; // Added this
import { supabase } from '../services/supabaseClient';
import { Bell, X } from 'lucide-react';

export default function Notification() {
    const [toast, setToast] = useState(null);
    const location = useLocation(); // Hook to monitor current route

    // AUTO-RESOLVE TOAST ON NAVIGATION
    useEffect(() => {
        // If user enters the notification/verify page, clear the toast immediately
        if (location.pathname === '/staff/verify' || location.pathname === '/notifications') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setToast(null);
        }
    }, [location.pathname]);

    useEffect(() => {
        let activeChannel = null;

        const setupSubscription = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            activeChannel = supabase
                .channel(`live_toasts:${user.id}:${Math.random().toString(36).slice(2)}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: `recipient_id=eq.${user.id}`
                    },
                    (payload) => {
                        // Check if user is ALREADY on the notification page
                        // If they are, don't show the toast at all
                        const isAtArchive = window.location.pathname === '/staff/verify' || 
                                           window.location.pathname === '/notifications';
                        
                        if (!isAtArchive) {
                            setToast(payload.new);
                            // Standard 5s timeout
                            setTimeout(() => setToast(null), 5000);
                        }
                    }
                )
                .subscribe();
        };

        setupSubscription();

        return () => {
            if (activeChannel) {
                supabase.removeChannel(activeChannel);
            }
        };
    }, []);

    if (!toast) return null;

    return (
        <div className="fixed bottom-6 right-6 z-9999 animate-in slide-in-from-right-full fade-in duration-500">
            <div className="p-5 rounded-3xl bg-slate-900 text-white shadow-2xl flex items-center gap-4 border border-white/10 backdrop-blur-lg">
                <div className="p-2 bg-indigo-600 rounded-xl">
                    <Bell size={18} />
                </div>
                <div className="pr-8">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                        {toast.title || 'System Alert'}
                    </p>
                    <p className="text-xs font-bold leading-tight mt-1">{toast.message}</p>
                </div>
                <button 
                    onClick={() => setToast(null)} 
                    className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
}