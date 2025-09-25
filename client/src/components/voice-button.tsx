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
    <div className="relative">
      {/* Pill-shaped container with JARVIS styling */}
      <div className={`
        flex items-center bg-gray-900/90 backdrop-blur-sm border-2 rounded-full px-6 py-4 transition-all duration-300
        ${isRecording 
          ? 'border-red-400 bg-red-900/20' 
          : 'border-cyan-400/60 bg-cyan-900/20'
        }
      `}>
        {/* JARVIS Icon */}
        <div className={`
          w-8 h-8 rounded-full flex items-center justify-center mr-4 border-2 transition-all duration-300
          ${isRecording 
            ? 'border-red-400 bg-red-400/20' 
            : 'border-cyan-400 bg-cyan-400/20 intense-glow'
          }
        `}>
          <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-400' : 'bg-cyan-400'} animate-pulse`}></div>
        </div>

        {/* Button */}
        <Button
          onClick={handleClick}
          disabled={isProcessing}
          className={`
            font-semibold py-2 px-6 rounded-full transition-all duration-300 font-mono text-sm tracking-wide
            ${isRecording 
              ? 'bg-red-500/80 hover:bg-red-500 text-white border border-red-400' 
              : 'bg-cyan-500/80 hover:bg-cyan-500 text-white border border-cyan-400 intense-glow'
            }
          `}
          data-testid="voice-button"
        >
          <div className="flex items-center space-x-2">
            {isRecording ? (
              <>
                <Square className="w-4 h-4" />
                <span>Stop Recording</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>Talk to Jarvis</span>
              </>
            )}
          </div>
        </Button>
      </div>

      {/* Status indicator */}
      {isRecording && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-400 rounded-full animate-pulse border-2 border-white"></div>
      )}
    </div>
  );
}
