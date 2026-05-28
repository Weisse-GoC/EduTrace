import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

const SignatureUpload = () => {
  const [loading, setLoading] = useState(false);
  const [headData, setHeadData] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchHeadRecord();
  }, []);

  const fetchHeadRecord = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('staff_records') 
        .select('full_name, employee_id, role, can_mint, signature_url')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setHeadData(data);
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
      if (!file) return;

      const { data: { user } } = await supabase.auth.getUser();
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${headData.employee_id}_sig.${fileExt}`;
      
      // FIXED: Removed 'institutional_assets/' from the start.
      // This path is now relative to the root of the 'institutional_assets' bucket.
      const filePath = `signatures/head/${user.id}/${fileName}`;

      // 1. Upload to the secure 'institutional_assets' bucket
      const { error: uploadError } = await supabase.storage
        .from('institutional_assets')
        .upload(filePath, file, { 
            upsert: true, // This forces the overwrite of existing files
            contentType: file.type, 
            cacheControl: '3600'
        });

      if (uploadError) throw uploadError;

      // 2. Update database with the PATH
      const { error: updateError } = await supabase
        .from('staff_records')
        .update({ signature_url: filePath }) 
        .eq('id', user.id);

      if (updateError) throw updateError;
      
      alert("Authority Unlocked: Signature Verified.");
      fetchHeadRecord(); 
    } catch (error) {
      console.error("Upload error details:", error);
      alert("Upload failed: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="text-center mt-20">Loading Authority Profile...</div>;

  return (
    <div className="flex justify-center items-center min-h-[80vh]">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-lg border border-gray-100">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Head Signature Upload</h2>
          <p className="text-gray-500 text-sm">Manage Master Credentials & L2 Authority</p>
        </div>

        <div className="space-y-6">
          <div className={`p-4 rounded-xl border-2 ${headData?.signature_url ? 'border-green-500 bg-green-50' : 'border-amber-500 bg-amber-50'}`}>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase text-gray-500">System Authority</span>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${headData?.can_mint ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-700'}`}>
                {headData?.can_mint ? 'L2 MINTING ACTIVE' : 'L2 MINTING DISABLED'}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-gray-700">
              {headData?.signature_url ? '✓ Master Signature Verified' : '⚠ Signature Missing'}
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl">
            <p className="text-xs text-gray-400 uppercase font-bold">Head Administrator</p>
            <p className="text-lg font-medium text-gray-800">{headData?.full_name}</p>
            <p className="text-sm text-gray-500">{headData?.employee_id} • {headData?.role}</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Update Digital Signature</label>
            <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-blue-400 transition-colors">
              <input 
                type="file" 
                accept="image/png, image/jpeg"
                onChange={handleUpload}
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="text-center">
                <p className="text-sm text-gray-600">{uploading ? "Uploading Securely..." : "Click to upload .png signature"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignatureUpload;