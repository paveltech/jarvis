import { useState } from "react";
import JarvisInterface from "@/components/jarvis-interface";

export default function Home() {
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Add floating particles for sci-fi background
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    style: {
      top: `${Math.random() * 80 + 10}%`,
      left: `${Math.random() * 80 + 10}%`,
      animationDelay: `${i * 1.5}s`,
    },
  }));

  return (
    <div className="min-h-screen flex flex-col relative bg-black text-foreground overflow-hidden" data-testid="jarvis-main-interface">
      {/* Floating Particles Background */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="floating-particle"
          style={particle.style}
          data-testid={`floating-particle-${particle.id}`}
        />
      ))}


      {/* Main JARVIS Interface - Full Screen */}
      <JarvisInterface sessionId={sessionId} />
    </div>
  );
}
