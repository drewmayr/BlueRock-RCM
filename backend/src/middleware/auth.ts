import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { unauthorized, forbidden } from "../lib/errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: string; agencyId: string; role: string };
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(unauthorized("Missing bearer token"));
  }
  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.userId, agencyId: payload.agencyId, role: payload.role };
    next();
  } catch {
    next(unauthorized("Invalid or expired token"));
  }
}

/** Restrict a route to specific roles (OWNER/MANAGER/AGENT). */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(unauthorized());
    if (!roles.includes(req.auth.role)) {
      return next(forbidden("You do not have permission to perform this action"));
    }
    next();
  };
}
