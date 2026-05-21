// src/services/headDashboardService.js
// src/services/headDashboardService.js
import { supabase } from "./supabaseClient";

export async function fetchHeadDashboardData() {
  const { data: apps, error: appsError } = await supabase
    .from("student_applications")
    .select(`
      *,
      student_records!user_id (
        id,
        full_name,
        student_id,
        course,
        email
      )
    `)
    .eq("status", "Verified");

  if (appsError) throw appsError;

  const normalizedApps = (apps || []).map((app) => ({
    ...app,
    student_records: Array.isArray(app.student_records) 
      ? app.student_records[0] 
      : app.student_records
  }));

  // Get stats for different statuses
  const { count: mintedCount, error: mintedError } = await supabase
    .from("student_applications")
    .select("*", { count: "exact", head: true })
    .eq("status", "Issued");

  const { count: processingCount, error: processingError } = await supabase
    .from("student_applications")
    .select("*", { count: "exact", head: true })
    .eq("status", "Processing");

  const { count: failedCount, error: failedError } = await supabase
    .from("student_applications")
    .select("*", { count: "exact", head: true })
    .eq("status", "Minting Failed");

  if (mintedError || processingError || failedError) throw mintedError || processingError || failedError;

  return {
    pendingApplications: normalizedApps,
    stats: {
      pending: normalizedApps.length,
      minted: mintedCount || 0,
      processing: processingCount || 0,
      failed: failedCount || 0,
    },
  };
}