'use client';

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Mic, Square, Loader2, Wand2, AlertCircle, AlertTriangle, FlaskConical, History, RotateCcw } from 'lucide-react';
import { parseEncounterTranscript, getMockScribeResult, type TemplateFieldContext, type ScribeNoteContext } from '@/lib/gemini-scribe';
import { SAMPLE_TRANSCRIPTS, type SampleTranscript } from '@/lib/sample-transcripts';
import { useDemoData } from '@/lib/demo-data-context';
import type { NoteDraft } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
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

export interface AutoFillResult {
  data: Record<string, unknown>;
  fieldsMatched: number;
  isMock: boolean;
  fieldConfidence?: Record<string, 'high' | 'low'>;
  missingFieldIds?: string[];
}

type ScribeBanner =
  | { kind: 'mock' }
  | { kind: 'error'; message: string }
  | null;

interface AiRecorderProps {
  onAutoFill: (result: AutoFillResult) => void;
  templateFields: TemplateFieldContext[];
  patientId: string;
  templateId: string;
  onDurationDetected?: (minutes: number) => void;
  currentDuration?: number;
  isTimerRunning?: boolean;
  sampleFilter?: (sample: SampleTranscript) => boolean;
  noteContext?: ScribeNoteContext;
}

// Browser capability detection (SSR-safe): true on the server, real support on the client
const emptySubscribe = () => () => {};
const getSpeechSupported = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);
const getSpeechSupportedServer = () => true;

// Extract duration mentions from text (e.g., "20 minutes", "half hour", "1 hour")
function extractDuration(text: string): number | null {
  const lowerText = text.toLowerCase();

  // Match patterns like "20 minutes", "20 min", "20-minute", "twenty minutes"
  const minuteMatch = lowerText.match(/(\d+)\s*(?:minute|min)/);
  if (minuteMatch) {
    return parseInt(minuteMatch[1]);
  }

  // Match "half hour" or "half an hour"
  if (lowerText.includes('half hour') || lowerText.includes('half an hour')) {
    return 30;
  }

  // Match patterns like "1 hour", "2 hours"
  const hourMatch = lowerText.match(/(\d+)\s*hour/);
  if (hourMatch) {
    return parseInt(hourMatch[1]) * 60;
  }

  return null;
}

