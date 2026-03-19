declare global {
  namespace Express {
    interface Request {
      sessionID: string;
      session?: { createdAt?: number };
    }
  }
}
