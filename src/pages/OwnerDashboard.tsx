import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, Clock, Phone, CheckCircle2, Loader2, LogOut, Bell, Pause, Play, UserX, BarChart3, PlayCircle, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Business = Tables<'businesses'>;
type QueueBooking = Tables<'bookings'> & {
  profiles?: { full_name: string | null; phone: string | null } | null;
  services?: { name: string | null } | null;
};

const DASHBOARD_POLL_MS = 2000;

export default function OwnerDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ownedBusinesses, setOwnedBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  const [business, setBusiness] = useState<Business | null>(null);
  const [bookings, setBookings] = useState<QueueBooking[]>([]);
  const [completedToday, setCompletedToday] = useState<QueueBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [setupForm, setSetupForm] = useState({ name: '', category: '', address: '', phone: '', avg_service_mins: '15' });
  const [creating, setCreating] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [serviceForm, setServiceForm] = useState({ name: '', duration_mins: '15', price: '' });
  const [activeTab, setActiveTab] = useState('queue');

  const attachProfiles = useCallback(async (rows: Array<Tables<'bookings'> & { services?: { name: string | null } | null }>) => {
    const userIds = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean)));
    if (userIds.length === 0) return rows.map(r => ({ ...r, profiles: null })) as QueueBooking[];
    const { data: profilesData } = await supabase.from('profiles').select('id, full_name, phone').in('id', userIds);
    const profileMap = new Map((profilesData ?? []).map(p => [p.id, { full_name: p.full_name, phone: p.phone }]));
    return rows.map(r => ({ ...r, profiles: profileMap.get(r.user_id) ?? null })) as QueueBooking[];
  }, []);

  const fetchDashboardData = useCallback(async (bizId: string, source: string) => {
    if (!user || !bizId) return;
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const [bizRes, activeRes, historyRes] = await Promise.all([
      supabase.from('businesses').select('*').eq('id', bizId).eq('owner_id', user.id).maybeSingle(),
      supabase.from('bookings').select('*, services(name)').eq('business_id', bizId).in('status', ['waiting', 'calling', 'in_progress']).order('position', { ascending: true }),
      supabase.from('bookings').select('*, services(name)').eq('business_id', bizId).in('status', ['completed', 'no_show', 'cancelled']).gte('created_at', startOfToday.toISOString()).order('completed_at', { ascending: false }),
    ]);
    if (bizRes.error || activeRes.error || historyRes.error) return;
    setBusiness(bizRes.data ?? null);
    setBookings(await attachProfiles(activeRes.data ?? []));
    setCompletedToday(await attachProfiles(historyRes.data ?? []));
  }, [attachProfiles, user]);

  const fetchOwnedBusinesses = useCallback(async () => {
    if (!user) return [] as Business[];
    const { data } = await supabase.from('businesses').select('*').eq('owner_id', user.id).order('status').order('created_at', { ascending: false });
    const results = (data ?? []) as Business[];
    setOwnedBusinesses(results);
    return results;
  }, [user]);

  const getDefaultBusinessId = useCallback((items: Business[]) => {
    if (!user || items.length === 0) return '';
    const storageKey = `smartq-owner-business:${user.id}`;
    const saved = window.localStorage.getItem(storageKey);
    if (saved && items.some(i => i.id === saved)) return saved;
    return items.find(i => i.status === 'approved')?.id ?? items[0].id;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const bootstrap = async () => {
      setLoading(true);
      const businesses = await fetchOwnedBusinesses();
      if (cancelled) return;
      if (businesses.length === 0) { setShowSetup(true); setBusiness(null); setBookings([]); setCompletedToday([]); setSelectedBusinessId(''); setLoading(false); return; }
      setShowSetup(false);
      setSelectedBusinessId(getDefaultBusinessId(businesses));
      setLoading(false);
    };
    bootstrap();
    return () => { cancelled = true; };
  }, [fetchOwnedBusinesses, getDefaultBusinessId, user]);

  useEffect(() => {
    if (!user || !selectedBusinessId) return;
    window.localStorage.setItem(`smartq-owner-business:${user.id}`, selectedBusinessId);
    void fetchDashboardData(selectedBusinessId, 'business:selected');
  }, [fetchDashboardData, selectedBusinessId, user]);

  useEffect(() => {
    if (!selectedBusinessId) return;
    const businessId = selectedBusinessId;
    let isActive = true;
    const channel = supabase
      .channel(`owner-bookings:${businessId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings', filter: `business_id=eq.${businessId}` }, async () => { if (isActive) await fetchDashboardData(businessId, 'realtime:INSERT'); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `business_id=eq.${businessId}` }, async () => { if (isActive) await fetchDashboardData(businessId, 'realtime:UPDATE'); })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'bookings', filter: `business_id=eq.${businessId}` }, async () => { if (isActive) await fetchDashboardData(businessId, 'realtime:DELETE'); })
      .subscribe();
    const interval = window.setInterval(() => { if (isActive) void fetchDashboardData(businessId, 'poll:2s'); }, DASHBOARD_POLL_MS);
    return () => { isActive = false; window.clearInterval(interval); supabase.removeChannel(channel); };
  }, [fetchDashboardData, selectedBusinessId]);

  const createBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase.from('businesses').insert({
      owner_id: user.id, name: setupForm.name, category: setupForm.category || null,
      address: setupForm.address || null, phone: setupForm.phone || null,
      avg_service_mins: parseInt(setupForm.avg_service_mins) || 15,
    }).select().single();
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { setOwnedBusinesses(prev => [data, ...prev]); setSelectedBusinessId(data.id); setBusiness(data); setShowSetup(false); toast({ title: 'Business created!', description: 'Pending admin approval.' }); }
    setCreating(false);
  };

  const addService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;
    const { error } = await supabase.from('services').insert({
      business_id: business.id, name: serviceForm.name,
      duration_mins: parseInt(serviceForm.duration_mins) || 15,
      price: serviceForm.price ? parseFloat(serviceForm.price) : null,
    });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { setShowAddService(false); setServiceForm({ name: '', duration_mins: '15', price: '' }); toast({ title: 'Service added!' }); }
  };

  const recalcPositions = async (bizId: string, excludeId?: string) => {
    const { data } = await supabase.from('bookings').select('id, user_id, position').eq('business_id', bizId).eq('status', 'waiting').order('position', { ascending: true });
    const remaining = (data ?? []).filter(i => i.id !== excludeId).map((i, idx) => ({ ...i, position: idx + 1 }));
    await Promise.all(remaining.map(i => supabase.from('bookings').update({ position: i.position }).eq('id', i.id)));
    return remaining;
  };

  const sendProximityNotifications = async (waitingList: Array<{ id: string; user_id: string; position: number }>) => {
    if (!business) return;
    for (const b of waitingList.slice(0, 3)) {
      const estWait = b.position * (business.avg_service_mins || 15);
      await supabase.from('notifications').insert({ user_id: b.user_id, title: b.position === 1 ? "You're next!" : 'Almost your turn!', message: `Position ${b.position} at ${business.name}. Est. wait: ~${estWait} min.`, type: 'reminder', booking_id: b.id });
    }
  };

  const autoCallNext = async (bizId: string, excludeId: string) => {
    if (!business) return;
    const { data: callingOthers } = await supabase.from('bookings').select('id').eq('business_id', bizId).eq('status', 'calling').neq('id', excludeId).limit(1);
    if ((callingOthers ?? []).length > 0) return;
    const { data: next } = await supabase.from('bookings').select('id, user_id').eq('business_id', bizId).eq('status', 'waiting').order('position', { ascending: true }).limit(1).maybeSingle();
    if (next) {
      await supabase.from('bookings').update({ status: 'calling' }).eq('id', next.id);
      await supabase.from('notifications').insert({ user_id: next.user_id, title: "You are next! Please arrive in 10 minutes", message: `You're being called at ${business.name}.`, type: 'calling', booking_id: next.id });
    }
  };

  const callNext = async (bookingId: string, userId: string) => {
    if (!business) return;
    const { error } = await supabase.from('bookings').update({ status: 'calling' }).eq('id', bookingId);
    if (!error) {
      await supabase.from('notifications').insert({ user_id: userId, title: "You are next!", message: `Please arrive at ${business.name} within 10 minutes.`, type: 'calling', booking_id: bookingId });
      await fetchDashboardData(business.id, 'action:call-next');
      toast({ title: 'Customer called!' });
    }
  };

  const startService = async (bookingId: string, userId: string) => {
    if (!business) return;
    const { error } = await supabase.from('bookings').update({ status: 'in_progress' }).eq('id', bookingId);
    if (!error) {
      await supabase.from('notifications').insert({ user_id: userId, title: 'Service started', message: `Your service at ${business.name} has begun.`, type: 'info', booking_id: bookingId });
      await fetchDashboardData(business.id, 'action:start-service');
      toast({ title: 'Service started!' });
    }
  };

  const completeService = async (bookingId: string, userId: string) => {
    if (!business) return;
    const { error } = await supabase.from('bookings').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', bookingId);
    if (!error) {
      const remaining = await recalcPositions(business.id, bookingId);
      await autoCallNext(business.id, bookingId);
      await sendProximityNotifications(remaining);
      await fetchDashboardData(business.id, 'action:complete-service');
      toast({ title: 'Service completed!' });
    }
  };

  const markNoShow = async (bookingId: string, userId: string) => {
    if (!business) return;
    const { error } = await supabase.from('bookings').update({ status: 'no_show', completed_at: new Date().toISOString() }).eq('id', bookingId);
    if (!error) {
      const remaining = await recalcPositions(business.id, bookingId);
      await autoCallNext(business.id, bookingId);
      await sendProximityNotifications(remaining);
      await supabase.from('notifications').insert({ user_id: userId, title: 'Your slot was skipped', message: `You were skipped at ${business.name}. You can rejoin the queue.`, type: 'info', booking_id: bookingId });
      await fetchDashboardData(business.id, 'action:no-show');
      toast({ title: 'Marked as no-show' });
    }
  };

  const toggleQueuePause = async () => {
    if (!business) return;
    const newValue = !business.is_queue_paused;
    const { error } = await supabase.from('businesses').update({ is_queue_paused: newValue }).eq('id', business.id);
    if (!error) {
      await fetchOwnedBusinesses();
      await fetchDashboardData(business.id, 'action:toggle-pause');
      toast({ title: newValue ? 'Queue paused' : 'Queue resumed' });
    }
  };

  const sendNotification = async (userId: string, bookingId: string) => {
    if (!business) return;
    await supabase.from('notifications').insert({ user_id: userId, title: 'Please arrive or your slot may be skipped', message: `Reminder from ${business.name}: your turn is approaching soon.`, type: 'reminder', booking_id: bookingId });
    toast({ title: 'Reminder sent!' });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (showSetup) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl -translate-y-1/2" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-6 relative z-10">
          <div className="text-center">
            <h1 className="text-2xl font-extrabold text-foreground">Set Up Your Business</h1>
            <p className="text-sm text-muted-foreground mt-2">Create your business to start managing queues</p>
          </div>
          <form onSubmit={createBusiness} className="space-y-4">
            <div className="space-y-2"><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business Name *</Label><Input value={setupForm.name} onChange={e => setSetupForm(p => ({ ...p, name: e.target.value }))} required className="h-12 rounded-xl bg-card border-border/50" /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</Label><Input value={setupForm.category} onChange={e => setSetupForm(p => ({ ...p, category: e.target.value }))} placeholder="e.g. Salon, Clinic" className="h-12 rounded-xl bg-card border-border/50" /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</Label><Input value={setupForm.address} onChange={e => setSetupForm(p => ({ ...p, address: e.target.value }))} className="h-12 rounded-xl bg-card border-border/50" /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</Label><Input value={setupForm.phone} onChange={e => setSetupForm(p => ({ ...p, phone: e.target.value }))} className="h-12 rounded-xl bg-card border-border/50" /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avg. Service Duration (mins)</Label><Input type="number" value={setupForm.avg_service_mins} onChange={e => setSetupForm(p => ({ ...p, avg_service_mins: e.target.value }))} className="h-12 rounded-xl bg-card border-border/50" /></div>
            <Button type="submit" className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20" disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Business
            </Button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (!business) {
    return <div className="min-h-screen flex items-center justify-center bg-background px-4 text-center"><p className="text-sm text-muted-foreground">No business selected</p></div>;
  }

  const waitingCount = bookings.filter(b => b.status === 'waiting').length;
  const callingCount = bookings.filter(b => b.status === 'calling').length;
  const inProgressCount = bookings.filter(b => b.status === 'in_progress').length;
  const maxQueue = business.max_queue_size || 50;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/70 backdrop-blur-2xl border-b border-border/30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-extrabold text-foreground text-lg">{business.name}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success pulse-live" />
              Dashboard · Live
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => signOut().then(() => navigate('/auth'))}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* Status notices */}
        {business.status === 'pending' && (
          <div className="bg-warning/10 border border-warning/20 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-warning">⏳ Pending admin approval</p>
            <p className="text-xs text-muted-foreground mt-1">Customers won't see your business yet.</p>
          </div>
        )}
        {business.status === 'rejected' && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-destructive">❌ Registration rejected</p>
          </div>
        )}

        {/* Business selector */}
        {ownedBusinesses.length > 1 && (
          <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
            <SelectTrigger className="rounded-xl h-11 bg-card border-border/50">
              <SelectValue placeholder="Select business" />
            </SelectTrigger>
            <SelectContent>
              {ownedBusinesses.map(item => (
                <SelectItem key={item.id} value={item.id}>{item.name} · {item.status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Queue Pause Toggle */}
        <div className="flex items-center justify-between bg-card card-glass rounded-2xl p-4">
          <div className="flex items-center gap-3">
            {business.is_queue_paused ? <Pause className="h-5 w-5 text-warning" /> : <Play className="h-5 w-5 text-success" />}
            <div>
              <p className="text-sm font-semibold text-foreground">Queue {business.is_queue_paused ? 'Paused' : 'Active'}</p>
              <p className="text-xs text-muted-foreground">{business.is_queue_paused ? 'No new customers can join' : 'Accepting customers'}</p>
            </div>
          </div>
          <Switch checked={!business.is_queue_paused} onCheckedChange={toggleQueuePause} />
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: Users, value: waitingCount, label: 'Waiting', color: 'text-warning' },
            { icon: Phone, value: callingCount, label: 'Called', color: 'text-success' },
            { icon: PlayCircle, value: inProgressCount, label: 'Serving', color: 'text-primary' },
            { icon: CheckCircle2, value: completedToday.length, label: 'Done', color: 'text-muted-foreground' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card card-glass rounded-2xl p-4 text-center"
            >
              <stat.icon className={`h-5 w-5 mx-auto ${stat.color}`} />
              <p className="text-2xl font-extrabold text-foreground mt-1.5">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Wait time + capacity */}
        <div className="bg-card card-glass rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Est. Wait: ~{waitingCount * business.avg_service_mins}m</span>
            </div>
            <span className="text-xs text-muted-foreground font-medium">{waitingCount + callingCount + inProgressCount}/{maxQueue}</span>
          </div>
          <Progress value={((waitingCount + callingCount + inProgressCount) / maxQueue) * 100} className="h-2" />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full rounded-xl bg-muted p-1">
            <TabsTrigger value="queue" className="flex-1 rounded-lg text-xs font-semibold">Live Queue ({bookings.length})</TabsTrigger>
            <TabsTrigger value="history" className="flex-1 rounded-lg text-xs font-semibold">Today ({completedToday.length})</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 rounded-lg text-xs font-semibold">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="mt-4 space-y-2">
            {bookings.length === 0 ? (
              <div className="text-center py-16">
                <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">No customers in queue</p>
              </div>
            ) : (
              <AnimatePresence>
                {bookings.map((b, i) => (
                  <motion.div
                    key={b.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ delay: i * 0.03 }}
                    className={`flex items-center justify-between p-4 bg-card card-glass rounded-2xl ${
                      b.status === 'calling' ? 'ring-2 ring-success/40 shadow-lg shadow-success/10' :
                      b.status === 'in_progress' ? 'ring-2 ring-primary/40 shadow-lg shadow-primary/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-extrabold ${
                        b.status === 'calling' ? 'gradient-success text-success-foreground' :
                        b.status === 'in_progress' ? 'gradient-primary text-primary-foreground' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {b.position}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-card-foreground text-sm">{b.profiles?.full_name || 'Customer'}</h4>
                          {b.status === 'calling' && <Badge className="status-available text-[9px] font-bold animate-pulse border">Called</Badge>}
                          {b.status === 'in_progress' && <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-bold border">Serving</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{b.services?.name} · #{b.token_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => sendNotification(b.user_id, b.id)} title="Send reminder" className="rounded-full h-8 w-8 p-0">
                        <Bell className="h-3.5 w-3.5" />
                      </Button>
                      {b.status === 'waiting' && (
                        <Button size="sm" onClick={() => callNext(b.id, b.user_id)} className="rounded-xl gradient-primary text-primary-foreground text-xs font-semibold h-8 px-3">
                          Call
                        </Button>
                      )}
                      {b.status === 'calling' && (
                        <>
                          <Button size="sm" onClick={() => startService(b.id, b.user_id)} className="rounded-xl gradient-success text-success-foreground text-xs font-semibold h-8 px-3">
                            <PlayCircle className="h-3.5 w-3.5 mr-1" /> Start
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => markNoShow(b.id, b.user_id)} className="rounded-full h-8 w-8 p-0 text-destructive hover:bg-destructive/5">
                            <UserX className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {b.status === 'in_progress' && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => markNoShow(b.id, b.user_id)} className="rounded-full h-8 w-8 p-0 text-destructive hover:bg-destructive/5">
                            <UserX className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" onClick={() => completeService(b.id, b.user_id)} className="rounded-xl text-xs font-semibold h-8 px-3 bg-success/10 text-success hover:bg-success/20 border border-success/20">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Done
                          </Button>
                        </>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-2">
            {completedToday.length === 0 ? (
              <div className="text-center py-16">
                <BarChart3 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">No completed services today</p>
              </div>
            ) : (
              completedToday.map(b => (
                <div key={b.id} className="flex items-center justify-between p-4 bg-card card-glass rounded-2xl">
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">{b.profiles?.full_name || 'Customer'}</p>
                    <p className="text-xs text-muted-foreground">{b.services?.name} · #{b.token_number}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] font-semibold ${
                    b.status === 'completed' ? 'status-available' : b.status === 'cancelled' ? 'bg-muted text-muted-foreground' : 'status-full'
                  }`}>
                    {b.status === 'completed' ? '✅ Done' : b.status === 'cancelled' ? '❌ Cancelled' : '⏭️ No-show'}
                  </Badge>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="settings" className="mt-4 space-y-4">
            <Dialog open={showAddService} onOpenChange={setShowAddService}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full rounded-xl h-11">
                  <Plus className="h-4 w-4 mr-1.5" /> Add Service
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl">
                <DialogHeader><DialogTitle>Add Service</DialogTitle></DialogHeader>
                <form onSubmit={addService} className="space-y-4">
                  <div className="space-y-2"><Label>Service Name</Label><Input value={serviceForm.name} onChange={e => setServiceForm(p => ({ ...p, name: e.target.value }))} required className="rounded-xl" /></div>
                  <div className="space-y-2"><Label>Duration (mins)</Label><Input type="number" value={serviceForm.duration_mins} onChange={e => setServiceForm(p => ({ ...p, duration_mins: e.target.value }))} className="rounded-xl" /></div>
                  <div className="space-y-2"><Label>Price ($)</Label><Input type="number" step="0.01" value={serviceForm.price} onChange={e => setServiceForm(p => ({ ...p, price: e.target.value }))} className="rounded-xl" /></div>
                  <Button type="submit" className="w-full rounded-xl gradient-primary text-primary-foreground font-semibold">Add Service</Button>
                </form>
              </DialogContent>
            </Dialog>
            <div className="bg-card card-glass rounded-2xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Queue Settings</h3>
              <div className="flex items-center justify-between"><Label className="text-sm text-muted-foreground">Max queue size</Label><span className="text-sm font-semibold text-foreground">{maxQueue}</span></div>
              <div className="flex items-center justify-between"><Label className="text-sm text-muted-foreground">Avg service time</Label><span className="text-sm font-semibold text-foreground">{business.avg_service_mins} min</span></div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
