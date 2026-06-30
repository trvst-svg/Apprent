'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import Editor from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Terminal as TerminalIcon, Play, Bookmark as BookmarkIcon, Eye, Check, ChevronLeft, Volume2, Shield, Code } from 'lucide-react';

interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  files: Array<{ path: string; content: string }>;
}

interface Stream {
  id: string;
  title: string;
  description: string;
  videoUrl?: string;
}

export default function SandboxWorkspace() {
  const { challengeId } = useParams();
  const router = useRouter();
  const { token, user } = useAuth();
  
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [stream, setStream] = useState<Stream | null>(null);
  const [code, setCode] = useState('// Loading environment...');
  const [loading, setLoading] = useState(true);

  // Interface States
  const [terminalOutput, setTerminalOutput] = useState('Workspace initialized. Write code and click "Run Verification" to trigger assertions.');
  const [runningTests, setRunningTests] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [redactionActive, setRedactionActive] = useState(true);

  // Video and Audio Overlay simulation
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeCommentary, setActiveCommentary] = useState<string | null>(null);

  // Mock overlay timestamps & files
  const mockAudioComments = [
    { timestamp: 15, text: "Expert Note: I'm spawning a goroutine here. Keep in mind that we need to release channels properly to avoid memory leakage.", transcription: "Spawning go proxy routines without thread leaks." },
    { timestamp: 45, text: "Expert Note: Watch out! I'm using context.WithTimeout to clean up resources in case of connection dropouts.", transcription: "Injecting connection timeouts onto client buffers." }
  ];

  const masterCode = `package main

import (
	"context"
	"fmt"
	"time"
)

func worker(ctx context.Context, ch chan bool) {
	defer close(ch) // Correctly close channel to prevent leaks!
	select {
	case <-time.After(1 * time.Second):
		fmt.Println("Job finished")
		ch <- true
	case <-ctx.Done():
		fmt.Println("Cancelled worker")
	}
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	ch := make(chan bool)
	go worker(ctx, ch)

	select {
	case res := <-ch:
		fmt.Println("Result:", res)
	case <-ctx.Done():
		fmt.Println("Timeout occurred")
	}
}
`;

  useEffect(() => {
    loadWorkspace();
  }, [challengeId]);

  const loadWorkspace = async () => {
    try {
      // Check if it is a challenge or a stream
      try {
        const chData = await apiFetch<Challenge>(`/api/v1/challenges/${challengeId}`, { token: token || undefined });
        setChallenge(chData);
        setCode(chData.files[0]?.content || '');
      } catch (_) {
        // Fallback: try loading stream details and mount default challenge template
        const strData = await apiFetch<Stream>(`/api/v1/streams/${challengeId}`, { token: token || undefined });
        setStream(strData);
        setCode(`package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n)\n\nfunc main() {\n\t// TODO: Implement safe channel cleanup without leaks\n\tch := make(chan bool)\n\tgo func() {\n\t\tch <- true\n\t}()\n\tfmt.Println(<-ch)\n}\n`);
      }
    } catch (err) {
      console.error('Failed to load workspace:', err);
    } finally {
      setLoading(false);
    }
  };

  // Track video current time
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const t = Math.floor(videoRef.current.currentTime);
      setCurrentTime(t);

      // Check if there is an expert comment at this second
      const active = mockAudioComments.find(c => c.timestamp === t);
      if (active) {
        setActiveCommentary(active.text);
      } else if (t > 0 && !mockAudioComments.some(c => c.timestamp === t || c.timestamp === t - 1 || c.timestamp === t + 1)) {
        // Clear comment after moment passes
        setActiveCommentary(null);
      }
    }
  };

  const jumpToTime = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
      setCurrentTime(seconds);
      const active = mockAudioComments.find(c => c.timestamp === seconds);
      if (active) setActiveCommentary(active.text);
    }
  };

  // Add bookmark
  const handleAddBookmark = async () => {
    if (!videoRef.current) return;
    const timestamp = Math.floor(videoRef.current.currentTime);
    try {
      await apiFetch(`/api/v1/streams/${challengeId || 'mock'}/bookmarks`, {
        method: 'POST',
        body: JSON.stringify({ timestamp, notes: bookmarkNote || 'Custom moment bookmark' }),
        token: token || undefined,
      });
      alert(`Bookmark saved at ${Math.floor(timestamp / 60)}:${(timestamp % 60).toString().padStart(2, '0')}!`);
      setBookmarkNote('');
    } catch (err: any) {
      alert(err.message || 'Failed to save bookmark');
    }
  };

  // Test Runner Simulation
  const handleRunTests = async () => {
    setRunningTests(true);
    setTerminalOutput('Compiling package main...\nRunning verification assertions...\n');
    
    try {
      const res = await apiFetch(`/api/v1/challenges/${challengeId || 'demo'}/submit`, {
        method: 'POST',
        body: JSON.stringify({ files: [{ path: 'main.go', content: code }] }),
        token: token || undefined,
      });

      setTimeout(() => {
        setTerminalOutput(res.resultLogs);
        if (res.status === 'pass') {
          setTerminalOutput(prev => prev + `\n\n[SUCCESS] Solution matched target assertions!\nAI Review Feedback: ${res.feedback}`);
        } else {
          setTerminalOutput(prev => prev + `\n\n[FAILED] Assertions check failed!\nReview Suggestion: ${res.feedback}`);
        }
        setRunningTests(false);
      }, 1500);
    } catch (err: any) {
      setTerminalOutput(`Error compiling code: ${err.message}`);
      setRunningTests(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-zinc-950 text-zinc-400">
        <TerminalIcon className="h-8 w-8 animate-spin text-violet-500 mr-2" />
        Mounting isolated sandbox container...
      </div>
    );
  }

  return (
    <div className="flex-1 bg-zinc-950 text-zinc-50 min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="border-b border-zinc-800 bg-zinc-900/40 backdrop-blur-md px-4 py-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <Button onClick={() => router.push('/learner')} variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-200">
            <ChevronLeft className="h-4 w-4 mr-1" /> Dashboard
          </Button>
          <span className="text-sm font-semibold border-l border-zinc-700 pl-3">
            Sandbox: {challenge?.title || stream?.title || 'Interactive Workshop'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setRedactionActive(!redactionActive)}
            variant="outline"
            className={`border-zinc-800 h-8 text-xs ${redactionActive ? 'text-emerald-400 bg-emerald-950/20' : 'text-zinc-400'}`}
          >
            <Shield className="h-4 w-4 mr-1.5" /> AI Privacy Redaction: {redactionActive ? 'ACTIVE' : 'OFF'}
          </Button>
        </div>
      </header>

      {/* Grid workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden h-[calc(100vh-53px)]">
        
        {/* Left Side: Video + Timestamps */}
        <div className="flex flex-col border-r border-zinc-800 bg-zinc-900/10 overflow-y-auto">
          {/* Simulated Video Frame */}
          <div className="relative aspect-video w-full bg-zinc-900 overflow-hidden group border-b border-zinc-800">
            {/* The Actual Video Element */}
            <video
              ref={videoRef}
              src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
              className={`w-full h-full object-cover transition duration-300 ${redactionActive ? 'brightness-[0.9]' : ''}`}
              onTimeUpdate={handleTimeUpdate}
              controls
            />

            {/* AI Blurring Filter Overlay Simulation */}
            {redactionActive && (
              <>
                {/* Blur Box simulating sensitive log key redaction */}
                <div className="absolute top-[20%] left-[15%] w-[45%] h-[8%] bg-zinc-800/40 backdrop-blur-[15px] border border-zinc-700/30 rounded flex items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-zinc-300 font-mono flex items-center gap-1 opacity-70">
                    <Shield className="h-3 w-3 text-emerald-400" /> redacted key [AWS_SECRET_ACCESS_KEY]
                  </span>
                </div>
                {/* Blur Box simulating database host info redaction */}
                <div className="absolute bottom-[30%] right-[10%] w-[35%] h-[6%] bg-zinc-800/40 backdrop-blur-[15px] border border-zinc-700/30 rounded flex items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-zinc-300 font-mono flex items-center gap-1 opacity-70">
                    <Shield className="h-3 w-3 text-emerald-400" /> redacted client credentials
                  </span>
                </div>
              </>
            )}

            {/* Audio Overlay Indicator */}
            {activeCommentary && (
              <div className="absolute bottom-4 left-4 right-4 p-3 bg-violet-950/90 backdrop-blur border border-violet-800 rounded-lg flex items-start gap-2 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Volume2 className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-bold text-violet-200 uppercase tracking-wider">Expert Voice Commentary (TIMED)</h5>
                  <p className="text-xs text-zinc-300 mt-1">{activeCommentary}</p>
                </div>
              </div>
            )}
          </div>

          {/* Audio commentaries and Bookmark creator */}
          <div className="p-4 space-y-4 flex-1">
            {/* Quick Trigger Timestamps */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Synchronized Audio Commentary Index</h4>
              <div className="grid grid-cols-2 gap-2">
                {mockAudioComments.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => jumpToTime(item.timestamp)}
                    className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-left hover:border-violet-500 hover:bg-zinc-900/80 transition text-xs"
                  >
                    <div className="flex items-center gap-1 text-violet-400 font-mono font-bold mb-1">
                      <Volume2 className="h-3.5 w-3.5" /> 
                      {Math.floor(item.timestamp / 60)}:{(item.timestamp % 60).toString().padStart(2, '0')}
                    </div>
                    <span className="text-zinc-300 line-clamp-1">{item.transcription}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Create new bookmark */}
            <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-2">
              <h4 className="text-xs font-bold uppercase text-zinc-300 flex items-center gap-1.5">
                <BookmarkIcon className="h-4 w-4 text-violet-400" /> Create Context Bookmark
              </h4>
              <p className="text-[11px] text-zinc-400">Save a timestamped note. The expert will review this bookmark and record a synced commentary overlay.</p>
              <div className="flex gap-2">
                <input
                  placeholder="e.g. Can you explain why we defer channel close?"
                  value={bookmarkNote}
                  onChange={(e) => setBookmarkNote(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
                />
                <Button onClick={handleAddBookmark} size="sm" className="bg-violet-600 hover:bg-violet-700 text-xs">
                  Save Mark
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Monaco IDE + Terminal Console */}
        <div className="flex flex-col h-full overflow-hidden bg-zinc-950">
          
          {/* Editor Header / Tabs */}
          <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/30 flex items-center justify-between">
            <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
              <Button
                onClick={() => setCompareMode(false)}
                size="sm"
                variant={!compareMode ? 'secondary' : 'ghost'}
                className="h-7 text-xs rounded"
              >
                <Code className="h-3.5 w-3.5 mr-1" /> My Workspace
              </Button>
              <Button
                onClick={() => setCompareMode(true)}
                size="sm"
                variant={compareMode ? 'secondary' : 'ghost'}
                className="h-7 text-xs rounded text-amber-300 hover:text-amber-200"
              >
                <Eye className="h-3.5 w-3.5 mr-1" /> Compare with Master
              </Button>
            </div>
            <Button
              onClick={handleRunTests}
              disabled={runningTests}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-zinc-50 font-bold h-8 text-xs cursor-pointer"
            >
              {runningTests ? 'Running...' : 'Run Verification'}
            </Button>
          </div>

          {/* Editor Content Area */}
          <div className="flex-1 min-h-[300px] relative">
            {!compareMode ? (
              <Editor
                height="100%"
                defaultLanguage="go"
                theme="vs-dark"
                value={code}
                onChange={(val) => setCode(val || '')}
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  scrollbar: { vertical: 'visible', horizontal: 'visible' },
                  lineNumbers: 'on',
                  tabSize: 4,
                }}
              />
            ) : (
              <div className="h-full grid grid-cols-2">
                <div className="flex flex-col border-r border-zinc-800">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-900/40 border-b border-zinc-800">My Workspace</div>
                  <div className="flex-1">
                    <Editor
                      height="100%"
                      defaultLanguage="go"
                      theme="vs-dark"
                      value={code}
                      options={{ readOnly: true, fontSize: 11, minimap: { enabled: false } }}
                    />
                  </div>
                </div>
                <div className="flex flex-col">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-zinc-900/40 border-b border-zinc-800">Expert Final Code</div>
                  <div className="flex-1">
                    <Editor
                      height="100%"
                      defaultLanguage="go"
                      theme="vs-dark"
                      value={masterCode}
                      options={{ readOnly: true, fontSize: 11, minimap: { enabled: false } }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Terminal Console Panel */}
          <div className="h-[220px] border-t border-zinc-800 bg-zinc-950 flex flex-col shrink-0">
            <div className="px-4 py-1.5 bg-zinc-900/60 border-b border-zinc-800 flex items-center justify-between text-xs font-semibold text-zinc-400">
              <span className="flex items-center gap-1.5"><TerminalIcon className="h-4 w-4 text-violet-400" /> Compiler Console Output</span>
              <Button size="sm" variant="ghost" className="h-6 text-[10px] p-1 text-zinc-500" onClick={() => setTerminalOutput('')}>Clear Console</Button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-zinc-300 whitespace-pre-wrap select-text selection:bg-zinc-700">
              {terminalOutput}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
