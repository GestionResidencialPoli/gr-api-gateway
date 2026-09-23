import type { NextFunction, Request, Response } from "express";
import Logger from "../lib/logger";

function handleError(error: Error, req: Request, res: Response, _next: NextFunction): void {
  Logger.error(error, { url: req.originalUrl, method: req.method });

  res.status(500).json({ error: { message: "Error interno del gateway." } });
}

export default handleError;
