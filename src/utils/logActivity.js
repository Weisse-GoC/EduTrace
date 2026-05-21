import { supabase } from '../services/supabaseClient'; 

/**
 * Global Utility for logging system-wide activities.
 * Fixed: Added targetApplicationId to satisfy Postgres Trigger requirements.
 */
export const logActivity = async ({
    userId, 
    issuerName, 
    role, 
    action, 
    targetStudentId = null, 
    targetStudentName = null, 
    targetApplicationId = null, // CRITICAL: Satisfies the DB "record new" error
    details = {}
}) => {
    
    if (!userId || !role || !action) {
        console.warn("⚠️ Activity logging aborted: Missing userId, role, or action.");
        return;
    }

    try {
        const logEntry = {
            user_id: String(userId),
            issuer_name: String(issuerName || "System User"),
            role: String(role).toLowerCase(),
            action: String(action).toUpperCase(),
            target_student_id: targetStudentId ? String(targetStudentId) : null,
            target_student_name: targetStudentName ? String(targetStudentName) : null,
            target_application_id: targetApplicationId, // Mapped to DB column
            details: details,
        };

        const { error } = await supabase
            .from('activity_logs')
            .insert([logEntry]);

        if (error) throw error;

    } catch (error) {
        // Catching here ensures that even if the log fails, 
        // it doesn't crash the function that called it.
        console.error("❌ Audit Logging Failure:", error.message);
    }
};