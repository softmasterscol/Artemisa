import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { X, AlertCircle, Mic, Cpu } from 'lucide-react';
import { SurveyData, SaveRecordArgs } from '../types.ts';
import { createBlob, decodeAudioData, base64ToUint8Array } from '../utils/audio.ts';

interface SurveyorProps {
  onSave: (data: Omit<SurveyData, 'id' | 'timestamp'>) => void;
  onCancel: () => void;
}

const Surveyor: React.FC<SurveyorProps> = ({ onSave, onCancel }) => {
  const [isConnecting, setIsConnecting] = useState(true);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);

  // Audio Contexts and Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Gemini Client
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Function Declaration for saving data
  const saveRecordTool: FunctionDeclaration = {
    name: 'save_survey_record',
    parameters: {
      type: Type.OBJECT,
      description: 'Guarda la información recopilada de la encuesta.',
      properties: {
        nombre: { type: Type.STRING, description: 'Nombre completo del encuestado' },
        telefono: { type: Type.STRING, description: 'Número de teléfono' },
        numero_documento: { type: Type.STRING, description: 'Número de documento de identidad' },
        correo: { type: Type.STRING, description: 'Correo electrónico' },
        ciudad: { type: Type.STRING, description: 'Ciudad de residencia' },
        barrio: { type: Type.STRING, description: 'Barrio de residencia' },
        direccion: { type: Type.STRING, description: 'Dirección completa' },
      },
      required: ['nombre', 'telefono', 'ciudad', 'barrio', 'direccion'],
    },
  };

  const initializeSession = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // Setup Audio Contexts
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      inputAudioContextRef.current = new AudioContext({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
      
      const outputNode = outputAudioContextRef.current.createGain();
      outputNode.connect(outputAudioContextRef.current.destination);

      // Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Session Connected');
            setIsConnecting(false);

            // Setup Audio Input Processing
            if (!inputAudioContextRef.current || !streamRef.current) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Simple volume visualization
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              // Smooth volume transition
              setVolume(prev => prev * 0.8 + rms * 0.2);

              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
            
            sourceRef.current = source;
            processorRef.current = processor;
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Tool Calls (Saving Data)
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'save_survey_record') {
                  const args = fc.args as unknown as SaveRecordArgs;
                  onSave(args);
                  // Send success response
                  sessionPromise.then((session) => {
                     session.sendToolResponse({
                        functionResponses: {
                           id: fc.id,
                           name: fc.name,
                           response: { result: "Record saved successfully. The survey is complete." }
                        }
                     })
                  })
                }
              }
            }

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

              const audioBytes = base64ToUint8Array(base64Audio);
              const audioBuffer = await decodeAudioData(audioBytes, ctx, 24000, 1);
              
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode); // Connect to gain node we created earlier
              
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) {
                  setIsAiSpeaking(false);
                }
              });

              setIsAiSpeaking(true);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onclose: () => {
            console.log('Session closed');
            setIsConnecting(false);
          },
          onerror: (e) => {
            console.error('Session error', e);
            setError('Connection error. Please restart.');
            setIsConnecting(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `
            Eres Atenea, un asistente de encuestas de campo futurista y eficiente.
            
            TU MISIÓN:
            Recolectar datos personales del usuario.

            FLUJO OBLIGATORIO:
            1. Saluda y pregunta: "¿Me podría indicar su nombre completo?".
            2. Luego pregunta UNO POR UNO:
               - Número de teléfono
               - Número de documento (DNI/ID)
               - Correo electrónico
               - Ciudad de residencia
               - Barrio
               - Dirección exacta
            
            3. NO pidas Cédula aparte, solo el número de documento general.
            
            4. Al terminar, di "Procesando datos..." y ejecuta 'save_survey_record'.
          `,
          tools: [{ functionDeclarations: [saveRecordTool] }],
        }
      });

      sessionRef.current = sessionPromise;

    } catch (err) {
      console.error("Initialization error:", err);
      setError("Failed to initialize microphone or AI connection.");
      setIsConnecting(false);
    }
  }, [onSave]);

  useEffect(() => {
    initializeSession();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (processorRef.current && inputAudioContextRef.current) {
        processorRef.current.disconnect();
        if(sourceRef.current) sourceRef.current.disconnect();
      }
      if (inputAudioContextRef.current?.state !== 'closed') {
        inputAudioContextRef.current?.close();
      }
      if (outputAudioContextRef.current?.state !== 'closed') {
        outputAudioContextRef.current?.close();
      }
    };
  }, []);

  // --- FUTURISTIC VISUALS ---
  const primaryColor = isAiSpeaking ? '#d946ef' : '#06b6d4'; // Fuchsia vs Cyan
  const glowShadow = `0 0 ${isAiSpeaking ? '40px' : '20px'} ${primaryColor}`;
  
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col text-white font-mono selection:bg-cyan-500/30">
      {/* Ambient Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-black to-black opacity-80 pointer-events-none"></div>
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] opacity-20 transition-colors duration-700 ${isAiSpeaking ? 'bg-fuchsia-600' : 'bg-cyan-600'}`}></div>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 z-20 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full ${isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-green-500 shadow-[0_0_10px_#22c55e]'}`}></div>
          <span className="text-xs tracking-[0.2em] uppercase text-cyan-100/60">
             {isConnecting ? 'INITIALIZING...' : 'ATENEA ONLINE'}
          </span>
        </div>
        <button onClick={onCancel} className="group relative p-3 rounded-full overflow-hidden transition-all hover:bg-white/10">
           <X className="w-6 h-6 text-slate-300 group-hover:text-white group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      {/* Main Scene */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        
        {error ? (
            <div className="flex flex-col items-center text-red-400 gap-6 z-10 animate-in fade-in zoom-in duration-300">
              <div className="p-4 border border-red-500/30 rounded-full bg-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                 <AlertCircle className="w-12 h-12" />
              </div>
              <div className="text-center space-y-2">
                  <p className="text-xl font-bold tracking-wider text-red-500">SYSTEM ERROR</p>
                  <p className="text-sm text-red-300/70">{error}</p>
              </div>
              <button 
                onClick={() => initializeSession()}
                className="px-8 py-3 bg-red-900/20 hover:bg-red-900/40 border border-red-500/50 rounded-none uppercase tracking-widest text-xs transition-all hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]"
              >
                Reboot System
              </button>
            </div>
        ) : (
            <div className="relative flex items-center justify-center">
               
               {/* --- QUANTUM CORE AVATAR --- */}
               
               {/* 1. Static HUD Ring */}
               <div className="absolute w-[320px] h-[320px] rounded-full border border-dashed border-slate-700/50 animate-[spin_60s_linear_infinite]"></div>
               <div className="absolute w-[340px] h-[340px] rounded-full border border-slate-800/30 flex justify-center items-center">
                  <div className="absolute top-0 h-2 w-[1px] bg-slate-600"></div>
                  <div className="absolute bottom-0 h-2 w-[1px] bg-slate-600"></div>
                  <div className="absolute left-0 w-2 h-[1px] bg-slate-600"></div>
                  <div className="absolute right-0 w-2 h-[1px] bg-slate-600"></div>
               </div>

               {/* 2. Outer Gyro Ring */}
               <div 
                  className={`absolute w-64 h-64 rounded-full border-[1px] border-t-transparent border-b-transparent transition-colors duration-500 ${isAiSpeaking ? 'border-fuchsia-500/60' : 'border-cyan-500/60'} animate-[spin_4s_linear_infinite]`}
                  style={{ boxShadow: isAiSpeaking ? 'inset 0 0 20px rgba(217,70,239,0.2)' : 'inset 0 0 20px rgba(6,182,212,0.2)' }}
               ></div>

               {/* 3. Inner Gyro Ring (Counter Rotate) */}
               <div 
                  className={`absolute w-48 h-48 rounded-full border-[2px] border-l-transparent border-r-transparent transition-colors duration-300 ${isAiSpeaking ? 'border-fuchsia-400' : 'border-cyan-400'} animate-[spin_3s_linear_infinite_reverse]`}
               ></div>

               {/* 4. The Core */}
               <div className="relative z-10 flex items-center justify-center">
                  {/* Inner Glow Orb */}
                  <div 
                    className={`w-20 h-20 rounded-full transition-all duration-100 ease-out ${isAiSpeaking ? 'bg-fuchsia-500' : 'bg-cyan-500'}`}
                    style={{ 
                        transform: `scale(${isAiSpeaking ? 1.2 + (Math.random() * 0.2) : 0.8 + volume * 3})`,
                        boxShadow: glowShadow
                    }}
                  >
                    <div className="absolute inset-0 bg-white/30 rounded-full blur-md animate-pulse"></div>
                  </div>
                  
                  {/* Particle Noise (Simulated with overlay) */}
                  <div className="absolute inset-0 mix-blend-overlay bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-50 rounded-full"></div>
               </div>

            </div>
        )}

        {/* Status Display */}
        <div className="absolute bottom-24 w-full text-center space-y-4 z-20">
           {!error && (
             <>
                <div className="flex justify-center gap-8 text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold">
                    <div className="flex flex-col items-center gap-1">
                        <Cpu className="w-4 h-4 opacity-50" />
                        <span>Processing</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <Mic className={`w-4 h-4 ${!isAiSpeaking ? 'text-cyan-400 animate-pulse' : 'opacity-30'}`} />
                        <span>Input</span>
                    </div>
                </div>
                
                <div className="h-8 flex items-center justify-center">
                    <p className={`text-2xl font-light tracking-widest uppercase transition-all duration-300 ${isAiSpeaking ? 'text-fuchsia-300 drop-shadow-[0_0_8px_rgba(217,70,239,0.8)]' : 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]'}`}>
                        {isConnecting ? 'CALIBRATING...' : isAiSpeaking ? 'TRANSMITTING' : 'LISTENING'}
                    </p>
                </div>
             </>
           )}
        </div>
      </div>
    </div>
  );
};

export default Surveyor;