export function AiRecorder({
  onAutoFill,
  templateFields,
  patientId,
  templateId,
  onDurationDetected,
  currentDuration = 0,
  sampleFilter,
  noteContext,
}: AiRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [timer, setTimer] = useState(0);
  const speechSupported = useSyncExternalStore(emptySubscribe, getSpeechSupported, getSpeechSupportedServer);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<ScribeBanner>(null);
  const [restorableDraft, setRestorableDraft] = useState<NoteDraft | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const { saveNoteDraft, getNoteDraft, deleteNoteDraft } = useDemoData();

  // Refs so autosave flushes (unmount, recognition end) always see current values
  const transcriptRef = useRef('');
  const lastSavedRef = useRef('');
  const saveNoteDraftRef = useRef(saveNoteDraft);
  useEffect(() => {
    saveNoteDraftRef.current = saveNoteDraft;
  }, [saveNoteDraft]);

  // Immediately persist the current transcript as a draft (if non-empty and changed)
  const flushTranscriptSave = useCallback(() => {
    const current = transcriptRef.current;
    if (!current.trim() || current === lastSavedRef.current) return;
    saveNoteDraftRef.current({
      patientId,
      templateId,
      rawTranscript: current,
      responses: {},
      generatedNarrative: '',
      startTime: new Date().toISOString(),
    });
    lastSavedRef.current = current;
  }, [patientId, templateId]);

  // Debounced (~1.5s) autosave of the transcript while typing/dictating
  useEffect(() => {
    transcriptRef.current = transcript;
    if (!transcript.trim()) return;
    const timeout = setTimeout(flushTranscriptSave, 1500);
    return () => clearTimeout(timeout);
  }, [transcript, flushTranscriptSave]);

  // Flush pending transcript on unmount so no dictation is lost
  useEffect(() => {
    return () => flushTranscriptSave();
  }, [flushTranscriptSave]);

  // On mount: offer to restore an unsaved dictation draft
  const restoreCheckedRef = useRef(false);
  useEffect(() => {
    if (restoreCheckedRef.current) return;
    restoreCheckedRef.current = true;
    const draft = getNoteDraft(patientId, templateId);
    if (draft?.rawTranscript && !transcriptRef.current) {
      setRestorableDraft(draft);
    }
  }, [getNoteDraft, patientId, templateId]);

  const handleRestoreDraft = () => {
    if (!restorableDraft?.rawTranscript) return;
    setTranscript(restorableDraft.rawTranscript);
    transcriptRef.current = restorableDraft.rawTranscript;
    lastSavedRef.current = restorableDraft.rawTranscript;
    setRestorableDraft(null);
    toast.success('Dictation restored');
  };

  const handleDiscardDraft = () => {
    if (restorableDraft) {
      deleteNoteDraft(restorableDraft.id);
    }
    setRestorableDraft(null);
  };

  // Handle the timer for the visual effect (reset happens in recognition.onstart)
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);
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
      setTimer(0);
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
      // Flush the dictation to the draft as soon as recording stops
      flushTranscriptSave();
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [speechSupported, flushTranscriptSave]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setInterimTranscript('');
    flushTranscriptSave();
  }, [flushTranscriptSave]);

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      setTranscript(''); // Clear previous
      startRecording();
    }
  };

  const handleLoadSample = (sampleTranscript: string) => {
    setTranscript(sampleTranscript);
    setRestorableDraft(null);
    toast.success("Sample loaded — click Generate");
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
      if (detectedDuration && onDurationDetected && detectedDuration !== currentDuration) {
        onDurationDetected(detectedDuration);
      }

      // Call the Server Action
      const result = await parseEncounterTranscript(transcript, templateFields, noteContext);

      if (result.success) {
        onAutoFill({
          data: result.data,
          fieldsMatched: result.fieldsMatched,
          isMock: result.isMock,
          fieldConfidence: result.fieldConfidence,
          missingFieldIds: result.missingFieldIds,
        });
        if (result.isMock) {
          setBanner({ kind: 'mock' });
        } else {
          setBanner(null);
          toast.success(`AI extracted ${result.fieldsMatched} fields`);
        }
      } else {
        setBanner({ kind: 'error', message: result.error || "Failed to process transcript" });
      }
    } catch (error) {
      console.error(error);
      setBanner({ kind: 'error', message: "Error connecting to AI Scribe" });
    } finally {
      setIsProcessing(false);
    }
  };

  // Explicit opt-in to canned demo values after a runtime failure
  const handleUseDemoValues = async () => {
    setIsProcessing(true);
    try {
      const result = await getMockScribeResult(templateFields);
      onAutoFill({
        data: result.data,
        fieldsMatched: result.fieldsMatched,
        isMock: result.isMock,
        fieldConfidence: result.fieldConfidence,
        missingFieldIds: result.missingFieldIds,
      });
      setBanner({ kind: 'mock' });
    } catch (error) {
      console.error(error);
      setBanner({ kind: 'error', message: "Could not load demo values" });
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isRecording || isProcessing}>
                <FlaskConical className="w-4 h-4 mr-2" /> Load Sample
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sample transcripts</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(sampleFilter ? SAMPLE_TRANSCRIPTS.filter(sampleFilter) : SAMPLE_TRANSCRIPTS).map((sample) => (
                <DropdownMenuItem
                  key={sample.label}
                  onSelect={() => handleLoadSample(sample.transcript)}
                >
                  {sample.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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

      {/* Unsaved dictation restore banner */}
      {restorableDraft?.rawTranscript && (
        <Alert className="border-blue-200 bg-blue-50 text-blue-800">
          <History className="h-4 w-4 text-blue-600" />
          <AlertTitle>
            Unsaved dictation from {formatDistanceToNow(new Date(restorableDraft.updatedAt || restorableDraft.startTime), { addSuffix: true })}
          </AlertTitle>
          <AlertDescription className="text-blue-700">
            <p className="line-clamp-2 italic">&ldquo;{restorableDraft.rawTranscript}&rdquo;</p>
            <div className="flex gap-2 mt-1">
              <Button size="sm" variant="outline" className="h-7 border-blue-300 text-blue-700 hover:bg-blue-100" onClick={handleRestoreDraft}>
                Restore
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-blue-700 hover:bg-blue-100" onClick={handleDiscardDraft}>
                Discard
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Demo mode (mock data) banner */}
      {banner?.kind === 'mock' && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Demo Mode: AI unavailable (no API key)</AlertTitle>
          <AlertDescription className="text-amber-700">
            <p>Values below are canned demo data, not AI output.</p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 mt-1 border-amber-300 text-amber-800 hover:bg-amber-100"
              onClick={handleProcess}
              disabled={!transcript || isRecording || isProcessing}
            >
              <RotateCcw className="w-3 h-3 mr-1" /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* AI failure banner */}
      {banner?.kind === 'error' && (
        <Alert className="border-red-300 bg-red-50 text-red-800">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertTitle>AI Scribe failed: {banner.message}</AlertTitle>
          <AlertDescription className="text-red-700">
            <p>You can retry, or explicitly fall back to demo values.</p>
            <div className="flex gap-2 mt-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-red-300 text-red-800 hover:bg-red-100"
                onClick={handleProcess}
                disabled={!transcript || isRecording || isProcessing}
              >
                <RotateCcw className="w-3 h-3 mr-1" /> Retry
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-red-700 hover:bg-red-100"
                onClick={handleUseDemoValues}
                disabled={isProcessing}
              >
                Use demo values instead
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

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
