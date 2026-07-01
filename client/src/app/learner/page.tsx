'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Terminal, Video, LogOut, BookOpen, Bookmark as BookmarkIcon, Play, Code, ArrowRight, Award, Zap, Compass, User, Flame } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import OnboardingModal from '@/components/OnboardingModal';
import { useAnalytics } from '@/hooks/useAnalytics';

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

interface Book {
	id: string;
	title: string;
	author: string;
	language: string;
	difficulty: string;
	url: string;
	description: string;
	coverUrl: string;
}

export default function LearnerDashboard() {
	const router = useRouter();
	const { user, token, logout } = useAuth();
	const [streams, setStreams] = useState<Stream[]>([]);
	const [challenges, setChallenges] = useState<Challenge[]>([]);
	const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
	const [books, setBooks] = useState<Book[]>([]);
	const [progress, setProgress] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	
	const { trackEvent } = useAnalytics();

	// Navigation & Filtering States
	const [activeTab, setActiveTab] = useState<'workspace' | 'library'>('workspace');
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedLanguage, setSelectedLanguage] = useState('all');
	const [selectedDifficulty, setSelectedDifficulty] = useState('all');

  useEffect(() => {
    if (!loading && (!user || user.role !== 'learner')) {
      router.push('/');
    }
  }, [user, loading]);

  useEffect(() => {
    if (user && user.role === 'learner') {
      fetchDashboardData();
      trackEvent('page_view', 'learner_dashboard', 'general', { tab: activeTab });
    }
  }, [user, activeTab]);

  const fetchDashboardData = async () => {
    try {
      const [st, ch, bm, bk, pr] = await Promise.all([
        apiFetch<Stream[]>('/api/v1/streams', { token: token || undefined }),
        apiFetch<Challenge[]>('/api/v1/challenges', { token: token || undefined }),
        apiFetch<Bookmark[]>('/api/v1/bookmarks', { token: token || undefined }),
        apiFetch<Book[]>('/api/v1/books', { token: token || undefined }),
        apiFetch<any>('/api/v1/progress', { token: token || undefined }).catch(() => null),
      ]);
      setStreams(st);
      setChallenges(ch);
      setBookmarks(bm);
      setBooks(bk);
      setProgress(pr);
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

  const filteredBooks = books.filter(b => {
    const matchesSearch = b.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          b.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLang = selectedLanguage === 'all' || b.language.toLowerCase() === selectedLanguage.toLowerCase();
    const matchesDiff = selectedDifficulty === 'all' || b.difficulty.toLowerCase() === selectedDifficulty.toLowerCase();
    return matchesSearch && matchesLang && matchesDiff;
  });

  return (
    <div className="flex-1 bg-zinc-950 text-zinc-50 min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/40 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="h-6 w-6 text-violet-500" />
          <span className="font-bold tracking-wider text-zinc-100 uppercase">
            Appr<span className="text-violet-500">ent</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={() => router.push('/learner/feed')} className="bg-violet-600 hover:bg-violet-700 text-zinc-100 text-xs">
            Open Feed Room <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <NotificationBell />
          <Button
            onClick={() => router.push('/learner/profile')}
            variant="ghost"
            className="text-zinc-400 hover:text-zinc-100 flex items-center gap-1 text-xs"
          >
            <User className="h-4 w-4" /> {user.name}
          </Button>
          <Button onClick={handleLogout} variant="outline" className="border-zinc-800 hover:bg-zinc-900 text-zinc-300 text-xs">
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </div>
      </header>

      {/* Sub-Header Tabs */}
      <div className="border-b border-zinc-800 bg-zinc-905/10 px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('workspace')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'workspace'
                ? 'bg-violet-600 text-zinc-50 shadow-lg shadow-violet-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
            }`}
          >
            <Terminal className="h-4 w-4" /> Learning Space
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'library'
                ? 'bg-violet-600 text-zinc-50 shadow-lg shadow-violet-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
            }`}
          >
            <BookOpen className="h-4 w-4" /> Books Library
          </button>
        </div>
        <Button
          onClick={() => router.push('/learner/paths')}
          variant="outline"
          className="border-zinc-800 hover:bg-zinc-900 text-indigo-400 text-xs flex items-center gap-1.5"
        >
          <Compass className="h-4 w-4" /> Curated Learning Paths
        </Button>
      </div>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {activeTab === 'workspace' && progress && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3 font-mono">
              <Zap className="h-6 w-6 text-indigo-400 animate-pulse" />
              <div>
                <span className="text-[10px] text-zinc-500 block uppercase font-bold">Accumulated XP</span>
                <span className="text-sm font-bold text-zinc-200">{progress.xpTotal || 0} XP</span>
              </div>
            </div>
            <div className="flex items-center gap-3 font-mono border-y md:border-y-0 md:border-x border-zinc-800 py-3 md:py-0 md:px-4">
              <Flame className="h-6 w-6 text-amber-500 animate-bounce" />
              <div>
                <span className="text-[10px] text-zinc-500 block uppercase font-bold">Active Streak</span>
                <span className="text-sm font-bold text-zinc-200">{progress.streakDays || 0} Days</span>
              </div>
            </div>
            <div className="flex items-center gap-3 font-mono">
              <Award className="h-6 w-6 text-emerald-400" />
              <div>
                <span className="text-[10px] text-zinc-500 block uppercase font-bold">Challenges Cleared</span>
                <span className="text-sm font-bold text-zinc-200">{progress.challengesCompleted || 0}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'workspace' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
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
                            <Play className="h-4 w-4 mr-2" /> Apprentice Expert
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
                  <div className="p-4 border border-dashed border-zinc-800 bg-zinc-900/20 text-center text-zinc-500 rounded-xl">
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
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header + Filters */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-zinc-900/40 p-4 border border-zinc-850 rounded-xl">
              <div>
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-violet-500" /> Coding Books Library
                </h2>
                <p className="text-xs text-zinc-500 mt-1">Read free, high-quality, legal programming textbooks for all levels</p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Search books..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-650 focus:outline-none focus:border-violet-500 w-full sm:w-48"
                />
                
                {/* Language Select */}
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-violet-500"
                >
                  <option value="all">All Languages</option>
                  <option value="go">Go</option>
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="rust">Rust</option>
                  <option value="cpp">C++</option>
                  <option value="java">Java</option>
                  <option value="typescript">TypeScript</option>
                  <option value="html-css">HTML & CSS</option>
                </select>

                {/* Difficulty Select */}
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-violet-500"
                >
                  <option value="all">All Levels</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            {/* Books Grid */}
            {filteredBooks.length === 0 ? (
              <div className="p-12 border border-dashed border-zinc-800 bg-zinc-900/10 text-center text-zinc-500 rounded-xl">
                No programming books match your current filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBooks.map((book) => (
                  <Card key={book.id} className="bg-zinc-900/40 border-zinc-800 text-zinc-100 hover:border-zinc-700 transition duration-300 flex flex-col justify-between overflow-hidden group relative">
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition duration-300" />
                    
                    <CardHeader className="flex flex-row gap-4 pb-4">
                      {/* Book Cover or Fallback */}
                      <div className="h-20 w-16 bg-zinc-950 border border-zinc-800 rounded flex-shrink-0 flex items-center justify-center overflow-hidden relative">
                        {book.coverUrl ? (
                          <img src={book.coverUrl} alt={book.title} className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        ) : (
                          <BookOpen className="h-6 w-6 text-zinc-700" />
                        )}
                        <BookOpen className="h-6 w-6 text-zinc-700 absolute" style={{ zIndex: -1 }} />
                      </div>
                      
                      <div className="space-y-1">
                        <CardTitle className="text-sm font-bold line-clamp-2 leading-snug">{book.title}</CardTitle>
                        <CardDescription className="text-[11px] text-zinc-500 line-clamp-1">By {book.author}</CardDescription>
                        <div className="flex gap-1.5 pt-1">
                          <Badge className="bg-violet-600/10 text-violet-300 border-violet-850 uppercase text-[9px] px-1.5 py-0">
                            {book.language}
                          </Badge>
                          <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700/60 uppercase text-[9px] px-1.5 py-0">
                            {book.difficulty}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0 text-xs text-zinc-400 leading-relaxed line-clamp-3">
                      {book.description}
                    </CardContent>
                    
                    <div className="p-4 pt-2 border-t border-zinc-900/60 bg-zinc-955/20">
                      <a
                        href={book.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/80 hover:text-zinc-100 text-zinc-300 text-xs font-semibold py-2 transition"
                      >
                        Read Free Textbook <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </a>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      <OnboardingModal />
    </div>
  );
}
