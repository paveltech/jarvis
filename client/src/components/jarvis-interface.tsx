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
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load ElevenLabs widget script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
    script.async = true;
    script.type = 'text/javascript';
    document.body.appendChild(script);

    return () => {
      // Cleanup script on unmount
      if (document.body.contains(script)) {
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
        <div className="absolute w-[600px] h-[600px] border border-cyan-400/40 rounded-full animate-spin-slow">
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

        {/* Central Core - Intense Glow */}
        <div className="relative w-32 h-32 bg-gradient-radial from-cyan-400 via-cyan-500/80 to-transparent rounded-full border-4 border-cyan-400 intense-core-glow animate-pulse flex items-center justify-center">
          <div className="w-20 h-20 bg-gradient-radial from-cyan-300/90 to-cyan-400/60 rounded-full border-2 border-cyan-300 flex items-center justify-center core-inner-glow">
            <span className="text-cyan-100 font-bold text-lg tracking-widest drop-shadow-[0_0_10px_#00ffff]">J.A.R.V.I.S</span>
          </div>
        </div>


        {/* Scanner Beam */}
        <div className="absolute w-[360px] h-[360px] rounded-full overflow-hidden">
          <div className="jarvis-scanner w-0.5 h-full bg-gradient-to-t from-transparent via-cyan-400 to-transparent absolute left-1/2 transform -translate-x-1/2 animate-scan-beam"></div>
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

      {/* ElevenLabs Conversational AI Widget - Bottom Right Corner */}
      <div className="fixed bottom-8 right-8 z-50">
        <div className="elevenlabs-widget-container">
          <div dangerouslySetInnerHTML={{
            __html: '<elevenlabs-convai agent-id="agent_9001k60fwb0pfwtvnfmz9zh24xh4"></elevenlabs-convai>'
          }} />
        </div>
      </div>

      {/* Legacy Voice Button - Hidden by default, can be shown for testing */}
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
