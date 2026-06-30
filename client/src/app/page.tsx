'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Terminal, Shield, Play, Code, Layers, Activity, ArrowRight, UserCheck, CheckCircle2, Laptop, Database, HelpCircle } from 'lucide-react';

export default function FuturisticLandingPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  
  // Auth Form State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'learner' | 'expert' | 'admin'>('learner');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Simulated AI filter interactive demo state
  const [simulationRedacted, setSimulationRedacted] = useState(true);

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
        setShowAuthModal(false);
        redirectUser(res.user.role);
      } else {
        const res = await apiFetch('/api/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password, role }),
        });
        login(res.token, res.user);
        setShowAuthModal(false);
        redirectUser(res.user.role);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const triggerAuth = (loginMode: boolean) => {
    setIsLogin(loginMode);
    setShowAuthModal(true);
  };

  return (
    <div className="flex-1 bg-zinc-950 text-zinc-50 min-h-screen flex flex-col font-sans relative overflow-x-hidden select-none">
      
      {/* Background Tech Grids & Neon Radial Shadows */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f23_1px,transparent_1px),linear-gradient(to_bottom,#1f1f23_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-[0.25] pointer-events-none" />
      <div className="absolute top-[10%] left-[20%] w-[600px] h-[600px] rounded-full bg-violet-600/5 blur-[150px] pointer-events-none" />
      <div className="absolute top-[40%] right-[10%] w-[500px] h-[500px] rounded-full bg-indigo-600/5 blur-[150px] pointer-events-none" />

      {/* Header / Sticky Navigation */}
      <header className="border-b border-zinc-900 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-lg shadow-lg shadow-violet-500/20">
            <Terminal className="h-5 w-5 text-zinc-50" />
          </div>
          <span className="text-lg font-bold tracking-wider uppercase text-zinc-100 font-sans">
            Shadow<span className="text-violet-500">Me</span>
          </span>
          <Badge className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 ml-2 font-mono text-[9px]">
            PROTOCOL V2.4
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => triggerAuth(true)}
            className="text-xs font-semibold text-zinc-400 hover:text-zinc-100 transition cursor-pointer"
          >
            Access Terminal
          </button>
          <Button 
            onClick={() => triggerAuth(false)}
            className="bg-violet-600 hover:bg-violet-700 text-zinc-50 text-xs font-semibold px-4 cursor-pointer"
          >
            Initialize Connection
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 pt-20 pb-16 text-center max-w-4xl mx-auto relative z-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-950/30 border border-violet-800/40 rounded-full mb-6 text-xs text-violet-300 font-mono">
          <Activity className="h-3.5 w-3.5 animate-pulse text-emerald-400" /> SYSTEM PORTAL IS ONLINE & ACTIVE
        </div>
        
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-6">
          The Virtual Apprenticeship <br />
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
            Workspace for Professionals
          </span>
        </h1>
        
        <p className="text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          Shadow elite engineers in real-time as they solve bugs, compile code, and construct cloud configurations. Replicate their solutions in sandbox environments and trace their commentaries.
        </p>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <Button 
            onClick={() => triggerAuth(false)}
            size="lg" 
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-zinc-50 font-bold px-8 shadow-lg shadow-violet-500/20 cursor-pointer"
          >
            Get Started <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <a href="#protocol-spec" className="text-xs font-mono font-bold text-zinc-400 hover:text-zinc-200 uppercase tracking-wider transition py-2 px-4 border border-zinc-800 rounded-lg hover:bg-zinc-900/30">
            Read Specifications
          </a>
        </div>
      </section>

      {/* Dynamic Features Row */}
      <section id="protocol-spec" className="px-6 py-16 max-w-6xl mx-auto w-full relative z-10 scroll-mt-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-100">Marketplace Specifications</h2>
          <p className="text-sm text-zinc-500 mt-2">Engineered to link practitioners with professional experts securely</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <Card className="bg-zinc-900/40 border-zinc-900 text-zinc-100 hover:border-zinc-800 transition duration-300 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-violet-600 opacity-0 group-hover:opacity-100 transition duration-300" />
            <CardHeader>
              <div className="p-2.5 bg-violet-950/40 border border-violet-800/40 rounded-lg w-max mb-2">
                <Shield className="h-5 w-5 text-violet-400" />
              </div>
              <CardTitle className="text-lg font-bold">1. AI Privacy Filtration</CardTitle>
              <CardDescription className="text-zinc-400 text-xs">
                Real-time media filter protocol blurs API keys, tokens, customer logs, and source components.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-zinc-500 leading-relaxed">
              Provides experts with bulletproof confidence to stream corporate workflows without exposing private corporate repositories or keys.
            </CardContent>
          </Card>

          {/* Card 2 */}
          <Card className="bg-zinc-900/40 border-zinc-900 text-zinc-100 hover:border-zinc-800 transition duration-300 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-indigo-600 opacity-0 group-hover:opacity-100 transition duration-300" />
            <CardHeader>
              <div className="p-2.5 bg-indigo-950/40 border border-indigo-800/40 rounded-lg w-max mb-2">
                <Play className="h-5 w-5 text-indigo-400" />
              </div>
              <CardTitle className="text-lg font-bold">2. Timed Commentary</CardTitle>
              <CardDescription className="text-zinc-400 text-xs">
                Asynchronous voice layers synced perfectly to specific timelines inside the video feed.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-zinc-500 leading-relaxed">
              Learners place timestamp bookmarks when confused. Experts record explanation overlays in the commentary queue to solve them.
            </CardContent>
          </Card>

          {/* Card 3 */}
          <Card className="bg-zinc-900/40 border-zinc-900 text-zinc-100 hover:border-zinc-800 transition duration-300 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-fuchsia-600 opacity-0 group-hover:opacity-100 transition duration-300" />
            <CardHeader>
              <div className="p-2.5 bg-fuchsia-950/40 border border-fuchsia-800/40 rounded-lg w-max mb-2">
                <Code className="h-5 w-5 text-fuchsia-400" />
              </div>
              <CardTitle className="text-lg font-bold">3. Coding Sandbox</CardTitle>
              <CardDescription className="text-zinc-400 text-xs">
                Integrated IDE environment loaded with specific exercise templates and compiler validations.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-zinc-500 leading-relaxed">
              Write, compile, and run Go code. Click "Compare with Master" to display a side-by-side file comparison with the expert's final build.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* AI Privacy Redaction Showcase */}
      <section className="px-6 py-12 max-w-5xl mx-auto w-full relative z-10">
        <Card className="bg-zinc-900/20 border-zinc-900 text-zinc-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-600 via-indigo-600 to-transparent" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 sm:p-8">
            <div className="flex flex-col justify-center space-y-4">
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                <Activity className="h-3 w-3" /> Live Redactor Protocol Demo
              </span>
              <h3 className="text-2xl font-bold">Securing Proprietary Workflows</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                ShadowMe runs an inline Computer Vision (CV) model pipeline. It intercepts video frames and detects secrets (API keys, IP addresses, credentials, proprietary logos) and blurs them before they leave the source compiler feed.
              </p>
              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={() => setSimulationRedacted(true)} 
                  variant={simulationRedacted ? 'default' : 'outline'}
                  className="text-xs h-8 cursor-pointer"
                >
                  Enable AI Redactor
                </Button>
                <Button 
                  onClick={() => setSimulationRedacted(false)} 
                  variant={!simulationRedacted ? 'destructive' : 'outline'}
                  className="text-xs h-8 cursor-pointer"
                >
                  Disable Redactor
                </Button>
              </div>
            </div>

            {/* Simulated Editor Screen */}
            <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl font-mono text-[10px] text-zinc-400 space-y-3 relative overflow-hidden select-text">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-900">
                <span className="text-zinc-500">aws_deploy.go</span>
                <span className="flex items-center gap-1"><Laptop className="h-3 w-3" /> main.go</span>
              </div>
              
              <div className="space-y-1 relative">
                <div><span className="text-zinc-600">01</span> <span className="text-violet-400">package</span> main</div>
                <div><span className="text-zinc-600">02</span> <span className="text-violet-400">import</span> <span className="text-emerald-400">"github.com/aws/aws-sdk-go"</span></div>
                <div><span className="text-zinc-600">03</span> <span className="text-violet-400">const</span> (</div>
                
                {/* Redacted Line 1 */}
                <div className="relative">
                  <span className="text-zinc-600">04</span> &nbsp;&nbsp;&nbsp;&nbsp;AWS_ACCESS_KEY = 
                  {simulationRedacted ? (
                    <span className="inline-block px-2 py-0.5 ml-1 bg-violet-950/60 text-violet-300 rounded font-mono text-[9px] border border-violet-800/40 backdrop-blur-md pointer-events-none">
                      <Shield className="h-2.5 w-2.5 inline mr-1 text-emerald-400" /> redacted access token
                    </span>
                  ) : (
                    <span className="text-yellow-400 ml-1">"AKIAIOSFODNN7EXAMPLE"</span>
                  )}
                </div>

                {/* Redacted Line 2 */}
                <div className="relative">
                  <span className="text-zinc-600">05</span> &nbsp;&nbsp;&nbsp;&nbsp;AWS_SECRET_KEY = 
                  {simulationRedacted ? (
                    <span className="inline-block px-2 py-0.5 ml-1 bg-violet-950/60 text-violet-300 rounded font-mono text-[9px] border border-violet-800/40 backdrop-blur-md pointer-events-none">
                      <Shield className="h-2.5 w-2.5 inline mr-1 text-emerald-400" /> redacted credentials
                    </span>
                  ) : (
                    <span className="text-yellow-400 ml-1">"wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"</span>
                  )}
                </div>

                <div><span className="text-zinc-600">06</span> )</div>
                <div><span className="text-zinc-600">07</span> <span className="text-violet-400">func</span> <span className="text-indigo-400">initSession</span>() {`{`}</div>
                <div><span className="text-zinc-600">08</span> &nbsp;&nbsp;&nbsp;&nbsp;conn.Connect(AWS_ACCESS_KEY)</div>
                <div><span className="text-zinc-600">09</span> {`}`}</div>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-8 px-6 text-center text-xs text-zinc-600 relative z-10 shrink-0">
        <p>© 2026 ShadowMe Inc. All virtual connections encrypted under TLS/SSL protocols.</p>
      </footer>

      {/* Authentication Portal Dialog Modal */}
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="bg-zinc-950/95 border-zinc-800 text-zinc-50 shadow-2xl relative overflow-hidden backdrop-blur-lg max-w-[420px]">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500" />
          
          <DialogHeader className="pt-4">
            <DialogTitle className="text-2xl text-center font-bold">
              {isLogin ? 'Access Hub' : 'Register protocol'}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 text-center">
              {isLogin ? 'Submit password parameters to initialize session.' : 'Register user keys for sandbox workspace credentials.'}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="p-3 mb-2 text-xs bg-red-950/40 border border-red-900/60 text-red-200 rounded-lg text-center font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {!isLogin && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 uppercase">Your Name</label>
                  <Input
                    placeholder="Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 uppercase">Apprenticeship Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['learner', 'expert', 'admin'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={`py-1.5 text-xs font-medium rounded-lg border uppercase transition ${
                          role === r
                            ? 'bg-violet-600/20 border-violet-500 text-violet-200 font-bold'
                            : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase">Email Address</label>
              <Input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-zinc-100 shadow-lg font-bold py-2 mt-4 transition duration-300 cursor-pointer text-xs"
            >
              {loading ? 'Processing...' : isLogin ? 'Authenticate Session' : 'Register Account'}
            </Button>
          </form>

          <div className="mt-4 text-center text-xs text-zinc-400 pb-2">
            {isLogin ? "New to the workspace? " : "Already have an account? "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-violet-400 hover:text-violet-300 font-medium underline underline-offset-4 cursor-pointer"
            >
              {isLogin ? 'Register' : 'Login'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
