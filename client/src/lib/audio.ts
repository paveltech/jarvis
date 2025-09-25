export async function recordAudio(): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
      } 
    });
    return stream;
  } catch (error) {
    console.error('Error accessing microphone:', error);
    throw new Error('Microphone access denied or not available');
  }
}

export function stopRecording(mediaRecorder: MediaRecorder): Promise<Blob> {
  return new Promise((resolve) => {
    const chunks: Blob[] = [];
    
    mediaRecorder.ondataavailable = (event) => {
      chunks.push(event.data);
    };
    
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(chunks, { type: 'audio/wav' });
      resolve(audioBlob);
    };
    
    mediaRecorder.stop();
  });
}

export function createAudioURL(audioBlob: Blob): string {
  return URL.createObjectURL(audioBlob);
}

export function downloadAudio(audioBlob: Blob, filename: string = 'recording.wav'): void {
  const url = createAudioURL(audioBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function playAudio(audioUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(audioUrl);
    
    audio.onended = () => resolve();
    audio.onerror = (error) => reject(error);
    
    audio.play().catch(reject);
  });
}
