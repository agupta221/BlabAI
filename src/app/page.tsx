"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Mic, MicOff, Wand2, Send, Plus, MessageSquare, Headphones, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import { useAudioRecorder } from "@/lib/hooks/useAudioRecorder"
import { useToast } from "@/components/ui/use-toast"
import { useDeepgramRecorder } from "@/lib/hooks/useDeepgramRecorder"
import { useCompletion } from 'ai/react';

// Add interface for chat type
interface Chat {
  id: string;
  timestamp: number;
  rawPrompt: string;
  enhancedPrompt?: string;
}

export default function BlabApp() {
  // Separate states for interim and final transcripts
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscripts, setFinalTranscripts] = useState<string[]>([]);
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [showEnhanced, setShowEnhanced] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const { toast } = useToast();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const handleNewDeepgramTranscript = useCallback((data: { text: string, isFinal: boolean, isUtterance: boolean }) => {
    console.log('New transcript:', data);
    
    if (data.isFinal) {
      // For final results, add to the final transcripts array
      setFinalTranscripts(prev => [...prev, data.text]);
      // Clear interim transcript since we have a final result
      setInterimTranscript("");
    } else {
      // For interim results, update the interim transcript
      setInterimTranscript(data.text);
    }
  }, []);

  // Combine final and interim transcripts for display
  const displayTranscript = useMemo(() => {
    const finalText = finalTranscripts.join(' ');
    return finalText + (interimTranscript ? ' ' + interimTranscript : '');
  }, [finalTranscripts, interimTranscript]);

  // Add state for editable transcript
  const [editableTranscript, setEditableTranscript] = useState("");

  // Update editable transcript when new transcription comes in
  useEffect(() => {
    setEditableTranscript(displayTranscript);
  }, [displayTranscript]);

  // Handle manual edits to the transcript
  const handleTranscriptEdit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditableTranscript(e.target.value);
  };

  const { 
    isRecording: isDeepgramRecording, 
    startRecording: startDeepgramRecording, 
    stopRecording: stopDeepgramRecording 
  } = useDeepgramRecorder({ 
    onTranscript: handleNewDeepgramTranscript 
  });

  const toggleRecording = useCallback(async () => {
    try {
      if (isDeepgramRecording) {
        stopDeepgramRecording();
        setInterimTranscript(""); // Clear any remaining interim transcript
        console.log('Recording stopped. Complete transcript:', displayTranscript);
        toast({
          title: "Recording stopped",
          description: "Your audio has been processed."
        });
      } else {
        console.log('Starting new recording');
        setFinalTranscripts([]); // Clear previous transcripts
        setInterimTranscript(""); // Clear interim transcript
        toast({
          title: "Recording started",
          description: "Please speak clearly into your microphone."
        });
        await startDeepgramRecording();
      }
    } catch (error) {
      console.error('Error toggling recording:', error);
      toast({
        title: "Error with recording",
        description: error instanceof Error ? error.message : "Please check your microphone permissions and try again.",
        variant: "destructive"
      });
      stopDeepgramRecording();
    }
  }, [isDeepgramRecording, startDeepgramRecording, stopDeepgramRecording, toast, displayTranscript]);

  const { 
    isRecording: isOpenAIRecording, 
    startRecording: startOpenAIRecording, 
    stopRecording: stopOpenAIRecording 
  } = useAudioRecorder();

  const handleStartTalking = useCallback(async () => {
    try {
      toast({
        title: "Starting conversation...",
        description: "Speak naturally with the AI assistant."
      });
      await startOpenAIRecording();
      setIsTalking(true);
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({
        title: "Error starting conversation",
        description: "Please check your microphone permissions and try again.",
        variant: "destructive"
      });
    }
  }, [startOpenAIRecording, toast]);

  const handleStopTalking = useCallback(() => {
    stopOpenAIRecording();
    setIsTalking(false);
    toast({
      title: "Conversation ended",
      description: "The AI assistant is no longer listening."
    });
  }, [stopOpenAIRecording, toast]);

  const toggleTalking = useCallback(() => {
    if (isTalking) {
      handleStopTalking();
    } else {
      handleStartTalking();
    }
  }, [isTalking, handleStartTalking, handleStopTalking]);

  // Set up streaming completion
  const {
    completion,
    complete,
    isLoading: isEnhancing,
    error: enhanceError,
  } = useCompletion({
    api: '/api/enhance',
    onError: (error) => {
      console.error('Error enhancing transcript:', error);
      toast({
        title: "Enhancement failed",
        description: "Failed to enhance the transcript. Please try again.",
        variant: "destructive"
      });
    },
  });

  // Update the enhance prompt function to use editable transcript
  const enhancePrompt = useCallback(async () => {
    // Only enhance when in regular recording mode and we have a transcript
    if (!isTalking && editableTranscript.trim()) {
      try {
        setShowEnhanced(true);
        setEnhancedPrompt(''); // Clear previous enhancement
        
        toast({
          title: "Enhancing transcript",
          description: "Converting your instructions into a detailed prompt..."
        });

        // Start the streaming completion with the editable transcript
        await complete(editableTranscript);
      } catch (error) {
        console.error('Error starting enhancement:', error);
        toast({
          title: "Enhancement failed",
          description: "Failed to start enhancement. Please try again.",
          variant: "destructive"
        });
      }
    }
  }, [isTalking, editableTranscript, complete, toast]);

  // Update enhancedPrompt when completion streams in
  useEffect(() => {
    if (completion) {
      setEnhancedPrompt(completion);
    }
  }, [completion]);

  // Function to save a new chat
  const saveChat = useCallback((rawPrompt: string, enhancedPrompt?: string) => {
    const newChat: Chat = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      rawPrompt,
      enhancedPrompt
    };
    setChats(prev => [newChat, ...prev]);
  }, []);

  // Function to load a chat
  const loadChat = useCallback((chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
      setEditableTranscript(chat.rawPrompt);
      if (chat.enhancedPrompt) {
        setEnhancedPrompt(chat.enhancedPrompt);
        setShowEnhanced(true);
      } else {
        setEnhancedPrompt('');
        setShowEnhanced(false);
      }
      setSelectedChatId(chatId);
    }
  }, [chats]);

  // Update sendToCursor to save chats
  const sendToCursor = async (prompt: string, isEnhanced = false) => {
    console.log('sendToCursor called with prompt:', prompt.substring(0, 50) + '...');
    
    try {
      // Check if we have text to send
      if (!prompt?.trim()) {
        console.error('No text to send');
        toast({
          title: "No text to send",
          description: "Please make sure there is text in the transcript box.",
          variant: "destructive"
        });
        return;
      }

      // Save the chat before sending
      if (isEnhanced) {
        // If sending enhanced prompt, save both prompts
        saveChat(editableTranscript, prompt);
      } else {
        // If sending raw prompt, save with any existing enhanced prompt
        saveChat(prompt, enhancedPrompt || undefined);
      }

      // Send text to our local server
      const response = await fetch('http://localhost:3001/insert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: prompt }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send to Cursor');
      }

      toast({
        title: "✨ Sent to Cursor",
        description: "Text has been sent to Cursor's composer.",
        duration: 3000
      });
    } catch (error) {
      console.error('Error in sendToCursor:', error);
      
      toast({
        title: "Failed to send to Cursor",
        description: "Please make sure the Cursor Helper is running. Check console for details.",
        variant: "destructive",
        duration: 5000
      });
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const textareaClasses = "w-full h-full min-h-[200px] resize-none bg-transparent border-0 p-0 text-base text-gray-800 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-0 placeholder:text-gray-400"

  // Add delete chat function
  const deleteChat = useCallback((chatId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent chat selection when clicking delete
    setChats(prev => prev.filter(chat => chat.id !== chatId));
    
    // If the deleted chat was selected, clear the UI
    if (chatId === selectedChatId) {
      setEditableTranscript('');
      setEnhancedPrompt('');
      setShowEnhanced(false);
      setSelectedChatId(null);
    }

    toast({
      title: "Chat deleted",
      description: "The chat has been removed from your history.",
      duration: 3000
    });
  }, [selectedChatId, toast]);

  return (
    <div className="flex h-screen bg-white">
      {/* Left Sidebar */}
      <div className="w-64 border-r border-gray-100 flex flex-col">
        <div className="p-4">
          <div className="mb-6">
            <h1 className="text-5xl font-normal text-purple-600 font-righteous leading-none">
              Blab
            </h1>
            <p className="text-sm font-light text-gray-500 mt-1 tracking-wide">
              Vibe Coding Made Easy
            </p>
          </div>
          <Button
            onClick={() => {
              setEditableTranscript('');
              setEnhancedPrompt('');
              setShowEnhanced(false);
              setSelectedChatId(null);
            }}
            className="w-full justify-start gap-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50"
            variant="ghost"
          >
            <Plus className="h-4 w-4" />
            New Vibe Coding Session
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="px-4 pb-2 space-y-3">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className="group relative hover:bg-gray-50/50 rounded-lg transition-colors flex items-center pr-2"
              >
                <Button
                  onClick={() => loadChat(chat.id)}
                  className={cn(
                    "flex-1 justify-start gap-2 text-gray-500 hover:text-purple-600 hover:bg-transparent py-3",
                    selectedChatId === chat.id && "bg-purple-50 text-purple-600 hover:bg-purple-50"
                  )}
                  variant="ghost"
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <div className="flex flex-col items-start min-w-0 max-w-[calc(100%-2rem)]">
                    <div className="w-full overflow-hidden">
                      <span className="text-sm truncate block">
                        {chat.rawPrompt.length > 10 
                          ? chat.rawPrompt.substring(0, 10) + "..."
                          : chat.rawPrompt
                        }
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatTimestamp(chat.timestamp)}
                    </span>
                  </div>
                </Button>
                <Button
                  onClick={(e) => deleteChat(chat.id, e)}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 ml-1 text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                  title="Delete chat"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {/* Add bottom padding spacer */}
            <div className="h-6" />
          </div>
        </ScrollArea>
        
        {/* Talk to Blab buddy Button - Now at bottom of left panel */}
        <div className="p-4 border-t border-gray-100">
          <Button
            onClick={toggleTalking}
            disabled={true}
            className={cn(
              "w-full py-3 transition-all duration-500 shadow-lg flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
            )}
            title="Coming soon!"
          >
            <Headphones className="h-5 w-5 text-white" />
            Brainstorm with Blab
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        {/* Top Panel */}
        <div className="h-1/2 border-b border-gray-100 p-6 flex items-center justify-center bg-gray-50/50">
          <div className="flex flex-col items-center">
            {/* Record Button (now active with Deepgram) */}
            <Button
              onClick={toggleRecording}
              className={cn(
                "w-24 h-24 rounded-full transition-all duration-500 shadow-lg",
                isDeepgramRecording
                  ? "bg-red-500 hover:bg-red-600 animate-pulse"
                  : "bg-purple-600 hover:bg-purple-700 hover:scale-[1.02] transform"
              )}
            >
              {isDeepgramRecording ? (
                <MicOff className="h-8 w-8 text-white" />
              ) : (
                <Mic className="h-8 w-8 text-white" />
              )}
            </Button>
            <p className="text-sm font-light text-gray-500 mt-4 tracking-wide">
              Click here to start vibe coding
            </p>
          </div>
        </div>

        {/* Bottom Panel */}
        <div className="h-1/2 flex">
          {/* Raw Transcript Panel */}
          <div className={cn("flex-1 p-6", !showEnhanced && "border-r border-gray-100")}>
            <div className="h-full rounded-xl p-6 bg-gray-50/50">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-gray-600 text-base">Raw Transcript</h3>
                <Button
                  onClick={enhancePrompt}
                  variant="ghost"
                  size="sm"
                  className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                  disabled={!editableTranscript.trim() || isEnhancing}
                >
                  {isEnhancing ? (
                    <div className="animate-spin">
                      <Wand2 className="h-4 w-4" />
                    </div>
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="h-[calc(100%-120px)]">
                <ScrollArea className="h-full">
                  <Textarea
                    value={editableTranscript}
                    onChange={handleTranscriptEdit}
                    placeholder="Start speaking or type your instructions here..."
                    className={cn(
                      textareaClasses,
                      interimTranscript && "italic" // Style interim results differently
                    )}
                  />
                </ScrollArea>
              </div>
              <Button
                onClick={() => sendToCursor(editableTranscript, false)}
                disabled={!editableTranscript.trim()}
                className="mt-6 w-full bg-purple-600 hover:bg-purple-700 hover:scale-[1.02] transform transition-all duration-200 h-10 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4 mr-2" />
                Send to Cursor
              </Button>
            </div>
          </div>

          {/* Enhanced Prompt Panel */}
          {showEnhanced && (
            <div className="flex-1 p-6">
              <div className="h-full rounded-xl p-6 bg-gray-50/50">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-gray-600 text-base">Enhanced Prompt</h3>
                  <div className="w-8 h-8" /> {/* Spacer to match wand button width and height */}
                </div>
                <div className="h-[calc(100%-120px)]">
                  <ScrollArea className="h-full">
                    <Textarea
                      value={enhancedPrompt}
                      onChange={(e) => setEnhancedPrompt(e.target.value)}
                      placeholder={isEnhancing ? "Enhancing your instructions..." : "Enhanced version of your instructions will appear here"}
                      className={cn(
                        textareaClasses,
                        isEnhancing && "animate-pulse"
                      )}
                    />
                  </ScrollArea>
                </div>
                <Button
                  onClick={() => sendToCursor(enhancedPrompt, true)}
                  disabled={!enhancedPrompt.trim()}
                  className="mt-6 w-full bg-purple-600 hover:bg-purple-700 hover:scale-[1.02] transform transition-all duration-200 h-10 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send to Cursor
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

