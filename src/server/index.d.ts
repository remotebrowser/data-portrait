import 'express-session';

declare module 'express-session' {
  interface SessionData {
    createdAt?: number;
  }
}

declare global {
  namespace Express {
    interface Request {
      sessionID: string;
    }
  }
}
