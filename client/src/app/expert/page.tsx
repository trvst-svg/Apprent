'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Terminal, Video, LogOut, Radio, Plus, Settings, BarChart2, MessageSquare, Mic, Play, Check } from 'lucide-react';

interface Stream {
  id: string;
  title: string;
  description: string;
  status: 'scheduled' | 'live' | 'ended' | 'recorded';
  startTime: string;
  streamKey: string;
}

interface PendingCommentary {
  streamId: string;
  title: string;
  bookmarks: Array<{
    id: string;
    timestamp: number;
    notes: string;
  }>;
}

export default function ExpertDashboard() {
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [pendingCommentaries, setPendingCommentaries] = useState<PendingCommentary[]>([]);
  const [loading, setLoading] = useState(true);

  // Stream Creation Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [showStreamKey, setShowStreamKey] = useState<string | null>(null);

  // Challenge Creation Form
  const [chTitle, setChTitle] = useState('');
  const [chDesc, setChDesc] = useState('');
  const [chDiff, setChDiff] = useState('intermediate');
  const [chLang, setChLang] = useState('go');
  const [chCode, setChCode] = useState('');
  const [chTest, setChTest] = useState('');

  // Audio Recording Mock
  const [recordingBookmarkId, setRecordingBookmarkId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedClips, setRecordedClips] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!loading && (!user || user.role !== 'expert')) {
      router.push('/');
    }
  }, [user, loading]);

  useEffect(() => {
    if (user && user.role === 'expert') {
      fetchExpertData();
    }
  }, [user]);

  const fetchExpertData = async () => {
    try {
      const [st, pc] = await Promise.all([
        apiFetch<Stream[]>('/api/v1/streams', { token: token || undefined }),
        apiFetch<PendingCommentary[]>('/api/v1/expert/pending-commentaries', { token: token || undefined }),
      ]);
      // Filter streams created by this expert (all in demo, or backend filtered)
      setStreams(st);
      setPendingCommentaries(pc);
    } catch (err) {
      console.error('Failed to load expert data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStream = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newStream = await apiFetch<Stream>('/api/v1/streams', {
        method: 'POST',
        body: JSON.stringify({ title, description, startTime: new Date(startTime).toISOString() }),
        token: token || undefined,
      });
      alert('Stream Scheduled Successfully!');
      setTitle('');
      setDescription('');
      setStartTime('');
      fetchExpertData();
      setShowStreamKey(newStream.streamKey);
    } catch (err: any) {
      alert(err.message || 'Failed to create stream');
    }
  };

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let filePath = 'main.go';
      if (chLang === 'python') filePath = 'solution.py';
      if (chLang === 'javascript') filePath = 'solution.js';

      await apiFetch('/api/v1/challenges', {
        method: 'POST',
        body: JSON.stringify({
          title: chTitle,
          description: chDesc,
          difficulty: chDiff,
          files: [{ path: filePath, content: chCode }],
          validation: { type: chLang, scripts: [chTest] },
        }),
        token: token || undefined,
      });
      alert('Challenge Published!');
      setChTitle('');
      setChDesc('');
      setChCode('');
      setChTest('');
    } catch (err: any) {
      alert(err.message || 'Failed to create challenge');
    }
  };

  const handleStartStream = async (streamId: string) => {
    try {
      await apiFetch(`/api/v1/streams/${streamId}/start`, {
        method: 'POST',
        token: token || undefined,
      });
      alert('Broadcast is live!');
      fetchExpertData();
    } catch (err: any) {
      alert(err.message || 'Failed to start stream');
    }
  };

  const handleEndStream = async (streamId: string) => {
    try {
      await apiFetch(`/api/v1/streams/${streamId}/end`, {
        method: 'POST',
        token: token || undefined,
      });
      alert('Broadcast stopped and archived.');
      fetchExpertData();
    } catch (err: any) {
      alert(err.message || 'Failed to end stream');
    }
  };

  // Recording Simulation
  const toggleRecording = (bookmarkId: string) => {
    if (isRecording) {
      setIsRecording(false);
      setRecordingBookmarkId(null);
      setRecordedClips(prev => ({ ...prev, [bookmarkId]: true }));
    } else {
      setIsRecording(true);
      setRecordingBookmarkId(bookmarkId);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-zinc-950 text-zinc-400">
        <Radio className="h-8 w-8 animate-pulse text-indigo-500 mr-2" />
        Synchronizing stream settings...
      </div>
    );
  }

  if (!user || user.role !== 'expert') return null;

  return (
    <div className="flex-1 bg-zinc-950 text-zinc-50 min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/40 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="h-6 w-6 text-indigo-500" />
          <span className="font-bold tracking-wider text-zinc-100 uppercase">
            Appr<span className="text-indigo-500">ent</span> <span className="text-xs text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded ml-2 font-mono">EXPERT</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-300">Welcome, {user.name}</span>
          <Button onClick={handleLogout} variant="outline" className="border-zinc-800 hover:bg-zinc-900 text-zinc-300">
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Stream setup & controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Scheduling stream */}
          <Card className="bg-zinc-900/60 border-zinc-800 text-zinc-100">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Schedule Broadcast</CardTitle>
                <CardDescription className="text-zinc-400">Configure ingestion endpoint properties for your streaming encoder (e.g. OBS Studio)</CardDescription>
              </div>
              <Settings className="h-5 w-5 text-indigo-400" />
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateStream} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400 uppercase">Stream Title</label>
                    <Input
                      placeholder="e.g. Profiling Go Channels & Allocations"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="bg-zinc-950 border-zinc-800"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400 uppercase">Start Timestamp</label>
                    <Input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="bg-zinc-950 border-zinc-800"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-400 uppercase">Description</label>
                  <Input
                    placeholder="Provide a detailed explanation of what real-world issues you will tackle..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-zinc-950 border-zinc-800"
                    required
                  />
                </div>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-zinc-50 w-full font-bold">
                  <Plus className="h-4 w-4 mr-2" /> Generate Ingestion Stream Key
                </Button>
              </form>

              {showStreamKey && (
                <div className="p-4 mt-4 bg-violet-950/20 border border-violet-900/60 rounded-lg space-y-2">
                  <div className="text-sm font-semibold text-violet-200">Broadcast Connection Ingestion Details:</div>
                  <div className="text-xs font-mono text-zinc-400">
                    <p><strong>Server URL:</strong> rtmp://stream.apprent.com/live</p>
                    <p><strong>Stream Key:</strong> {showStreamKey}</p>
                  </div>
                  <p className="text-[10px] text-zinc-500">Keep this stream key secure. Use it to bind output feeds in OBS Studio or other hardware encoders.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active streams panel */}
          <Card className="bg-zinc-900/60 border-zinc-800 text-zinc-100">
            <CardHeader>
              <CardTitle>Broadcast Controls</CardTitle>
              <CardDescription className="text-zinc-400">Toggle live configurations and check status</CardDescription>
            </CardHeader>
            <CardContent>
              {streams.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                  No streams scheduled yet. Fill out the form above.
                </div>
              ) : (
                <div className="space-y-3">
                  {streams.map((s) => (
                    <div key={s.id} className="p-4 bg-zinc-950/40 border border-zinc-800 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-zinc-200">{s.title}</h4>
                          <Badge className={
                            s.status === 'live' ? 'bg-red-500/20 text-red-300' :
                            s.status === 'recorded' ? 'bg-zinc-800 text-zinc-400' :
                            'bg-violet-500/20 text-violet-300'
                          }>
                            {s.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">{s.description}</p>
                      </div>
                      <div className="flex gap-2 w-full md:w-auto">
                        {s.status === 'scheduled' && (
                          <Button onClick={() => handleStartStream(s.id)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 flex-1">
                            Go Live
                          </Button>
                        )}
                        {s.status === 'live' && (
                          <Button onClick={() => handleEndStream(s.id)} size="sm" variant="destructive" className="flex-1">
                            End Broadcast
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Audio Commentary Queue & Sandbox creator */}
        <div className="space-y-6">
          {/* Audio commentaries queue */}
          <Card className="bg-zinc-900/60 border-zinc-800 text-zinc-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Pending Commentaries</CardTitle>
                <CardDescription className="text-zinc-400">Learners bookmarked these timeline spots. Upload overlays to explain what you did</CardDescription>
              </div>
              <MessageSquare className="h-5 w-5 text-indigo-400" />
            </CardHeader>
            <CardContent>
              {pendingCommentaries.length === 0 ? (
                <div className="text-center py-6 text-zinc-500 text-sm">No bookmarked moments pending reviews.</div>
              ) : (
                <div className="space-y-3">
                  {pendingCommentaries.map((pc) => (
                    <div key={pc.streamId} className="space-y-2">
                      <div className="text-xs font-semibold text-zinc-400 border-b border-zinc-800 pb-1">{pc.title}</div>
                      {pc.bookmarks.map((bm) => (
                        <div key={bm.id} className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-lg flex items-center justify-between">
                          <div className="flex-1 min-w-0 pr-2">
                            <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/40 border border-indigo-800/40 px-1.5 py-0.5 rounded">
                              {Math.floor(bm.timestamp / 60)}:{(bm.timestamp % 60).toString().padStart(2, '0')}
                            </span>
                            <p className="text-xs text-zinc-300 mt-1 truncate">{bm.notes || 'Time mark'}</p>
                          </div>
                          <Button
                            onClick={() => toggleRecording(bm.id)}
                            size="sm"
                            className={
                              isRecording && recordingBookmarkId === bm.id
                                ? 'bg-red-600 hover:bg-red-700 animate-pulse text-zinc-50'
                                : recordedClips[bm.id]
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-zinc-50'
                                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                            }
                          >
                            {isRecording && recordingBookmarkId === bm.id ? (
                              'Stop'
                            ) : recordedClips[bm.id] ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Mic className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sandbox challenge creator */}
          <Card className="bg-zinc-900/60 border-zinc-800 text-zinc-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Create Code Challenge</CardTitle>
              <Plus className="h-5 w-5 text-indigo-400" />
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateChallenge} className="space-y-3">
                <Input
                  placeholder="Challenge Name (e.g. Fix Memory Leak)"
                  value={chTitle}
                  onChange={(e) => setChTitle(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-sm"
                  required
                />
                <Input
                  placeholder="Task instructions and description..."
                  value={chDesc}
                  onChange={(e) => setChDesc(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-sm"
                  required
                />
                <select
                  value={chDiff}
                  onChange={(e) => setChDiff(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-lg p-2 text-sm"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
                <select
                  value={chLang}
                  onChange={(e) => setChLang(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-lg p-2 text-sm"
                >
                  <option value="go">Go (Golang)</option>
                  <option value="python">Python 3</option>
                  <option value="javascript">JavaScript (Node)</option>
                </select>
                <textarea
                  placeholder="// Paste the template / initial code here..."
                  value={chCode}
                  onChange={(e) => setChCode(e.target.value)}
                  className="w-full h-24 bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-xs rounded-lg p-2"
                  required
                />
                <textarea
                  placeholder="// Paste validation command or test runner assert..."
                  value={chTest}
                  onChange={(e) => setChTest(e.target.value)}
                  className="w-full h-16 bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-xs rounded-lg p-2"
                  required
                />
                <Button type="submit" size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700 text-zinc-50 font-bold">
                  Publish Coding Sandbox Challenge
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

      </main>
    </div>
  );
}
