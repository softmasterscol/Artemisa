import React, { useState, useEffect } from 'react';
import { Plus, UserCheck, FileSpreadsheet, Settings, X, Save, Link as LinkIcon, HelpCircle, Sparkles, Download } from 'lucide-react';
import SurveyList from './components/SurveyList.tsx';
import Surveyor from './components/Surveyor.tsx';
import { SurveyData, AppView } from './types.ts';
import * as XLSX from 'xlsx';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [surveys, setSurveys] = useState<SurveyData[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Load from local storage on mount
  useEffect(() => {
    const storedSurveys = localStorage.getItem('voice_surveys');
    if (storedSurveys) {
      try {
        setSurveys(JSON.parse(storedSurveys));
      } catch (e) {
        console.error("Failed to load surveys", e);
      }
    }

    const storedSheetUrl = localStorage.getItem('google_sheet_url');
    if (storedSheetUrl) {
      setSheetUrl(storedSheetUrl);
    }

    // Handle PWA Install Prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  // Save surveys to local storage on change
  useEffect(() => {
    localStorage.setItem('voice_surveys', JSON.stringify(surveys));
  }, [surveys]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Save settings
  const handleSaveSettings = () => {
    localStorage.setItem('google_sheet_url', sheetUrl);
    setShowSettings(false);
  };

  // Sync to Google Sheet
  const syncToGoogleSheet = async (data: SurveyData): Promise<boolean> => {
    if (!sheetUrl) return false;
    try {
      // We use no-cors mode because Google Apps Script Web Apps don't easily support CORS preflight
      // for simple POST requests without complex headers. 
      // Note: In no-cors, we can't read the response, but the data is sent.
      await fetch(sheetUrl, {
        method: 'POST',
        mode: 'no-cors', 
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return true;
    } catch (error) {
      console.error("Sync failed", error);
      return false;
    }
  };

  const handleSaveSurvey = async (data: Omit<SurveyData, 'id' | 'timestamp'>) => {
    const newSurvey: SurveyData = {
      ...data,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      synced: false
    };

    // Optimistic update locally
    let finalSurvey = { ...newSurvey };
    
    // Try sync if URL is configured
    if (sheetUrl) {
      const success = await syncToGoogleSheet(newSurvey);
      finalSurvey.synced = success;
    }

    setSurveys(prev => [finalSurvey, ...prev]);
    setView(AppView.DASHBOARD);
  };

  const handleDeleteSurvey = (id: string) => {
     if(window.confirm("¿Estás seguro de eliminar este registro?")) {
        setSurveys(prev => prev.filter(s => s.id !== id));
     }
  };

  const handleExport = () => {
    if (surveys.length === 0) return;

    // Preparar datos para exportación limpia con encabezados en español
    const dataToExport = surveys.map(s => ({
      "Fecha": new Date(s.timestamp).toLocaleDateString(),
      "Hora": new Date(s.timestamp).toLocaleTimeString(),
      "Nombre": s.nombre,
      "Teléfono": s.telefono,
      "Documento": s.numero_documento,
      "Correo": s.correo,
      "Ciudad": s.ciudad,
      "Barrio": s.barrio,
      "Dirección": s.direccion
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    
    // Ajustar anchos de columna sugeridos
    const wscols = [
      {wch: 12}, // Fecha
      {wch: 10}, // Hora
      {wch: 25}, // Nombre
      {wch: 15}, // Teléfono
      {wch: 15}, // Documento
      {wch: 25}, // Correo
      {wch: 15}, // Ciudad
      {wch: 20}, // Barrio
      {wch: 35}, // Dirección
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos Recopilados");
    
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Reporte_ATENEA_${dateStr}.xlsx`);
  };

  const googleScriptCode = `function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var rawData = e.postData.contents;
  var data = JSON.parse(rawData);
  
  // Crea encabezados si la hoja está vacía
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["ID", "Fecha", "Nombre", "Teléfono", "Documento", "Correo", "Ciudad", "Barrio", "Dirección"]);
  }
  
  sheet.appendRow([
    data.id, 
    data.timestamp, 
    data.nombre, 
    data.telefono, 
    data.numero_documento, 
    data.correo, 
    data.ciudad, 
    data.barrio, 
    data.direccion
  ]);
  
  return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col relative font-sans text-slate-200 selection:bg-cyan-500/30">
      {/* Background Shapes */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] mix-blend-screen animate-blob"></div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] mix-blend-screen animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] mix-blend-screen animate-blob animation-delay-4000"></div>
      </div>

      {/* Navigation */}
      <header className="bg-slate-900/70 backdrop-blur-md border-b border-white/5 sticky top-0 z-30 shadow-lg shadow-black/20 pt-safe">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-cyan-600 to-indigo-600 p-2 rounded-xl shadow-lg shadow-cyan-500/20 border border-white/10">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400 tracking-tight hidden sm:block">ATENEA</h1>
            <h1 className="text-xl font-bold text-cyan-400 tracking-tight sm:hidden">ATENEA</h1>
          </div>
          
          <div className="flex items-center gap-2">
            {view === AppView.DASHBOARD && (
              <>
                 {deferredPrompt && (
                   <button
                     onClick={handleInstallClick}
                     className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-cyan-900/20 animate-pulse"
                   >
                     <Download className="w-4 h-4" />
                     <span className="hidden sm:inline">Instalar App</span>
                   </button>
                 )}
                 
                 {surveys.length > 0 && (
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-2 bg-emerald-600/80 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-900/20 border border-emerald-500/20"
                    title="Exportar a Excel"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span className="hidden sm:inline">Excel</span>
                  </button>
                )}
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                  title="Configuración Drive"
                >
                  <Settings className="w-6 h-6" />
                </button>
             </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 z-10 pb-20">
        {view === AppView.DASHBOARD && (
          <div className="space-y-6 fade-in">
            
            {/* Action Card */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 rounded-3xl p-8 text-white shadow-2xl shadow-indigo-900/50 flex flex-col sm:flex-row items-center justify-between gap-6 transform hover:scale-[1.01] transition-all duration-300 border border-white/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>
              <div className="relative z-10">
                <h2 className="text-3xl font-extrabold mb-2 tracking-tight">Nueva Encuesta</h2>
                <p className="text-indigo-100 text-lg font-medium opacity-90">Activa el asistente de voz con IA.</p>
              </div>
              <button 
                onClick={() => setView(AppView.SURVEYOR)}
                className="relative z-10 bg-white text-indigo-700 hover:bg-indigo-50 active:scale-95 px-8 py-4 rounded-full font-bold shadow-xl transition-all flex items-center gap-2 whitespace-nowrap text-lg"
              >
                <Plus className="w-6 h-6" />
                Comenzar
              </button>
            </div>

            {/* Warning if not connected */}
            {!sheetUrl && surveys.length > 0 && (
               <div className="bg-amber-900/20 backdrop-blur-sm border border-amber-500/30 rounded-2xl p-4 flex gap-3 items-start shadow-sm">
                  <div className="bg-amber-500/20 p-2 rounded-full">
                    <HelpCircle className="w-5 h-5 text-amber-400 shrink-0" />
                  </div>
                  <div>
                    <h3 className="font-bold text-amber-200 text-sm">Sincronización desactivada</h3>
                    <p className="text-amber-200/70 text-sm mt-1">Configura la conexión con Google Sheets en ajustes (⚙️) para respaldar tus datos.</p>
                  </div>
               </div>
            )}

            {/* List */}
            <SurveyList surveys={surveys} onDelete={handleDeleteSurvey} />
          </div>
        )}

        {/* Surveyor Overlay */}
        {view === AppView.SURVEYOR && (
          <Surveyor 
            onSave={handleSaveSurvey} 
            onCancel={() => setView(AppView.DASHBOARD)} 
          />
        )}
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-3xl shadow-2xl shadow-black/50 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-700">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900">
              <h3 className="font-bold text-xl text-slate-100 flex items-center gap-2">
                <div className="bg-green-900/30 p-2 rounded-lg border border-green-500/20">
                   <LinkIcon className="w-5 h-5 text-green-400" />
                </div>
                Conexión Google Sheets
              </h3>
              <button onClick={() => setShowSettings(false)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto text-sm text-slate-400 space-y-6 bg-slate-900">
              <div>
                <label className="block font-bold text-slate-300 mb-2 text-base">URL del Script (Web App)</label>
                <input 
                  type="text" 
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/..."
                  className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all text-slate-100 placeholder-slate-600"
                />
                <p className="text-xs text-slate-500 mt-2 pl-1">Pega aquí la URL generada por Apps Script.</p>
              </div>

              <div className="bg-indigo-900/20 p-5 rounded-2xl border border-indigo-500/20 space-y-3">
                <h4 className="font-bold text-indigo-300 flex items-center gap-2">
                  Instrucciones rápidas
                </h4>
                <ol className="list-decimal ml-4 space-y-2 text-indigo-200/70 marker:text-indigo-500 marker:font-bold">
                  <li>Crea una hoja en <strong>Google Drive</strong>.</li>
                  <li>Ve a <strong>Extensiones &gt; Apps Script</strong>.</li>
                  <li>Pega el código de abajo.</li>
                  <li><strong>Implantar (Deploy) &gt; Nueva implementación</strong>.</li>
                  <li>Tipo: <strong>Aplicación web</strong>. Acceso: <strong>Cualquiera (Anyone)</strong>.</li>
                  <li>Copia la URL resultante.</li>
                </ol>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-2">Código Apps Script:</label>
                <div className="relative group">
                  <pre className="bg-black text-emerald-300 p-5 rounded-2xl text-xs overflow-x-auto font-mono leading-relaxed border border-slate-700 group-hover:border-emerald-500/50 transition-colors">
                    {googleScriptCode}
                  </pre>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-800 flex justify-end bg-slate-900">
              <button 
                onClick={handleSaveSettings}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-cyan-900/50 transition-all active:scale-95"
              >
                <Save className="w-5 h-5" />
                Guardar y Conectar
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="p-6 text-center text-slate-500 text-xs font-medium relative z-10">
        <p>Powered by Google Gemini 2.5 Flash & React</p>
      </footer>
    </div>
  );
};

export default App;