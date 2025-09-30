import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";

interface VoiceButtonProps {
  onStartRecording: () => void;
  onStopRecording: () => void;
  isRecording: boolean;
  isProcessing: boolean;
  conversationMode?: boolean;
  isWaitingForResponse?: boolean;
}

export default function VoiceButton({ 
  onStartRecording, 
  onStopRecording, 
  isRecording, 
  isProcessing,
  conversationMode = false,
  isWaitingForResponse = false
}: VoiceButtonProps) {
  const [isActive, setIsActive] = useState(false);
  // Mirror JARVIS widget logic: start/end via ElevenLabs widget if present
  const getWidget = (): any | null => document.querySelector('elevenlabs-convai') as any;
  const getWidgetRoot = (widget: any): ShadowRoot | Document => (widget as any).shadowRoot || document;
  const clickStartOnWidget = (widget: any) => {
    const root = getWidgetRoot(widget);
    const startBtn = (root as any)?.querySelector?.(
      'button[aria-label="Start a call"], button[aria-label="Start"]'
    ) as HTMLButtonElement | null;
    if (startBtn) startBtn.click(); else widget.startConversation?.();
  };
  const clickEndOnWidget = (widget: any) => {
    const root = getWidgetRoot(widget);
    const endBtn = (root as any)?.querySelector?.(
      'button[aria-label="End"], button[aria-label="End call"], button[aria-label="Stop"]'
    ) as HTMLButtonElement | null;
    if (endBtn) endBtn.click(); else widget.endConversation?.();
  };
  const isWidgetRunning = (widget: any): boolean => {
    const root = getWidgetRoot(widget);
    const endBtn = (root as any)?.querySelector?.(
      'button[aria-label="End"], button[aria-label="End call"], button[aria-label="Stop"]'
    ) as HTMLButtonElement | null;
    return !!endBtn;
  };

  const handleClick = () => {
    if (isProcessing) return;

    const widget = getWidget();
    if (widget) {
      try {
        // Toggle purely via local state for the button label
        if (!isActive) {
          clickStartOnWidget(widget);
          setIsActive(true);
        } else {
          clickEndOnWidget(widget);
          setIsActive(false);
        }
      } catch (e) {
        // Fallback to existing behavior
        if (!isActive) onStartRecording(); else onStopRecording();
        setIsActive(!isActive);
      }
      return;
    }

    // Fallback: existing behavior
    if (!isActive) onStartRecording(); else onStopRecording();
    setIsActive(!isActive);
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
            jarvis-button font-semibold py-2 px-6 rounded-full transition-all duration-300 font-mono text-sm tracking-wide
            ${isRecording 
              ? 'bg-red-500/80 hover:bg-red-500 text-white border-red-400' 
              : ''
            }
          `}
          data-testid="voice-button"
        >
          <div className="flex items-center space-x-2">
            {isActive ? (
              // In conversation mode
              isRecording ? (
                <>
                  <Square className="w-4 h-4" />
                  <span>Stop Speaking</span>
                </>
              ) : isWaitingForResponse ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>JARVIS Thinking...</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4" />
                  <span>End Conversation</span>
                </>
              )
            ) : (
              // Single interaction mode
              isRecording ? (
                <>
                  <Square className="w-4 h-4" />
                  <span>Stop Speaking</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>Talk to JARVIS</span>
                </>
              )
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
