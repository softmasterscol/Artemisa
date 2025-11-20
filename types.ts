export interface SurveyData {
  id: string;
  timestamp: string;
  nombre: string;
  telefono: string;
  numero_documento: string; // Generic document
  correo: string;
  ciudad: string;
  barrio: string;
  direccion: string;
  synced?: boolean;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  SURVEYOR = 'SURVEYOR'
}

// Helper type for the Gemini Function Call arguments
export interface SaveRecordArgs {
  nombre: string;
  telefono: string;
  numero_documento: string;
  correo: string;
  ciudad: string;
  barrio: string;
  direccion: string;
}