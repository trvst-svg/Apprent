'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Video, DollarSign, LogOut, Terminal, Activity, BookOpen } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface AdminMetrics {
  totalUsers: number;
  usersByRole: Record<string, number>;
  totalStreams: number;
  streamsByStatus: Record<string, number>;
  totalRevenue: number;
  totalBookings: number;
  totalChallenges: number;
}

interface UserLog {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [users, setUsers] = useState<UserLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Role protection
    if (!loading && (!user || user.role !== 'admin')) {
      router.push('/');
      return;
    }
  }, [user, loading]);

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchAdminData();
    }
  }, [user]);

  const fetchAdminData = async () => {
    try {
      const [m, u] = await Promise.all([
        apiFetch<AdminMetrics>('/api/v1/admin/metrics', { token: token || undefined }),
        apiFetch<UserLog[]>('/api/v1/admin/users', { token: token || undefined }),
      ]);
      setMetrics(m);
      setUsers(u);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-zinc-950 text-zinc-400">
        <Activity className="h-8 w-8 animate-spin text-violet-500 mr-2" />
        Loading system metrics...
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return null;
  }

  // Sample data for charts
  const roleChartData = metrics ? [
    { name: 'Learners', count: metrics.usersByRole.learner || 0 },
    { name: 'Experts', count: metrics.usersByRole.expert || 0 },
    { name: 'Admins', count: metrics.usersByRole.admin || 0 },
  ] : [];

  const streamStatusData = metrics ? [
    { name: 'Scheduled', count: metrics.streamsByStatus.scheduled || 0 },
    { name: 'Live', count: metrics.streamsByStatus.live || 0 },
    { name: 'Recorded', count: metrics.streamsByStatus.recorded || 0 },
  ] : [];

  return (
    <div className="flex-1 bg-zinc-950 text-zinc-50 min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/40 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="h-6 w-6 text-violet-500" />
          <span className="font-bold tracking-wider text-zinc-100 uppercase">
            Shadow<span className="text-violet-500">Me</span> <span className="text-xs text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded ml-2 font-mono">ADMIN</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-300">Welcome, {user.name}</span>
          <Button onClick={handleLogout} variant="outline" className="border-zinc-800 hover:bg-zinc-900 text-zinc-300">
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-zinc-900/60 border-zinc-800 text-zinc-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Total Registered Users</CardTitle>
              <Users className="h-5 w-5 text-violet-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-white">{metrics?.totalUsers}</div>
              <p className="text-xs text-zinc-500 mt-1">Learners & Experts</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/60 border-zinc-800 text-zinc-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Apprenticeship Streams</CardTitle>
              <Video className="h-5 w-5 text-indigo-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-white">{metrics?.totalStreams}</div>
              <p className="text-xs text-zinc-500 mt-1">{metrics?.streamsByStatus.live || 0} active live streaming</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/60 border-zinc-800 text-zinc-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Total Platform Bookings</CardTitle>
              <BookOpen className="h-5 w-5 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-white">{metrics?.totalBookings}</div>
              <p className="text-xs text-zinc-500 mt-1">{metrics?.totalChallenges || 0} coding challenges ready</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/60 border-zinc-800 text-zinc-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Gross Booking Revenue</CardTitle>
              <DollarSign className="h-5 w-5 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-white">${metrics?.totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-zinc-500 mt-1">Processed securely via Stripe mock</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts & Graphs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-zinc-900/60 border-zinc-800 text-zinc-100">
            <CardHeader>
              <CardTitle className="text-lg">User Roles Distribution</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roleChartData}>
                  <XAxis dataKey="name" stroke="#71717a" />
                  <YAxis stroke="#71717a" />
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', color: '#fff' }} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/60 border-zinc-800 text-zinc-100">
            <CardHeader>
              <CardTitle className="text-lg">Streaming Activity Logs</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={streamStatusData}>
                  <XAxis dataKey="name" stroke="#71717a" />
                  <YAxis stroke="#71717a" />
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', color: '#fff' }} />
                  <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card className="bg-zinc-900/60 border-zinc-800 text-zinc-100">
          <CardHeader>
            <CardTitle>System Accounts</CardTitle>
            <CardDescription className="text-zinc-400">Total registered profiles on the database cluster</CardDescription>
          </CardHeader>
          <CardContent>
            <Table className="border border-zinc-800">
              <TableHeader className="bg-zinc-900/50">
                <TableRow className="border-b border-zinc-800">
                  <TableHead className="text-zinc-400">User ID</TableHead>
                  <TableHead className="text-zinc-400">Name</TableHead>
                  <TableHead className="text-zinc-400">Email</TableHead>
                  <TableHead className="text-zinc-400">System Role</TableHead>
                  <TableHead className="text-zinc-400">Registered At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className="border-b border-zinc-800 hover:bg-zinc-900/40">
                    <TableCell className="font-mono text-xs text-zinc-500">{u.id}</TableCell>
                    <TableCell className="font-semibold text-zinc-200">{u.name}</TableCell>
                    <TableCell className="text-zinc-400">{u.email}</TableCell>
                    <TableCell>
                      <Badge className={
                        u.role === 'admin' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                        u.role === 'expert' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' :
                        'bg-violet-500/20 text-violet-300 border-violet-500/30'
                      }>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-zinc-500 text-sm">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
