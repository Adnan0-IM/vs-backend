// Global error handlers for serverless environment
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION:", reason);
});

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { createRouteHandler } from "uploadthing/express";

import { uploadRouter } from "./uploadthing.js";
import { organizationRouter } from "./routes/organizationRoutes.js";
import { documentRouter } from "./routes/documentRoutes.js";
import { auth } from "./lib/auth.js";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// enable CORS for localhost:5173
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://vs.adnanilyas.dev",
    "http://localhost:3000",
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options("/api/auth/*splat", cors(corsOptions));

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api/organization", organizationRouter);
app.use("/api/documents", documentRouter);

app.use(
  "/api/uploadthing",
  createRouteHandler({
    router: uploadRouter,
    // config: { ... },
  }),
);

// Home route - HTML
app.get("/", (_, res) => {
  res.type("html").send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <title>VeriDoc Api</title>
        <link rel="stylesheet" href="/style.css" />
      </head>
      <body>
        <nav>
          <a href="/">Home</a>
          <a href="/healthz">Health</a>
        </nav>
        <h1>Welcome to <strong>VeriDoc</strong> Api </h1>
      <p>This is an API for issuing and verifying documents.</p>
      <p>
        A Final year Project by
        <a href="https://adnanilyas.dev">Adnan Iliyasu</a>
      </p>
      <div>
        <p>Hosted on</p>
        <img src="/logo.png" alt="Logo" width="120" />
      </div>
      </body>
    </html>
  `);
});

// Health check
app.get("/healthz", (_, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

export default app;
