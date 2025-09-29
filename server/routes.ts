import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { 
  transcribeRequestSchema, 
  jarvisRequestSchema,
  insertConversationSchema 
} from "@shared/schema";

// Configure multer for audio file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize OpenAI client
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get conversation history
  app.get("/api/conversations/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const conversations = await storage.getConversations(sessionId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Transcribe audio using OpenAI Whisper
  app.post("/api/transcribe", upload.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      // Get the original filename and extension for better OpenAI compatibility
      const originalFilename = req.file.originalname || 'audio.wav';
      const fileExtension = originalFilename.split('.').pop() || 'wav';
      
      // Create a properly named file for OpenAI
      const properFilename = `audio_${Date.now()}.${fileExtension}`;
      const audioReadStream = fs.createReadStream(req.file.path);
      
      console.log(`Processing audio file: ${originalFilename} -> ${properFilename}`);
      console.log(`File size: ${req.file.size} bytes, MIME type: ${req.file.mimetype}`);

      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const transcription = await openai.audio.transcriptions.create({
        file: audioReadStream,
        model: "whisper-1",
      });

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({ 
        text: transcription.text,
        duration: 0
      });
    } catch (error) {
      console.error("Error transcribing audio:", error);
      res.status(500).json({ error: "Failed to transcribe audio" });
    }
  });

  // Send message to JARVIS (n8n webhook)
  app.post("/api/jarvis", async (req, res) => {
    try {
      const validatedData = jarvisRequestSchema.parse(req.body);
      const { message, sessionId } = validatedData;

      // Save user message to conversation history
      await storage.addConversation({
        sessionId,
        message,
        sender: 'user',
      });

      // Send to n8n webhook
      const webhookUrl = process.env.N8N_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL_ENV_VAR || "https://your-n8n-instance.com/webhook/jarvis";
      
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: message }),
      });

      if (!webhookResponse.ok) {
        throw new Error(`Webhook request failed: ${webhookResponse.statusText}`);
      }

      const jarvisResponseRaw = await webhookResponse.text();
      console.log("Raw n8n response:", jarvisResponseRaw);
      
      // Parse the n8n response which comes as JSON string
      let jarvisResponse;
      try {
        const parsed = JSON.parse(jarvisResponseRaw);
        jarvisResponse = parsed.output || jarvisResponseRaw; // Extract 'output' field or use raw text
        console.log("Parsed JARVIS response:", jarvisResponse);
      } catch (parseError) {
        jarvisResponse = jarvisResponseRaw; // Fallback to raw text
        console.log("Using raw response as fallback:", jarvisResponse);
      }
      
      // CRITICAL: Check for empty response from n8n
      if (!jarvisResponse || jarvisResponse.trim() === '') {
        console.error("❌ EMPTY RESPONSE from n8n! Check workflow status and configuration.");
        jarvisResponse = "Es tut mir leid, aber ich kann momentan nicht antworten. Bitte überprüfen Sie die n8n-Workflow-Konfiguration oder versuchen Sie es später erneut.";
      }

      // Generate speech using OpenAI TTS (KOSTENGÜNSTIGE ALTERNATIVE zu ElevenLabs)
      let audioUrl: string | undefined;
      try {
        // COST-EFFECTIVE: Try OpenAI TTS first (viel günstiger als ElevenLabs)
        console.log("🎤 Using cost-effective OpenAI TTS for speech generation");
        console.log("Generating speech for response:", jarvisResponse.substring(0, 100) + "...");
        
        const ttsResponse = await openai.audio.speech.create({
          model: "tts-1", // Fastest and cheapest model ($15/1M chars vs ElevenLabs $120/1M chars)
          voice: "onyx", // Deep male voice similar to JARVIS
          input: jarvisResponse,
          response_format: "mp3",
          speed: 1.0,
        });

        if (ttsResponse) {
          const audioBuffer = await ttsResponse.arrayBuffer();
          const audioFilename = `jarvis_openai_${Date.now()}.mp3`;
          const audioPath = path.join('uploads', audioFilename);
          
          // Ensure uploads directory exists
          if (!fs.existsSync('uploads')) {
            fs.mkdirSync('uploads');
          }
          
          fs.writeFileSync(audioPath, Buffer.from(audioBuffer));
          audioUrl = `/api/audio/${audioFilename}`;
          console.log("✅ OpenAI TTS file generated successfully:", audioFilename);
        }
      } catch (openaiTtsError) {
        console.error("❌ OpenAI TTS failed, trying ElevenLabs fallback:", openaiTtsError);
        
        // FALLBACK: Use ElevenLabs if OpenAI TTS fails
        try {
          const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY_ENV_VAR || "default_key";
          const voiceId = process.env.ELEVENLABS_VOICE_ID || "ErXwobaYiN019PkySvjV";
          console.log("🎤 Fallback to ElevenLabs voice:", voiceId);
          
          const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
              'Accept': 'audio/mpeg',
              'Content-Type': 'application/json',
              'xi-api-key': elevenLabsApiKey,
            },
            body: JSON.stringify({
              text: jarvisResponse,
              model_id: "eleven_multilingual_v2",
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.5,
              },
            }),
          });

          if (ttsResponse.ok) {
            const audioBuffer = await ttsResponse.arrayBuffer();
            const audioFilename = `jarvis_${Date.now()}.mp3`;
            const audioPath = path.join('uploads', audioFilename);
            
            if (!fs.existsSync('uploads')) {
              fs.mkdirSync('uploads');
            }
            
            fs.writeFileSync(audioPath, Buffer.from(audioBuffer));
            audioUrl = `/api/audio/${audioFilename}`;
            console.log("✅ ElevenLabs fallback voice file generated:", audioFilename);
          } else {
            const errorText = await ttsResponse.text();
            console.error("❌ ElevenLabs API Error:", ttsResponse.status, errorText);
          }
        } catch (elevenLabsError) {
          console.error("❌ Both OpenAI TTS and ElevenLabs failed:", elevenLabsError);
          // Continue without audio if both TTS services fail
        }
      }

      // Save JARVIS response to conversation history
      await storage.addConversation({
        sessionId,
        message: jarvisResponse,
        sender: 'jarvis',
        audioUrl,
      });

      res.json({ 
        response: jarvisResponse,
        audioUrl 
      });
    } catch (error) {
      console.error("Error processing JARVIS request:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  // Serve audio files
  app.get("/api/audio/:filename", (req, res) => {
    const { filename } = req.params;
    const audioPath = path.join('uploads', filename);
    
    if (fs.existsSync(audioPath)) {
      res.setHeader('Content-Type', 'audio/mpeg');
      fs.createReadStream(audioPath).pipe(res);
    } else {
      res.status(404).json({ error: "Audio file not found" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
