// src/components/AuthContext.jsx
import { useEffect, useState, useRef } from "react";
import { supabase } from "../services/supabaseClient";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../hooks/useAuth";

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const isMounted = useRef(true);
    const profileRef = useRef(null);

    // Helper to fetch and merge profile data
    async function fetchUserData(supabaseUser) {
        if (!isMounted.current) return;
        setUser(supabaseUser);

        try {
            // STEP 1: Get base profile
            const { data: profileData, error: profileError } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", supabaseUser.id)
                .single();

            if (profileError || !profileData) {
                if (isMounted.current) {
                    const fallbackProfile = {
                        role: "third-party",
                        fullName: supabaseUser.email.split("@")[0],
                    };
                    profileRef.current = fallbackProfile;
                    setProfile(fallbackProfile);
                }
                return;
            }

            let extraData = {};

            // STEP 2: Fetch specific role records
            if (profileData.role === "student") {
                const { data: studentRecord } = await supabase
                    .from("student_records")
                    .select("student_id, course, status")
                    .eq("email", supabaseUser.email)
                    .single();

                extraData = {
                    sharedId: studentRecord?.student_id || profileData.school_id,
                    course: studentRecord?.course,
                    status: studentRecord?.status,
                };
            } else if (profileData.role === "staff" || profileData.role === "head") {
                const { data: staffRecord } = await supabase
                    .from("staff_records")
                    .select("employee_id, department, can_mint")
                    .eq("email", supabaseUser.email)
                    .single();

                extraData = {
                    sharedId: staffRecord?.employee_id || profileData.school_id,
                    department: staffRecord?.department,
                    can_mint: staffRecord?.can_mint ?? profileData.can_mint,
                };
            }

            // STEP 3: Merge and Set State
            if (isMounted.current) {
                const mergedProfile = {
                    ...profileData,
                    ...extraData,
                    fullName: profileData.full_name,
                    displayRole:
                        profileData.role === "head"
                            ? "Head Registrar"
                            : profileData.role === "staff"
                                ? "University Staff"
                                : profileData.role === "admin"
                                    ? "System Administrator"
                                    : profileData.role === "student"
                                        ? "Student"
                                        : "Third-Party Verifier",
                };

                profileRef.current = mergedProfile;
                setProfile(mergedProfile);
            }
        } catch (err) {
            console.error("Auth Data Fetch Error:", err);
        }
    }

    useEffect(() => {
        isMounted.current = true;

        const initAuth = async () => {
            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                if (session?.user && isMounted.current) {
                    await fetchUserData(session.user);
                }
            } catch (error) {
                console.error("Init Auth Error:", error);
            } finally {
                if (isMounted.current) setLoading(false);
            }
        };

        const handleVisibilityRecovery = async () => {
            if (document.visibilityState !== "visible") return;

            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                if (session?.user && !profileRef.current && isMounted.current) {
                    setLoading(true);
                    await fetchUserData(session.user);
                }
            } catch (error) {
                console.error("Visibility Recovery Error:", error);
            } finally {
                if (isMounted.current) setLoading(false);
            }
        };

        initAuth();
        document.addEventListener("visibilitychange", handleVisibilityRecovery);

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === "SIGNED_IN" && session?.user) {
                const needsInitialLoad = !profileRef.current;

                if (needsInitialLoad && isMounted.current) {
                    setLoading(true);
                }

                try {
                    await fetchUserData(session.user);
                } finally {
                    if (needsInitialLoad && isMounted.current) {
                        setLoading(false);
                    }
                }
            }

            if (event === "SIGNED_OUT") {
                profileRef.current = null;
                setUser(null);
                setProfile(null);
                setLoading(false);
                navigate("/auth", { replace: true });
            }
        });

        return () => {
            isMounted.current = false;
            document.removeEventListener("visibilitychange", handleVisibilityRecovery);
            subscription.unsubscribe();
        };
    }, [navigate]);

    async function logout() {
        setLoading(true);
        await supabase.auth.signOut();
    }

    const value = {
        user,
        userId: user?.id || null,
        profile,
        role: profile?.role || null,
        schoolId: profile?.school_id || null,
        institutionalId: profile?.sharedId || profile?.school_id || null,
        fullName: profile?.fullName || profile?.full_name || "User",
        displayRole: profile?.displayRole || null,
        canMint: profile?.can_mint || false,
        loading,
        logout,
        isHead: profile?.role === "head",
        isStaff: profile?.role === "staff",
        isStudent: profile?.role === "student",
        isAdmin: profile?.role === "admin",
    };

    return (
        <AuthContext.Provider value={value}>
            {loading ? <LoadingScreen /> : children}
        </AuthContext.Provider>
    );
}

function LoadingScreen() {
    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 fixed inset-0 z-9999">
            <div className="relative w-20 h-20 mb-8">
                <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-2xl"></div>
                <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-2xl animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center font-black text-indigo-400 text-xs">ET</div>
            </div>
            <h2 className="text-white font-black uppercase tracking-[0.4em] text-[10px] animate-pulse text-center">
                Loading screen...
            </h2>
        </div>
    );
}
