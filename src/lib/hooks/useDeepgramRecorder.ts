import { useState, useCallback, useRef } from 'react';
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

export interface UseDeepgramRecorderProps {
  onTranscript: (data: { text: string; isFinal: boolean; isUtterance: boolean }) => void;
}

export function useDeepgramRecorder({ onTranscript }: UseDeepgramRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const deepgramConnectionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioDataSentRef = useRef(false);
  const audioDataCountRef = useRef(0);
  const lastTranscriptRef = useRef<string>("");

  const startRecording = useCallback(async () => {
    try {
      console.log('Starting recording...');
      
      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      mediaStreamRef.current = stream;
      console.log('Got microphone stream');

      // Create Deepgram client
      const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
      if (!apiKey) {
        throw new Error('Deepgram API key is not configured');
      }
      console.log('Creating Deepgram client...');
      const deepgram = createClient(apiKey);

      // Create live transcription connection
      console.log('Creating live transcription connection...');
      const connection = await deepgram.listen.live({
        model: "nova-2",
        language: "en-US",
        smart_format: true,
        interim_results: true,
        punctuate: true,
        endpointing: 200,
        encoding: "linear16",
        sample_rate: 16000,
      });
      
      deepgramConnectionRef.current = connection;
      console.log('Created Deepgram connection, ready state:', connection.getReadyState());

      // Set up event listeners
      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log('Deepgram connection opened');
        lastTranscriptRef.current = "";
        
        try {
          // Start sending audio data
          const audioContext = new AudioContext({
            sampleRate: 16000,
            latencyHint: 'interactive'
          });
          audioContextRef.current = audioContext;
          
          const source = audioContext.createMediaStreamSource(stream);
          sourceRef.current = source;
          
          const processor = audioContext.createScriptProcessor(2048, 1, 1);
          processorRef.current = processor;

          source.connect(processor);
          processor.connect(audioContext.destination);

          let audioProcessingStarted = false;
          processor.onaudioprocess = (e) => {
            if (!audioProcessingStarted) {
              console.log('Audio processing started');
              audioProcessingStarted = true;
            }
            
            const readyState = deepgramConnectionRef.current?.getReadyState();
            if (readyState === 1) {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Check if we're getting non-zero audio data
              const hasAudioData = inputData.some(sample => Math.abs(sample) > 0.01);
              if (hasAudioData) {
                if (!audioDataSentRef.current) {
                  console.log('First non-zero audio data detected');
                  audioDataSentRef.current = true;
                }
                
                const audio = convertFloat32ToInt16(inputData);
                try {
                  deepgramConnectionRef.current.send(audio);
                  audioDataCountRef.current++;
                  
                  // Log every 100 packets sent
                  if (audioDataCountRef.current % 100 === 0) {
                    console.log(`Sent ${audioDataCountRef.current} audio packets`);
                  }
                } catch (err) {
                  console.error('Error sending audio data:', err);
                }
              }
            } else if (readyState !== 1) {
              console.log('Deepgram connection not ready, state:', readyState);
              // Try to reconnect if connection is closed
              if (readyState === 3) {
                console.log('Connection closed, cleaning up...');
                cleanup();
              }
            }
          };
        } catch (err) {
          console.error('Error setting up audio processing:', err);
          cleanup();
        }
      });

      connection.on(LiveTranscriptionEvents.Close, () => {
        console.log('Deepgram connection closed, ready state:', connection?.getReadyState());
        cleanup();
      });

      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        
        if (transcript?.trim()) {
          const isFinal = data.is_final || false;
          const isUtterance = data.speech_final || false;
          
          console.log('Received transcript:', {
            text: transcript,
            isFinal,
            isUtterance,
            confidence: data.channel?.alternatives?.[0]?.confidence
          });

          onTranscript({ 
            text: transcript, 
            isFinal,
            isUtterance
          });
        }
      });

      connection.on(LiveTranscriptionEvents.Error, (err) => {
        console.error('Deepgram error:', err);
        cleanup();
      });

      connection.on('ConnectionClosed', () => {
        console.log('Deepgram connection closed event, ready state:', connection?.getReadyState());
        cleanup();
      });

      setIsRecording(true);
      console.log('Recording started successfully');
    } catch (error) {
      console.error('Error starting recording:', error);
      cleanup();
      throw error;
    }
  }, [onTranscript]);

  const cleanup = useCallback(() => {
    console.log('Cleaning up recording resources...');
    
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
        processorRef.current = null;
      } catch (err) {
        console.error('Error disconnecting processor:', err);
      }
    }

    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      } catch (err) {
        console.error('Error disconnecting source:', err);
      }
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
        audioContextRef.current = null;
      } catch (err) {
        console.error('Error closing audio context:', err);
      }
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      } catch (err) {
        console.error('Error stopping media stream:', err);
      }
    }

    if (deepgramConnectionRef.current) {
      try {
        const readyState = deepgramConnectionRef.current.getReadyState();
        console.log('Closing Deepgram connection, current state:', readyState);
        deepgramConnectionRef.current.finish();
        deepgramConnectionRef.current = null;
      } catch (err) {
        console.error('Error finishing Deepgram connection:', err);
      }
    }

    audioDataSentRef.current = false;
    audioDataCountRef.current = 0;
    setIsRecording(false);
    console.log('Cleanup completed');
  }, []);

  const stopRecording = useCallback(() => {
    console.log('Stopping recording...');
    cleanup();
  }, [cleanup]);

  // Helper function to convert audio data
  const convertFloat32ToInt16 = (buffer: Float32Array) => {
    const l = buffer.length;
    const buf = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      buf[i] = Math.min(1, buffer[i]) * 0x7FFF;
    }
    return buf.buffer;
  };

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
} 
