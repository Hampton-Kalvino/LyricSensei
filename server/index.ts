import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// --- ENHANCED CORS Middleware with detailed logging ---
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Log EVERY incoming request with its origin
  log(`[CORS] ${req.method} ${req.path} | Origin: ${origin || 'NONE'}`);
  
  const allowedOrigins = [
    'https://localhost',
    'http://localhost',
    'capacitor://localhost',
    'ionic://localhost',
    'https://lyricsensei.com',
    'http://lyricsensei.com',
    'http://localhost:5000',
    'http://localhost:5173',
    'http://10.0.2.2:5000',
    'http://127.0.0.1:5000',
  ];

  // More permissive matching
  let shouldAllow = false;
  
  if (origin) {
    // Exact match
    if (allowedOrigins.includes(origin)) {
      shouldAllow = true;
      log(`[CORS] ✓ Exact match for: ${origin}`);
    }
    // Pattern match
    else if (
      origin.includes('localhost') || 
      origin.includes('127.0.0.1') ||
      origin.includes('10.0.2.2') ||
      origin.startsWith('capacitor://') ||
      origin.startsWith('ionic://')
    ) {
      shouldAllow = true;
      log(`[CORS] ✓ Pattern match for: ${origin}`);
    }
    else {
      log(`[CORS] ✗ BLOCKING: ${origin}`);
    }
    
    if (shouldAllow) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  } else {
    // No origin - allow with wildcard
    log(`[CORS] No origin header, using wildcard`);
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  // ALWAYS set these
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    log(`[CORS] OPTIONS preflight for ${req.path}`);
    return res.status(204).end();
  }

  next();
});

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      
      log(logLine);
    }
  });

  next();
});

// Register your API routes
(async () => {
  const server = await registerRoutes(app);

  // Error handler - MUST come after routes but BEFORE Vite
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    log(`[ERROR] ${status}: ${message}`);
    res.status(status).json({ message });
  });

  // Setup Vite or static serving
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, "0.0.0.0", () => {
    log(`========================================`);
    log(`✓ Server running on http://0.0.0.0:${PORT}`);
    log(`✓ CORS enabled for Capacitor mobile apps`);
    log(`✓ Watching for origins containing: localhost, 127.0.0.1, capacitor://`);
    log(`========================================`);
  });
})();