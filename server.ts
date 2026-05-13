import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 8080;
  
  console.log(`AuraMetropolis Protocol starting...`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`System Port (from env): ${process.env.PORT}`);
  console.log(`Active Port: ${PORT}`);
  console.log(`Running in directory: ${process.cwd()}`);
  console.log(`Bundle directory (__dirname): ${__dirname}`);

  app.use(express.json());

  // Request Logging
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // Gemini Setup with Fallback
  const GEMINI_KEYS = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3
  ].filter(Boolean) as string[];

  const getAI = (keyIndex = 0): GoogleGenAI => {
    return new GoogleGenAI({
      apiKey: GEMINI_KEYS[keyIndex] || GEMINI_KEYS[0] || "",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  };

  // API Routes
  app.post("/api/generate-nft-trait", async (req, res) => {
    const { currentStatus, investmentLevel } = req.body;
    
    let lastError = null;
    for (let i = 0; i < GEMINI_KEYS.length; i++) {
      try {
        const ai = getAI(i);
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Status: ${currentStatus}, Investment Level: ${investmentLevel}`,
          config: {
            systemInstruction: "You are the AuraMetropolis Architect. Generate a short, poetic description (max 20 words) for a real-estate NFT that is evolving. Incorporate the investment level and a sense of 'future luxury'. Return as JSON: { \"traitText\": \"string\", \"auraColor\": \"#HEX\" }",
            responseMimeType: "application/json",
          }
        });
        
        const result = JSON.parse(response.text || "{}");
        return res.json(result);
      } catch (error) {
        console.warn(`Gemini Key ${i + 1} failed, trying next...`, error);
        lastError = error;
      }
    }

    console.error("All Gemini Keys failed:", lastError);
    res.status(500).json({ error: "Failed to generate trait after retrying all available keys" });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
  // Serve from the directory where the bundle is located
    const distPath = path.resolve(__dirname);
    const indexPath = path.join(distPath, 'index.html');
    
    console.log(`Serving static assets from: ${distPath}`);
    console.log(`Index file path: ${indexPath}`);
    
    app.use(express.static(distPath, { index: false }));
    
    app.get('*', (req, res) => {
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error(`Failed to serve index.html from ${indexPath}:`, err);
          res.status(404).send("Metropolis Shell Mismatch: index.html not found in distribution node.");
        }
      });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
