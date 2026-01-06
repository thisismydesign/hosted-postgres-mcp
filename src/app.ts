import express from "express";
import { corsMiddleware } from "./middleware/cors.js";
import { routes } from "./routes/index.js";

export const app = express();
app.use(express.json());
app.use(corsMiddleware);
app.use(routes);
