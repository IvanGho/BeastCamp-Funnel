import type { Server } from "node:http";
export function crear(): Server;
export function validar(tipo: "lead" | "click", d: unknown): Record<string, string> | null;
