// src/components/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { LogOut, ShieldCheck, Bell } from 'lucide-react';

export default function Sidebar({ navLinks, onLogout }) {
    const [liveUnread, setLiveUnread] = useState(0);
    const location = useLocation();

    // Listen to the "Captain" (Navbar) updates
    useEffect(() => {
        const handleUpdate = (e) => setLiveUnread(e.detail);
        window.addEventListener('unread-notifs', handleUpdate);
        return () => window.removeEventListener('unread-notifs', handleUpdate);
    }, []);

    return (
        <nav className="w-24 bg-[#e5e7eb] flex flex-col h-screen border-r border-gray-300 sticky top-0 left-0 shadow-inner z-50">
            {/* Logo Link: Navigate to home/landing page */}
            <Link
                to="/"
                className="p-4 flex flex-col items-center bg-[#d1d5db] border-b border-gray-300 transition-colors hover:bg-gray-300"
            >
                <ShieldCheck className="text-indigo-600" size={28} />
                <span className="text-[8px] font-black uppercase mt-1 text-indigo-900">EduTrace</span>
            </Link>

            <div className="flex-1 flex flex-col items-center py-6 space-y-4 overflow-y-auto">
                {navLinks.map((link) => {
                    const Icon = link.icon;
                    const isNotifLink = link.to.includes('notifications'); // Matches your App.js route name
                    const isActive = location.pathname === link.to;

                    return (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            // Prevent new tab if clicking the already active route
                            onClick={(e) => {
                                if (isActive) e.preventDefault();
                            }}
                            className={({ isActive }) => 
                                `group flex flex-col items-center justify-center w-[70%] aspect-square rounded-2xl transition-all relative ${
                                    isActive 
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                                    : 'text-gray-500 hover:bg-white hover:text-indigo-600'
                                }`
                            }
                        >
                            <Icon size={22} />
                            
                            {/* Notification Badge */}
                            {isNotifLink && liveUnread > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold h-4 w-4 rounded-full flex items-center justify-center border-2 border-[#e5e7eb] animate-in zoom-in">
                                    {liveUnread}
                                </span>
                            )}
                            
                            <span className="text-[8px] mt-1 font-black uppercase tracking-tighter">
                                {link.label}
                            </span>
                        </NavLink>
                    );
                })}
            </div>

            {/* Logout Button */}
            <button 
                onClick={onLogout} 
                className="p-4 flex flex-col items-center text-gray-400 hover:text-red-600 border-t border-gray-300 transition-colors group"
            >
                <LogOut size={20} className="group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-black uppercase mt-1">Exit</span>
            </button>
        </nav>
    );
}