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
        console.log('ElevenLabs widget defined, setting up JARVIS conversation integration...');
        
        // CREATE and CONFIGURE the actual widget
        setTimeout(() => {
          const container = document.getElementById('elevenlabs-widget-container');
          if (container && !container.querySelector('elevenlabs-convai')) {
            console.log('🎯 Creating ElevenLabs Conversational Agent widget...');
            
            // Create the widget element
            const widget = document.createElement('elevenlabs-convai') as any;
            
            // Configure the widget with the correct Agent ID from user
            widget.setAttribute('agent-id', 'agent_0601k62vhrxafx98s1k6zshc6n7t');
            widget.setAttribute('public-user-id', `jarvis-user-${sessionId}`);
            
            // PROFESSIONAL: Widget configuration from ElevenLabs documentation
            widget.setAttribute('avatar', 'false'); // No avatar for JARVIS UI
            widget.setAttribute('chat-mode', 'false'); // Voice only
            widget.setAttribute('interruptions-enabled', 'true'); // CRITICAL for interruption!
            widget.setAttribute('quick-connect', 'true'); // Faster connection
            
            // Style the widget to be invisible but functional
            widget.style.width = '120px';
            widget.style.height = '120px';
            widget.style.opacity = '0';
            widget.style.pointerEvents = 'auto';
            widget.style.position = 'absolute';
            widget.style.top = '50%';
            widget.style.left = '50%';
            widget.style.transform = 'translate(-50%, -50%)';
            
            container.appendChild(widget);
            
            // Set up comprehensive event listeners for natural conversation
            const eventTypes = [
              'conversation-started',
              'conversation-ended', 
              'user-speaking-started',
              'user-speaking-ended',
              'agent-speaking-started',
              'agent-speaking-ended',
              'user-transcript',
              'agent-response'
            ];
            
            eventTypes.forEach(eventType => {
              widget.addEventListener(eventType, (event: Event) => {
                const customEvent = event as CustomEvent;
                console.log(`🎯 ElevenLabs ${eventType}:`, customEvent.detail);
                
                // Handle different event types with JARVIS visual integration
                switch(eventType) {
                  case 'conversation-started':
                    console.log('✅ ElevenLabs conversation started - JARVIS is active');
                    setConversationMode(true);
                    setIsRecording(true);
                    setVoiceVisualizationVisible(true);
                    setStatus("JARVIS is listening, sir...");
                    toast({
                      title: "JARVIS Activated",
                      description: "Voice conversation started. Speak naturally, JARVIS will respond.",
                    });
                    break;
                    
                  case 'conversation-ended':
                    console.log('⏹️ ElevenLabs conversation ended - JARVIS is ready');
                    setConversationMode(false);
                    setIsRecording(false);
                    setVoiceVisualizationVisible(false);
                    setStatus("Ready for your command, sir...");
                    break;
                    
                  case 'user-speaking-started':
                    console.log('🎤 User started speaking to JARVIS');
                    setIsRecording(true);
                    setStatus("Recording your command...");
                    break;
                    
                  case 'user-speaking-ended':
                    console.log('🔇 User finished speaking');
                    setIsRecording(false);
                    setStatus("Processing with JARVIS...");
                    break;
                    
                  case 'agent-speaking-started':
                    console.log('🗣️ JARVIS started speaking - interruption naturally supported');
                    setIsWaitingForResponse(true);
                    setStatus("JARVIS is responding...");
                    // ElevenLabs handles interruption automatically!
                    break;
                    
                  case 'agent-speaking-ended':
                    console.log('✅ JARVIS finished speaking');
                    setIsWaitingForResponse(false);
                    setStatus("JARVIS is listening, sir...");
                    break;
                    
                  case 'user-transcript':
                    const userMessage = customEvent.detail?.transcript || customEvent.detail?.text;
                    if (userMessage) {
                      console.log('📝 User transcript captured:', userMessage);
                      setStatus("JARVIS is processing your request...");
                      
                      // Send to n8n workflow for JARVIS intelligence
                      jarvisMutation.mutate({ 
                        message: userMessage, 
                        sessionId: sessionId 
                      });
                    }
                    break;
                    
                  case 'agent-response':
                    const agentMessage = customEvent.detail?.response || customEvent.detail?.text;
                    if (agentMessage) {
                      console.log('🤖 JARVIS natural response:', agentMessage);
                      // ElevenLabs handles voice synthesis automatically
                    }
                    break;
                }
              });
            });
            
            // PROFESSIONAL: Wait for widget ready event and controller - ElevenLabs Documentation Method
            widget.addEventListener('ready', () => {
              console.log('🎯 ElevenLabs widget is ready - setting up professional controls');
              
              // Access the controller object from the widget (documented method)
              const controller = widget.controller;
              
              if (controller) {
                console.log('✅ ElevenLabs controller available - setting up interruption methods');
                
                // Professional interruption method using controller
                (window as any).jarvisInterrupt = () => {
                  if (controller.sendUserActivity) {
                    console.log('🛑 Professional interruption triggered via controller');
                    controller.sendUserActivity();
                    setStatus("JARVIS interrupted. Ready for your command, sir...");
                    toast({
                      title: "JARVIS Interrupted",
                      description: "Voice detected - JARVIS stopped speaking.",
                    });
                  } else {
                    console.log('⚠️ sendUserActivity method not available on controller');
                  }
                };
                
                // End conversation method using controller
                (window as any).jarvisStop = () => {
                  if (controller.endSession) {
                    console.log('🔚 JARVIS conversation ended via controller');
                    controller.endSession();
                    setConversationMode(false);
                    setStatus("JARVIS is ready.");
                  } else {
                    console.log('⚠️ endSession method not available on controller');
                  }
                };
                
                // Volume control using controller
                (window as any).jarvisMute = (muted = true) => {
                  if (controller.setVolume) {
                    controller.setVolume({ volume: muted ? 0 : 1 });
                    console.log(`🔇 JARVIS ${muted ? 'muted' : 'unmuted'} via controller`);
                  } else {
                    console.log('⚠️ setVolume method not available on controller');
                  }
                };
                
                // Store controller reference for later use
                (window as any).jarvisController = controller;
                
                // Log available controller methods
                console.log('🔧 Controller methods available:', {
                  sendUserActivity: !!controller.sendUserActivity,
                  endSession: !!controller.endSession,
                  setVolume: !!controller.setVolume,
                  startConversation: !!controller.startConversation
                });
              } else {
                console.log('⚠️ Controller not available on widget - using widget methods as fallback');
                // Fallback to widget methods if controller is not available
                (window as any).jarvisInterrupt = () => {
                  if (widget.sendUserActivity) {
                    widget.sendUserActivity();
                    setStatus("JARVIS interrupted. Ready for your command, sir...");
                  }
                };
              }
            });
            console.log('✅ ElevenLabs widget fully configured for JARVIS!');
          }
        }, 2000);
      }).catch(error => {
        console.error('Error setting up ElevenLabs widget:', error);
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

  // PROFESSIONAL: ElevenLabs Controller-First Approach
  const startWebSpeechRecognition = () => {
    // Check for ElevenLabs controller first (professional method)
    const controller = (window as any).jarvisController;
    
    if (controller && controller.startConversation) {
      console.log('🎯 Using ElevenLabs controller for natural conversation');
      try {
        controller.startConversation();
        setConversationMode(true);
        setStatus("JARVIS is listening, sir...");
        return;
      } catch (error) {
        console.log('⚠️ ElevenLabs controller failed, falling back:', error);
      }
    }
    
    // Fallback: Check widget directly
    setTimeout(() => {
      const widget = document.querySelector('elevenlabs-convai') as any;
      const widgetInContainer = document.querySelector('#elevenlabs-widget-container elevenlabs-convai') as any;
      const activeWidget = widget || widgetInContainer;
      
      if (activeWidget && activeWidget.startConversation) {
        console.log('🎯 ElevenLabs widget found - starting conversation via widget');
        try {
          activeWidget.startConversation();
          setConversationMode(true);
          setStatus("JARVIS is listening, sir...");
          return;
        } catch (error) {
          console.log('⚠️ Widget startConversation failed:', error);
        }
      }
      
      console.log('📢 ElevenLabs not available - using enhanced Web Speech fallback');
      startWebSpeechFallback();
    }, 500);
  };

  const startWebSpeechFallback = () => {
    console.log('🔄 Starting Web Speech API fallback with continuous recognition');
    
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
    
    // Enhanced for better interruption detection
    recognition.continuous = true; // Continuous listening for interruption
    recognition.interimResults = true; // Catch interruptions faster
    recognition.lang = 'de-DE';
    recognition.maxAlternatives = 1;

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
      const transcript = lastResult[0].transcript.toLowerCase().trim();
      
      // If JARVIS is speaking and user speaks, interrupt immediately
      if (currentAudioRef.current && transcript.length > 3) {
        console.log('🛑 USER INTERRUPTION detected while JARVIS speaking:', transcript);
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current.src = '';
        currentAudioRef.current = null;
        setStatus("JARVIS interrupted. Ready for your command, sir...");
        toast({
          title: "JARVIS Interrupted",
          description: "Voice detected - JARVIS stopped speaking.",
        });
      }
      
      // Only process final results
      if (lastResult.isFinal) {
        console.log('🎤 Final transcript:', transcript);
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
      } else {
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
  const startInterruptDetection = () => {
    console.log('🎯 Event-safe mode: Click interface to interrupt JARVIS');
    // No speech recognition - click interface is 100% reliable for events
  };

  const stopInterruptDetection = () => {
    if (interruptRecognitionRef.current) {
      console.log('Stopping interrupt detection');
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
