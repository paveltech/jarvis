import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";

interface VoiceButtonProps {
  onStartRecording: () => void;
  onStopRecording: () => void;
  isRecording: boolean;
  isProcessing: boolean;
}

export default function VoiceButton({ 
  onStartRecording, 
  onStopRecording, 
  isRecording, 
  isProcessing 
}: VoiceButtonProps) {
  
  const handleClick = () => {
    if (isProcessing) return;
    
    if (isRecording) {
      onStopRecording();
    } else {
      onStartRecording();
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isProcessing}
      className={`
        font-semibold py-4 px-8 rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-2xl animate-glow
        ${isRecording 
          ? 'bg-destructive hover:bg-destructive/80 text-destructive-foreground' 
          : 'bg-gradient-to-r from-primary to-accent hover:from-accent hover:to-primary text-primary-foreground'
        }
      `}
      data-testid="voice-button"
    >
      <div className="flex items-center space-x-3">
        {isRecording ? (
          <>
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <Square className="w-6 h-6" />
            <span>Stop Recording</span>
          </>
        ) : (
          <>
            <Mic className="w-6 h-6" />
            <span>Talk to JARVIS</span>
          </>
        )}
      </div>
    </Button>
  );
}
