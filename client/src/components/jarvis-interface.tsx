import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import VoiceButton from "./voice-button";
import { apiRequest } from "@/lib/queryClient";
import type { JarvisRequest, JarvisResponse } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface JarvisInterfaceProps {
  sessionId: string;
}

export default function JarvisInterface({ sessionId }: JarvisInterfaceProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("Ready for your command.");
  const [voiceVisualizationVisible, setVoiceVisualizationVisible] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [showConversationalAI, setShowConversationalAI] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load ElevenLabs widget script with comprehensive error handling
  useEffect(() => {
    const loadElevenLabsScript = async () => {
      try {
        console.log('Loading ElevenLabs script...');
        
        // Check if script already exists
        const existingScript = document.querySelector('script[src*="convai-widget-embed"]');
        if (existingScript) {
          console.log('ElevenLabs script already loaded');
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
        script.async = true;
        script.type = 'text/javascript';
        
        // Add script load handlers
        const scriptLoaded = new Promise((resolve, reject) => {
          script.onload = () => {
            console.log('ElevenLabs script loaded successfully');
            resolve(true);
          };
          script.onerror = (error) => {
            console.error('ElevenLabs script failed to load:', error);
            reject(error);
          };
        });

        document.body.appendChild(script);
        await scriptLoaded;
        
      } catch (error) {
        console.error('Error loading ElevenLabs script:', error);
      }
    };

    // Add global error handler to catch any uncaught exceptions
    const handleGlobalError = (event: ErrorEvent) => {
      console.log('Global error event details:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        type: event.type
      });
      
      // Defensive checks for ElevenLabs script error patterns
      const message = event.message || '';
      const filename = event.filename || '';
      
      if (
        (message === 'Script error.' && filename === '' && event.lineno === 0) ||
        (message.includes('elevenlabs') || filename.includes('elevenlabs')) ||
        (message === '' && filename === '' && event.lineno === 0) ||
        (event.error === null && message === 'Script error.')
      ) {
        console.log('Suppressed ElevenLabs-related error (harmless)');
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return false;
      }
      
      console.error('Unhandled global error:', event.error, event.message, event.filename, event.lineno);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.log('Promise rejection details:', {
        reason: event.reason,
        promise: event.promise,
        type: event.type
      });
      
      // Suppress ElevenLabs-related promise rejections
      if (
        (event.reason && typeof event.reason === 'string' && event.reason.includes('elevenlabs')) ||
        (event.reason === null) ||
        (event.reason === undefined)
      ) {
        console.log('Suppressed ElevenLabs-related promise rejection (harmless)');
        event.preventDefault();
        return false;
      }
      
      console.error('Unhandled promise rejection:', event.reason);
      event.preventDefault();
    };

    // Store original error handlers
    const originalOnError = window.onerror;
    const originalOnUnhandledRejection = window.onunhandledrejection;

    // Override window.onerror for complete error control
    window.onerror = (message, filename, lineno, colno, error) => {
      console.log('Window.onerror caught:', { message, filename, lineno, colno, error });
      
      // Check if this is an ElevenLabs-related error
      const msgStr = String(message || '');
      const fileStr = String(filename || '');
      
      if (
        msgStr === 'Script error.' ||
        msgStr.includes('elevenlabs') ||
        fileStr.includes('elevenlabs') ||
        (msgStr === '' && fileStr === '' && lineno === 0)
      ) {
        console.log('Suppressed ElevenLabs error via window.onerror');
        return true; // Prevent default error handling
      }
      
      // Call original handler for other errors
      if (originalOnError) {
        return originalOnError.call(window, message, filename, lineno, colno, error);
      }
      return false;
    };

    // Override onunhandledrejection
    window.onunhandledrejection = (event) => {
      console.log('Window.onunhandledrejection caught:', event.reason);
      
      if (!event.reason || event.reason === null || event.reason === undefined) {
        console.log('Suppressed null/undefined promise rejection');
        event.preventDefault();
        return true;
      }
      
      // Call original handler for legitimate errors
      if (originalOnUnhandledRejection) {
        return originalOnUnhandledRejection.call(window, event);
      }
      return false;
    };
    
    // Also keep event listeners as backup
    window.addEventListener('error', handleGlobalError, true);
    window.addEventListener('unhandledrejection', handleUnhandledRejection, true);

    loadElevenLabsScript();

    return () => {
      // Restore original error handlers
      window.onerror = originalOnError;
      window.onunhandledrejection = originalOnUnhandledRejection;
      
      // Cleanup event listeners
      window.removeEventListener('error', handleGlobalError, true);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
      
      const script = document.querySelector('script[src*="convai-widget-embed"]');
      if (script && document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Mutation for transcribing audio
  const transcribeMutation = useMutation({
    mutationFn: async (audioBlob: Blob): Promise<{ text: string; duration: number }> => {
      const formData = new FormData();
      // Map MIME types to correct file extensions
      let fileExtension = 'webm'; // default
      if (audioBlob.type.includes('wav')) {
        fileExtension = 'wav';
      } else if (audioBlob.type.includes('mp4') || audioBlob.type.includes('m4a')) {
        fileExtension = 'mp4';
      } else if (audioBlob.type.includes('webm')) {
        fileExtension = 'webm';
      } else if (audioBlob.type.includes('ogg')) {
        fileExtension = 'ogg';
      }
      console.log('Audio blob type:', audioBlob.type, 'Using extension:', fileExtension);
      formData.append('audio', audioBlob, `recording.${fileExtension}`);
      
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to transcribe audio');
      }
      
      return response.json();
    },
  });

  // Mutation for sending message to JARVIS
  const jarvisMutation = useMutation({
    mutationFn: async (request: JarvisRequest): Promise<JarvisResponse> => {
      const response = await apiRequest('POST', '/api/jarvis', request);
      return response.json();
    },
    onSuccess: (jarvisResponse: JarvisResponse) => {
      // Invalidate conversations to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', sessionId] });
      
      // Play audio response if available
      if (jarvisResponse.audioUrl) {
        setStatus("JARVIS is responding...");
        const audio = new Audio(jarvisResponse.audioUrl);
        audio.onended = () => setStatus("Ready for your command, sir");
        audio.onerror = () => setStatus("Ready for your command, sir");
        audio.play().catch(() => setStatus("Ready for your command, sir"));
      } else {
        setStatus("Ready for your command, sir");
      }
    },
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });
      
      // Try different audio formats that OpenAI Whisper supports, prioritize webm with opus
      let mediaRecorder;
      
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/mp4' });
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/wav' });
      } else {
        // Use default format
        mediaRecorder = new MediaRecorder(stream);
      }
      
      console.log('MediaRecorder using format:', mediaRecorder.mimeType);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        // Use the actual MIME type from the recorder
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        console.log('Recording format:', mimeType, 'Blob type:', audioChunksRef.current[0]?.type);
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log('Final blob type:', audioBlob.type, 'Size:', audioBlob.size);
        await processAudioInput(audioBlob);
        
        // Stop all tracks to free up microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setVoiceVisualizationVisible(true);
      setStatus("Listening, sir...");
    } catch (error) {
      console.error('Error starting recording:', error);
      setStatus("Microphone access denied, sir.");
      toast({
        title: "Microphone Error",
        description: "Unable to access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecordingHandler = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setVoiceVisualizationVisible(false);
      setStatus("Processing your command...");
    }
  };

  const processAudioInput = async (audioBlob: Blob) => {
    try {
      // Step 1: Transcribe audio
      setStatus("Transcribing your message...");
      const transcription = await transcribeMutation.mutateAsync(audioBlob);
      
      // Step 2: Send to JARVIS
      setStatus("JARVIS is processing your request...");
      const jarvisResponse = await jarvisMutation.mutateAsync({
        message: transcription.text,
        sessionId,
      });

      // Step 3: Play audio response if available
      if (jarvisResponse.audioUrl) {
        setStatus("JARVIS is responding...");
        const audio = new Audio(jarvisResponse.audioUrl);
        audio.onended = () => setStatus("Ready for your command, sir");
        audio.play().catch(console.error);
      } else {
        setStatus("Ready for your command, sir");
      }

    } catch (error) {
      console.error('Error processing audio:', error);
      setStatus("Something went wrong, sir. Please try again.");
      toast({
        title: "Processing Error",
        description: "Failed to process your request. Please try again.",
        variant: "destructive",
      });
    }
  };

  const isProcessing = transcribeMutation.isPending || jarvisMutation.isPending;

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative" data-testid="jarvis-main-content">
      
      {/* Advanced JARVIS Hub - High-tech Iron Man Style */}
      <div className="relative flex items-center justify-center" data-testid="jarvis-hub">
        
        {/* Outer Technical Ring - 600px */}
        <div className="absolute w-[600px] h-[600px] border border-cyan-400/40 rounded-full">
          {/* Outer ring segments */}
          {Array.from({ length: 60 }, (_, i) => (
            <div
              key={`outer-${i}`}
              className={`absolute w-2 h-1 ${i % 5 === 0 ? 'bg-cyan-400' : 'bg-cyan-400/40'}`}
              style={{
                top: '2px',
                left: '50%',
                transformOrigin: '50% 300px',
                transform: `translateX(-50%) rotate(${i * 6}deg)`,
              }}
            />
          ))}
          {/* Binary data segments */}
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={`binary-${i}`}
              className="absolute text-cyan-400/60 text-xs font-mono"
              style={{
                top: '15px',
                left: '50%',
                transformOrigin: '50% 285px',
                transform: `translateX(-50%) rotate(${i * 45}deg)`,
              }}
            >
              {Math.random() > 0.5 ? '1010110' : '0101101'}
            </div>
          ))}
        </div>

        {/* Middle Technical Ring - 480px */}
        <div className="absolute w-[480px] h-[480px] border-2 border-cyan-400/60 rounded-full">
          {/* Segmented data ring */}
          {Array.from({ length: 40 }, (_, i) => (
            <div
              key={`middle-${i}`}
              className={`absolute w-1 h-4 ${i % 3 === 0 ? 'bg-cyan-400' : 'bg-cyan-400/50'}`}
              style={{
                top: '0px',
                left: '50%',
                transformOrigin: '50% 240px',
                transform: `translateX(-50%) rotate(${i * 9}deg)`,
              }}
            />
          ))}
        </div>

        {/* Inner Data Ring - 360px */}
        <div className="absolute w-[360px] h-[360px] border-2 border-cyan-400/80 rounded-full animate-pulse-slow">
          {/* Measurement scales */}
          {Array.from({ length: 72 }, (_, i) => (
            <div
              key={`inner-${i}`}
              className={`absolute ${i % 6 === 0 ? 'w-0.5 h-6 bg-cyan-400' : 'w-px h-3 bg-cyan-400/60'}`}
              style={{
                top: '0px',
                left: '50%',
                transformOrigin: '50% 180px',
                transform: `translateX(-50%) rotate(${i * 5}deg)`,
              }}
            />
          ))}
          {/* Binary ring */}
          <div className="absolute inset-4 border border-cyan-400/40 rounded-full flex items-center justify-center">
            <div className="text-cyan-400/60 text-xs font-mono absolute top-2 left-1/2 transform -translate-x-1/2">
              001100100111001
            </div>
          </div>
        </div>

        {/* Core Ring - 240px */}
        <div className="absolute w-[240px] h-[240px] border-4 border-cyan-400 rounded-full intense-glow animate-glow">
          {/* Core segments */}
          {Array.from({ length: 24 }, (_, i) => (
            <div
              key={`core-${i}`}
              className="absolute w-1 h-8 bg-cyan-400"
              style={{
                top: '0px',
                left: '50%',
                transformOrigin: '50% 120px',
                transform: `translateX(-50%) rotate(${i * 15}deg)`,
              }}
            />
          ))}
        </div>

        {/* Authentic JARVIS Central Interface */}
        <div className="relative w-48 h-48 flex items-center justify-center">
          
          {/* Outermost Ring with Segmented Arcs */}
          <div className="absolute w-48 h-48 border border-cyan-400/50 rounded-full">
            {/* Outer arc segments */}
            {Array.from({ length: 60 }, (_, i) => (
              <div
                key={`outer-arc-${i}`}
                className={`absolute ${
                  i % 10 === 0 ? 'w-0.5 h-4 bg-cyan-400' : 
                  i % 5 === 0 ? 'w-px h-3 bg-cyan-400/80' : 
                  'w-px h-2 bg-cyan-400/40'
                }`}
                style={{
                  top: '-2px',
                  left: '50%',
                  transformOrigin: '50% 96px',
                  transform: `translateX(-50%) rotate(${i * 6}deg)`,
                }}
              />
            ))}
            
            {/* Technical readouts around outer ring */}
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-cyan-400/80 text-xs font-mono">
              0000000000
            </div>
            <div className="absolute top-1/2 -right-8 transform -translate-y-1/2 rotate-90 text-cyan-400/80 text-xs font-mono">
              0010100101
            </div>
            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-cyan-400/80 text-xs font-mono">
              1111111111
            </div>
            <div className="absolute top-1/2 -left-8 transform -translate-y-1/2 -rotate-90 text-cyan-400/80 text-xs font-mono">
              1010001010
            </div>
          </div>

          {/* Middle Ring with Measurement Indicators */}
          <div className="absolute w-36 h-36 border border-cyan-400/70 rounded-full">
            {/* Middle ring segments */}
            {Array.from({ length: 36 }, (_, i) => (
              <div
                key={`middle-arc-${i}`}
                className={`absolute ${
                  i % 6 === 0 ? 'w-0.5 h-3 bg-cyan-400' : 'w-px h-2 bg-cyan-400/60'
                }`}
                style={{
                  top: '-1px',
                  left: '50%',
                  transformOrigin: '50% 72px',
                  transform: `translateX(-50%) rotate(${i * 10}deg)`,
                }}
              />
            ))}
            
            {/* Quadrant numbers */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-cyan-400 text-sm font-mono">0</div>
            <div className="absolute top-1/2 -right-4 transform -translate-y-1/2 text-cyan-400 text-sm font-mono">90</div>
            <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 text-cyan-400 text-sm font-mono">180</div>
            <div className="absolute top-1/2 -left-4 transform -translate-y-1/2 text-cyan-400 text-sm font-mono">270</div>
          </div>

          {/* Inner Technical Ring */}
          <div className="absolute w-28 h-28 border border-cyan-400/80 rounded-full">
            {/* Inner precision markers */}
            {Array.from({ length: 24 }, (_, i) => (
              <div
                key={`inner-precision-${i}`}
                className="absolute w-px h-2 bg-cyan-400/70"
                style={{
                  top: '0px',
                  left: '50%',
                  transformOrigin: '50% 56px',
                  transform: `translateX(-50%) rotate(${i * 15}deg)`,
                }}
              />
            ))}
            
            {/* Status indicators */}
            <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-cyan-400 rounded-full"></div>
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-cyan-400 rounded-full"></div>
            <div className="absolute top-1/2 left-2 transform -translate-y-1/2 w-1 h-1 bg-cyan-400 rounded-full"></div>
            <div className="absolute top-1/2 right-2 transform -translate-y-1/2 w-1 h-1 bg-cyan-400 rounded-full"></div>
          </div>

          {/* Tony Stark Arc Reactor Core - Heartbeat Pulsation */}
          <div className="absolute w-24 h-24 flex items-center justify-center">
            {/* Outer Halo - Breathing Glow */}
            <div className="absolute w-24 h-24 bg-gradient-radial from-cyan-400/20 via-cyan-400/10 to-transparent rounded-full animate-jarvis-glow-breath"></div>
            
            {/* Core Shell - Main Pulsing Heart */}
            <div className="absolute w-20 h-20 bg-gradient-radial from-cyan-500/40 via-cyan-400/25 to-transparent rounded-full border-2 border-cyan-400 animate-jarvis-core-pulse flex items-center justify-center">
              {/* Inner Heart Chamber */}
              <div className="w-16 h-16 bg-gradient-radial from-black/60 via-black/40 to-black/20 border border-cyan-400/80 rounded-full flex items-center justify-center relative overflow-hidden">
                {/* Central Arc Reactor Glow */}
                <div className="absolute inset-1 bg-gradient-radial from-cyan-400/30 to-transparent rounded-full"></div>
                
                {/* J.A.R.V.I.S Text with Heartbeat Glow */}
                <span className="relative z-10 text-cyan-100 font-mono text-sm tracking-[0.2em] font-bold animate-jarvis-text-glow">
                  J.A.R.V.I.S
                </span>
              </div>
            </div>
          </div>

          {/* Connection Lines to Outer Elements */}
          <div className="absolute w-0.5 h-8 bg-gradient-to-t from-cyan-400 to-transparent top-0 left-1/2 transform -translate-x-1/2"></div>
          <div className="absolute w-0.5 h-8 bg-gradient-to-b from-cyan-400 to-transparent bottom-0 left-1/2 transform -translate-x-1/2"></div>
          <div className="absolute h-0.5 w-8 bg-gradient-to-r from-cyan-400 to-transparent top-1/2 left-0 transform -translate-y-1/2"></div>
          <div className="absolute h-0.5 w-8 bg-gradient-to-l from-cyan-400 to-transparent top-1/2 right-0 transform -translate-y-1/2"></div>
        </div>



        {/* Corner HUD Elements */}
        <div className="absolute -top-8 -left-8 w-16 h-16 border-t-2 border-l-2 border-cyan-400/60">
          <div className="absolute top-1 left-1 w-2 h-2 bg-cyan-400"></div>
        </div>
        <div className="absolute -top-8 -right-8 w-16 h-16 border-t-2 border-r-2 border-cyan-400/60">
          <div className="absolute top-1 right-1 w-2 h-2 bg-cyan-400"></div>
        </div>
        <div className="absolute -bottom-8 -left-8 w-16 h-16 border-b-2 border-l-2 border-cyan-400/60">
          <div className="absolute bottom-1 left-1 w-2 h-2 bg-cyan-400"></div>
        </div>
        <div className="absolute -bottom-8 -right-8 w-16 h-16 border-b-2 border-r-2 border-cyan-400/60">
          <div className="absolute bottom-1 right-1 w-2 h-2 bg-cyan-400"></div>
        </div>
      </div>

      {/* Voice Visualization - Positioned near center */}
      {voiceVisualizationVisible && (
        <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 flex items-center justify-center space-x-1" data-testid="voice-visualization">
          <div className="voice-wave" />
          <div className="voice-wave" />
          <div className="voice-wave" />
          <div className="voice-wave" />
          <div className="voice-wave" />
        </div>
      )}

      {/* Talk to JARVIS Button with Conversational AI - Center Bottom */}
      <div className="fixed bottom-16 left-1/2 transform -translate-x-1/2 z-20">
        <VoiceButton
          onStartRecording={() => {
            try {
              console.log('Starting JARVIS conversation...');
              // Show the conversational AI widget
              setShowConversationalAI(true);
              
              // Wait for the custom element to be properly defined and API ready
              const startWidget = async () => {
                try {
                  console.log('Waiting for ElevenLabs widget to be ready...');
                  
                  // Wait for custom element to be defined
                  await customElements.whenDefined('elevenlabs-convai');
                  
                  // Wait longer for the widget to fully initialize
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  
                  let widget = document.querySelector('elevenlabs-convai');
                  let retries = 0;
                  const maxRetries = 10;
                  
                  // Wait for widget API to be available with retries
                  while (retries < maxRetries) {
                    widget = document.querySelector('elevenlabs-convai');
                    
                    if (widget) {
                      console.log(`Widget found (attempt ${retries + 1}), checking API readiness...`);
                      
                      // Check for multiple possible API methods that indicate readiness
                      const apiReady = (
                        typeof (widget as any).startConversation === 'function' ||
                        typeof (widget as any).start === 'function' ||
                        typeof (widget as any).beginConversation === 'function' ||
                        (widget as any).isReady === true ||
                        (widget as any).ready === true
                      );
                      
                      if (apiReady) {
                        console.log('Widget API is ready, starting conversation...');
                        
                        // Try multiple API methods
                        if (typeof (widget as any).startConversation === 'function') {
                          console.log('Using startConversation API...');
                          await (widget as any).startConversation();
                        } else if (typeof (widget as any).start === 'function') {
                          console.log('Using start API...');
                          await (widget as any).start();
                        } else if (typeof (widget as any).beginConversation === 'function') {
                          console.log('Using beginConversation API...');
                          await (widget as any).beginConversation();
                        } else {
                          console.log('Using click fallback...');
                          (widget as HTMLElement).click();
                        }
                        break;
                      } else {
                        console.log(`API not ready yet (attempt ${retries + 1}), waiting...`);
                        await new Promise(resolve => setTimeout(resolve, 500));
                        retries++;
                      }
                    } else {
                      console.log(`Widget not found (attempt ${retries + 1}), waiting...`);
                      await new Promise(resolve => setTimeout(resolve, 500));
                      retries++;
                    }
                  }
                  
                  if (retries >= maxRetries) {
                    console.warn('Widget API timeout - falling back to simple click');
                    const finalWidget = document.querySelector('elevenlabs-convai');
                    if (finalWidget) {
                      (finalWidget as HTMLElement).click();
                    }
                  }
                  
                } catch (widgetError) {
                  console.error('Widget initialization/start failed:', widgetError);
                  // Fallback to simple click even on error
                  const errorWidget = document.querySelector('elevenlabs-convai');
                  if (errorWidget) {
                    console.log('Error fallback: triggering click...');
                    (errorWidget as HTMLElement).click();
                  }
                }
              };
              
              // Start the widget asynchronously
              startWidget();
              
            } catch (error) {
              console.error('Failed to start conversation:', error);
            }
          }}
          onStopRecording={() => {
            try {
              console.log('Stopping JARVIS conversation...');
              // Try to stop the ElevenLabs conversation properly
              const widget = document.querySelector('elevenlabs-convai');
              if (widget && typeof (widget as any).stopConversation === 'function') {
                console.log('Stopping ElevenLabs conversation...');
                (widget as any).stopConversation();
              }
            } catch (error) {
              console.warn('Failed to stop conversation:', error);
            } finally {
              // Always hide the widget regardless of stop success
              setShowConversationalAI(false);
            }
          }}
          isRecording={showConversationalAI}
          isProcessing={isProcessing}
        />
      </div>

      {/* ElevenLabs Conversational AI Widget - Appears when activated */}
      {showConversationalAI && (
        <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 z-50" data-testid="elevenlabs-widget">
          <div className="relative">
            {/* Close button */}
            <button 
              onClick={() => {
                try {
                  console.log('Closing JARVIS widget...');
                  // Try to stop the conversation before closing
                  const widget = document.querySelector('elevenlabs-convai');
                  if (widget && typeof (widget as any).stopConversation === 'function') {
                    (widget as any).stopConversation();
                  }
                } catch (error) {
                  console.warn('Failed to stop conversation on close:', error);
                } finally {
                  // Always close the widget
                  setShowConversationalAI(false);
                }
              }}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs font-bold z-10 border border-red-400"
              data-testid="close-widget"
            >
              ×
            </button>
            
            {/* Widget container with JARVIS styling */}
            <div className="elevenlabs-widget-container">
              <div dangerouslySetInnerHTML={{
                __html: '<elevenlabs-convai agent-id="agent_9001k60fwb0pfwtvnfmz9zh24xh4"></elevenlabs-convai>'
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Legacy Voice Button Backup - Hidden by default */}
      <div className="fixed bottom-8 right-32 z-10 hidden">
        <VoiceButton
          onStartRecording={startRecording}
          onStopRecording={stopRecordingHandler}
          isRecording={isRecording}
          isProcessing={isProcessing}
        />
      </div>

      {/* Temporary Text Input for Testing n8n Webhook - Keep for debugging */}
      <div className="fixed bottom-8 left-8 z-10 flex space-x-2 opacity-50 hover:opacity-100 transition-opacity">
        <Input 
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          placeholder="Debug: Test message..."
          className="w-48 bg-gray-900/90 border-cyan-400/40 text-cyan-400 text-sm"
          onKeyPress={(e) => {
            if (e.key === 'Enter' && testMessage.trim()) {
              jarvisMutation.mutate({ message: testMessage, sessionId });
              setTestMessage("");
            }
          }}
        />
        <Button 
          onClick={() => {
            if (testMessage.trim()) {
              jarvisMutation.mutate({ message: testMessage, sessionId });
              setTestMessage("");
            }
          }}
          disabled={isProcessing || !testMessage.trim()}
          className="bg-cyan-500/60 hover:bg-cyan-500 text-white border border-cyan-400/40 text-sm px-3"
        >
          Test
        </Button>
      </div>


      {/* Processing Overlay - Minimalistic */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50" data-testid="processing-overlay">
          <div className="text-center">
            <div className="w-24 h-24 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin intense-glow" />
          </div>
        </div>
      )}
    </div>
  );
}
