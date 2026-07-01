'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Terminal, LogOut, Compass, ArrowRight, ChevronLeft, CheckCircle2, Play, BookOpen, ExternalLink, Code } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';

interface PathStep {
  type: 'challenge' | 'stream' | 'book';
  resourceId: string;
  title: string;
  order: number;
}

interface LearningPath {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  steps: PathStep[];
}

interface Enrollment {
  pathId: string;
  completedSteps: number[];
}

export default function PathDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const [path, setPath] = useState<LearningPath | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'learner')) {
      router.push('/');
    }
  }, [user, loading]);

  useEffect(() => {
    if (user && user.role === 'learner' && params.pathId) {
      fetchPathDetails();
    }
  }, [user, params.pathId]);

  const fetchPathDetails = async () => {
    try {
      const pathData = await apiFetch<LearningPath>(`/api/v1/paths/${params.pathId}`, { token: token || undefined });
      const enrollmentsData = await apiFetch<Array<{ enrollment: Enrollment }>>('/api/v1/paths/my-enrollments', { token: token || undefined });
      
      setPath(pathData);
      const matched = enrollmentsData.find((e) => e.enrollment.pathId === params.pathId);
      if (matched) {
        setEnrollment(matched.enrollment);
      }
    } catch (err) {
      console.error('Failed to fetch path details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteStep = async (order: number) => {
    try {
      await apiFetch(`/api/v1/paths/${params.pathId}/complete`, {
        method: 'POST',
        token: token || undefined,
        body: JSON.stringify({ stepOrder: order }),
      });
      fetchPathDetails();
    } catch (err) {
      alert('Failed to mark step complete');
    }
  };

  const navigateToResource = (step: PathStep) => {
    if (step.type === 'challenge') {
      router.push(`/learner/sandbox/${step.resourceId}`);
    } else if (step.type === 'stream') {
      router.push(`/learner?streamId=${step.resourceId}`);
    } else if (step.type === 'book') {
      router.push('/learner'); // open library tab
    }
  };

  if (loading || !path || !user) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-zinc-950 text-zinc-400">
        <Compass className="h-8 w-8 animate-spin text-indigo-500 mr-2" />
        Resolving step-by-step curriculum configuration...
      </div>
    );
  }

  const completedSet = new Set(enrollment?.completedSteps || []);

  return (
    <div className="flex-1 bg-zinc-950 text-zinc-50 min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Course",
            "name": path.title,
            "description": path.description,
            "provider": {
              "@type": "Organization",
              "name": "Apprent",
              "sameAs": "https://apprent.dev"
            }
          })
        }}
      />
      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/learner/paths')}
            className="hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Paths Index
          </Button>
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-indigo-500" />
            <span className="font-bold tracking-wider uppercase text-zinc-100">
              Appr<span className="text-indigo-500">ent</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <Button
            onClick={() => {
              logout();
              router.push('/');
            }}
            variant="outline"
            className="border-zinc-800 hover:bg-zinc-900 text-zinc-300"
          >
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl w-full mx-auto p-6 space-y-6">
        <div className="p-6 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-3">
          <div className="flex justify-between items-start gap-4">
            <h1 className="text-xl font-bold text-zinc-100">{path.title}</h1>
            <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-950/60 font-mono text-[10px]">
              {path.difficulty.toUpperCase()}
            </Badge>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">{path.description}</p>
        </div>

        {/* Steps List */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Curriculum Path Steps</h2>
          
          <div className="space-y-3">
            {path.steps.map((step, idx) => {
              const isCompleted = completedSet.has(step.order);
              return (
                <div
                  key={idx}
                  className={`p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg flex items-center justify-between gap-4 transition-colors ${
                    isCompleted ? 'border-indigo-900/20 bg-zinc-900/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isCompleted ? 'bg-emerald-950/30 text-emerald-400' : 'bg-zinc-950 border border-zinc-800 text-zinc-400'
                    }`}>
                      {step.order}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-200 truncate">{step.title}</span>
                        <Badge className={`text-[9px] px-1.5 py-0.5 font-mono ${
                          step.type === 'challenge' ? 'bg-amber-500/10 text-amber-400 border-amber-950/60' :
                          step.type === 'stream' ? 'bg-red-500/10 text-red-400 border-red-950/60' :
                          'bg-indigo-500/10 text-indigo-400 border-indigo-950/60'
                        }`}>
                          {step.type.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Click "Launch Module" to start learning.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => navigateToResource(step)}
                      size="sm"
                      variant="outline"
                      className="border-zinc-800 hover:bg-zinc-900 text-zinc-300 text-xs font-bold gap-1"
                    >
                      {step.type === 'challenge' ? <Code className="h-3.5 w-3.5" /> : step.type === 'stream' ? <Play className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
                      Launch Module
                    </Button>

                    {isCompleted ? (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-950/60 font-mono text-[10px] py-1 px-2.5 flex gap-1 items-center">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Done
                      </Badge>
                    ) : (
                      <Button
                        onClick={() => handleCompleteStep(step.order)}
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700 text-zinc-50 text-xs font-bold"
                      >
                        Mark Done
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
