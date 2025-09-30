declare namespace JSX {
  interface IntrinsicElements {
    'elevenlabs-convai': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      'agent-id'?: string;
      'api-key'?: string;
      'client-events'?: string;
      'display'?: string;
      // Add other attributes from ElevenLabs if needed
      style?: React.CSSProperties;
    };
  }
}


