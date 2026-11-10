import type { Server, IncomingMessage, ServerResponse } from "node:http";

export interface Servicio {
  manejar(req: IncomingMessage, res: ServerResponse): Promise<void>;
  cerrar(): Promise<void>;
  /** Espera a que terminen el mail, el aviso a Meta y las escrituras en curso (pruebas). */
  esperar(): Promise<void>;
  /** Reintenta lo pendiente de las últimas 24 horas (mails y Purchase que no salieron). */
  barrer(): Promise<void>;
}

export interface OpcionesServicio {
  dataDir?: string;
  env?: Record<string, string | undefined>;
  planDe?: (funnel: string) => unknown | Promise<unknown>;
  fetch?: (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; text?: () => Promise<string> }>;
  garantiaDias?: number;
  esperaReintentoMs?: number;
  log?: (mensaje: string) => void;
}

export function crear(opciones?: OpcionesServicio): Server;
export function crearServicio(opciones?: OpcionesServicio): Promise<Servicio>;
export function validar(tipo: "lead" | "click", d: unknown): Record<string, string> | null;
