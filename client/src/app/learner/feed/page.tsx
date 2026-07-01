'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Volume2, BookOpen, ExternalLink, ChevronUp, ChevronDown, Terminal, Shield, Play } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';

interface FeedItem {
  id: string;
  title: string;
  expertName: string;
  videoUrl: string;
  description: string;
  commentaries: Array<{ time: string; note: string }>;
  transcript: string[];
  snippets: Array<{ filename: string; code: string }>;
}

const mockFeedData: FeedItem[] = [
  {
    id: 'f1',
    title: 'Debugging Concurrent Map Writes in Go',
    expertName: 'Jane Doe (Staff Engineer)',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    description: 'Watch me diagnose a panic caused by concurrent map reads/writes, trace goroutines in VS Code, and safely refactor with sync.RWMutex.',
    commentaries: [
      { time: '0:05', note: 'I use go test -race to locate the data race immediately.' },
      { time: '0:18', note: 'Writing dynamic maps concurrently triggers a fatal panic in Go. RWMutex prevents this.' }
    ],
    transcript: [
      '[0:02] Running "go run main.go"...',
      '[0:05] Oh! It panicked: fatal error: concurrent map read and map write.',
      '[0:10] Let\'s inspect the stack trace. The goroutine spawned at line 24 is writing directly to the global map.',
      '[0:18] I will define a sync.RWMutex wrapper to safely protect the read and write operations.',
      '[0:30] Locking the write block and test passes.'
    ],
    snippets: [
      {
        filename: 'safe_map.go',
        code: `type SafeMap struct {
    sync.RWMutex
    data map[string]string
}

func (m *SafeMap) Set(key, val string) {
    m.Lock()
    defer m.Unlock()
    m.data[key] = val
}`
      }
    ]
  },
  {
    id: 'f2',
    title: 'Tracing Memory Leaks on ECS Container Allocations',
    expertName: 'Mark Johnson (DevOps Principal)',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    description: 'Profiling Go memory allocations using pprof, locating escape analysis issues, and adjusting AWS ECS resource ceilings.',
    commentaries: [
      { time: '0:03', note: 'Pprof web UI shows a heap allocation spike in the JSON decoder.' },
      { time: '0:22', note: 'We will reuse byte buffers with sync.Pool to lower garbage collection sweeps.' }
    ],
    transcript: [
      '[0:01] Launching pprof profile tools...',
      '[0:03] Look at this heap allocations tree: most bytes escape to the heap inside json.Unmarshal.',
      '[0:15] Let\'s investigate why we can\'t reuse buffers.',
      '[0:22] Introducing sync.Pool for byte buffers prevents frequent allocation cycles.',
      '[0:35] Re-running load tests... memory graph is flat!'
    ],
    snippets: [
      {
        filename: 'buffer_pool.go',
        code: `var bufPool = sync.Pool{
    New: func() interface{} {
        return new(bytes.Buffer)
    },
}

func parse(r io.Reader) {
    buf := bufPool.Get().(*bytes.Buffer)
    buf.Reset()
    defer bufPool.Put(buf)
    // read and process...
}`
      }
    ]
  }
];

