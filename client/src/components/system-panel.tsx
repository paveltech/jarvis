import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function SystemPanel() {
  const [apiStatuses] = useState({
    whisper: true,
    elevenlabs: true,
    n8n: true,
  });

  const workflows = [
    {
      icon: "🤖",
      name: "Email Agent",
      description: "Send emails, create drafts, manage inbox, reply to messages",
    },
    {
      icon: "📅",
      name: "Calendar Agent", 
      description: "Create events, check schedule, manage appointments",
    },
    {
      icon: "👥",
      name: "Contact Agent",
      description: "Search contacts, add new contacts, update information",
    },
    {
      icon: "✍️",
      name: "Content Creator",
      description: "Generate blog posts, research topics, create content",
    },
  ];

  const settings = [
    "Voice Settings",
    "Webhook Config", 
    "API Keys",
  ];

  return (
    <div className="w-80 h-screen bg-secondary/30 backdrop-blur-lg border-l border-border p-6" data-testid="system-panel">
      <h2 className="text-lg font-semibold text-accent mb-6">System Capabilities</h2>
      
      {/* Available Workflows */}
      <div className="space-y-4 mb-8">
        {workflows.map((workflow, index) => (
          <div key={index} className="hud-element rounded-lg p-4" data-testid={`workflow-${index}`}>
            <h3 className="text-sm font-medium text-primary mb-2">
              {workflow.icon} {workflow.name}
            </h3>
            <p className="text-xs text-muted-foreground">{workflow.description}</p>
          </div>
        ))}
      </div>

      {/* API Status */}
      <div className="mb-8" data-testid="api-status">
        <h3 className="text-sm font-medium text-accent mb-4">API Status</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">OpenAI Whisper</span>
            <div 
              className={`w-3 h-3 rounded-full ${apiStatuses.whisper ? 'bg-primary animate-pulse' : 'bg-destructive'}`}
              data-testid="status-whisper"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">ElevenLabs TTS</span>
            <div 
              className={`w-3 h-3 rounded-full ${apiStatuses.elevenlabs ? 'bg-primary animate-pulse' : 'bg-destructive'}`}
              data-testid="status-elevenlabs"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">n8n Webhook</span>
            <div 
              className={`w-3 h-3 rounded-full ${apiStatuses.n8n ? 'bg-primary animate-pulse' : 'bg-destructive'}`}
              data-testid="status-webhook"
            />
          </div>
        </div>
      </div>

      {/* Settings */}
      <div data-testid="settings">
        <h3 className="text-sm font-medium text-accent mb-4">Settings</h3>
        <div className="space-y-3">
          {settings.map((setting, index) => (
            <Button
              key={index}
              variant="ghost"
              className="w-full hud-element rounded-lg p-3 text-left text-sm text-muted-foreground hover:bg-primary/10 transition-colors justify-start"
              data-testid={`setting-${index}`}
            >
              {setting}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
