import { Router, Request, Response } from "express";

export const healthRouter = Router();

healthRouter.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});
