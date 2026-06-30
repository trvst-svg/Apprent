'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Terminal, Video, LogOut, BookOpen, Bookmark as BookmarkIcon, Play, Code, ArrowRight } from 'lucide-react';

interface Stream {
  id: string;
  title: string;
  description: string;
  status: 'scheduled' | 'live' | 'ended' | 'recorded';
  startTime: string;
  videoUrl?: string;
  expertId: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: string;
}

interface Bookmark {
  id: string;
  streamId: string;
  timestamp: number;
  notes: string;
}

export default function LearnerDashboard() {
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'learner')) {
      router.push('/');
    }
  }, [user, loading]);

  useEffect(() => {
    if (user && user.role === 'learner') {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const [st, ch, bm] = await Promise.all([
        apiFetch<Stream[]>('/api/v1/streams', { token: token || undefined }),
        apiFetch<Challenge[]>('/api/v1/challenges', { token: token || undefined }),
        apiFetch<Bookmark[]>('/api/v1/bookmarks', { token: token || undefined }),
      ]);
      setStreams(st);
      setChallenges(ch);
      setBookmarks(bm);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async (streamId: string) => {
    try {
      await apiFetch(`/api/v1/streams/${streamId}/book`, {
        method: 'POST',
        body: JSON.stringify({ paidAmount: 49.00 }),
        token: token || undefined,
      });
      alert('Session Booked Successfully!');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to book stream');
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-zinc-950 text-zinc-400">
        <Terminal className="h-8 w-8 animate-spin text-violet-500 mr-2" />
        Initializing Workspace...
      </div>
    );
  }

  if (!user || user.role !== 'learner') return null;

  const liveStreams = streams.filter(s => s.status === 'live');
  const upcomingStreams = streams.filter(s => s.status === 'scheduled');
  const recordedStreams = streams.filter(s => s.status === 'recorded' || s.status === 'ended');

  return (
    <div className="flex-1 bg-zinc-950 text-zinc-50 min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/40 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="h-6 w-6 text-violet-500" />
          <span className="font-bold tracking-wider text-zinc-100 uppercase">
            Shadow<span className="text-violet-500">Me</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={() => router.push('/learner/feed')} className="bg-violet-600 hover:bg-violet-700 text-zinc-100">
            Open Feed Room <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <span className="text-sm text-zinc-300">User: {user.name}</span>
          <Button onClick={handleLogout} variant="outline" className="border-zinc-800 hover:bg-zinc-900 text-zinc-300">
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Streams Panels */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-red-400">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              Live Apprenticeship Broadcasts
            </h2>
            {liveStreams.length === 0 ? (
              <div className="p-8 border border-dashed border-zinc-800 bg-zinc-900/20 text-center text-zinc-500 rounded-xl">
                No experts are currently streaming live. Check upcoming logs below.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liveStreams.map((s) => (
                  <Card key={s.id} className="bg-zinc-900/60 border-zinc-800 text-zinc-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-red-500" />
                    <CardHeader>
                      <CardTitle className="text-lg">{s.title}</CardTitle>
                      <CardDescription className="text-zinc-400">{s.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-between items-center">
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/30">LIVE</Badge>
                      <Button onClick={() => router.push(`/learner/sandbox/${s.id}`)} className="bg-violet-600 hover:bg-violet-700">
                        <Play className="h-4 w-4 mr-2" /> Shadow Expert
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-300">
              <Video className="h-5 w-5 text-indigo-400" />
              Scheduled Masterclasses
            </h2>
            {upcomingStreams.length === 0 ? (
              <div className="p-4 border border-zinc-800 bg-zinc-900/20 text-center text-zinc-500 rounded-xl">
                No masterclasses scheduled.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upcomingStreams.map((s) => (
                  <Card key={s.id} className="bg-zinc-900/60 border-zinc-800 text-zinc-100">
                    <CardHeader>
                      <CardTitle className="text-base">{s.title}</CardTitle>
                      <CardDescription className="text-zinc-400">{s.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-between items-center">
                      <span className="text-xs text-zinc-500 font-mono">
                        {new Date(s.startTime).toLocaleString()}
                      </span>
                      <Button onClick={() => handleBook(s.id)} variant="outline" className="border-violet-600 hover:bg-violet-600/10 text-violet-400">
                        Book Session ($49)
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Archives / Recorded Rooms */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-300">
              <BookOpen className="h-5 w-5 text-purple-400" />
              Archived Repositories (Playback)
            </h2>
            {recordedStreams.length === 0 ? (
              <div className="p-4 border border-zinc-800 bg-zinc-900/20 text-center text-zinc-500 rounded-xl">
                No recordings published.
              </div>
            ) : (
              <div className="space-y-2">
                {recordedStreams.map((s) => (
                  <div key={s.id} className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-lg flex items-center justify-between hover:bg-zinc-900/70 transition">
                    <div>
                      <h4 className="font-semibold text-zinc-200">{s.title}</h4>
                      <p className="text-xs text-zinc-400 mt-1">{s.description}</p>
                    </div>
                    <Button onClick={() => router.push(`/learner/sandbox/${s.id}`)} variant="secondary" className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100">
                      <Play className="h-4 w-4 mr-2" /> Play
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Challenges & Bookmarks Panels */}
        <div className="space-y-6">
          {/* Sandbox Challenges Panel */}
          <Card className="bg-zinc-900/60 border-zinc-800 text-zinc-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Sandbox Challenges</CardTitle>
              <Code className="h-5 w-5 text-violet-400" />
            </CardHeader>
            <CardContent>
              {challenges.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">No active coding challenges loaded.</p>
              ) : (
                <div className="space-y-3">
                  {challenges.map((c) => (
                    <div key={c.id} className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-lg flex flex-col justify-between hover:border-zinc-700 transition">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-zinc-200 text-sm">{c.title}</span>
                        <Badge className={
                          c.difficulty === 'beginner' ? 'bg-emerald-500/20 text-emerald-300' :
                          c.difficulty === 'intermediate' ? 'bg-indigo-500/20 text-indigo-300' :
                          'bg-red-500/20 text-red-300'
                        }>
                          {c.difficulty}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-400 mb-3">{c.description}</p>
                      <Button onClick={() => router.push(`/learner/sandbox/${c.id}`)} size="sm" className="bg-violet-600 hover:bg-violet-700 text-xs w-full">
                        Solve Challenge
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bookmarks Panel */}
          <Card className="bg-zinc-900/60 border-zinc-800 text-zinc-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Saved Timestamps</CardTitle>
              <BookmarkIcon className="h-5 w-5 text-indigo-400" />
            </CardHeader>
            <CardContent>
              {bookmarks.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">No bookmarks added yet.</p>
              ) : (
                <div className="space-y-2">
                  {bookmarks.map((bm) => (
                    <div key={bm.id} className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-lg flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono text-violet-400 bg-violet-950/40 px-2 py-0.5 rounded border border-violet-800/40 mr-2">
                          {Math.floor(bm.timestamp / 60)}:{(bm.timestamp % 60).toString().padStart(2, '0')}
                        </span>
                        <span className="text-xs text-zinc-300">{bm.notes || 'No description'}</span>
                      </div>
                      <Button onClick={() => router.push(`/learner/sandbox/${bm.streamId}`)} size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </main>
    </div>
  );
}
