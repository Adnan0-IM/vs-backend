import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { createRouteHandler } from "uploadthing/express";

import { uploadRouter } from "./uploadthing.js";
import { organizationRouter } from "./routes/organizationRoutes.js";
import { documentRouter } from "./routes/documentRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// enable CORS for localhost:5173
const corsOptions = {
  origin: ["http://localhost:5173", "https://vs.adnanilyas.dev", "http://localhost:3000"],
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
app.get("/", (req, res) => {
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
          <a href="/about">About</a>
          <a href="/api-data">API Data</a>
          <a href="/healthz">Health</a>
        </nav>
        <h1>Welcome to <strong>VeriDoc</strong> Api 🚀</h1>
        <p>API for issuing and verifying documents.</p>
        <p>Check out the <a href="/about">About</a> page for more information.</p>
        <img src="/logo.png" alt="Logo" width="120" />
      </body>
    </html>
  `);
});

app.get("/about", function (req, res) {
  res.sendFile(path.join(__dirname, "..", "components", "about.htm"));
});

// Example API endpoint - JSON
app.get("/api-data", (req, res) => {
  res.json({
    message: "Here is some sample API data",
    items: ["apple", "banana", "cherry"],
  });
});

// Health check
app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});


app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
export default app;
