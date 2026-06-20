import { NextFunction, Request, Response } from "express";

// Fails closed: an unconfigured ADMIN_PASSCODE means admin endpoints are
// unreachable rather than open to anyone.
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const configured = process.env.ADMIN_PASSCODE;
  const provided = req.header("X-Admin-Passcode");

  if (!configured || !provided || provided !== configured) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }

  next();
}
