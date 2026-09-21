import React, { useState, useEffect } from 'react';
import { X, Star, Calendar, MapPin, Film, User, ChevronRight } from 'lucide-react';
import api from '../api/client';
import MovieCard from './MovieCard';

export default function ActorModal({ person, onClose, onSelectMovie, onShowToast }) {
 const [personInfo, setPersonInfo] = useState(person || null);
 const [movies, setMovies] = useState([]);
 const [loading, setLoading] = useState(true);
 const [expandedBio, setExpandedBio] = useState(false);

 // Keyboard shortcut: Escape to close
 useEffect(() => {
  const handleKeyDown = (e) => {
   if (e.key === 'Escape') onClose();
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
 }, [onClose]);

 useEffect(() => {
  if (!person?.id) return;
  let isMounted = true;
  setLoading(true);

  const fetchPersonCredits = async () => {
   try {
    const res = await api.get(`/movies/person/${person.id}/credits`);
    if (isMounted) {
     setPersonInfo(res.data.person || person);
     setMovies(res.data.movies || []);
    }
   } catch (err) {
    console.error("Error fetching actor filmography:", err);
   } finally {
    if (isMounted) setLoading(false);
   }
  };

  fetchPersonCredits();
  return () => {
   isMounted = false;
  };
 }, [person?.id]);

 if (!person) return null;

 return (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
   {/* Backdrop */}
   <div className="fixed inset-0" onClick={onClose} />

   {/* Modal Card */}
   <div className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-10 my-auto max-h-[90vh] flex flex-col">
    {/* Close Button */}
    <button
     onClick={onClose}
     aria-label="Close modal"
     className="absolute top-4 right-4 z-20 rounded-full p-2 bg-black/70 border border-white/10 text-zinc-400 hover:text-white hover:bg-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
    >
     <X className="w-5 h-5" />
    </button>

    {/* Scrollable Content */}
    <div className="overflow-y-auto flex-1 p-6 sm:p-8 space-y-6">
     {/* Header Profile Section */}
     <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-6 border-b border-zinc-800/80">
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-700 shadow-xl flex-shrink-0 flex items-center justify-center">
       {personInfo?.profile_url || person?.profile_url ? (
        <img
         src={personInfo?.profile_url || person?.profile_url}
         alt={personInfo?.name || person?.name}
         className="w-full h-full object-cover"
        />
       ) : (
        <User className="w-12 h-12 text-zinc-600" />
       )}
      </div>

      <div className="flex-1 text-center sm:text-left space-y-2">
       <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
         {personInfo?.name || person?.name}
        </h2>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/50">
         {personInfo?.known_for_department || person?.known_for_department || 'Actor'}
        </span>
       </div>

       {/* Metadata */}
       <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-mono text-zinc-400">
        {personInfo?.birthday && (
         <span className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
          Born: {personInfo.birthday}
         </span>
        )}
        {personInfo?.place_of_birth && (
         <span className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-zinc-500" />
          {personInfo.place_of_birth}
         </span>
        )}
        <span className="flex items-center gap-1 text-zinc-300">
         <Film className="w-3.5 h-3.5 text-rose-500" />
         {movies.length} {movies.length === 1 ? 'title' : 'titles'} in catalog
        </span>
       </div>

       {/* Biography snippet */}
       {personInfo?.biography && (
        <div className="pt-2">
         <p className={`text-xs text-zinc-300 leading-relaxed ${expandedBio ? '' : 'line-clamp-3'}`}>
          {personInfo.biography}
         </p>
         {personInfo.biography.length > 220 && (
          <button
           onClick={() => setExpandedBio(!expandedBio)}
           className="text-[11px] font-medium text-amber-400 hover:text-amber-300 mt-1"
          >
           {expandedBio ? 'Show less' : 'Read more biography...'}
          </button>
         )}
        </div>
       )}
      </div>
     </div>

     {/* Filmography Section */}
     <div className="space-y-4">
      <div className="flex items-center justify-between">
       <div>
        <h3 className="text-lg font-bold tracking-tight text-white">
         Filmography &amp; Major Works
        </h3>
        <p className="text-xs text-zinc-400">
         Sorted by popularity and critical reception
        </p>
       </div>
      </div>

      {loading ? (
       <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
         <div key={i} className="aspect-[2/3] bg-zinc-900/60 rounded-xl animate-pulse" />
        ))}
       </div>
      ) : movies.length === 0 ? (
       <div className="h-40 flex flex-col items-center justify-center text-center space-y-2">
        <Film className="w-8 h-8 text-zinc-600 stroke-1" />
        <p className="text-xs text-zinc-400">No filmography found for this artist.</p>
       </div>
      ) : (
       <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {movies.map((m) => (
         <div key={`${m.media_type || 'movie'}_${m.id}`} className="relative group">
          <MovieCard
           movie={m}
           onSelect={(selected) => {
            onClose();
            onSelectMovie(selected);
           }}
           onShowToast={onShowToast}
          />
          {m.character && (
           <div className="mt-1 px-1 text-[11px] text-amber-400/90 font-medium truncate" title={m.character}>
            as {m.character}
           </div>
          )}
         </div>
        ))}
       </div>
      )}
     </div>
    </div>
   </div>
  </div>
 );
}
