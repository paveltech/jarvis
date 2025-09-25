import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Conversation } from "@shared/schema";

interface ChatSidebarProps {
  sessionId: string;
}

export default function ChatSidebar({ sessionId }: ChatSidebarProps) {
  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations", sessionId],
    refetchInterval: 1000, // Refresh every second for real-time updates
  });

  return (
    <div className="w-96 h-screen bg-secondary/30 backdrop-blur-lg border-r border-border p-6 overflow-hidden" data-testid="chat-sidebar">
      <div className="flex items-center mb-8">
        <div className="w-8 h-8 bg-primary rounded-full mr-3 animate-glow" data-testid="jarvis-logo"></div>
        <h1 className="text-xl font-semibold text-accent">JARVIS Interface</h1>
      </div>

      {/* System Status */}
      <div className="hud-element rounded-lg p-4 mb-6" data-testid="system-status">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">System Status</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Voice Recognition</span>
            <div className="w-2 h-2 bg-primary rounded-full animate-glow" data-testid="status-voice"></div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">n8n Workflows</span>
            <div className="w-2 h-2 bg-primary rounded-full animate-glow" data-testid="status-n8n"></div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">AI Processing</span>
            <div className="w-2 h-2 bg-primary rounded-full animate-glow" data-testid="status-ai"></div>
          </div>
        </div>
      </div>

      {/* Chat History */}
      <div className="hud-element rounded-lg p-4 h-96" data-testid="chat-history">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Conversation History</h3>
        <ScrollArea className="h-80">
          {isLoading ? (
            <div className="text-center text-muted-foreground">Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div className="text-center text-muted-foreground">No conversations yet. Start by talking to JARVIS!</div>
          ) : (
            <div className="space-y-4">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`rounded-lg p-3 message-glow ${
                    conversation.sender === 'user' ? 'chat-bubble-user' : 'chat-bubble-jarvis'
                  }`}
                  data-testid={`message-${conversation.sender}-${conversation.id}`}
                >
                  <p className="text-sm text-foreground">{conversation.message}</p>
                  <span className="text-xs text-muted-foreground">
                    {conversation.sender === 'user' ? 'You' : 'JARVIS'} • {
                      new Date(conversation.timestamp).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    }
                  </span>
                  {conversation.audioUrl && (
                    <audio 
                      controls 
                      className="mt-2 w-full" 
                      data-testid={`audio-${conversation.id}`}
                    >
                      <source src={conversation.audioUrl} type="audio/mpeg" />
                    </audio>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
