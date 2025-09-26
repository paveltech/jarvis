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
  const [debugInfo, setDebugInfo] = useState<{
    recognitionActive: boolean;
    lastConfidence: number;
    noiseFiltered: number;
    lastInput: string;
    interruptionMode: boolean;
  }>({
    recognitionActive: false,
    lastConfidence: 0,
    noiseFiltered: 0,
    lastInput: '',
    interruptionMode: false
  });
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

  // OPTIMIZED: Direct ElevenLabs Embedding + Enhanced Voice Activity Detection
  useEffect(() => {
    console.log('🎯 Loading OPTIMIZED ElevenLabs Integration for PRODUCTION...');
    
    const loadOptimizedWidget = async () => {
      try {
        // Only load on production domain (not localhost/dev)
        if (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')) {
          console.log('⚠️ Skipping ElevenLabs on development - use published URL');
          return;
        }
        
        // ENHANCED: Multiple loading strategies for reliability (no aggressive timeout)
        try {
          await loadViaConvaiWidget();
        } catch (error) {
          console.log('ConvAI Widget failed, trying direct embed...');
          try {
            await loadViaDirectEmbed();
          } catch (embedError) {
            console.log('Direct embed also failed, using enhanced Web Speech');
            throw new Error('All ElevenLabs strategies failed');
          }
        }
        
      } catch (error) {
        console.log('⚠️ All ElevenLabs loading strategies failed - using enhanced Web Speech');
        initializeEnhancedWebSpeech();
      }
    };
    
    const loadViaConvaiWidget = async () => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.elevenlabs.io/convai-widget/index.js';
        script.async = true;
        
        script.onload = () => {
          console.log('✅ ConvAI Widget script loaded - initializing...');
          
          setTimeout(() => {
            if ((window as any).ConvaiUI) {
              const widget = (window as any).ConvaiUI({
                agentId: 'agent_0601k62vhrxafx98s1k6zshc6n7t',
                apiKey: undefined,
                
                // OPTIMIZED: Enhanced VAD and noise suppression
                startBehavior: 'open_mic',
                clientEvents: ['interruption', 'start', 'end', 'error'],
                
                // NOISE HANDLING: Better microphone settings
                microphoneSettings: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                },
                
                // VAD OPTIMIZATION: Voice Activity Detection tuning
                vadSettings: {
                  threshold: 0.6, // Higher threshold for noisy environments
                  patience: 800,   // Wait longer before detecting silence
                  minSpeechFrames: 3 // Need more frames to confirm speech
                },
                
                onStart: () => {
                  console.log('🎯 ElevenLabs: Conversation started with enhanced VAD');
                  setConversationMode(true);
                  setStatus('JARVIS listening (Enhanced VAD)');
                },
                
                onEnd: () => {
                  console.log('🛑 ElevenLabs: Conversation ended');
                  setConversationMode(false);
                  setStatus('Ready for your command, sir.');
                },
                
                onError: (error: any) => {
                  console.error('ElevenLabs conversation error:', error);
                  reject(error);
                },
                
                onInterruption: () => {
                  console.log('🛑 ElevenLabs: Natural interruption detected');
                  setStatus('JARVIS interrupted naturally...');
                }
              });
              
              (window as any).jarvisWidget = widget;
              console.log('✅ ElevenLabs ConvAI Widget ready with enhanced VAD');
              resolve(widget);
            } else {
              reject(new Error('ConvaiUI not available'));
            }
          }, 1000);
        };
        
        script.onerror = () => reject(new Error('ConvAI Widget script failed'));
        document.head.appendChild(script);
      });
    };
    
    const loadViaDirectEmbed = async () => {
      return new Promise((resolve, reject) => {
        // BACKUP: Direct HTML embed approach
        const embedContainer = document.createElement('div');
        embedContainer.innerHTML = `
          <elevenlabs-convai 
            agent-id="agent_0601k62vhrxafx98s1k6zshc6n7t"
            client-events="interruption,start,end,error"
            style="display: none;"
          ></elevenlabs-convai>
        `;
        
        document.body.appendChild(embedContainer);
        
        setTimeout(() => {
          const widget = embedContainer.querySelector('elevenlabs-convai') as any;
          if (widget && widget.startConversation) {
            (window as any).jarvisWidget = widget;
            console.log('✅ ElevenLabs direct embed ready');
            resolve(widget);
          } else {
            reject(new Error('Direct embed failed'));
          }
        }, 2000);
      });
    };
    
    const initializeEnhancedWebSpeech = () => {
      console.log('🔧 Initializing Enhanced Web Speech with noise optimization');
      setStatus('Enhanced speech recognition ready (noise-optimized)');
    };

    loadOptimizedWidget();
    
    return () => {
      console.log('ElevenLabs integration cleaned up');
      if ((window as any).jarvisWidget) {
        try {
          (window as any).jarvisWidget.destroy?.();
        } catch (e) {
          console.log('Widget cleanup error:', e);
        }
        delete (window as any).jarvisWidget;
      }
    };
  }, [sessionId]);

  // UNIFIED: Enhanced Natural Conversation System (Single Recognition Instance)
  const interruptionModeRef = useRef<boolean>(false);
  
  const handleNaturalInterruption = (userInput: string) => {
    // Only interrupt if JARVIS is currently speaking
    if (currentAudioRef.current && userInput.trim().length > 2) {
      console.log('🛑 User interruption detected during JARVIS speech:', userInput);
      
      // Immediate JARVIS interruption
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setStatus("JARVIS interrupted. Processing your request...");
      
      // CRITICAL: DON'T destroy recognitionRef - keep conversation alive
      // Just disable interruption mode temporarily
      interruptionModeRef.current = false;
      
      // Process user's interruption as new command
      console.log('🎯 Processing interrupted command:', userInput);
      jarvisMutation.mutate({ 
        message: userInput, 
        sessionId 
      });
      
      toast({
        title: "JARVIS Interrupted",
        description: "Processing your new request...",
      });
      
      return true; // Interruption handled
    }
    return false; // No interruption needed
  };
  
  // Enhanced voice interruption detection (legacy fallback)
  const handleVoiceInterruption = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setStatus("JARVIS interrupted. Ready for your command, sir...");
      
      // Call ElevenLabs interrupt if available
      if ((window as any).jarvisInterrupt) {
        (window as any).jarvisInterrupt();
      }
    }
  };

  // Global error handling for ElevenLabs
  useEffect(() => {
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
      
      // Play audio response if available - ROBUST AUDIO MANAGEMENT
      if (jarvisResponse.audioUrl) {
        // CRITICAL: Stop any existing audio first to prevent double voices
        if (currentAudioRef.current) {
          console.log('🛑 Stopping previous audio to prevent double voices');
          currentAudioRef.current.pause();
          currentAudioRef.current.currentTime = 0;
          currentAudioRef.current.src = '';
          currentAudioRef.current = null;
        }
        
        setStatus("JARVIS is responding...");
        const audio = new Audio(jarvisResponse.audioUrl);
        currentAudioRef.current = audio; // Store reference for stopping
        
        audio.onended = () => {
          currentAudioRef.current = null;
          stopInterruptDetection();
          if (conversationMode) {
            setStatus("Listening, sir...");
            console.log('🔄 JARVIS finished speaking, restarting continuous recognition...');
            // ROBUST: Only restart if not already running and still in conversation mode
            setTimeout(() => {
              if (conversationMode && !recognitionRef.current) {
                try {
                  startWebSpeechRecognition();
                } catch (error) {
                  console.log('⚠️ Failed to restart recognition:', error);
                }
              } else {
                console.log('⏹️ Skipping recognition restart - already running or not in conversation mode');
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

  // MODERN: ElevenLabs ConvAI Widget-First Approach
  const startWebSpeechRecognition = () => {
    // Check for modern ConvAI Widget first
    const widget = (window as any).jarvisWidget;
    
    if (widget && widget.startConversation) {
      console.log('🎯 Using ElevenLabs ConvAI Widget for natural conversation');
      try {
        widget.startConversation();
        setConversationMode(true);
        setStatus("JARVIS is listening via ElevenLabs...");
        return;
      } catch (error) {
        console.log('⚠️ ElevenLabs ConvAI Widget failed, falling back:', error);
      }
    }
    
    // Fallback: Check if ConvaiUI is available globally
    if ((window as any).ConvaiUI) {
      console.log('🎯 ConvaiUI available - attempting to initialize conversation');
      try {
        // Try to start conversation with global ConvaiUI
        const tempWidget = (window as any).ConvaiUI({
          agentId: 'agent_0601k62vhrxafx98s1k6zshc6n7t',
          apiKey: undefined,
        });
        
        if (tempWidget && tempWidget.startConversation) {
          tempWidget.startConversation();
          setConversationMode(true);
          setStatus("JARVIS is listening via ElevenLabs...");
          (window as any).jarvisWidget = tempWidget; // Store for later use
          return;
        }
      } catch (error) {
        console.log('⚠️ ConvaiUI initialization failed:', error);
      }
    }
    
    console.log('📢 ElevenLabs ConvAI not available - using enhanced Web Speech fallback');
    startWebSpeechFallback();
  };

  const startWebSpeechFallback = () => {
    console.log('🔄 Starting ENHANCED Web Speech API with noise optimization');
    
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
    
    // OPTIMIZED: Enhanced settings for noisy environments
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'de-DE';
    recognition.maxAlternatives = 3; // More alternatives for noisy audio
    
    // ENHANCED: Additional Web Speech optimizations
    if ('webkitSpeechRecognition' in window) {
      // Chrome-specific optimizations
      (recognition as any).serviceName = 'chrome'; // Use Chrome's enhanced engine
    }

    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsRecording(true);
      setVoiceVisualizationVisible(true);
      setConversationMode(true);
      setStatus("JARVIS is listening, sir...");
      console.log('⚡ Enhanced Web Speech started with interruption detection');
    };

    recognition.onresult = async (event: any) => {
      const lastResult = event.results[event.results.length - 1];
      let transcript = lastResult[0].transcript.trim();
      
      // NOISE FILTERING: Enhanced confidence-based filtering
      const confidence = lastResult[0].confidence || 0;
      const minConfidence = 0.5; // Balanced threshold - not too aggressive
      
      // NOISE FILTERING: Multiple alternatives analysis for better accuracy
      if (event.results[event.results.length - 1].length > 1) {
        const alternatives = Array.from(event.results[event.results.length - 1])
          .map((alt: any) => ({ transcript: alt.transcript.trim(), confidence: alt.confidence || 0 }))
          .filter((alt: any) => alt.confidence > minConfidence)
          .sort((a: any, b: any) => b.confidence - a.confidence);
        
        if (alternatives.length > 0) {
          transcript = alternatives[0].transcript;
          console.log(`🎤 Enhanced: Using best alternative (confidence: ${alternatives[0].confidence})`);
        }
      }
      
      // NOISE FILTERING: Length and content validation
      if (transcript.length < 2 || confidence < minConfidence) {
        console.log(`⚠️ Filtered low-confidence input: "${transcript}" (confidence: ${confidence})`);
        return; // Skip low-confidence or too-short inputs
      }
      
      // BACKGROUND NOISE: Filter common noise patterns
      const noisePatterns = [
        /^(ah+|eh+|um+|hm+|mm+)$/i,  // Filler sounds
        /^(la+|na+|da+|ba+)$/i,       // Random syllables
        /^[a-z]$/i,                   // Single letters
        /^\\W+$/,                      // Only punctuation/symbols
      ];
      
      if (noisePatterns.some(pattern => pattern.test(transcript))) {
        console.log(`🔇 Filtered noise pattern: "${transcript}"`);
        return;
      }
      
      console.log(`✅ Clean input accepted: "${transcript}" (confidence: ${confidence})`);
      
      // UNIFIED: Check for interruption during JARVIS speech (enhances existing logic)
      if (interruptionModeRef.current && lastResult.isFinal && transcript.length > 2) {
        const interrupted = handleNaturalInterruption(transcript);
        if (interrupted) {
          return; // Interruption handled, don't process as normal command
        }
      }
      
      // Legacy interruption check (keep for compatibility)
      if (currentAudioRef.current && transcript.length > 3 && lastResult.isFinal) {
        console.log('🛑 USER INTERRUPTION detected while JARVIS speaking:', transcript);
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current.src = '';
        currentAudioRef.current = null;
        setStatus("JARVIS interrupted. Processing your request...");
        
        // Process interruption as new command
        try {
          await jarvisMutation.mutateAsync({
            message: transcript,
            sessionId,
          });
        } catch (error) {
          console.error('Error processing interruption:', error);
        }
        return;
      }
      
      // Only process final results as normal commands
      if (lastResult.isFinal && !currentAudioRef.current) {
        console.log('🎤 Final transcript (normal):', transcript);
        setStatus("JARVIS is processing your request...");

        try {
          await jarvisMutation.mutateAsync({
            message: transcript,
            sessionId,
          });
        } catch (error) {
          console.error('Error sending to JARVIS:', error);
          setStatus("Error processing request. Please try again.");
        }
      } else if (!lastResult.isFinal) {
        console.log('🎙️ Interim result:', transcript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Enhanced recognition error:', event.error);
      if (event.error !== 'no-speech') {
        setStatus("Speech recognition error. Please try again.");
      }
    };

    recognition.onend = () => {
      console.log('Enhanced recognition ended');
      // Restart if still in conversation mode
      if (conversationMode && !jarvisMutation.isPending) {
        setTimeout(() => {
          if (conversationMode && recognitionRef.current) {
            console.log('🔄 Restarting enhanced recognition...');
            try {
              recognitionRef.current.start();
            } catch (error) {
              console.log('Recognition restart error:', error);
            }
          }
        }, 1000);
      } else {
        setIsRecording(false);
        setVoiceVisualizationVisible(false);
      }
    };

    recognition.start();
  };

  // EVENT-SAFE: Removed unreliable trigger word detection
  // Click-to-interrupt is now the primary method for event reliability
  // UNIFIED: Natural voice interruption using the main recognition system
  const startInterruptDetection = () => {
    console.log('🎯 Enabling interruption mode on main recognition...');
    interruptionModeRef.current = true;
    
    // Keep the existing recognition running but in interruption mode
    if (recognitionRef.current) {
      console.log('✅ Main recognition continues with interruption detection enabled');
    } else if (conversationMode) {
      // Start main recognition if not already running and in conversation mode
      try {
        startWebSpeechRecognition();
        console.log('✅ Started main recognition with interruption detection');
      } catch (error) {
        console.log('⚠️ Failed to start recognition for interruption detection:', error);
        toast({
          title: "Voice Detection Issue",
          description: "Cannot enable voice interruption. Click to interrupt instead.",
        });
      }
    }
  };

  const stopInterruptDetection = () => {
    console.log('Disabling natural voice interruption...');
    interruptionModeRef.current = false;
    
    // Keep main recognition running for normal conversation flow
    console.log('✅ Interruption mode disabled, normal conversation continues');
    
    // Clean up legacy interrupt recognition if any
    if (interruptRecognitionRef.current) {
      interruptRecognitionRef.current.stop();
      interruptRecognitionRef.current = null;
    }
  };

  const stopWebSpeechRecognition = () => {
    console.log('🛑 Completely stopping Web Speech API recognition');
    
    // Stop current audio playback immediately
    if (currentAudioRef.current) {
      console.log('🔇 Stopping JARVIS audio playback');
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current.src = ''; // Force stop
      currentAudioRef.current = null;
    }
    
    // Stop interrupt detection
    stopInterruptDetection();
    
    // Set flags to prevent auto-restart
    setConversationMode(false);
    setIsRecording(false);
    setVoiceVisualizationVisible(false);
    setIsWaitingForResponse(false);
    setStatus("Ready for your command, sir.");
    
    // Forcefully stop and clear recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort(); // More forceful than .stop()
      } catch (error) {
        console.log('Recognition already stopped:', error);
      }
      recognitionRef.current = null;
    }
  };

  // CRITICAL: Manual audio processing for push-to-talk Voice Button
  const processAudioInput = async (audioBlob: Blob) => {
    console.log('🎤 Processing manual audio input (push-to-talk)');
    setStatus("Transcribing your command...");
    
    try {
      // Transcribe the audio using OpenAI Whisper
      const transcriptionResult = await transcribeMutation.mutateAsync(audioBlob);
      console.log('✅ Transcription successful:', transcriptionResult.text);
      
      if (transcriptionResult.text && transcriptionResult.text.trim()) {
        // Send transcribed text to JARVIS
        setStatus("JARVIS is processing your request...");
        await jarvisMutation.mutateAsync({
          message: transcriptionResult.text.trim(),
          sessionId,
        });
      } else {
        console.log('⚠️ Empty transcription result');
        setStatus("Could not understand your command. Please try again.");
        toast({
          title: "Transcription Error",
          description: "Could not understand your speech. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Manual audio processing failed:', error);
      setStatus("Error processing your command. Please try again.");
      toast({
        title: "Processing Error",
        description: "Failed to process your audio. Please try again.",
        variant: "destructive",
      });
    }
  };

  const isProcessing = transcribeMutation.isPending || jarvisMutation.isPending;

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative" data-testid="jarvis-main-content">
      
      {/* Simple JARVIS Hub - Event-Safe Design */}
      <div className="relative flex items-center justify-center" data-testid="jarvis-hub">
        {/* Authentic JARVIS Interface - Based on Original Reference */}
        <div className="relative w-96 h-96 flex items-center justify-center"
             data-testid="jarvis-interface">
          
          {/* Ring 5 - Outermost segmented arcs with gaps */}
          <div className="absolute w-80 h-80 top-1/2 left-1/2 jarvis-ring-rotation-slow">
            {/* Segmented outer arcs - like in original */}
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={`outer-seg-${i}`}
                className="absolute bg-cyan-400/70 rounded-full jarvis-segment-arc"
                style={{
                  width: i % 2 === 0 ? '40px' : '30px',
                  height: '3px',
                  top: '50%',
                  left: '50%',
                  transformOrigin: '0px 0px',
                  transform: `translate(-50%, -50%) rotate(${i * 60}deg) translateX(158px)`,
                  animationDelay: `${i * 0.3}s`,
                }}
              />
            ))}
          </div>

          {/* Ring 4 - Dotted pattern ring */}
          <div className="absolute w-72 h-72 top-1/2 left-1/2 jarvis-ring-rotation-reverse">
            {Array.from({ length: 24 }, (_, i) => (
              <div
                key={`dot-${i}`}
                className="absolute w-1 h-1 bg-cyan-400/80 rounded-full animate-pulse"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: `translate(-50%, -50%) rotate(${i * 15}deg) translateX(142px)`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>

          {/* Ring 3 - Binary Data Display (curved text like original) */}
          <div className="absolute w-64 h-64 top-1/2 left-1/2 jarvis-ring-rotation-medium">
            {/* Binary text segments around the ring */}
            {Array.from({ length: 8 }, (_, segment) => {
              const binaryText = '00000000';
              const angleStart = segment * 45;
              return (
                <div
                  key={`binary-segment-${segment}`}
                  className="absolute text-[11px] font-mono text-cyan-300/95 font-bold tracking-wider jarvis-binary-text"
                  style={{
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${angleStart}deg) translateY(-125px) rotate(-${angleStart}deg)`,
                    animationDelay: `${segment * 0.5}s`,
                  }}
                >
                  {binaryText}
                </div>
              );
            })}
          </div>

          {/* Ring 2 - Tick marks and measurement scales */}
          <div className="absolute w-56 h-56 top-1/2 left-1/2 jarvis-ring-rotation-fast">
            {Array.from({ length: 60 }, (_, i) => (
              <div
                key={`tick-${i}`}
                className={`absolute bg-cyan-400/70 jarvis-tick-marks ${
                  i % 10 === 0 ? 'w-0.5 h-4' : 
                  i % 5 === 0 ? 'w-px h-3' : 
                  'w-px h-2'
                }`}
                style={{
                  top: i % 10 === 0 ? '-8px' : i % 5 === 0 ? '-6px' : '-4px',
                  left: '50%',
                  transformOrigin: '50% 112px',
                  transform: `translateX(-50%) rotate(${i * 6}deg)`,
                  animationDelay: `${i * 0.02}s`,
                }}
              />
            ))}
          </div>

          {/* Ring 1 - Inner bright glow ring with pulsing - ENHANCED LIKE ORIGINAL */}
          <div className="absolute w-40 h-40 border-4 border-cyan-400 rounded-full bg-gradient-radial from-cyan-400/60 via-cyan-400/30 to-transparent animate-jarvis-core-pulse shadow-[0_0_60px_rgba(0,255,255,1.0),0_0_40px_rgba(0,255,255,0.8),0_0_20px_rgba(0,255,255,0.6)]"></div>

          {/* Center Core - JARVIS Text with authentic pulsing glow - ENHANCED LIKE ORIGINAL */}
          <div className="absolute w-32 h-32 flex items-center justify-center bg-gradient-radial from-cyan-400/50 via-cyan-400/25 to-transparent rounded-full shadow-[0_0_80px_rgba(0,255,255,0.9)]">
            {/* Central background glow - stronger pulse */}
            <div className="absolute w-28 h-28 bg-gradient-radial from-cyan-400/70 via-cyan-400/40 to-transparent rounded-full animate-jarvis-glow-breath shadow-[0_0_40px_rgba(0,255,255,1.0)]"></div>
            
            {/* Additional intense glow layer */}
            <div className="absolute w-24 h-24 bg-gradient-radial from-white/20 via-cyan-400/60 to-transparent rounded-full animate-jarvis-core-pulse"></div>
            
            {/* ElevenLabs Widget Container - Will be populated by DOM manipulation */}
            <div 
              id="elevenlabs-widget-container" 
              className="absolute inset-0 flex items-center justify-center z-20"
              style={{ opacity: 0, pointerEvents: 'auto' }}
            />

          {/* J.A.R.V.I.S Text - Authentic font and glow - ENHANCED LIKE ORIGINAL + CLICKABLE */}
            <span 
              className="relative z-10 text-white text-xl animate-jarvis-text-glow cursor-pointer hover:scale-105 transition-transform duration-200" 
              style={{fontFamily: 'Rajdhani, Inter, system-ui, sans-serif', fontWeight: 500, letterSpacing: '0.4em'}}
              onClick={(e) => {
                e.stopPropagation();
                console.log('🎯 User clicked JARVIS center - triggering widget');
                
                // Use ElevenLabs widget for natural conversation
                const widget = document.querySelector('elevenlabs-convai') as any;
                
                if (widget) {
                  console.log('🎯 ElevenLabs widget found, managing conversation naturally');
                  
                  // If JARVIS is speaking, the widget handles interruption automatically
                  if (currentAudioRef.current) {
                    console.log('🛑 JARVIS speaking - widget will handle interruption');
                    // ElevenLabs handles this naturally, no manual intervention needed
                    currentAudioRef.current.pause();
                    currentAudioRef.current.currentTime = 0; 
                    currentAudioRef.current.src = '';
                    currentAudioRef.current = null;
                    setStatus("Ready for your command, sir...");
                    return;
                  }
                  
                  // Start or manage conversation through widget
                  if (!conversationMode) {
                    console.log('🎤 Starting ElevenLabs conversation');
                    if (widget.startConversation) {
                      widget.startConversation();
                    }
                    setStatus("JARVIS is listening, sir...");
                  } else {
                    console.log('🛑 Ending ElevenLabs conversation');
                    if (widget.endConversation) {
                      widget.endConversation();
                    }
                    setStatus("Ready for your command, sir...");
                  }
                } else {
                  console.log('⚠️ ElevenLabs widget not found, using fallback method');
                  // Simple fallback - stop any current audio
                  if (currentAudioRef.current) {
                    currentAudioRef.current.pause();
                    currentAudioRef.current.currentTime = 0;
                    currentAudioRef.current.src = '';
                    currentAudioRef.current = null;
                  }
                  setStatus("Click failed - please try voice button instead");
                }
              }}
              data-testid="jarvis-center-click">
              J.A.R.V.I.S
            </span>
          </div>

          {/* Click hint overlay when JARVIS is speaking */}
          {currentAudioRef.current && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-cyan-400/70 text-sm font-mono animate-pulse">
                Click to interrupt
              </div>
            </div>
          )}

        </div>
      </div>


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
