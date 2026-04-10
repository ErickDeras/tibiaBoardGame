/** Tablero único compartido (sala global). Si no está definido, no se exige sesión en las rutas. */
export function getSharedBoardId(): string | null {
  const v = process.env.SHARED_BOARD_ID?.trim();
  return v || null;
}

export const MAX_LIVE_SESSIONS = 4;
export const LIVE_SESSION_WINDOW_MS = 120_000;