export default function FeedRoom() {
  const router = useRouter();
  const [feedItems, setFeedItems] = useState<FeedItem[]>(mockFeedData);
  const [activeIndex, setActiveIndex] = useState(0);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  const currentItem = feedItems[activeIndex];
  const [currentTime, setCurrentTime] = useState(0);
  const [activeMobileTab, setActiveMobileTab] = useState<'video' | 'info'>('video');
  const { token } = useAuth();

  useEffect(() => {
    fetchStreams();
  }, []);

  useEffect(() => {
    if (currentItem && currentItem.commentaries.length === 0 && !currentItem.id.startsWith('f')) {
      fetchCommentaries(currentItem.id);
    }
  }, [activeIndex, feedItems]);

  const fetchStreams = async () => {
    try {
      const res = await apiFetch<{ data: any[] }>('/api/v1/streams?status=recorded', { token: token || undefined });
      if (res.data && res.data.length > 0) {
        const formatted = res.data.map(s => ({
          id: s.id,
          title: s.title,
          expertName: "Verified Apprent Expert",
          videoUrl: s.videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          description: s.description,
          commentaries: [],
          transcript: ["[0:01] Synced video stream loaded."],
          snippets: []
        }));
        setFeedItems([...formatted, ...mockFeedData]);
      }
    } catch (err) {
      console.error('Failed to load recorded streams for feed:', err);
    }
  };

  const fetchCommentaries = async (streamId: string) => {
    try {
      const res = await apiFetch<any[]>(`/api/v1/streams/${streamId}/commentaries`, { token: token || undefined });
      if (res && res.length > 0) {
        const formatted = res.map(c => ({
          time: '0:01',
          note: c.text
        }));
        setFeedItems(prev => prev.map(item => item.id === streamId ? { ...item, commentaries: formatted } : item));
      }
    } catch (err) {
      console.error('Failed to load commentaries:', err);
    }
  };

  const getSecondsFromTranscript = (text: string): number => {
    const match = text.match(/\[(\d+):(\d+)\]/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      return minutes * 60 + seconds;
    }
    return 0;
  };

  const getSecondsFromTime = (timeStr: string): number => {
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    return 0;
  };

  const jumpToFeedTime = (timeStr: string) => {
    const id = currentItem.id;
    const video = videoRefs.current[id];
    if (video) {
      const sec = timeStr.includes('[') ? getSecondsFromTranscript(timeStr) : getSecondsFromTime(timeStr);
      video.currentTime = sec;
      video.play().catch(() => {});
      setCurrentTime(sec);
    }
  };

  const handleNext = () => {
    if (activeIndex < feedItems.length - 1) {
      pauseAllVideos();
      setActiveIndex(activeIndex + 1);
      playActiveVideo(activeIndex + 1);
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) {
      pauseAllVideos();
      setActiveIndex(activeIndex - 1);
      playActiveVideo(activeIndex - 1);
    }
  };

  const pauseAllVideos = () => {
    Object.values(videoRefs.current).forEach((video) => {
      if (video) video.pause();
    });
  };

  const playActiveVideo = (index: number) => {
    const id = feedItems[index]?.id;
    if (id) {
      setTimeout(() => {
        const video = videoRefs.current[id];
        if (video) video.play().catch(() => {});
      }, 100);
    }
  };

  // Find active commentary index based on current video time
  let activeCommentaryIdx = -1;
  for (let i = 0; i < currentItem.commentaries.length; i++) {
    const sec = getSecondsFromTime(currentItem.commentaries[i].time);
    if (currentTime >= sec) {
      activeCommentaryIdx = i;
    }
  }

  // Find active transcript index based on current video time
  const parsedTranscript = currentItem.transcript.map((line) => {
    const timeSec = getSecondsFromTranscript(line);
    return { line, timeSec };
  });

  let activeTranscriptIdx = -1;
  for (let i = 0; i < parsedTranscript.length; i++) {
    if (currentTime >= parsedTranscript[i].timeSec) {
      activeTranscriptIdx = i;
    }
  }

  return (
    <div className="flex-1 bg-zinc-950 text-zinc-50 min-h-screen flex flex-col overflow-hidden">
      {/* Navbar */}
      <header className="border-b border-zinc-800 bg-zinc-900/40 backdrop-blur-md px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button onClick={() => router.push('/learner')} variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-200">
            <ChevronLeft className="h-4 w-4 mr-1" /> Dashboard
          </Button>
          <span className="text-sm font-semibold border-l border-zinc-700 pl-3">
            Asynchronous Feed Room (The Feed)
          </span>
        </div>
      </header>

      {/* Mobile Tab Selector */}
      <div className="lg:hidden flex border-b border-zinc-800 bg-zinc-900/50 shrink-0">
        <button
          onClick={() => setActiveMobileTab('video')}
          className={`flex-1 py-3 text-center text-xs font-semibold border-b-2 transition ${
            activeMobileTab === 'video'
              ? 'border-violet-500 text-zinc-100 bg-violet-950/10'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Play className="h-3.5 w-3.5 inline mr-1.5" /> Watch Broadcast
        </button>
        <button
          onClick={() => setActiveMobileTab('info')}
          className={`flex-1 py-3 text-center text-xs font-semibold border-b-2 transition ${
            activeMobileTab === 'info'
              ? 'border-violet-500 text-zinc-100 bg-violet-950/10'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Volume2 className="h-3.5 w-3.5 inline mr-1.5" /> Notes & Snippets
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        
        {/* Scroll Controls (Floating on Desktop) */}
        <div className="absolute right-4 bottom-4 lg:bottom-auto lg:top-[50%] lg:translate-y-[-50%] flex flex-col gap-2 z-30 bg-zinc-900/60 p-2 rounded-xl border border-zinc-800 backdrop-blur">
          <Button onClick={handlePrev} disabled={activeIndex === 0} size="icon" className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30">
            <ChevronUp className="h-5 w-5" />
          </Button>
          <Button onClick={handleNext} disabled={activeIndex === feedItems.length - 1} size="icon" className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30">
            <ChevronDown className="h-5 w-5" />
          </Button>
        </div>

        {/* Left Side: Dynamic vertical TikTok/Reels Video Frame */}
        <div className={`flex-1 flex items-center justify-center p-4 bg-zinc-950 border-r border-zinc-800 ${activeMobileTab === 'video' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="relative w-full max-w-[400px] aspect-[9/16] bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 flex flex-col justify-end group">
            
            {/* Vertical Video Element */}
            <video
              ref={(el) => { videoRefs.current[currentItem.id] = el; }}
              src={currentItem.videoUrl}
              className="absolute inset-0 w-full h-full object-cover brightness-[0.8]"
              loop
              autoPlay
              muted
              controls
              onTimeUpdate={(e) => {
                const video = e.currentTarget;
                if (video) setCurrentTime(Math.floor(video.currentTime));
              }}
            />

            {/* Simulated Live Privacy Mask */}
            <div className="absolute top-[10%] left-[10%] w-[80%] h-[7%] bg-zinc-950/40 backdrop-blur-[15px] border border-zinc-800/40 rounded flex items-center justify-center pointer-events-none">
              <span className="text-[10px] text-zinc-300 font-mono flex items-center gap-1 opacity-70">
                <Shield className="h-3.5 w-3.5 text-emerald-400" /> AI redaction active
              </span>
            </div>

            {/* Video description card at the bottom */}
            <div className="relative p-4 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-transparent z-10 text-zinc-100 space-y-2 pointer-events-none">
              <Badge className="bg-violet-600 hover:bg-violet-600/80 text-xs font-semibold">APPRENTICESHIP</Badge>
              <h3 className="font-bold text-lg leading-tight">{currentItem.title}</h3>
              <p className="text-xs text-zinc-300 font-medium">{currentItem.expertName}</p>
              <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">{currentItem.description}</p>
            </div>
          </div>
        </div>

        {/* Right Side: Sync Information Panels */}
        <div className={`w-full lg:w-[480px] bg-zinc-900/10 flex flex-col overflow-y-auto shrink-0 border-l border-zinc-800/50 p-6 space-y-6 ${activeMobileTab === 'info' ? 'flex' : 'hidden lg:flex'}`}>
          
          {/* Audio commentaries */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
              <Volume2 className="h-4 w-4 text-violet-400" /> Synchronized Expert Notes
            </h4>
            <div className="space-y-2.5">
              {currentItem.commentaries.map((com, index) => {
                const isActive = index === activeCommentaryIdx;
                return (
                  <div 
                    key={index} 
                    onClick={() => jumpToFeedTime(com.time)}
                    className={`p-3 border rounded-lg flex items-start gap-2.5 cursor-pointer transition-all duration-300 ${
                      isActive 
                        ? 'bg-violet-950/20 border-violet-500 shadow-lg shadow-violet-500/5 translate-x-1' 
                        : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded shrink-0 transition-colors ${
                      isActive 
                        ? 'text-zinc-50 bg-violet-600' 
                        : 'text-violet-400 bg-violet-950/40'
                    }`}>{com.time}</span>
                    <p className={`text-xs leading-relaxed transition-colors ${
                      isActive ? 'text-zinc-100 font-medium' : 'text-zinc-300'
                    }`}>{com.note}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transcript logs */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Terminal className="h-4 w-4 text-indigo-400" /> Interactive Runtime Transcript
            </h4>
            <Card className="bg-zinc-950 border-zinc-800 text-zinc-100">
              <CardContent className="p-3 font-mono text-[11px] leading-relaxed text-zinc-400 space-y-1 max-h-[150px] overflow-y-auto">
                {currentItem.transcript.map((line, idx) => {
                  const isActive = idx === activeTranscriptIdx;
                  return (
                    <div 
                      key={idx} 
                      onClick={() => jumpToFeedTime(line)}
                      className={`cursor-pointer transition-colors duration-300 py-0.5 px-1 rounded ${
                        isActive 
                          ? 'text-violet-400 bg-violet-950/20 font-bold border-l-2 border-violet-500 pl-1.5 shadow-[inset_0_0_8px_rgba(139,92,246,0.05)]' 
                          : 'hover:text-zinc-200 text-zinc-600'
                      }`}
                    >
                      {line}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Non-sensitive code snippets */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-purple-400" /> Reference Code snippet
            </h4>
            {currentItem.snippets.map((sn, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="text-[10px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800/80 px-2 py-0.5 w-max rounded-t">
                  {sn.filename}
                </div>
                <Card className="bg-zinc-950 border-zinc-800 text-zinc-100 overflow-x-auto">
                  <CardContent className="p-3 font-mono text-[10px] leading-normal text-zinc-300 whitespace-pre">
                    {sn.code}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          {/* Action triggers */}
          <div className="pt-4 border-t border-zinc-800">
            <Button onClick={() => router.push(`/learner/sandbox/${currentItem.id}`)} className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 font-bold text-sm cursor-pointer">
              Launch Interactive Sandbox for this Module <ExternalLink className="h-4 w-4 ml-1.5" />
            </Button>
          </div>

        </div>

      </div>
    </div>
  );
}
