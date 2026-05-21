//src/pages/StaffPage/LookUp.jsx
import { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { 
    Search, User, Hash, GraduationCap, 
    History, ExternalLink, Loader2, AlertCircle 
} from 'lucide-react';

export default function StudentLookup() {
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [requestHistory, setRequestHistory] = useState([]);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setSelectedStudent(null);
        
        try {
            const { data, error } = await supabase
                .from('student_records')
                .select('*')
                .or(`student_id.ilike.%${query}%,full_name.ilike.%${query}%`)
                .limit(5);

            if (error) throw error;
            setResults(data || []);
        } catch (err) {
            console.error("Search error:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStudentDetails = async (student) => {
        setSelectedStudent(student);
        // Fetch their specific request history from the 'student_applications' table
        const { data } = await supabase
            .from('student_applications')
            .select('*')
            .eq('student_id', student.student_id)
            .order('created_at', { ascending: false });
        
        setRequestHistory(data || []);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header Section */}
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">
                    Student <span className="text-indigo-600">Intelligence</span>
                </h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">
                    Centralized Registrar Record Verification
                </p>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="relative group max-w-2xl">
                <input 
                    className="w-full p-7 bg-white rounded-4xl shadow-2xl shadow-indigo-100/50 border-2 border-transparent focus:border-indigo-600 focus:ring-0 font-bold text-slate-700 transition-all outline-none"
                    placeholder="Search ID Number or Full Name..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <button 
                    type="submit"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-4 bg-indigo-600 text-white rounded-2xl hover:bg-slate-900 transition-all shadow-lg shadow-indigo-200"
                >
                    {loading ? <Loader2 className="animate-spin" size={20}/> : <Search size={20}/>}
                </button>
            </form>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Results List */}
                <div className="lg:col-span-1 space-y-4">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Search Results</h3>
                    {results.length > 0 ? (
                        results.map((student) => (
                            <button
                                key={student.id}
                                onClick={() => fetchStudentDetails(student)}
                                className={`w-full p-5 rounded-3xl border-2 text-left transition-all ${
                                    selectedStudent?.id === student.id 
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-200' 
                                    : 'bg-white border-slate-50 text-slate-600 hover:border-indigo-100'
                                }`}
                            >
                                <p className="text-[10px] font-bold opacity-60 uppercase mb-1">{student.student_id}</p>
                                <h4 className="font-black uppercase tracking-tight">{student.full_name}</h4>
                            </button>
                        ))
                    ) : (
                        <div className="p-10 bg-slate-50 rounded-4xl border-2 border-dashed border-slate-200 text-center">
                            <p className="text-slate-400 text-[10px] font-bold uppercase">No records found</p>
                        </div>
                    )}
                </div>

                {/* Detailed View */}
                <div className="lg:col-span-2">
                    {selectedStudent ? (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                            {/* Student Profile Card */}
                            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-2xl shadow-slate-200/50">
                                <div className="flex flex-wrap items-start justify-between gap-6">
                                    <div className="flex items-center gap-6">
                                        <div className="w-24 h-24 bg-indigo-50 rounded-4xl flex items-center justify-center text-indigo-600 border-4 border-white shadow-inner">
                                            <User size={48} />
                                        </div>
                                        <div>
                                            <h2 className="text-3xl font-black text-slate-900 uppercase italic leading-none mb-2">
                                                {selectedStudent.full_name}
                                            </h2>
                                            <div className="flex gap-2">
                                                <span className="px-3 py-1 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-lg">
                                                    {selectedStudent.course}
                                                </span>
                                                <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[9px] font-black uppercase rounded-lg">
                                                    Year {selectedStudent.year_level}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 p-4 rounded-2xl">
                                            <Hash size={16} className="text-indigo-600 mb-2"/>
                                            <p className="text-[9px] font-black text-slate-400 uppercase">Student ID</p>
                                            <p className="text-sm font-bold text-slate-800">{selectedStudent.student_id}</p>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-2xl">
                                            <GraduationCap size={16} className="text-indigo-600 mb-2"/>
                                            <p className="text-[9px] font-black text-slate-400 uppercase">Status</p>
                                            <p className="text-sm font-bold text-slate-800">Regular</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Request History Table */}
                            <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-xl shadow-slate-200/50">
                                <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <History size={18} className="text-indigo-600"/>
                                        <h3 className="font-black text-xs uppercase tracking-widest text-slate-900">Recent Request History</h3>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                                                <th className="p-6">Document</th>
                                                <th className="p-6">Date</th>
                                                <th className="p-6">Status</th>
                                                <th className="p-6">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm">
                                            {requestHistory.length > 0 ? requestHistory.map((req) => (
                                                <tr key={req.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-6 font-bold text-slate-800 uppercase text-xs">{req.document_type}</td>
                                                    <td className="p-6 text-slate-500 font-medium">
                                                        {new Date(req.created_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="p-6">
                                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                                                            req.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                                                        }`}>
                                                            {req.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-6">
                                                        <button className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors">
                                                            <ExternalLink size={16}
                                                                onClick={() => alert("View document functionality not implemented in this demo.")}
                                                            />

                                                        </button>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan="4" className="p-10 text-center text-slate-400 italic">No previous requests found.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-100 flex flex-col items-center justify-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 text-slate-300">
                            <AlertCircle size={48} className="mb-4 opacity-20"/>
                            <p className="font-black uppercase text-xs tracking-[0.2em]">Select a student to view full dossier</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}