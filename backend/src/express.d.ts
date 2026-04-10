import type { LiveSessionWithPlayer } from "./services/liveSession.js";

declare global {
  namespace Express {
    interface Request {
      liveSession?: LiveSessionWithPlayer | null;
    }
  }
}

export {};
