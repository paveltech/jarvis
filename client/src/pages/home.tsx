import { useState, useEffect } from "react";
import JarvisInterface from "@/components/jarvis-interface";
import ChatSidebar from "@/components/chat-sidebar";
import SystemPanel from "@/components/system-panel";

export default function Home() {
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Add floating particles
  const particles = Array.from({ length: 4 }, (_, i) => ({
    id: i,
    style: {
      top: `${[10, 30, 70, 50][i]}%`,
      left: `${[15, 85, 10, 90][i]}%`,
      animationDelay: `${i * 2}s`,
    },
  }));

  return (
    <div className="min-h-screen flex relative bg-background text-foreground" data-testid="jarvis-main-interface">
      {/* Floating Particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="floating-particle"
          style={particle.style}
          data-testid={`floating-particle-${particle.id}`}
        />
      ))}

      {/* Chat Sidebar */}
      <ChatSidebar sessionId={sessionId} />

      {/* Main Content */}
      <JarvisInterface sessionId={sessionId} />

      {/* System Panel */}
      <SystemPanel />
    </div>
  );
}
