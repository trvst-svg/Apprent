'use client';

import React from 'react';
import { Shield, Sparkles, CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AIReviewPanelProps {
  review: {
    summary: string;
    issues: string[];
    suggestions: string[];
    praise: string[];
    score: number;
  } | null;
  loading: boolean;
}

export default function AIReviewPanel({ review, loading }: AIReviewPanelProps) {
  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-indigo-400 animate-spin" />
          <div className="h-4 w-40 bg-zinc-800 rounded" />
        </div>
        <div className="h-24 bg-zinc-900 rounded-lg" />
        <div className="space-y-2">
          <div className="h-4 bg-zinc-850 rounded w-5/6" />
          <div className="h-4 bg-zinc-850 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="p-8 text-center text-zinc-500 text-xs border border-dashed border-zinc-850 rounded-xl">
        <Shield className="h-8 w-8 mx-auto text-zinc-700 mb-2" />
        No active review results. Click "Run AI Review" to analyze your solution.
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 border-emerald-950/60 bg-emerald-950/20';
    if (score >= 50) return 'text-amber-400 border-amber-950/60 bg-amber-950/20';
    return 'text-red-400 border-red-950/60 bg-red-950/20';
  };

  return (
    <div className="space-y-4 p-2 text-zinc-200">
      {/* Score and Summary */}
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-1">
          <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-400" />
            Gemini Architecture Assistant
          </h3>
          <p className="text-[11px] text-zinc-400 leading-relaxed">{review.summary}</p>
        </div>
        <Badge className={`px-2.5 py-1 text-xs font-mono font-bold border ${getScoreColor(review.score)}`}>
          SCORE: {review.score}/100
        </Badge>
      </div>

      {/* Praise */}
      {review.praise.length > 0 && (
        <Card className="bg-emerald-950/5 border-emerald-900/30">
          <CardContent className="p-3 space-y-1.5">
            <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Strengths & Correct Logic
            </h4>
            <ul className="list-inside space-y-1 text-[11px] text-zinc-300">
              {review.praise.map((item, idx) => (
                <li key={idx} className="list-none pl-4 relative">
                  <span className="absolute left-0 text-emerald-500">•</span> {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Issues */}
      {review.issues.length > 0 && (
        <Card className="bg-red-950/5 border-red-900/30">
          <CardContent className="p-3 space-y-1.5">
            <h4 className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Issues & Potential Bugs
            </h4>
            <ul className="list-inside space-y-1 text-[11px] text-zinc-300">
              {review.issues.map((item, idx) => (
                <li key={idx} className="list-none pl-4 relative">
                  <span className="absolute left-0 text-red-500">•</span> {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Suggestions */}
      {review.suggestions.length > 0 && (
        <Card className="bg-indigo-950/5 border-indigo-900/30">
          <CardContent className="p-3 space-y-1.5">
            <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" /> Optimization Suggestions
            </h4>
            <ul className="list-inside space-y-1 text-[11px] text-zinc-300">
              {review.suggestions.map((item, idx) => (
                <li key={idx} className="list-none pl-4 relative">
                  <span className="absolute left-0 text-indigo-400">•</span> {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
