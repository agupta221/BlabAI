import { useState, useCallback, useRef } from 'react';

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = useCallback(async () => {
    try {
      console.log('Starting audio conversation...');
      
      // Get ephemeral token from our backend
      const tokenResponse = await fetch('/api/realtime/token');
      const tokenData = await tokenResponse.json();
      
      if (!tokenResponse.ok) {
        throw new Error(tokenData.error || 'Failed to get ephemeral token');
      }
      
      if (!tokenData.client_secret?.value) {
        throw new Error('Invalid token response from server');
      }
      
      const EPHEMERAL_KEY = tokenData.client_secret.value;
      console.log('Got ephemeral token');

      // Create a peer connection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // Set up to play remote audio from the model
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      document.body.appendChild(audioEl);
      audioElementRef.current = audioEl;

      // Handle incoming audio stream
      pc.ontrack = (e) => {
        console.log('Received audio track from OpenAI');
        if (e.streams && e.streams[0]) {
          audioEl.srcObject = e.streams[0];
          console.log('Audio stream connected to audio element');
        }
      };

      // Get local audio stream and add track
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      pc.addTrack(stream.getTracks()[0], stream);
      console.log('Added local audio track');

      // Set up data channel for events
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      // Handle data channel events
      dc.onopen = () => {
        console.log('Data channel opened');
        // Send initial configuration
        const initEvent = {
          type: 'response.create',
          response: {
            modalities: ['audio'],
            instructions: 'You are a helpful AI assistant. Listen to the user and respond with voice.',
          },
        };
        dc.send(JSON.stringify(initEvent));
      };

      dc.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          console.log('Received event:', event);
        } catch (error) {
          console.error('Error parsing data channel message:', error);
        }
      };

      // Create and send offer
      console.log('Creating offer...');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to OpenAI and get answer
      const baseUrl = 'https://api.openai.com/v1/realtime';
      const model = 'gpt-4o-realtime-preview-2024-12-17';
      console.log('Sending SDP offer to OpenAI...');
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          'Authorization': `Bearer ${EPHEMERAL_KEY}`,
          'Content-Type': 'application/sdp',
        },
      });

      if (!sdpResponse.ok) {
        throw new Error(`Failed to get SDP answer: ${sdpResponse.statusText}`);
      }

      const sdpAnswer = await sdpResponse.text();
      await pc.setRemoteDescription({
        type: 'answer' as RTCSdpType,
        sdp: sdpAnswer,
      });
      console.log('Remote description set');

      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      stopRecording();
      throw error;
    }
  }, []);

  const stopRecording = useCallback(() => {
    console.log('Stopping audio conversation...');
    
    if (dataChannelRef.current?.readyState === 'open') {
      const endEvent = {
        type: 'response.end',
      };
      console.log('Sending end event:', endEvent);
      dataChannelRef.current.send(JSON.stringify(endEvent));
    }
    
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    if (audioElementRef.current) {
      audioElementRef.current.remove();
      audioElementRef.current = null;
    }

    setIsRecording(false);
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}; 
