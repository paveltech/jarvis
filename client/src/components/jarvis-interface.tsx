import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import VoiceButton from "./voice-button";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { recordAudio, stopRecording } from "@/lib/audio";
import type { JarvisRequest, JarvisResponse } from "@shared/schema";

interface JarvisInterfaceProps {
  sessionId: string;
}

export default function JarvisInterface({ sessionId }: JarvisInterfaceProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("All systems operational, sir. Ready for your command.");
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

  const quickActions = [
    { icon: "📅", label: "Calendar" },
    { icon: "📧", label: "Email" },
    { icon: "📝", label: "Content" },
    { icon: "👥", label: "Contacts" },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 relative" data-testid="jarvis-main-content">
      {/* Central JARVIS Interface */}
      <div className="relative flex items-center justify-center mb-16" data-testid="jarvis-hub">
        {/* Animated Rings */}
        <div className="jarvis-ring" />
        <div className="jarvis-ring" />
        <div className="jarvis-ring" />
        
        {/* Central Hub */}
        <div className="relative w-48 h-48 bg-gradient-to-br from-primary/20 to-transparent rounded-full border-2 border-primary/50 flex items-center justify-center animate-pulse-slow">
          <div className="w-32 h-32 bg-gradient-to-br from-primary/30 to-transparent rounded-full border border-primary/60 flex items-center justify-center">
            <div className="w-16 h-16 bg-primary/20 rounded-full border border-primary/80 flex items-center justify-center animate-glow">
              <span className="text-primary font-bold text-lg tracking-widest">J.A.R.V.I.S</span>
            </div>
          </div>
        </div>

        {/* HUD Elements */}
        <div className="absolute top-0 left-0 w-20 h-1 bg-primary/60" />
        <div className="absolute top-0 right-0 w-20 h-1 bg-primary/60" />
        <div className="absolute bottom-0 left-0 w-20 h-1 bg-primary/60" />
        <div className="absolute bottom-0 right-0 w-20 h-1 bg-primary/60" />
      </div>

      {/* Voice Interaction Section */}
      <div className="text-center space-y-8">
        {/* Talk to JARVIS Button */}
        <VoiceButton
          onStartRecording={startRecording}
          onStopRecording={stopRecordingHandler}
          isRecording={isRecording}
          isProcessing={isProcessing}
        />

        {/* Voice Visualization */}
        {voiceVisualizationVisible && (
          <div className="flex items-center justify-center space-x-1" data-testid="voice-visualization">
            <div className="voice-wave" />
            <div className="voice-wave" />
            <div className="voice-wave" />
            <div className="voice-wave" />
            <div className="voice-wave" />
          </div>
        )}

        {/* Status Text */}
        <p className="text-muted-foreground text-lg" data-testid="status-text">
          {status}
        </p>

        {/* Quick Actions */}
        <div className="flex space-x-4">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant="ghost"
              className="hud-element rounded-lg px-4 py-2 text-sm text-accent hover:bg-primary/10 transition-colors"
              data-testid={`quick-action-${index}`}
            >
              {action.icon} {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Processing Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50" data-testid="processing-overlay">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
            <p className="text-accent font-medium">JARVIS is processing your request...</p>
          </div>
        </div>
      )}
    </div>
  );
}
