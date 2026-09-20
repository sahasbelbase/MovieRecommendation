import React, { useState } from 'react';
import { X, Download, Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function DataModal({ isOpen, onClose, onShowToast }) {
 const { user, watchedMovies, refreshWatchedList } = useAuth();
 const [activeTab, setActiveTab] = useState('export'); // 'export' | 'import'
 const [importing, setImporting] = useState(false);
 const [importStatus, setImportStatus] = useState(null);

 if (!isOpen) return null;

 // Handle Export download
 const handleExport = async (format) => {
  try {
   if (user) {
    // Authenticated backend export
    const response = await api.get(`/users/export?format=${format}`, {
     responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `my_movies_watched.${format}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
   } else {
    // Guest local storage export
    let content = '';
    let mime = 'application/json';
    if (format === 'json') {
     content = JSON.stringify(watchedMovies, null, 2);
    } else {
     mime = 'text/csv';
     const header = "id,title,year,vote_average,genres,watched_at\n";
     const rows = watchedMovies.map(m =>
      `${m.id},"${(m.title || '').replace(/"/g, '""')}",${m.year || ''},${m.vote_average || ''},"${(m.genres || []).join('; ')}",${m.watched_at || ''}`
     ).join("\n");
     content = header + rows;
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my_movies_watched.${format}`;
    a.click();
    URL.revokeObjectURL(url);
   }

   if (onShowToast) {
    onShowToast({ message: `Exported ${watchedMovies.length} movies as ${format.toUpperCase()}` });
   }
  } catch (err) {
   console.error("Export error:", err);
   alert("Failed to export data");
  }
 };

 // Handle Import upload
 const handleFileUpload = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setImporting(true);
  setImportStatus(null);

  try {
   if (user) {
    // Authenticated backend import
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/users/import', formData, {
     headers: { 'Content-Type': 'multipart/form-data' }
    });
    setImportStatus({
     success: true,
     message: `Successfully imported ${res.data.imported_count} movies into your library!`
    });
    await refreshWatchedList();
   } else {
    // Guest mode import
    const reader = new FileReader();
    reader.onload = async (event) => {
     try {
      const text = event.target.result;
      let count = 0;
      if (file.name.endsWith('.json')) {
       const parsed = JSON.parse(text);
       const combined = [...watchedMovies];
       const seen = new Set(combined.map(m => m.id));
       for (const item of parsed) {
        if (item.id &&!seen.has(item.id)) {
         combined.push(item);
         seen.add(item.id);
         count++;
        }
       }
       localStorage.setItem('cinematch_guest_watched', JSON.stringify(combined));
       window.location.reload();
      } else {
       setImportStatus({
        success: false,
        message: "For CSV and Letterboxd imports, please sign in so our server can match movie IDs and stream posters."
       });
       setImporting(false);
       return;
      }
      setImportStatus({
       success: true,
       message: `Imported ${count} movies into local session!`
      });
     } catch (err) {
      setImportStatus({ success: false, message: "Could not parse JSON file." });
     }
    };
    reader.readAsText(file);
   }
  } catch (err) {
   console.error("Import error:", err);
   setImportStatus({ success: false, message: "Import failed. Please verify file format." });
  } finally {
   setImporting(false);
  }
 };

 return (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
   <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-6">
    {/* Header */}
    <div className="flex items-center justify-between">
     <div>
      <h3 className="text-lg font-bold text-white">Data Portability</h3>
      <p className="text-xs text-zinc-400">Export or import your personal movie history</p>
     </div>
     <button
      onClick={onClose}
      aria-label="Close modal"
      className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
     >
      <X className="w-4 h-4" />
     </button>
    </div>

    {/* Tab Switcher */}
    <div className="flex rounded-xl bg-zinc-900 p-1 border border-zinc-800">
     <button
      onClick={() => setActiveTab('export')}
      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
       activeTab === 'export'
        ? 'bg-zinc-800 text-white shadow'
        : 'text-zinc-400 hover:text-zinc-200'
      }`}
     >
      Export My Data
     </button>
     <button
      onClick={() => setActiveTab('import')}
      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
       activeTab === 'import'
        ? 'bg-zinc-800 text-white shadow'
        : 'text-zinc-400 hover:text-zinc-200'
      }`}
     >
      Import Watchlist / Letterboxd
     </button>
    </div>

    {/* Export View */}
    {activeTab === 'export' && (
     <div className="space-y-4">
      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-2">
       <p className="text-xs text-zinc-300">
        You currently have <strong>{watchedMovies.length}</strong> movies recorded. You own your data and can download it at any time.
       </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
       <button
        onClick={() => handleExport('json')}
        className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-200 transition-all"
       >
        <Download className="w-4 h-4 text-rose-500" />
        Download JSON
       </button>
       <button
        onClick={() => handleExport('csv')}
        className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-200 transition-all"
       >
        <FileText className="w-4 h-4 text-emerald-500" />
        Download CSV
       </button>
      </div>
     </div>
    )}

    {/* Import View */}
    {activeTab === 'import' && (
     <div className="space-y-4">
      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-2">
       <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Supported Formats</h4>
       <p className="text-xs text-zinc-400 leading-relaxed">
        • <strong>Letterboxd</strong>: Upload your exported <code className="text-zinc-300">watched.csv</code> file directly.<br />
        • <strong>Movie Recommendation Engine / Custom JSON</strong>: Upload previously exported JSON backup.
       </p>
      </div>

      {/* Dropzone */}
      <label className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-800 hover:border-zinc-700 rounded-xl bg-zinc-900/30 cursor-pointer transition-colors group">
       <Upload className="w-8 h-8 text-zinc-500 group-hover:text-rose-400 transition-colors mb-2" />
       <span className="text-xs font-medium text-zinc-300">
        {importing ? "Importing movies..." : "Click or drag file here to import"}
       </span>
       <span className="text-[11px] text-zinc-500 mt-1">.json or.csv files up to 10MB</span>
       <input
        type="file"
        accept=".json,.csv"
        onChange={handleFileUpload}
        disabled={importing}
        className="hidden"
       />
      </label>

      {importStatus && (
       <div className={`p-3 rounded-xl flex items-start gap-2.5 text-xs ${
        importStatus.success
         ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
         : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
       }`}>
        {importStatus.success ? (
         <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        ) : (
         <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
        )}
        <span>{importStatus.message}</span>
       </div>
      )}
     </div>
    )}
   </div>
  </div>
 );
}
