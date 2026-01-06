import { Router } from "express";
import { mcpRouter } from "./mcp.js";
import { healthRouter } from "./health.js";

export const routes = Router();
routes.use(mcpRouter);
routes.use(healthRouter);
