import type { Request, Response, NextFunction } from "express";
import type { AuthUser } from "./authenticate";

export function authorize(role: AuthUser["role"]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      res.status(403).json({ error: "Forbidden for this role" });
      return;
    }
    next();
  };
}
