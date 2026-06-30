'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Terminal, Shield, Play, Layers } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'learner' | 'expert' | 'admin'>('learner');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      redirectUser(user.role);
    }
  }, [user]);

  const redirectUser = (userRole: 'learner' | 'expert' | 'admin') => {
    if (userRole === 'admin') router.push('/admin');
    else if (userRole === 'expert') router.push('/expert');
    else router.push('/learner');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const res = await apiFetch('/api/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        login(res.token, res.user);
        redirectUser(res.user.role);
      } else {
        const res = await apiFetch('/api/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password, role }),
        });
        login(res.token, res.user);
        redirectUser(res.user.role);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-screen bg-zinc-950 text-zinc-50 relative overflow-hidden">
      {/* Decorative Glow Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      {/* Brand Section */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12 relative z-10">
        <div className="flex items-center gap-2 mb-8">
          <div className="p-2 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-lg shadow-lg shadow-violet-500/20">
            <Terminal className="h-6 w-6 text-zinc-50" />
          </div>
          <span className="text-xl font-bold tracking-wider uppercase text-zinc-100">
            Shadow<span className="text-violet-500">Me</span>
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-none mb-6">
          Watch. Learn. <br />
          <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
            Replicate the Masters.
          </span>
        </h1>
        <p className="text-zinc-400 text-lg max-w-lg mb-8 leading-relaxed">
          The ultimate Virtual Apprenticeship Marketplace. Pay to digitally shadow top-tier developers in real-time, trace their code, and solve sandbox code challenges.
        </p>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
          <div className="flex items-start gap-3 p-4 bg-zinc-900/40 backdrop-blur-md rounded-xl border border-zinc-800/60">
            <Shield className="h-5 w-5 text-violet-400 mt-1" />
            <div>
              <h3 className="font-semibold text-zinc-200">AI Privacy Filter</h3>
              <p className="text-xs text-zinc-400">Real-time blurring of API keys, credentials, and customer secrets.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-zinc-900/40 backdrop-blur-md rounded-xl border border-zinc-800/60">
            <Play className="h-5 w-5 text-indigo-400 mt-1" />
            <div>
              <h3 className="font-semibold text-zinc-200">Commentary Rooms</h3>
              <p className="text-xs text-zinc-400">Asynchronous audio commentary synced perfectly with code timelines.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Portal Section */}
      <div className="w-full md:w-[480px] lg:w-[540px] flex items-center justify-center p-8 bg-zinc-900/30 backdrop-blur-md border-l border-zinc-800/60 relative z-10">
        <Card className="w-full bg-zinc-900/60 border-zinc-800 text-zinc-50 shadow-2xl relative overflow-hidden backdrop-blur-lg">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500" />
          
          <CardHeader>
            <CardTitle className="text-2xl text-center font-bold">
              {isLogin ? 'Sign In' : 'Create Account'}
            </CardTitle>
            <CardDescription className="text-zinc-400 text-center">
              {isLogin ? 'Welcome back, apprentice.' : 'Join the rank of professional practitioners.'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="p-3 mb-4 text-sm bg-red-950/40 border border-red-900/60 text-red-200 rounded-lg text-center font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-300">Name</label>
                    <Input
                      type="text"
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-zinc-950/60 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-300">Select Role</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['learner', 'expert', 'admin'] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={`py-2 text-sm font-medium rounded-lg border uppercase transition ${
                            role === r
                              ? 'bg-violet-600/20 border-violet-500 text-violet-200 font-bold'
                              : 'bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-sm font-semibold text-zinc-300">Email Address</label>
                <Input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-zinc-950/60 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-zinc-300">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-zinc-950/60 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-zinc-100 shadow-lg font-bold py-2 mt-4 transition duration-300 cursor-pointer"
              >
                {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-zinc-400">
              {isLogin ? "New to the workspace? " : "Already have an account? "}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-violet-400 hover:text-violet-300 font-medium underline underline-offset-4 cursor-pointer"
              >
                {isLogin ? 'Register' : 'Login'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
