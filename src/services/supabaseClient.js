import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Session locking disabled to prevent React 18 deadlocks
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        lock: (name, acquireTimeout, fn) => fn(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

// ===========================================
// AUTH & USER LOOKUPS
// ===========================================

// Fetch a user's profile by their Supabase UUID — used on login and auth context init
export const getUserDataById = async (userId) => {
    if (!userId) return null;
    const { data, error } = await supabase
        .from('profiles')
        .select('email, school_id, role, full_name')
        .eq('id', userId)
        .single();

    if (error) {
        console.warn("User Lookup Error:", error.message);
        return null;
    }
    return data;
};

// Allows registrars to search a student by their school ID (e.g. 2024-0001)
// Returns the UUID so we can use it as recipient_id downstream
export const getUserBySchoolId = async (schoolId) => {
    if (!schoolId) return null;
    const cleanId = schoolId.trim().toUpperCase();

    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('school_id', cleanId)
        .single();

    if (error) {
        console.error("School ID Lookup Error:", error);
        return null;
    }
    return data;
};

// ===========================================
// IPFS & BLOCKCHAIN HASHING
// ===========================================

// Uploads a file to Pinata IPFS via a Netlify serverless function
// We proxy through Netlify to keep the Pinata secret off the client bundle
export const uploadFileAndGetUrl = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }

    const fileBase64 = btoa(binary);

    const res = await fetch("/.netlify/functions/pinata-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            fileBase64
        })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "IPFS Upload Failed");
    return data.url;
};

// Produces a Keccak256 hash of the file — this is what gets anchored on-chain
export const generateFileHash = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    return ethers.keccak256(bytes);
};

// ===========================================
// REGISTRAR ACTIONS
// ===========================================

// Issues a credential after the registrar completes blockchain anchoring
// Also marks the originating student_application as Approved and fires a notification
export const issueCredential = async ({
    issuerId,
    studentId,
    studentName,
    schoolId,
    documentType,
    fileUrl,
    blockchainHash,
    txHash,
    requestId = null // application_id from student_applications — links both tables
}) => {
    // 1. Write the issued credential record
    const { data: credential, error: credError } = await supabase
        .from('credentials')
        .insert([{
            application_id: requestId,
            issuer_id: issuerId,
            recipient_id: studentId,
            student_name: studentName,
            school_id: schoolId,
            document_type: documentType,
            file_url: fileUrl,
            blockchain_hash: blockchainHash,
            tx_hash: txHash,
            status: 'Verified' || 'To_be_Issued'
        }])
        .select()
        .single();

    if (credError) throw credError;

    // 2. Reflect the approval back on the student's original application
    if (requestId) {
        const { error: applicationError } = await supabase
            .from('student_applications')
            .update({
                status: 'Approved',
                completed_at: new Date().toISOString()
            })
            .eq('application_id', requestId);

        if (applicationError) throw applicationError;
    }

    // 3. Notify the student in real time
    await createNotification(
        studentId,
        "Document Issued",
        `Your ${documentType} has been successfully verified on Arbitrum and issued.`
    );

    return credential;
};

// ===========================================
// NOTIFICATIONS & LOGS
// ===========================================

// Returns the count of unread notifications — used by StudentLayout for the badge indicator
export const getUnreadNotificationCount = async (studentId) => {
    if (!studentId) return 0;

    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', studentId)
        .eq('read', false);

    if (error) {
        console.error("Service Layer Error [getUnreadNotificationCount]:", error.message);
        throw error;
    }
    return count || 0;
};

// Pushes a notification row to the student — consumed by the real-time listener on their dashboard
export const createNotification = async (recipientId, title, message) => {
    try {
        await supabase
            .from('notifications')
            .insert([{
                recipient_id: recipientId,
                title,
                message,
                read: false
            }]);
    } catch (e) {
        console.error("Notification delivery failed:", e);
    }
};

// Writes an audit trail entry — call this after any significant system action
export const logActivity = async (
    userId,
    action,
    {
        issuerName = null,
        role = null,
        targetStudentId = null,
        targetStudentName = null,
        ...details
    } = {}
) => {
    try {
        await supabase
            .from('activity_logs')
            .insert([{
                user_id: userId,
                issuer_name: issuerName,
                role,
                action,
                target_student_id: targetStudentId,
                target_student_name: targetStudentName,
                details
            }]);
    } catch (e) {
        console.error("Logging failed:", e);
    }
};

// ===========================================
// STUDENT DATA HELPERS
// ===========================================

// Fetches all issued credentials for a student — used by StudentDashboard
export const getCredentialsByRecipientId = async (recipientId) => {
    if (!recipientId) return [];

    const { data, error } = await supabase
        .from('credentials')
        .select('*')
        .eq('recipient_id', recipientId)
        .order('issued_at', { ascending: false });

    if (error) {
        console.error("Service Layer Error [getCredentialsByRecipientId]:", error.message);
        throw error;
    }
    return data || [];
};

// Fetches a single credential by application_id — used by ViewCredential for the detail page
export const getCredentialById = async (credentialId) => {
    if (!credentialId) return null;

    const { data, error } = await supabase
        .from('credentials')
        .select('*')
        .eq('application_id', credentialId)
        .maybeSingle();

    if (error) {
        console.error("Service Layer Error [getCredentialById]:", error.message);
        throw error;
    }
    return data;
};

// Fetches only active applications — rows disappear once status moves past these three
// student_id is the auth UUID stored when the application was submitted
export const getApplicationsByStudentId = async (studentId) => {
    if (!studentId) return [];

    const { data, error } = await supabase
        .from('student_applications')
        .select(`
            application_id,
            document_type,
            status,
            created_at,
            purpose
        `)
        .eq('user_id', studentId)
        .in('status', ['Pending', 'Verified', 'To_be_Issued'])
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Service Layer Error [getApplicationsByStudentId]:", error.message);
        throw error;
    }
    return data || [];
};