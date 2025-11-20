import React from 'react';
import { SurveyData } from '../types.ts';
import { MapPin, User, Trash2, CloudCheck, CloudOff, Mail, Phone } from 'lucide-react';

interface SurveyListProps {
  surveys: SurveyData[];
  onDelete: (id: string) => void;
}

const SurveyList: React.FC<SurveyListProps> = ({ surveys, onDelete }) => {

  if (surveys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500 bg-slate-800/30 backdrop-blur-sm rounded-3xl shadow-sm border border-white/5 p-8 text-center">
        <div className="bg-slate-800/50 p-6 rounded-full mb-4 shadow-inner ring-1 ring-white/5">
          <User className="w-10 h-10 text-indigo-400/70" />
        </div>
        <p className="text-xl font-bold text-slate-300">No hay registros</p>
        <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">Presiona "Nueva Encuesta" para comenzar a recopilar datos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-end mb-2 px-2">
        <h2 className="text-2xl font-bold text-slate-200 flex items-center gap-2">
          Registros
          <span className="text-sm font-normal text-slate-400 bg-slate-800 border border-slate-700 px-2 py-1 rounded-full">{surveys.length}</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-5">
        {surveys.map((survey) => (
          <div key={survey.id} className="bg-slate-800/40 backdrop-blur-md p-5 rounded-3xl shadow-lg shadow-black/20 border border-white/5 relative group hover:bg-slate-800/60 transition-all duration-300">
             <button 
                onClick={() => onDelete(survey.id)}
                className="absolute top-5 right-5 p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                title="Eliminar registro"
             >
                <Trash2 className="w-5 h-5" />
             </button>
             
             {/* Sync Status Indicator */}
             <div className="absolute top-6 right-16" title={survey.synced ? "Sincronizado con Drive" : "Pendiente de sincronizar"}>
               {survey.synced ? (
                 <div className="bg-emerald-500/10 p-1.5 rounded-full border border-emerald-500/20">
                    <CloudCheck className="w-4 h-4 text-emerald-500" />
                 </div>
               ) : (
                 <div className="bg-slate-700/50 p-1.5 rounded-full border border-slate-600/30">
                    <CloudOff className="w-4 h-4 text-slate-400" />
                 </div>
               )}
             </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-5">
              <div className="bg-gradient-to-br from-cyan-600 to-indigo-600 p-3.5 rounded-2xl text-white shadow-lg shadow-cyan-900/20 shrink-0">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100 pr-12 leading-tight">{survey.nombre || 'Sin Nombre'}</h3>
                <div className="flex flex-wrap gap-3 mt-1.5">
                   <span className="inline-flex items-center gap-1 text-xs font-medium text-cyan-300 bg-cyan-950/40 border border-cyan-500/20 px-2 py-1 rounded-md">
                      <Mail className="w-3 h-3" /> {survey.correo || 'N/A'}
                   </span>
                   <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-300 bg-purple-950/40 border border-purple-500/20 px-2 py-1 rounded-md">
                      <Phone className="w-3 h-3" /> {survey.telefono || 'N/A'}
                   </span>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-950/30 rounded-xl p-4 space-y-3 border border-white/5">
              <div className="flex items-start gap-3 text-sm text-slate-400">
                <MapPin className="w-5 h-5 text-pink-500 mt-0.5 shrink-0" />
                <p className="font-medium">
                  {survey.direccion}, {survey.barrio}, <span className="text-slate-200 font-bold">{survey.ciudad}</span>
                </p>
              </div>
              
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                 <div className="flex gap-4 text-xs text-slate-500 font-mono">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-slate-600">Documento</span>
                      <span className="font-semibold text-slate-400">{survey.numero_documento}</span>
                    </div>
                 </div>
                 <span className="text-[10px] text-slate-600">{new Date(survey.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SurveyList;