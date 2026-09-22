import type { NextFunction, Request, Response } from "express";
import Logger from "../lib/logger";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handleError(error: Error, req: Request, res: Response, next: NextFunction): void {
  Logger.error(error, { url: req.originalUrl, method: req.method });

  res.status(500).json({ error: { message: "Error interno del gateway." } });
}

export default handleError;
