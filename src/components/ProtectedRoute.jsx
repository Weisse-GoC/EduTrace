// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute({ children, requiredRole, requireMinting = false }) {
    const { user, role, canMint, loading } = useAuth();
    const location = useLocation();

    // 1. LOADING GATE
    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-[#F8FAFC]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Verifying Credentials</p>
                </div>
            </div>
        );
    }

    // 2. AUTHENTICATION CHECK
    if (!user) {
        return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    const userRole = role?.toLowerCase();

    // 3. ROLE-BASED ACCESS CONTROL (RBAC)
    const homeRoutes = {
        student: '/student/dashboard',
        staff: '/staff/dashboard',
        head: '/head/dashboard',
        admin: '/admin/dashboard'
    };

    // Check if user is trying to access a role-specific route they don't belong to
    if (requiredRole && userRole !== requiredRole.toLowerCase()) {
        console.warn(`Unauthorized: User ${userRole} tried to access ${requiredRole} area.`);
        return <Navigate to={homeRoutes[userRole] || '/'} replace />;
    }

    // 4. MINTING PERMISSION CHECK (Specific for Head-level actions)
    if (requireMinting && !canMint) {
        console.error("Access Denied: Minting privileges required.");
        return <Navigate to={homeRoutes[userRole] || '/'} replace />;
    }

    // 5. AUTHORIZED
    return children;
}