'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Terminal, Shield, LogOut, Award, Zap, Flame, User, CheckCircle2, ChevronLeft, Save, Key } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';

interface ProgressData {
  challengesCompleted: number;
  challengesFailed: number;
  streakDays: number;
  xpTotal: number;
  badges: Array<{ name: string; earnedAt: string }>;
  languagesUsed: string[];
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, token, logout, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<ProgressData | null>(null);

  // Profile Form States
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [skills, setSkills] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Password Form States
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    if (!loading && (!user || user.role !== 'learner')) {
      router.push('/');
    }
  }, [user, loading]);

  useEffect(() => {
    if (user && user.role === 'learner') {
      setName(user.name || '');
      setBio(user.profile?.bio || '');
      setAvatarUrl(user.profile?.avatarUrl || '');
      setSkills(user.profile?.skills?.join(', ') || '');
      setTitle(user.profile?.title || '');
      setCompany(user.profile?.company || '');
      fetchProgress();
    }
  }, [user]);

  const fetchProgress = async () => {
    try {
      const data = await apiFetch<ProgressData>('/api/v1/progress', { token: token || undefined });
      setProgress(data);
    } catch (err) {
      console.error('Failed to fetch progress:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    try {
      const skillArray = skills.split(',').map((s) => s.trim()).filter((s) => s !== '');
      await apiFetch('/api/v1/auth/profile', {
        method: 'PUT',
        token: token || undefined,
        body: JSON.stringify({
          name,
          bio,
          avatarUrl,
          skills: skillArray,
          title,
          company,
        }),
      });
      setSaveSuccess(true);
      await refreshUser();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert('Failed to update profile');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSuccess(false);
    setPwError('');
    try {
      await apiFetch('/api/v1/auth/password', {
        method: 'PUT',
        token: token || undefined,
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      setPwSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err: any) {
      setPwError(err.message || 'Failed to update password');
    }
  };

  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-zinc-950 text-zinc-400">
        <Zap className="h-8 w-8 animate-pulse text-indigo-500 mr-2" />
        Resolving verified developer profiles...
      </div>
    );
  }

  return (
    <div className="flex-1 bg-zinc-950 text-zinc-50 min-h-screen flex flex-col">
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

      <main className="max-w-6xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Progress Card */}
        <div className="space-y-6 lg:col-span-1">
          {/* User Bio Card */}
          <Card className="bg-zinc-900/60 border-zinc-800 text-zinc-100">
            <CardHeader className="flex flex-col items-center pb-4">
              <div className="h-20 w-20 rounded-full bg-zinc-800 border-2 border-indigo-500/40 overflow-hidden flex items-center justify-center mb-3">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <User className="h-10 w-10 text-zinc-600" />
                )}
              </div>
              <CardTitle className="text-lg">{name}</CardTitle>
              <CardDescription className="text-zinc-400 font-mono text-xs">
                {title || 'Apprent Learner'} {company && `@ ${company}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center text-xs text-zinc-400 px-6 border-t border-zinc-850 pt-4">
              <p className="italic">{bio || "This developer hasn't written a bio yet."}</p>
            </CardContent>
          </Card>

          {/* Gamification Stats */}
          <Card className="bg-zinc-900/60 border-zinc-800 text-zinc-100">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Award className="h-4 w-4 text-violet-400" /> Learner Level Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* XP */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono text-zinc-400">
                  <span>EXPERIENCE</span>
                  <span className="text-violet-400 font-bold">{progress?.xpTotal || 0} XP</span>
                </div>
                <div className="h-2 w-full bg-zinc-950 border border-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    style={{ width: `${Math.min(100, ((progress?.xpTotal || 0) % 1000) / 10)}%` }}
                  />
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 font-mono text-center">
                <div className="p-3 bg-zinc-950/40 border border-zinc-850 rounded-lg">
                  <Flame className="h-4 w-4 text-amber-500 mx-auto mb-1" />
                  <span className="text-xs text-zinc-500 block">STREAK</span>
                  <span className="text-sm font-bold text-amber-400">{progress?.streakDays || 0} Days</span>
                </div>
                <div className="p-3 bg-zinc-950/40 border border-zinc-850 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                  <span className="text-xs text-zinc-500 block">PASSED</span>
                  <span className="text-sm font-bold text-emerald-400">{progress?.challengesCompleted || 0}</span>
                </div>
              </div>

              {/* Badges Grid */}
              <div className="space-y-2 pt-2 border-t border-zinc-850">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Earned Badges ({progress?.badges?.length || 0})</span>
                {progress?.badges?.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">No achievement badges unlocked yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {progress?.badges?.map((badge, idx) => (
                      <Badge key={idx} className="bg-indigo-950/40 border border-indigo-800/40 text-indigo-300 font-mono text-[10px] py-1">
                        🏆 {badge.name.replace('_', ' ').toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Editing Profile and Password Change */}
        <div className="lg:col-span-2 space-y-6">
          {/* Edit Profile Form */}
          <Card className="bg-zinc-900/60 border-zinc-800 text-zinc-100">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-5 w-5 text-indigo-400" /> Profile Information
              </CardTitle>
              <CardDescription className="text-zinc-400 text-xs">Configure your public credentials and tags</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-zinc-400">Display Name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-zinc-950 border-zinc-850" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-zinc-400">Job Title</label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-zinc-950 border-zinc-850" placeholder="e.g. Software Engineer" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-zinc-400">Company Name</label>
                    <Input value={company} onChange={(e) => setCompany(e.target.value)} className="bg-zinc-950 border-zinc-850" placeholder="e.g. Google" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-zinc-400">Avatar Image URL</label>
                    <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="bg-zinc-950 border-zinc-850" placeholder="https://..." />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-zinc-400">Skills Tags (comma separated)</label>
                  <Input value={skills} onChange={(e) => setSkills(e.target.value)} className="bg-zinc-950 border-zinc-850" placeholder="go, python, kubernetes, docker" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-zinc-400">Developer Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full min-h-20 bg-zinc-950 border border-zinc-850 text-zinc-200 text-xs rounded-lg p-3 focus:outline-none focus:border-indigo-500"
                    placeholder="Describe your background and learning goals..."
                  />
                </div>

                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-zinc-50 font-bold text-xs gap-1.5 py-2 px-4 ml-auto flex">
                  <Save className="h-4 w-4" /> Save Profile Details
                </Button>

                {saveSuccess && (
                  <p className="text-xs text-emerald-400 font-semibold animate-pulse mt-2 text-right">
                    ✓ Profile updated and synchronized successfully!
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card className="bg-zinc-900/60 border-zinc-800 text-zinc-100">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-5 w-5 text-indigo-400" /> Account Security
              </CardTitle>
              <CardDescription className="text-zinc-400 text-xs">Update your credentials regularly</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-zinc-400">Current Password</label>
                    <Input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="bg-zinc-950 border-zinc-850"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-zinc-400">New Password</label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="bg-zinc-950 border-zinc-850"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 text-xs font-bold py-2 px-4 ml-auto flex">
                  Update Account Password
                </Button>

                {pwSuccess && (
                  <p className="text-xs text-emerald-400 font-semibold animate-pulse mt-2 text-right">
                    ✓ Password updated successfully!
                  </p>
                )}
                {pwError && (
                  <p className="text-xs text-red-400 font-semibold animate-pulse mt-2 text-right">
                    ✗ {pwError}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
