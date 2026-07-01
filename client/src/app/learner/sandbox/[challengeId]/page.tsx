'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, getWebSocketURL } from '@/lib/api';
import Editor from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Terminal as TerminalIcon, Play, Bookmark as BookmarkIcon, Eye, Check, ChevronLeft, Volume2, Shield, Code, BookOpen, Sparkles, MessageSquare, Send } from 'lucide-react';
import AIReviewPanel from '@/components/AIReviewPanel';
import { useAnalytics } from '@/hooks/useAnalytics';

const LANGUAGE_TUTORIALS: Record<string, Array<{ title: string; content: string; codeSnippet?: string }>> = {
  go: [
    {
      title: "1. Understanding Channels & Goroutines",
      content: "Goroutines run concurrently. Channels are the pipes that connect concurrent goroutines. You can send values into channels from one goroutine and receive those values into another goroutine. Always make sure to close channels when they are no longer needed to signal receivers and avoid goroutine leaks.",
      codeSnippet: `package main

import "fmt"

func main() {
    messages := make(chan string)

    go func() { messages <- "ping" }()

    msg := <-messages
    fmt.Println(msg)
}`
    },
    {
      title: "2. Preventing Goroutine Leaks",
      content: "A goroutine leak occurs when a goroutine is started but never terminates. This typically happens when a goroutine blocks on a channel write or read indefinitely because the channel is never read from or closed. Use contexts with timeouts or select statements to guarantee cleanup.",
      codeSnippet: `package main

import (
    "context"
    "fmt"
    "time"
)

func main() {
    ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
    defer cancel()

    ch := make(chan bool)
    go func() {
        time.Sleep(200*time.Millisecond)
        ch <- true
    }()

    select {
    case <-ch:
        fmt.Println("Completed")
    case <-ctx.Done():
        fmt.Println("Timeout, cleaned up routine")
    }
}`
    }
  ],
  python: [
    {
      title: "1. Python String Slicing & Reversal",
      content: "Python strings can be easily manipulated using slicing syntax string[start:stop:step]. Specifying a step value of -1 yields a reversed copy of the string. Slicing is highly optimized in the Python runtime.",
      codeSnippet: `def reverse_string(s: str) -> str:
    # Quick string reversal using slicing step
    return s[::-1]

print(reverse_string("hello")) # "olleh"`
    },
    {
      title: "2. String Methods & Operations",
      content: "Python provides built-in methods like .strip(), .split(), .join(), and .replace() to clean and structure text efficiently. String formatting can be done using f-strings.",
      codeSnippet: `words = ["Apprent", "is", "awesome"]
sentence = " ".join(words)
print(f"Result: {sentence}")`
    }
  ],
  javascript: [
    {
      title: "1. Custom Array Filtering",
      content: "Filtering elements requires evaluating each item against a predicate function. By iterating over the source collection and pushing elements that return truthy under the predicate, you build the custom filter logic.",
      codeSnippet: `function filterArray(arr, predicate) {
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    if (predicate(arr[i])) {
      result.push(arr[i]);
    }
  }
  return result;
}

console.log(filterArray([1, 2, 3, 4], x => x % 2 === 0)); // [2, 4]`
    },
    {
      title: "2. Array map, filter, and reduce",
      content: "JavaScript ES6 arrays support functional methods. .map() transforms elements, .filter() subsets elements, and .reduce() accumulates elements into a single result.",
      codeSnippet: `const numbers = [1, 2, 3];
const double = numbers.map(x => x * 2);
console.log(double); // [2, 4, 6]`
    }
  ]
};

interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  files: Array<{ path: string; content: string }>;
  validation?: {
    type: string;
    scripts: string[];
  };
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
  const { trackEvent } = useAnalytics();

  // Interface States
  const [terminalOutput, setTerminalOutput] = useState('Workspace initialized. Write code and click "Run Verification" to trigger assertions.');
  const [runningTests, setRunningTests] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [redactionActive, setRedactionActive] = useState(true);
  const [activeMobileTab, setActiveMobileTab] = useState<'video' | 'workspace'>('video');

  // AI Review States
  const [aiReview, setAiReview] = useState<any>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [aiHint, setAiHint] = useState<any>(null);
  const [loadingHint, setLoadingHint] = useState(false);

  // Interactive Textbook and Docs States
  const [books, setBooks] = useState<any[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [selectedChapter, setSelectedChapter] = useState<number>(0);
  const [leftTab, setLeftTab] = useState<'commentary' | 'docs' | 'ai' | 'chat'>('commentary');

  // Real-time Chat & WS States
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [onlineCount, setOnlineCount] = useState(1);
  const wsRef = useRef<WebSocket | null>(null);

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
    trackEvent('page_view', challengeId as string, 'challenge');
  }, [challengeId]);

  useEffect(() => {
    if (!token || !user || !challengeId) return;

    const wsUrl = getWebSocketURL(challengeId as string, user.id);
    const authenticatedWsUrl = `${wsUrl}&token=${token}&userName=${encodeURIComponent(user.name)}`;
    const ws = new WebSocket(authenticatedWsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'chat') {
          setChatMessages((prev) => [...prev, msg]);
        } else if (msg.type === 'presence') {
          const content = JSON.parse(msg.content);
          if (content.count) {
            setOnlineCount(content.count);
          }
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [challengeId, token, user]);

  const loadWorkspace = async () => {
    try {
      try {
        const bks = await apiFetch<any[]>('/api/v1/books', { token: token || undefined });
        setBooks(bks);
        if (bks.length > 0) setSelectedBookId(bks[0].id);
      } catch (err) {
        console.error('Failed to load books for sandbox:', err);
      }

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
    trackEvent('run_verify', challengeId as string, 'challenge');
    
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
          trackEvent('submit_solution', challengeId as string, 'challenge', { status: 'pass' });
        } else {
          setTerminalOutput(prev => prev + `\n\n[FAILED] Assertions check failed!\nReview Suggestion: ${res.feedback}`);
          trackEvent('submit_solution', challengeId as string, 'challenge', { status: 'fail' });
        }
        setRunningTests(false);
      }, 1500);
    } catch (err: any) {
      setTerminalOutput(`Error compiling code: ${err.message}`);
      setRunningTests(false);
    }
  };

  const runAIReview = async () => {
    setLoadingReview(true);
    setAiReview(null);
    trackEvent('ai_review', challengeId as string, 'challenge');
    try {
      const res = await apiFetch('/api/v1/ai/review', {
        method: 'POST',
        token: token || undefined,
        body: JSON.stringify({
          challengeId: challengeId === 'demo' ? '' : challengeId,
          code,
          language: challenge?.validation?.type || 'go',
        }),
      });
      setAiReview(res);
    } catch (err) {
      alert('AI service currently busy. Please try again.');
    } finally {
      setLoadingReview(false);
    }
  };

  const getAIHint = async () => {
    setLoadingHint(true);
    setAiHint(null);
    try {
      const res = await apiFetch('/api/v1/ai/hint', {
        method: 'POST',
        token: token || undefined,
        body: JSON.stringify({
          challengeId: challengeId === 'demo' ? '' : challengeId,
          code,
          language: challenge?.validation?.type || 'go',
        }),
      });
      setAiHint(res);
    } catch (err) {
      alert('AI service currently busy. Please try again.');
    } finally {
      setLoadingHint(false);
    }
  };

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !wsRef.current || !user) return;

    const payload = {
      type: 'chat',
      streamId: challengeId,
      sender: user.id,
      senderName: user.name,
      content: chatInput,
    };

    wsRef.current.send(JSON.stringify(payload));
    setChatInput('');
  };

  // Find active comment idx based on current time
  let activeCommentIdx = -1;
  for (let i = 0; i < mockAudioComments.length; i++) {
    if (currentTime >= mockAudioComments[i].timestamp) {
      activeCommentIdx = i;
    }
  }

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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-[10px] font-mono font-bold text-zinc-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            ONLINE: {onlineCount} DEV{onlineCount > 1 ? 'S' : ''}
          </div>

          <Button
            onClick={() => setRedactionActive(!redactionActive)}
            variant="outline"
            className={`border-zinc-800 h-8 text-xs ${redactionActive ? 'text-emerald-400 bg-emerald-950/20' : 'text-zinc-400'}`}
          >
            <Shield className="h-4 w-4 mr-1.5" /> AI Privacy Redaction: {redactionActive ? 'ACTIVE' : 'OFF'}
          </Button>
        </div>
      </header>

      {/* Mobile Tab Selector */}
      <div className="lg:hidden flex border-b border-zinc-850 bg-zinc-900/50 shrink-0">
        <button
          onClick={() => setActiveMobileTab('video')}
          className={`flex-1 py-3 text-center text-xs font-semibold border-b-2 transition ${
            activeMobileTab === 'video'
              ? 'border-violet-500 text-zinc-100 bg-violet-950/10'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Play className="h-3.5 w-3.5 inline mr-1.5" /> Video & Commentary
        </button>
        <button
          onClick={() => setActiveMobileTab('workspace')}
          className={`flex-1 py-3 text-center text-xs font-semibold border-b-2 transition ${
            activeMobileTab === 'workspace'
              ? 'border-violet-500 text-zinc-100 bg-violet-950/10'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Code className="h-3.5 w-3.5 inline mr-1.5" /> Workspace & Editor
        </button>
      </div>

      {/* Grid workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden h-[calc(100vh-101px)] lg:h-[calc(100vh-53px)]">
        
        {/* Left Side: Video + Timestamps */}
        <div className={`flex flex-col border-r border-zinc-800 bg-zinc-900/10 overflow-y-auto ${activeMobileTab === 'video' ? 'flex' : 'hidden lg:flex'}`}>
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

          {/* Tab Selector for Left Panel */}
          <div className="border-b border-zinc-850 bg-zinc-950/20 flex px-4">
            <button
              onClick={() => setLeftTab('commentary')}
              className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                leftTab === 'commentary'
                  ? 'border-violet-500 text-violet-400 bg-violet-950/5'
                  : 'border-transparent text-zinc-400 hover:text-zinc-300'
              }`}
            >
              <Volume2 className="h-3.5 w-3.5" /> Commentary & Marks
            </button>
            <button
              onClick={() => setLeftTab('docs')}
              className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                leftTab === 'docs'
                  ? 'border-violet-500 text-violet-400 bg-violet-950/5'
                  : 'border-transparent text-zinc-400 hover:text-zinc-300'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" /> Study Guides & Docs
            </button>
            <button
              onClick={() => setLeftTab('ai')}
              className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                leftTab === 'ai'
                  ? 'border-violet-500 text-violet-400 bg-violet-950/5'
                  : 'border-transparent text-zinc-400 hover:text-zinc-300'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" /> AI Review
            </button>
            <button
              onClick={() => setLeftTab('chat')}
              className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                leftTab === 'chat'
                  ? 'border-violet-500 text-violet-400 bg-violet-950/5'
                  : 'border-transparent text-zinc-400 hover:text-zinc-300'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" /> Chat
            </button>
          </div>

          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            {leftTab === 'commentary' && (
              <>
                {/* Quick Trigger Timestamps */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Synchronized Audio Commentary Index</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {mockAudioComments.map((item, idx) => {
                      const isActive = idx === activeCommentIdx;
                      return (
                        <button
                          key={idx}
                          onClick={() => jumpToTime(item.timestamp)}
                          className={`p-2.5 rounded-lg text-left transition text-xs border cursor-pointer ${
                            isActive
                              ? 'border-violet-500 bg-violet-950/20 shadow-md shadow-violet-500/5 translate-x-0.5'
                              : 'bg-zinc-900 border-zinc-805 hover:border-violet-500/50 hover:bg-zinc-900/80'
                          }`}
                        >
                          <div className={`flex items-center gap-1 font-mono font-bold mb-1 ${
                            isActive ? 'text-zinc-100' : 'text-violet-400'
                          }`}>
                            <Volume2 className="h-3.5 w-3.5" /> 
                            {Math.floor(item.timestamp / 60)}:{(item.timestamp % 60).toString().padStart(2, '0')}
                          </div>
                          <span className={`${isActive ? 'text-zinc-100 font-medium' : 'text-zinc-300'} line-clamp-1`}>
                            {item.transcription}
                          </span>
                        </button>
                      );
                    })}
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
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-xs text-zinc-100 placeholder:text-zinc-650 focus:outline-none focus:border-violet-500"
                    />
                    <Button onClick={handleAddBookmark} size="sm" className="bg-violet-600 hover:bg-violet-700 text-xs">
                      Save Mark
                    </Button>
                  </div>
                </div>
              </>
            )}

            {leftTab === 'docs' && (
              <div className="space-y-4">
                {/* Book Selector */}
                <div className="bg-zinc-900/40 p-3 border border-zinc-800 rounded-lg">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Select Reference Textbook
                  </label>
                  <select
                    value={selectedBookId}
                    onChange={(e) => {
                      setSelectedBookId(e.target.value);
                      setSelectedChapter(0);
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
                  >
                    {books.length === 0 ? (
                      <option value="">No reference books available</option>
                    ) : (
                      books.map((b) => (
                        <option key={b.id} value={b.id}>
                          [{b.language.toUpperCase()}] {b.title}
                        </option>
                      ))
                    )}
                  </select>
                  {books.find((b) => b.id === selectedBookId) && (
                    <div className="mt-2 text-[11px] text-zinc-400 leading-relaxed">
                      {books.find((b) => b.id === selectedBookId)?.description}
                      <a
                        href={books.find((b) => b.id === selectedBookId)?.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-400 hover:underline block mt-1"
                      >
                        Read complete textbook online →
                      </a>
                    </div>
                  )}
                </div>

                {/* GeeksforGeeks reference & Practice Panel */}
                <div className="border border-zinc-800 bg-zinc-950/40 p-3 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                      <TerminalIcon className="h-4 w-4 text-emerald-400" /> GeeksforGeeks Reference
                    </h5>
                    <span className="text-[9px] uppercase font-bold text-zinc-500">Live API</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Read corresponding GeeksforGeeks programming guides and load sample templates directly into the sandbox to practice.
                  </p>
                  <a
                    href={`https://www.geeksforgeeks.org/${
                      (challenge?.validation?.type || 'go') === 'go' ? 'golang' : (challenge?.validation?.type || 'go')
                    }/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-violet-400 hover:text-violet-300 font-semibold inline-flex items-center gap-1"
                  >
                    Browse GFG {(challenge?.validation?.type || 'go').toUpperCase()} Wiki in New Window ↗
                  </a>
                </div>

                {/* Interactive Study Guide Chapters */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Interactive Guides & Code Snippets
                  </h4>
                  
                  {LANGUAGE_TUTORIALS[challenge?.validation?.type || 'go'] ? (
                    <div className="space-y-3">
                      {LANGUAGE_TUTORIALS[challenge?.validation?.type || 'go'].map((chap, idx) => (
                        <div key={idx} className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-2">
                          <h5 className="text-xs font-bold text-zinc-100">{chap.title}</h5>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">{chap.content}</p>
                          {chap.codeSnippet && (
                            <div className="space-y-1.5">
                              <pre className="bg-zinc-950 p-2 rounded text-[10px] font-mono text-zinc-300 overflow-x-auto border border-zinc-900 max-h-[140px]">
                                {chap.codeSnippet}
                              </pre>
                              <Button
                                onClick={() => {
                                    setCode(chap.codeSnippet || '');
                                    setTerminalOutput(`Loaded code from "${chap.title}". Modify it and run verification!`);
                                }}
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] border-zinc-800 hover:bg-zinc-850 text-violet-400 hover:text-violet-300 w-full"
                              >
                                Load Snippet into Editor
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 border border-dashed border-zinc-800 bg-zinc-900/10 text-center text-zinc-500 rounded-lg text-xs">
                      No interactive study guides pre-loaded for this challenge. Select a book from the list above to read.
                    </div>
                  )}
                </div>
              </div>
            )}

            {leftTab === 'ai' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    onClick={runAIReview}
                    disabled={loadingReview}
                    className="flex-1 bg-violet-600 hover:bg-violet-700 text-zinc-50 font-bold text-xs"
                  >
                    {loadingReview ? 'Analyzing...' : 'Run AI Review'}
                  </Button>
                  <Button
                    onClick={getAIHint}
                    disabled={loadingHint}
                    variant="outline"
                    className="flex-1 border-zinc-800 hover:bg-zinc-900 text-amber-400 font-bold text-xs"
                  >
                    {loadingHint ? 'Thinking...' : 'Get AI Hint'}
                  </Button>
                </div>

                {/* AI Hint Panel */}
                {aiHint && (
                  <Card className="bg-amber-950/5 border-amber-900/20 text-zinc-150">
                    <CardContent className="p-3 space-y-1">
                      <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" /> Concept: {aiHint.concept}
                      </h4>
                      <p className="text-[11px] text-zinc-300 leading-relaxed">{aiHint.hint}</p>
                    </CardContent>
                  </Card>
                )}

                {/* AI Review Panel */}
                <AIReviewPanel review={aiReview} loading={loadingReview} />
              </div>
            )}

            {leftTab === 'chat' && (
              <div className="flex flex-col h-[calc(100vh-230px)] justify-between text-xs text-zinc-300">
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4 max-h-[300px]">
                  {chatMessages.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500 italic">
                      No messages in this workspace yet. Start the conversation!
                    </div>
                  ) : (
                    chatMessages.map((msg, idx) => (
                      <div key={idx} className="p-2 bg-zinc-900/60 border border-zinc-850 rounded-lg">
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="font-bold text-indigo-400">{msg.senderName}</span>
                          <span className="text-[9px] text-zinc-500 font-mono">
                            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className="text-zinc-200">{msg.content}</p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={sendChatMessage} className="flex gap-2 border-t border-zinc-800 pt-3 mt-auto shrink-0 bg-zinc-950">
                  <input
                    placeholder="Type a message to peers..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                  <Button type="submit" size="icon" className="bg-indigo-600 hover:bg-indigo-700">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Monaco IDE + Terminal Console */}
        <div className={`flex flex-col h-full overflow-hidden bg-zinc-950 ${activeMobileTab === 'workspace' ? 'flex' : 'hidden lg:flex'}`}>
          
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
                language={challenge?.validation?.type || 'go'}
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
                      language={challenge?.validation?.type || 'go'}
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
                      language={challenge?.validation?.type || 'go'}
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
