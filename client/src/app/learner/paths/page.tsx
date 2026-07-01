'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Terminal, LogOut, Compass, ArrowRight, ChevronLeft, Award, Sparkles, BookOpen } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';

interface LearningPath {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  tags: string[];
  steps: Array<{ type: string; title: string; order: number }>;
}

interface Enrollment {
  pathId: string;
  completedSteps: number[];
}

export default function PathsPage() {
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [enrollments, setEnrollments] = useState<Record<string, Enrollment>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'learner')) {
      router.push('/');
    }
  }, [user, loading]);

  useEffect(() => {
    if (user && user.role === 'learner') {
      fetchPathsAndEnrollments();
    }
  }, [user]);

  const fetchPathsAndEnrollments = async () => {
    try {
      const pathsData = await apiFetch<{ data: LearningPath[] }>('/api/v1/paths', { token: token || undefined });
      const enrollmentsData = await apiFetch<Array<{ enrollment: Enrollment }>>('/api/v1/paths/my-enrollments', { token: token || undefined });
      
      setPaths(pathsData.data || []);
      const enrollMap: Record<string, Enrollment> = {};
      enrollmentsData.forEach((e) => {
        enrollMap[e.enrollment.pathId] = e.enrollment;
      });
      setEnrollments(enrollMap);
    } catch (err) {
      console.error('Failed to load learning paths:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (pathId: string) => {
    try {
      await apiFetch(`/api/v1/paths/${pathId}/enroll`, {
        method: 'POST',
        token: token || undefined,
      });
      fetchPathsAndEnrollments();
    } catch (err) {
      alert('Failed to enroll in learning path');
    }
  };

  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-zinc-950 text-zinc-400">
        <Compass className="h-8 w-8 animate-spin text-indigo-500 mr-2" />
        Synchronizing learning curriculum paths...
      </div>
    );
  }

  return (
    <div className="flex-1 bg-zinc-950 text-zinc-50 min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            paths.map((p) => ({
              "@context": "https://schema.org",
              "@type": "Course",
              "name": p.title,
              "description": p.description,
              "provider": {
                "@type": "Organization",
                "name": "Apprent",
                "sameAs": "https://apprent.dev"
              }
            }))
          )
        }}
      />
      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/learner')}
            className="hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Dashboard
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

      {/* Main Content */}
      <main className="max-w-5xl w-full mx-auto p-6 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-400" />
            Curated Developer Learning Paths
          </h1>
          <p className="text-xs text-zinc-400">Step-by-step tracks curated by industry experts combining challenges, streams, and textbooks.</p>
        </div>

        {paths.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
            <Compass className="h-10 w-10 mx-auto text-zinc-700 mb-2" />
            No learning paths available yet. Ask your experts to create one!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {paths.map((p) => {
              const enrolled = enrollments[p.id];
              const pct = enrolled && p.steps.length > 0
                ? Math.round((enrolled.completedSteps.length / p.steps.length) * 100)
                : 0;

              return (
                <Card key={p.id} className="bg-zinc-900/60 border-zinc-800 text-zinc-100 flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start gap-4">
                      <CardTitle className="text-base font-bold text-zinc-200">{p.title}</CardTitle>
                      <Badge className={
                        p.difficulty === 'beginner' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-950/60' :
                        p.difficulty === 'intermediate' ? 'bg-amber-500/10 text-amber-400 border-amber-950/60' :
                        'bg-rose-500/10 text-rose-400 border-rose-950/60'
                      }>
                        {p.difficulty.toUpperCase()}
                      </Badge>
                    </div>
                    <CardDescription className="text-zinc-400 text-xs mt-2 line-clamp-2">
                      {p.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {p.tags.map((t, idx) => (
                        <Badge key={idx} variant="outline" className="bg-zinc-950/40 border-zinc-800 text-zinc-500 font-mono text-[9px]">
                          {t}
                        </Badge>
                      ))}
                    </div>

                    {/* Progress Bar or Enrollment Action */}
                    {enrolled ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                          <span>PATH PROGRESSION</span>
                          <span>{pct}% ({enrolled.completedSteps.length}/{p.steps.length} Steps)</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-950 border border-zinc-850 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" /> Contains {p.steps.length} learning modules
                      </div>
                    )}

                    {/* Action Button */}
                    <div className="pt-2">
                      {enrolled ? (
                        <Button
                          onClick={() => router.push(`/learner/paths/${p.id}`)}
                          className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold gap-1"
                        >
                          Continue Path <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleEnroll(p.id)}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-zinc-50 text-xs font-bold"
                        >
                          Enroll in Track
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
