import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth'; 
import { ShieldCheck, ArrowRight, Zap, Loader2 } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();

  /**
   * BULLETPROOF REDIRECT GUARD
   * Redirects user to their specific dashboard once auth is confirmed.
   */
  useEffect(() => {
    // Only attempt redirect if loading is finished and we have a user + profile
    if (!loading && user && profile) {
      // Normalize role to lowercase for safety
      const userRole = profile.role?.toLowerCase();
      
      let target = null;

      // Matching your AuthContext role definitions
      if (userRole === 'head') {
        target = '/head/dashboard';
      } else if (userRole === 'staff' || userRole === 'registrar') {
        target = '/staff/dashboard';
      } else if (userRole === 'student') {
        target = '/student/dashboard';
      } else if (userRole === 'admin') {
        target = '/admin/dashboard';
      }

      // If we found a valid dashboard for the user, send them there
      if (target) {
        console.log(`Auth Success: Redirecting ${userRole} to ${target}`);
        navigate(target, { replace: true });
      }
    }
  }, [user, profile, loading, navigate]);

  // Branded loader to prevent UI flickering during session check
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin absolute" />
            <ShieldCheck className="w-6 h-6 text-indigo-600 absolute top-3 left-3 opacity-20" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">
            Verifying Session
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col selection:bg-indigo-100">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-8 h-8 text-indigo-600" />
          <span className="text-2xl font-black tracking-tighter uppercase">EduTrace</span>
        </div>
        <button 
          onClick={() => navigate('/auth')} 
          className="px-5 py-2 bg-gray-50 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-all text-xs uppercase tracking-widest border border-gray-100"
        >
          Portal Login
        </button>
      </nav>

      {/* Hero Section */}
      <header className="flex-1 flex flex-col items-center text-center px-6 pt-12 md:pt-20 pb-32 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full text-[10px] font-black uppercase mb-8 tracking-[0.2em]">
          <Zap className="w-3 h-3 fill-current" />
          <span>Blockchain-Backed Academic Ledger</span>
        </div>
        
        <h1 className="text-5xl md:text-8xl font-black leading-[0.9] mb-8 tracking-tighter">
          SECURE <br /> 
          <span className="text-indigo-600 italic font-serif text-4xl md:text-7xl">Credentials</span>
        </h1>
        
        <p className="text-base md:text-lg text-gray-500 mb-12 max-w-lg leading-relaxed font-medium">
          Access immutable academic records. Verified by the University of the Cordilleras and secured on the Arbitrum blockchain.
        </p>

        {/* Action Button */}
        <button 
          onClick={() => navigate('/auth')} 
          className="group bg-slate-900 text-white px-10 py-5 md:px-12 md:py-6 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-[0.3em] shadow-2xl hover:bg-indigo-600 transition-all flex items-center gap-4 active:scale-95"
        >
          Enter Portal <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
        </button>
      </header>

      {/* Trust Bar */}
      <footer className="py-10 text-center border-t border-gray-100 bg-gray-50/50">
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12 opacity-30 grayscale px-6">
            <span className="font-black text-xs md:text-sm tracking-widest">UC-BCF</span>
            <span className="font-black text-xs md:text-sm tracking-widest">BLOCKCHAIN</span>
            <span className="font-black text-xs md:text-sm tracking-widest">EDUTRACE v2.0</span>
        </div>
      </footer>
    </div>
  );
}