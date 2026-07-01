'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Terminal, BookOpen, Heart, Code } from 'lucide-react';

export default function OnboardingModal() {
  const { user, token, refreshUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Form states
  const [hobbiesInput, setHobbiesInput] = useState('');
  const [hobbies, setHobbies] = useState<string[]>([]);

  const [knownInput, setKnownInput] = useState('');
  const [knownLanguages, setKnownLanguages] = useState<string[]>([]);

  const [learnInput, setLearnInput] = useState('');
  const [learnLanguages, setLearnLanguages] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && user.role === 'learner' && !user.profile?.onboarded) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [user]);

  const handleAddHobby = (e: React.FormEvent) => {
    e.preventDefault();
    if (hobbiesInput.trim() && !hobbies.includes(hobbiesInput.trim())) {
      setHobbies([...hobbies, hobbiesInput.trim().toLowerCase()]);
      setHobbiesInput('');
    }
  };

  const handleAddKnown = (e: React.FormEvent) => {
    e.preventDefault();
    if (knownInput.trim() && !knownLanguages.includes(knownInput.trim())) {
      setKnownLanguages([...knownLanguages, knownInput.trim().toLowerCase()]);
      setKnownInput('');
    }
  };

  const handleAddLearn = (e: React.FormEvent) => {
    e.preventDefault();
    if (learnInput.trim() && !learnLanguages.includes(learnInput.trim())) {
      setLearnLanguages([...learnLanguages, learnInput.trim().toLowerCase()]);
      setLearnInput('');
    }
  };

  const handleSubmit = async () => {
    if (knownLanguages.length === 0 || learnLanguages.length === 0) {
      alert('Please add at least one language you know and one you want to learn.');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/api/v1/auth/onboarding', {
        method: 'PUT',
        token: token || undefined,
        body: JSON.stringify({
          hobbies,
          languagesKnown: knownLanguages,
          languagesToLearn: learnLanguages,
        }),
      });

      // Log the onboarding completion analytics event
      await apiFetch('/api/v1/analytics/log', {
        method: 'POST',
        token: token || undefined,
        body: JSON.stringify({
          eventType: 'onboard',
          metadata: {
            languagesKnownCount: knownLanguages.length,
            languagesToLearnCount: learnLanguages.length,
          },
        }),
      }).catch(() => null);

      await refreshUser();
      setIsOpen(false);
    } catch (err) {
      alert('Failed to save onboarding preferences');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[450px] bg-zinc-950 border-zinc-850 text-zinc-100 p-6">
        <DialogHeader className="space-y-2 flex flex-col items-center text-center pb-2 border-b border-zinc-850">
          <div className="p-2 bg-indigo-950/40 border border-indigo-800/40 rounded-full text-indigo-400">
            <Sparkles className="h-6 w-6 animate-pulse" />
          </div>
          <DialogTitle className="text-lg font-bold text-zinc-150">Welcome to Apprent</DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs">
            Help us customize your AI recommenders, course challenges, and live stream notifications by answering three quick questions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 text-xs">
          {/* Question 1: Languages Known */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Code className="h-3.5 w-3.5 text-indigo-400" /> What programming languages do you know?
            </label>
            <form onSubmit={handleAddKnown} className="flex gap-2">
              <Input
                placeholder="e.g. go, javascript, python"
                value={knownInput}
                onChange={(e) => setKnownInput(e.target.value)}
                className="bg-zinc-900 border-zinc-800 focus-visible:ring-indigo-500 h-8 text-xs"
              />
              <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs">Add</Button>
            </form>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {knownLanguages.map((lang, idx) => (
                <Badge key={idx} variant="secondary" className="bg-zinc-900 border-zinc-800 text-zinc-300 font-mono">
                  {lang}
                  <button type="button" onClick={() => setKnownLanguages(knownLanguages.filter((_, i) => i !== idx))} className="ml-1 text-zinc-500 hover:text-zinc-200">×</button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Question 2: Languages to Learn */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-indigo-400" /> What programming languages do you want to learn?
            </label>
            <form onSubmit={handleAddLearn} className="flex gap-2">
              <Input
                placeholder="e.g. rust, typescript, go"
                value={learnInput}
                onChange={(e) => setLearnInput(e.target.value)}
                className="bg-zinc-900 border-zinc-800 focus-visible:ring-indigo-500 h-8 text-xs"
              />
              <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs">Add</Button>
            </form>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {learnLanguages.map((lang, idx) => (
                <Badge key={idx} variant="secondary" className="bg-zinc-900 border-zinc-800 text-zinc-300 font-mono">
                  {lang}
                  <button type="button" onClick={() => setLearnLanguages(learnLanguages.filter((_, i) => i !== idx))} className="ml-1 text-zinc-500 hover:text-zinc-200">×</button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Question 3: Hobbies */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 text-indigo-400" /> What are your hobbies / interests?
            </label>
            <form onSubmit={handleAddHobby} className="flex gap-2">
              <Input
                placeholder="e.g. system design, gaming, machine learning"
                value={hobbiesInput}
                onChange={(e) => setHobbiesInput(e.target.value)}
                className="bg-zinc-900 border-zinc-800 focus-visible:ring-indigo-500 h-8 text-xs"
              />
              <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs">Add</Button>
            </form>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {hobbies.map((hobby, idx) => (
                <Badge key={idx} variant="secondary" className="bg-zinc-900 border-zinc-800 text-zinc-300">
                  {hobby}
                  <button type="button" onClick={() => setHobbies(hobbies.filter((_, i) => i !== idx))} className="ml-1 text-zinc-500 hover:text-zinc-200">×</button>
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-zinc-850 flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-zinc-50 font-bold text-xs"
          >
            {submitting ? 'Initializing Workspace...' : 'Complete Onboarding'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
