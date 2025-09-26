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
  const [conversationMode, setConversationMode] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const recognitionRef = useRef<any>(null);
  const interruptRecognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Convert audio blob to WAV format for better OpenAI compatibility
  const convertToWav = async (audioBlob: Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const fileReader = new FileReader();
      
      fileReader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          // Convert to WAV
          const wavBuffer = audioBufferToWav(audioBuffer);
          const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
          
          resolve(wavBlob);
        } catch (error) {
          reject(error);
        }
      };
      
      fileReader.onerror = () => reject(new Error('Failed to read audio file'));
      fileReader.readAsArrayBuffer(audioBlob);
    });
  };

  // Convert AudioBuffer to WAV format
  const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bytesPerSample = 2;
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const bufferSize = 44 + dataSize;
    
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);
    
    // Convert audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return arrayBuffer;
  };

  // Load ElevenLabs conversational agent widget
  useEffect(() => {
    console.log('Loading ElevenLabs conversational agent...');
    
    const loadElevenLabsWidget = async () => {
      try {
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
        
        // Set up widget event listeners after script loads with longer delay
        setTimeout(setupWidgetEventListeners, 1000);
        
      } catch (error) {
        console.error('Error loading ElevenLabs widget:', error);
      }
    };

    const setupWidgetEventListeners = () => {
      // Wait for the widget to be defined
      customElements.whenDefined('elevenlabs-convai').then(() => {
        console.log('ElevenLabs widget defined, setting up event bridge...');
        
        // Monitor for widget events and bridge to n8n
        setTimeout(() => {
          const widget = document.querySelector('elevenlabs-convai');
          if (widget) {
            console.log('Found ElevenLabs widget, setting up conversation bridge...');
            
            // Add mutation observer to capture conversation events
            const observer = new MutationObserver((mutations) => {
              mutations.forEach((mutation) => {
                // Look for text changes that might indicate user input or responses
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                  const text = widget.textContent || '';
                  if (text.trim() && text.length > 5) {
                    console.log('Widget text detected:', text);
                    // You could parse this text and relay specific parts to n8n if needed
                  }
                }
              });
            });
            
            observer.observe(widget, {
              childList: true,
              subtree: true,
              characterData: true
            });
            
            // Try to hook into widget events if available
            ['message', 'speech', 'userInput', 'conversation'].forEach(eventType => {
              widget.addEventListener(eventType, (event: Event) => {
                console.log(`ElevenLabs ${eventType} event:`, event);
                
                // Extract user message and relay to n8n
                const customEvent = event as CustomEvent;
                const userMessage = customEvent.detail?.message || customEvent.detail?.text;
                if (userMessage) {
                  console.log('Relaying user message to n8n:', userMessage);
                  jarvisMutation.mutate({ message: userMessage, sessionId });
                }
              });
            });
          }
        }, 2000);
      }).catch(error => {
        console.error('Error setting up widget listeners:', error);
      });
    };

    loadElevenLabsWidget();
    
    return () => {
      console.log('ElevenLabs widget cleaned up');
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
      setIsWaitingForResponse(true);
      const response = await apiRequest('POST', '/api/jarvis', request);
      return response.json();
    },
    onSuccess: (jarvisResponse: JarvisResponse) => {
      // Invalidate conversations to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', sessionId] });
      setIsWaitingForResponse(false);
      
      // Play audio response if available
      if (jarvisResponse.audioUrl) {
        setStatus("JARVIS is responding...");
        const audio = new Audio(jarvisResponse.audioUrl);
        currentAudioRef.current = audio; // Store reference for stopping
        
        audio.onended = () => {
          currentAudioRef.current = null;
          stopInterruptDetection();
          if (conversationMode) {
            setStatus("Listening, sir...");
            console.log('JARVIS finished speaking, restarting continuous recognition...');
            // Restart the main speech recognition for next input
            setTimeout(() => {
              if (conversationMode) {
                startWebSpeechRecognition();
              }
            }, 1000);
          } else {
            setStatus("Ready for your command, sir.");
          }
        };
        audio.onerror = () => {
          currentAudioRef.current = null;
          stopInterruptDetection();
          if (conversationMode) {
            setStatus("Listening, sir...");
            console.log('Audio error, restarting continuous recognition...');
            // Restart the main speech recognition for next input
            setTimeout(() => {
              if (conversationMode) {
                startWebSpeechRecognition();
              }
            }, 1000);
          } else {
            setStatus("Ready for your command, sir.");
          }
        };
        audio.play().then(() => {
          // Start interrupt detection while JARVIS is speaking
          if (conversationMode) {
            startInterruptDetection();
          }
        }).catch(() => {
          currentAudioRef.current = null;
          stopInterruptDetection();
          if (conversationMode) {
            setStatus("Listening, sir...");
            console.log('Audio play failed, restarting continuous recognition...');
            // Restart the main speech recognition for next input
            setTimeout(() => {
              if (conversationMode) {
                startWebSpeechRecognition();
              }
            }, 1000);
          } else {
            setStatus("Ready for your command, sir.");
          }
        });
      } else {
        if (conversationMode) {
          setStatus("Listening, sir...");
          console.log('No audio response, restarting continuous recognition...');
          // Restart the main speech recognition for next input
          setTimeout(() => {
            if (conversationMode) {
              startWebSpeechRecognition();
            }
          }, 1000);
        } else {
          setStatus("Ready for your command, sir.");
        }
      }
    },
    onError: (error) => {
      console.error('JARVIS request failed:', error);
      setIsWaitingForResponse(false);
      setConversationMode(false); // Exit conversation mode on error
      setStatus("Error occurred. Ready for your command, sir.");
      toast({
        title: "JARVIS Error",
        description: "Failed to process your request. Please try again.",
        variant: "destructive",
      });
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
      
      // Try different audio formats that OpenAI Whisper supports - prioritize MP4 and WAV
      let mediaRecorder;
      
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/mp4' });
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/wav' });
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/ogg;codecs=opus' });
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/ogg' });
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      } else {
        // Use default format and convert to WAV via Web Audio API
        console.log('No preferred formats supported, using default format');
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
        
        // OpenAI supports MP4 directly - skip problematic WAV conversion
        let finalAudioBlob = audioBlob;
        console.log('Using original audio format for OpenAI:', audioBlob.type);
        
        await processAudioInput(finalAudioBlob);
        
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

  // Web Speech API - Continuous conversation mode
  const startWebSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({
        title: "Speech Recognition Not Supported",
        description: "Your browser doesn't support speech recognition. Please try a different browser.",
        variant: "destructive",
      });
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true; // Enable continuous listening
    recognition.interimResults = false;
    recognition.lang = 'de-DE'; // German language for JARVIS
    recognition.maxAlternatives = 1;

    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsRecording(true);
      setVoiceVisualizationVisible(true);
      setConversationMode(true);
      setStatus("Listening, sir...");
      console.log('Web Speech API: Continuous recognition started');
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      console.log('Web Speech API transcribed:', transcript);
      
      // Temporarily pause listening while processing
      setStatus("JARVIS is processing your request...");

      try {
        // Send directly to JARVIS
        await jarvisMutation.mutateAsync({
          message: transcript,
          sessionId,
        });
      } catch (error) {
        console.error('Error sending to JARVIS:', error);
        setStatus("Error processing request. Please try again.");
        toast({
          title: "JARVIS Error",
          description: "Failed to process your request. Please try again.",
          variant: "destructive",
        });
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Web Speech API error:', event.error);
      if (event.error !== 'no-speech') {
        setStatus("Speech recognition error. Please try again.");
        toast({
          title: "Speech Recognition Error",
          description: `Error: ${event.error}. Please try again.`,
          variant: "destructive",
        });
      }
    };

    recognition.onend = () => {
      console.log('Web Speech API recognition ended');
      // Only restart if still in conversation mode and not processing
      if (conversationMode && !jarvisMutation.isPending) {
        setTimeout(() => {
          if (conversationMode && recognitionRef.current) {
            console.log('Restarting continuous recognition...');
            recognitionRef.current.start();
          }
        }, 1000);
      }
    };

    recognition.start();
  };

  const startInterruptDetection = () => {
    console.log('🎤 Starting JARVIS trigger word detection');
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.log('Speech recognition not supported for trigger word detection');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const triggerRecognition = new SpeechRecognition();
    
    // Simple trigger word configuration - like Alexa
    triggerRecognition.continuous = true;
    triggerRecognition.interimResults = false; // Only final results to avoid false triggers
    triggerRecognition.lang = 'de-DE';
    
    triggerRecognition.onresult = (event: any) => {
      const lastResult = event.results[event.results.length - 1];
      const transcript = lastResult[0].transcript.trim().toLowerCase();
      const confidence = lastResult[0].confidence;
      
      console.log(`🎧 Trigger detection: "${transcript}" (confidence: ${confidence})`);
      
      // Check for JARVIS trigger word
      if (transcript.includes('jarvis') && confidence > 0.5) {
        console.log('🎯 JARVIS trigger word detected! Stopping and listening...');
        
        // Stop JARVIS immediately and forcefully
        if (currentAudioRef.current) {
          console.log('🛑 Force stopping JARVIS audio immediately');
          try {
            currentAudioRef.current.pause();
            currentAudioRef.current.currentTime = 0;
            currentAudioRef.current.src = '';
            currentAudioRef.current.load(); // Force reload to stop completely
          } catch (e) {
            console.log('Audio stop error:', e);
          } finally {
            currentAudioRef.current = null;
          }
        }
        
        // Stop trigger detection
        stopInterruptDetection();
        
        // Switch to listening mode for the actual command
        setStatus("Listening for your command, sir...");
        setTimeout(() => {
          console.log('💬 Ready for command after JARVIS trigger');
          // Don't need to call anything here - the main recognition is still running
        }, 500);
      }
    };
    
    triggerRecognition.onerror = (event: any) => {
      console.log('Trigger word detection error:', event.error);
      
      // Silently restart on common errors
      if (event.error === 'no-speech' || event.error === 'audio-capture') {
        setTimeout(() => {
          if (currentAudioRef.current) {
            startInterruptDetection();
          }
        }, 1000);
      }
    };
    
    triggerRecognition.onend = () => {
      // Restart trigger detection if JARVIS is still speaking
      if (currentAudioRef.current) {
        setTimeout(() => {
          startInterruptDetection();
        }, 200);
      }
    };
    
    interruptRecognitionRef.current = triggerRecognition;
    triggerRecognition.start();
  };

  const stopInterruptDetection = () => {
    if (interruptRecognitionRef.current) {
      console.log('Stopping interrupt detection');
      interruptRecognitionRef.current.stop();
      interruptRecognitionRef.current = null;
    }
  };

  const stopWebSpeechRecognition = () => {
    console.log('Stopping Web Speech API recognition');
    
    // Stop current audio playback immediately
    if (currentAudioRef.current) {
      console.log('Stopping JARVIS audio playback');
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current.src = ''; // Force stop
      currentAudioRef.current = null;
    }
    
    // Stop interrupt detection
    stopInterruptDetection();
    
    setConversationMode(false);
    setIsRecording(false);
    setVoiceVisualizationVisible(false);
    setStatus("Ready for your command, sir.");
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  };

  // Legacy function - now unused but kept for compatibility
  const processAudioInput = async (audioBlob: Blob) => {
    console.log('processAudioInput called - this should not happen with Web Speech API');
  };

  const isProcessing = transcribeMutation.isPending || jarvisMutation.isPending;

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative" data-testid="jarvis-main-content">
      
      {/* Advanced JARVIS Hub - High-tech Iron Man Style */}
      <div className="relative flex items-center justify-center" data-testid="jarvis-hub">
        

        {/* Authentic JARVIS Interface - Exactly as shown in reference image */}
        <div className="relative w-64 h-64 flex items-center justify-center">
          
          {/* Ring 5 - Outermost interrupted circles with square dots (like reference) */}
          <div className="absolute w-60 h-60">
            {/* Interrupted outer arc segments */}
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={`outer-arc-${i}`}
                className="absolute bg-cyan-400/60 rounded-full"
                style={{
                  width: i % 2 === 0 ? '35px' : '25px',
                  height: '2px',
                  top: '50%',
                  left: '50%',
                  transformOrigin: '0px 0px',
                  transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateX(118px)`,
                }}
              />
            ))}
            
            {/* Square dot indicators exactly like reference */}
            {Array.from({ length: 16 }, (_, i) => (
              <div
                key={`square-dot-${i}`}
                className="absolute w-1.5 h-1.5 bg-cyan-400/80"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: `translate(-50%, -50%) rotate(${i * 22.5}deg) translateX(115px)`,
                }}
              />
            ))}
          </div>

          {/* Ring 4 - Segmented arcs with strategic gaps (matching reference) */}
          <div className="absolute w-48 h-48">
            {/* Main segmented arcs - broken pattern like reference */}
            {Array.from({ length: 12 }, (_, i) => (
              <div
                key={`seg-arc-${i}`}
                className="absolute bg-cyan-400/70 rounded-sm"
                style={{
                  width: i % 3 === 0 ? '28px' : '20px',
                  height: '1.5px',
                  top: '50%',
                  left: '50%',
                  transformOrigin: '0px 0px',
                  transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateX(94px)`,
                }}
              />
            ))}
          </div>

          {/* Ring 3 - Binary Data Display (curved text like reference) */}
          <div className="absolute w-40 h-40">
            {/* Curved binary text segments around the ring - positioned at radius 78px */}
            {Array.from({ length: 4 }, (_, quadrant) => {
              const binaryStrings = ['0000000000', '0010010010', '0000000000', '0001100010'];
              const angleStart = quadrant * 90 - 25; // Start angle for each quadrant
              return Array.from({ length: 10 }, (_, charIndex) => (
                <div
                  key={`binary-${quadrant}-${charIndex}`}
                  className="absolute text-[9px] font-mono text-cyan-400/90 font-bold"
                  style={{
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${angleStart + charIndex * 5}deg) translateY(-78px) rotate(-${angleStart + charIndex * 5}deg)`,
                  }}
                >
                  {binaryStrings[quadrant][charIndex]}
                </div>
              ));
            })}
          </div>

          {/* Ring 2 - Measurement scales and tick marks (like reference) */}
          <div className="absolute w-32 h-32 border border-cyan-400/70 rounded-full">
            {/* Main tick marks with correct positioning at radius 64px */}
            {Array.from({ length: 72 }, (_, i) => (
              <div
                key={`tick-${i}`}
                className={`absolute bg-cyan-400/80 ${
                  i % 18 === 0 ? 'w-0.5 h-4' : 
                  i % 6 === 0 ? 'w-px h-3' : 
                  'w-px h-2'
                }`}
                style={{
                  top: i % 18 === 0 ? '-8px' : i % 6 === 0 ? '-6px' : '-4px',
                  left: '50%',
                  transformOrigin: '50% 64px',
                  transform: `translateX(-50%) rotate(${i * 5}deg)`,
                }}
              />
            ))}
          </div>

          {/* Ring 1 - Inner bright glow ring (matching reference intensity) */}
          <div className="absolute w-24 h-24 border-2 border-cyan-400 rounded-full bg-gradient-radial from-cyan-400/25 via-cyan-400/15 to-transparent animate-jarvis-core-pulse shadow-[0_0_20px_rgba(0,255,255,0.6)]"></div>

          {/* Center Core - JARVIS Text with authentic glow (exactly like reference) */}
          <div className="absolute w-20 h-20 flex items-center justify-center bg-gradient-radial from-cyan-400/20 via-cyan-400/10 to-transparent rounded-full">
            {/* Central background glow - stronger like reference */}
            <div className="absolute w-16 h-16 bg-gradient-radial from-cyan-400/40 via-cyan-400/20 to-transparent rounded-full animate-jarvis-glow-breath"></div>
            
            {/* J.A.R.V.I.S Text - Authentic font and positioning */}
            <span className="relative z-10 text-white font-sans text-sm tracking-[0.25em] font-normal animate-jarvis-text-glow">
              J.A.R.V.I.S
            </span>
          </div>

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

      {/* Authentic JARVIS HUD Interface */}
      {voiceVisualizationVisible && (
        <div className="jarvis-hud" data-testid="jarvis-hud">
          {/* Outer ring with data points */}
          <div className="jarvis-data-points">
            <div className="data-point"></div>
            <div className="data-point"></div>
            <div className="data-point"></div>
            <div className="data-point"></div>
            <div className="data-point"></div>
          </div>
          
          {/* Animated segments */}
          <div className="jarvis-segments"></div>
          
          {/* Concentric rings */}
          <div className="jarvis-ring-3"></div>
          <div className="jarvis-ring-2"></div>
          <div className="jarvis-ring-1"></div>
          
          {/* Core with JARVIS text */}
          <div className="jarvis-core">
            J.A.R.V.I.S
          </div>
        </div>
      )}

      {/* Talk to JARVIS Button - Center Bottom */}
      <div className="fixed bottom-16 left-1/2 transform -translate-x-1/2 z-20">
        <VoiceButton
          onStartRecording={() => {
            console.log('Starting continuous conversation with JARVIS');
            startWebSpeechRecognition();
          }}
          onStopRecording={() => {
            console.log('Stopping conversation with JARVIS');
            stopWebSpeechRecognition();
          }}
          isRecording={isRecording}
          isProcessing={isProcessing}
          conversationMode={conversationMode}
          isWaitingForResponse={isWaitingForResponse}
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
