//src/services/supabaseClient.js
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

// 1. Initialize Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // The "Cure" for session locking issues in React 18+
        lock: (name, acquireTimeout, fn) => fn(), 
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

// ===========================================
// AUTH & USER LOOKUPS (The "Key" Finders)
// ===========================================

/**
 * Fetches base profile data using the Supabase UUID.
 * Used by Login.jsx and AuthContext.
 */
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

/**
 * Used by Registrars to find students by their Institutional ID (e.g., 2024-0001).
 * Returns the email so the registrar can confirm identity.
 */
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
    return data; // Returns the UUID (id) which is our recipient_id
};

// ===========================================
// IPFS & BLOCKCHAIN HASHING
// ===========================================

/**
 * Uploads file to Pinata IPFS through a server-side Netlify function.
 * This keeps the Pinata secret out of the browser bundle.
 */
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
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            fileBase64
        }    )
    });
    
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data?.error || "IPFS Upload Failed");
    }

    return data.url;
};

/**
 * Generates Keccak256 hash for the blockchain.
 */
export const generateFileHash = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    return ethers.keccak256(bytes); 
};

// ===========================================
// REGISTRAR & ADMIN ACTIONS
// ===========================================

export const issueCredential = async ({
    issuerId, 
    studentId,      
    studentName, 
    schoolId, 
    documentType, 
    fileUrl, 
    blockchainHash, 
    txHash, 
    requestId = null // This is your application_id!
}) => {
    // 1. Insert into 'credentials' table including the application_id relationship
    const { data: credential, error: credError } = await supabase
        .from('credentials')
        .insert([{
            application_id: requestId, // FIXED: Maps the request ID to your schema's primary key column
            issuer_id: issuerId,
            recipient_id: studentId, 
            student_name: studentName,
            school_id: schoolId,
            document_type: documentType,
            file_url: fileUrl,
            blockchain_hash: blockchainHash,
            tx_hash: txHash,
            status: 'Verified'
        }])
        .select()
        .single();

    if (credError) throw credError;

    // 2. Update the originating student application if applicable
    if (requestId) {
        const { error: applicationError } = await supabase
            .from('student_applications')
            .update({ 
                status: 'Approved', 
                completed_at: new Date().toISOString()
                // Removed credential_id update since credentials points to student_applications directly!
            })
            .eq('application_id', requestId); // FIXED: Uses the application_id primary key column

        if (applicationError) throw applicationError;
    }

    // 3. Trigger Notification
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

/**
 * FIXED: Added the missing application count method requested by StudentLayout.jsx
 * Fetches the exact total count of unread notifications for a student.
 */
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

/**
 * Sends a live alert to the student's dashboard.
 */
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

/**
 * Audit trail for all system actions.
 */
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
// STUDENT CREDENTIAL CONSUMPTION HELPERS
// ===========================================

/**
 * Fetches all credentials issued to a specific student user.
 * Used by StudentDashboard.jsx
 */
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

/**
 * REFACTORED: Fetches an individual credential details by its UUID.
 * Includes a fallback logic to lookup records via 'application_id' if direct 'id' match is empty.
 */
/**
 * FIXED: Fetches an individual credential details by its actual schema key (application_id).
 * Matches the 'application_id' column shown in your database ERD.
 */
export const getCredentialById = async (credentialId) => {
    if (!credentialId) return null;

    const { data, error } = await supabase
        .from('credentials')
        .select('*')
        .eq('application_id', credentialId) // Using the exact column name from your image
        .maybeSingle();

    if (error) {
        console.error("Service Layer Error [getCredentialById]:", error.message);
        throw error;
    }
    return data;
};