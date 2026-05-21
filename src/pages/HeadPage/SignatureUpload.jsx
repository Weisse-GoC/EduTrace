import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

const SignatureUpload = () => {
  const [loading, setLoading] = useState(false);
  const [staffData, setStaffData] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchStaffRecord();
  }, []);

  const fetchStaffRecord = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      // Fetching from staff_records based on your ERD
      const { data, error } = await supabase
        .from('staff_records')
        .select('full_name, employee_id, role, can_mint, signature_url')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setStaffData(data);
    } catch (error) {
      console.error('Error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (event) => {
    try {
      setUploading(true);
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${staffData.employee_id}_sig.${fileExt}`;
      const filePath = `${fileName}`;

      // 1. Upload to the 'signatures' bucket you created
      const { error: uploadError } = await supabase.storage
        .from('signatures')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // 2. Get the Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('signatures')
        .getPublicUrl(filePath);

      // 3. Update staff_records table
      const { data: { user } } = await supabase.auth.getUser();
      const { error: updateError } = await supabase
        .from('staff_records')
        .update({ signature_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;
      
      alert("Authority Unlocked: Signature Verified.");
      fetchStaffRecord(); 
    } catch (error) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="text-center mt-20">Loading Authority Profile...</div>;

  return (
    <div className="flex justify-center items-center min-h-[80vh]">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-lg border border-gray-100">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Signature Upload</h2>
          <p className="text-gray-500 text-sm">Manage Registrar Credentials & Authority</p>
        </div>

        <div className="space-y-6">
          {/* Authority Status Card */}
          <div className={`p-4 rounded-xl border-2 ${staffData?.signature_url ? 'border-green-500 bg-green-50' : 'border-amber-500 bg-amber-50'}`}>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase text-gray-500">System Authority</span>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${staffData?.can_mint ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-700'}`}>
                {staffData?.can_mint ? 'MINTING ACTIVE' : 'MINTING DISABLED'}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-gray-700">
              {staffData?.signature_url ? '✓ Signature Verified' : '⚠ Signature Missing'}
            </p>
          </div>

          {/* User Info */}
          <div className="bg-gray-50 p-4 rounded-xl">
            <p className="text-xs text-gray-400 uppercase font-bold">Registrar Name</p>
            <p className="text-lg font-medium text-gray-800">{staffData?.full_name}</p>
            <p className="text-sm text-gray-500">{staffData?.employee_id} • {staffData?.role}</p>
          </div>

          {/* Upload Section */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Update Digital Signature</label>
            <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-blue-400 transition-colors">
              <input 
                type="file" 
                accept="image/*"
                onChange={handleUpload}
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="text-center">
                <p className="text-sm text-gray-600">{uploading ? "Uploading..." : "Click to upload .png signature"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignatureUpload;