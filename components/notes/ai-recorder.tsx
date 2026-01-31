'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Mic, Square, Loader2, Wand2, AlertCircle } from 'lucide-react';
import { parseEncounterTranscript, type TemplateFieldContext } from '@/lib/gemini-scribe';
import { toast } from 'sonner';

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface AiRecorderProps {
  onAutoFill: (data: Record<string, unknown>, fieldsMatched: number, isMock: boolean) => void;
  templateFields: TemplateFieldContext[];
  onDurationDetected?: (minutes: number) => void;
  currentDuration?: number;
  isTimerRunning?: boolean;
}

// Extract duration mentions from text (e.g., "20 minutes", "half hour", "1 hour")
function extractDuration(text: string): number | null {
  const lowerText = text.toLowerCase();

  // Match patterns like "20 minutes", "20 min", "20-minute", "twenty minutes"
  const minuteMatch = lowerText.match(/(\d+)\s*(?:minute|min)/);
  if (minuteMatch) {
    console.log("🕐 extractDuration matched minutes:", minuteMatch[1]);
    return parseInt(minuteMatch[1]);
  }

  // Match "half hour" or "half an hour"
  if (lowerText.includes('half hour') || lowerText.includes('half an hour')) {
    console.log("🕐 extractDuration matched half hour");
    return 30;
  }

  // Match patterns like "1 hour", "2 hours"
  const hourMatch = lowerText.match(/(\d+)\s*hour/);
  if (hourMatch) {
    console.log("🕐 extractDuration matched hours:", hourMatch[1]);
    return parseInt(hourMatch[1]) * 60;
  }

  console.log("🕐 extractDuration found no match in:", lowerText.slice(0, 100));
  return null;
}

export function AiRecorder({
  onAutoFill,
  templateFields,
  onDurationDetected,
  currentDuration = 0,
  isTimerRunning = false,
}: AiRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [timer, setTimer] = useState(0);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Check for Web Speech API support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSpeechSupported(false);
      }
    }
  }, []);

  // Handle the timer for the visual effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = useCallback(() => {
    setError(null);

    if (!speechSupported) {
      setError("Speech recognition not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
      setInterimTranscript('');
      toast.success("Listening... speak now");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }

      if (finalTranscript) {
        setTranscript((prev) => prev + finalTranscript);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setError("Microphone access denied. Please allow microphone access and try again.");
      } else if (event.error === 'no-speech') {
        // This is normal when user pauses, don't show error
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [speechSupported]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setInterimTranscript('');
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      setTranscript(''); // Clear previous
      startRecording();
    }
  };

  const handleProcess = async () => {
    if (!transcript) {
      toast.error("Please record or enter a transcript first");
      return;
    }

    setIsProcessing(true);
    try {
      // Check for duration mentions in transcript
      const detectedDuration = extractDuration(transcript);
      console.log("🕐 Duration detection:", {
        transcript: transcript.slice(0, 100),
        detectedDuration,
        currentDuration,
        onDurationDetectedExists: !!onDurationDetected
      });
      if (detectedDuration && onDurationDetected && detectedDuration !== currentDuration) {
        console.log("🕐 Calling onDurationDetected with:", detectedDuration);
        onDurationDetected(detectedDuration);
      }

      // Call the Server Action
      const result = await parseEncounterTranscript(transcript, templateFields);

      if (result.success) {
        onAutoFill(result.data, result.fieldsMatched, result.isMock);
        toast.success(`✨ AI extracted ${result.fieldsMatched} fields${result.isMock ? " (Demo Mode)" : ""}`);
      } else {
        toast.error(result.error || "Failed to process transcript");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error connecting to AI Scribe");
    } finally {
      setIsProcessing(false);
    }
  };

  // Combined transcript with interim results for display
  const displayTranscript = transcript + (interimTranscript ? ` ${interimTranscript}` : '');

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-slate-50 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-full ${isRecording ? 'bg-red-100 animate-pulse' : 'bg-slate-200'}`}>
            {isRecording ? <Mic className="w-6 h-6 text-red-600" /> : <Mic className="w-6 h-6 text-slate-600" />}
          </div>
          <div>
            <h3 className="font-medium text-slate-900">AI Voice Scribe</h3>
            <p className="text-sm text-slate-500">
              {isRecording
                ? `Listening... ${formatTime(timer)}`
                : speechSupported
                  ? 'Click Start and speak clearly'
                  : 'Speech not supported - type below'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant={isRecording ? "destructive" : "default"}
            onClick={toggleRecording}
            disabled={!speechSupported}
          >
            {isRecording ? (
              <>
                <Square className="w-4 h-4 mr-2" /> Stop
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 mr-2" /> Start
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Browser support warning */}
      {!speechSupported && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-sm">Speech recognition requires Chrome or Edge. You can still type your notes below.</p>
        </div>
      )}

      {/* Transcript Area */}
      <div className="relative">
        <Textarea
          value={isRecording ? displayTranscript : transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder={isRecording ? "Speak now... your words will appear here" : "Click Start to record, or type/paste your notes here..."}
          className={`min-h-[100px] bg-white ${isRecording ? 'border-red-300' : ''}`}
          disabled={isProcessing}
          readOnly={isRecording}
        />
        {interimTranscript && (
          <span className="absolute bottom-2 right-2 text-xs text-slate-400">
            listening...
          </span>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleProcess}
          disabled={!transcript || isRecording || isProcessing}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" /> Generate Structured Note
            </>
          )}
        </Button>
      </div>
    </div>
  );
}