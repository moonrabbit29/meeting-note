import express, { type Request, type Response } from "express";
import { handler } from "../build/handler.js";

const app = express();
const port = 3002;

app.get("/api/hello", (_req: Request, res: Response) => {
	res.json({ message: "Hello from Express" });
});

app.use(handler);

app.listen(port, () => {
	console.log(`Server running on http://localhost:${port}`);
});