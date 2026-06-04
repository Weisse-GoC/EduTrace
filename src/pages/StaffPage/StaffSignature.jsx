import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

const StaffSignature = () => {
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

      const { data, error } = await supabase
        .from('staff_records') 
        .select('full_name, employee_id, role, can_mint, signature_url')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setStaffData(data);
    } catch (error) {
      console.error('Error fetching staff record:', error.message);
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
      const fileName = `${staffData.employee_id}_sig.${fileExt}`;
      
      // Path updated for staff isolation
      const filePath = `signatures/staff/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('institutional_assets')
        .upload(filePath, file, { 
            upsert: true,
            contentType: file.type, 
            cacheControl: '3600'
        });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('staff_records')
        .update({ signature_url: filePath }) 
        .eq('id', user.id);

      if (updateError) throw updateError;
      
      alert("Staff Signature Verified.");
      fetchStaffRecord(); 
    } catch (error) {
      console.error("Upload error details:", error);
      alert("Upload failed: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="text-center mt-20 text-indigo-600 font-black">Loading Staff Profile...</div>;

  return (
    <div className="flex justify-center items-center min-h-[80vh] bg-slate-50">
      <div className="w-full max-w-md p-8 bg-white rounded-3xl shadow-xl border border-slate-100">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Staff Signature</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">L1 Issuance Authorization</p>
        </div>

        <div className="space-y-6">
          <div className={`p-4 rounded-2xl border-2 ${staffData?.signature_url ? 'border-emerald-500 bg-emerald-50' : 'border-amber-500 bg-amber-50'}`}>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase text-slate-500">Privileges</span>
              <span className={`text-[9px] font-black px-2 py-1 rounded-full ${staffData?.can_mint ? 'bg-emerald-200 text-emerald-700' : 'bg-rose-200 text-rose-700'}`}>
                {staffData?.can_mint ? 'MINTING ACTIVE' : 'MINTING RESTRICTED'}
              </span>
            </div>
            <p className="mt-2 text-sm font-black text-slate-700">
              {staffData?.signature_url ? '✓ Digital Signature Verified' : '⚠ Signature Pending'}
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl">
            <p className="text-[9px] text-slate-400 uppercase font-black">Staff Credentials</p>
            <p className="text-lg font-black text-slate-900 uppercase">{staffData?.full_name}</p>
            <p className="text-[10px] font-bold text-slate-500">{staffData?.employee_id} • {staffData?.role}</p>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-600 uppercase mb-2">Update Authorization Signature</label>
            <div className="relative border-2 border-dashed border-slate-300 rounded-2xl p-6 hover:border-indigo-400 transition-colors cursor-pointer bg-slate-50">
              <input 
                type="file" 
                accept="image/png, image/jpeg"
                onChange={handleUpload}
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="text-center">
                <p className="text-xs font-bold text-slate-600">
                    {uploading ? "Uploading Securely..." : "Click to select or drag & drop PNG/JPG"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffSignature;