import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import VoiceButton from "./voice-button";
import { apiRequest } from "@/lib/queryClient";
import type { JarvisRequest, JarvisResponse } from "@shared/schema";

interface JarvisInterfaceProps {
  sessionId: string;
}

export default function JarvisInterface({ sessionId }: JarvisInterfaceProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("Ready for your command.");
  const [voiceVisualizationVisible, setVoiceVisualizationVisible] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutation for transcribing audio
  const transcribeMutation = useMutation({
    mutationFn: async (audioBlob: Blob): Promise<{ text: string; duration: number }> => {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      
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
    onSuccess: () => {
      // Invalidate conversations to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', sessionId] });
    },
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
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
      
      {/* Central JARVIS Hub - Inspired by Iron Man */}
      <div className="relative flex items-center justify-center mb-24" data-testid="jarvis-hub">
        
        {/* Outermost Ring - Slow rotation */}
        <div className="absolute w-96 h-96 border border-primary/20 rounded-full animate-spin-slow">
          {/* Outer ring details */}
          <div className="absolute top-0 left-1/2 w-8 h-1 bg-primary/60 transform -translate-x-1/2" />
          <div className="absolute bottom-0 left-1/2 w-8 h-1 bg-primary/60 transform -translate-x-1/2" />
          <div className="absolute left-0 top-1/2 w-1 h-8 bg-primary/60 transform -translate-y-1/2" />
          <div className="absolute right-0 top-1/2 w-1 h-8 bg-primary/60 transform -translate-y-1/2" />
        </div>

        {/* Middle Ring */}
        <div className="absolute w-80 h-80 border border-primary/40 rounded-full animate-pulse-slow">
          {/* Technical markings */}
          {Array.from({ length: 24 }, (_, i) => (
            <div
              key={i}
              className="absolute w-1 h-2 bg-primary/30"
              style={{
                top: '2px',
                left: '50%',
                transformOrigin: '50% 160px',
                transform: `translateX(-50%) rotate(${i * 15}deg)`,
              }}
            />
          ))}
        </div>

        {/* Inner Ring */}
        <div className="absolute w-64 h-64 border-2 border-primary/60 rounded-full animate-glow">
          {/* Inner ring segments */}
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="absolute w-16 h-1 bg-primary/50"
              style={{
                top: '50%',
                left: '50%',
                transformOrigin: '0 0',
                transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateX(120px)`,
              }}
            />
          ))}
        </div>

        {/* Central Core */}
        <div className="relative w-48 h-48 bg-gradient-radial from-primary/30 via-primary/10 to-transparent rounded-full border-2 border-primary flex items-center justify-center animate-pulse">
          <div className="w-32 h-32 bg-gradient-radial from-primary/40 via-primary/20 to-transparent rounded-full border border-primary/80 flex items-center justify-center">
            <div className="w-20 h-20 bg-gradient-radial from-primary/60 to-primary/20 rounded-full border-2 border-primary animate-glow flex items-center justify-center">
              <span className="text-primary font-bold text-xl tracking-widest drop-shadow-lg">J.A.R.V.I.S</span>
            </div>
          </div>
        </div>

        {/* HUD Corner Elements */}
        <div className="absolute -top-4 -left-4 w-8 h-8 border-t-2 border-l-2 border-primary/60" />
        <div className="absolute -top-4 -right-4 w-8 h-8 border-t-2 border-r-2 border-primary/60" />
        <div className="absolute -bottom-4 -left-4 w-8 h-8 border-b-2 border-l-2 border-primary/60" />
        <div className="absolute -bottom-4 -right-4 w-8 h-8 border-b-2 border-r-2 border-primary/60" />
      </div>

      {/* Talk to JARVIS Button */}
      <div className="relative z-10">
        <VoiceButton
          onStartRecording={startRecording}
          onStopRecording={stopRecordingHandler}
          isRecording={isRecording}
          isProcessing={isProcessing}
        />
      </div>

      {/* Voice Visualization */}
      {voiceVisualizationVisible && (
        <div className="flex items-center justify-center space-x-1 mt-8" data-testid="voice-visualization">
          <div className="voice-wave" />
          <div className="voice-wave" />
          <div className="voice-wave" />
          <div className="voice-wave" />
          <div className="voice-wave" />
        </div>
      )}

      {/* Status Text - Minimal and clean */}
      <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2">
        <p className="text-primary/80 text-sm font-medium tracking-wide" data-testid="status-text">
          {status}
        </p>
      </div>

      {/* Processing Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center z-50" data-testid="processing-overlay">
          <div className="text-center">
            <div className="w-20 h-20 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-6" />
            <p className="text-primary font-medium text-lg tracking-wide">Processing your request...</p>
          </div>
        </div>
      )}
    </div>
  );
}
