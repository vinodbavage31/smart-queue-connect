import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, Clock, Phone, CheckCircle2, Loader2, LogOut, Bell, Pause, Play, UserX, BarChart3, PlayCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function OwnerDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [business, setBusiness] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [completedToday, setCompletedToday] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [setupForm, setSetupForm] = useState({
    name: '', category: '', address: '', phone: '', avg_service_mins: '15',
  });
  const [creating, setCreating] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [serviceForm, setServiceForm] = useState({ name: '', duration_mins: '15', price: '' });
  const [activeTab, setActiveTab] = useState('queue');

  useEffect(() => {
    fetchBusiness();
  }, [user]);

  // Realtime subscription for bookings — refetch on ANY change
  useEffect(() => {
    if (!business) return;
    const bizId = business.id;
    console.log('[OwnerDashboard] Setting up realtime for business:', bizId);

    const channel = supabase
      .channel(`owner-queue-${bizId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `business_id=eq.${bizId}`,
      }, (payload) => {
        console.log('[OwnerDashboard] Realtime event received:', payload.eventType, payload);
        fetchBookings(bizId);
        fetchCompletedToday(bizId);
      })
      .subscribe((status) => {
        console.log('[OwnerDashboard] Subscription status:', status);
      });

    // Fallback polling every 3s for resilience
    const interval = setInterval(() => {
      fetchBookings(bizId);
      fetchCompletedToday(bizId);
    }, 3000);

    return () => {
      console.log('[OwnerDashboard] Cleaning up realtime for business:', bizId);
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [business?.id]); // fetchBookings/fetchCompletedToday are stable useCallbacks defined below

  const fetchBusiness = async () => {
    if (!user) return;
    setLoading(true);
    const { data: biz } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (biz) {
      setBusiness(biz);
      await Promise.all([fetchBookings(biz.id), fetchCompletedToday(biz.id)]);
    } else {
      setShowSetup(true);
    }
    setLoading(false);
  };

  const fetchBookings = useCallback(async (bizId: string) => {
    const { data } = await supabase
      .from('bookings')
      .select('*, profiles(full_name, phone), services(name)')
      .eq('business_id', bizId)
      .in('status', ['waiting', 'calling', 'in_progress'])
      .order('position', { ascending: true });
    setBookings(data || []);
  }, []);

  const fetchCompletedToday = useCallback(async (bizId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('bookings')
      .select('*, profiles(full_name), services(name)')
      .eq('business_id', bizId)
      .in('status', ['completed', 'no_show', 'cancelled'])
      .gte('created_at', today)
      .order('completed_at', { ascending: false });
    setCompletedToday(data || []);
  }, []);

  const createBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase.from('businesses').insert({
      owner_id: user.id,
      name: setupForm.name,
      category: setupForm.category || null,
      address: setupForm.address || null,
      phone: setupForm.phone || null,
      avg_service_mins: parseInt(setupForm.avg_service_mins) || 15,
    }).select().single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setBusiness(data);
      setShowSetup(false);
      toast({ title: 'Business created!', description: 'Your business is pending admin approval.' });
    }
    setCreating(false);
  };

  const addService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;
    const { error } = await supabase.from('services').insert({
      business_id: business.id,
      name: serviceForm.name,
      duration_mins: parseInt(serviceForm.duration_mins) || 15,
      price: serviceForm.price ? parseFloat(serviceForm.price) : null,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setShowAddService(false);
      setServiceForm({ name: '', duration_mins: '15', price: '' });
      toast({ title: 'Service added!' });
    }
  };

  // Recalculate positions for remaining waiting bookings
  const recalcPositions = async (excludeId?: string) => {
    const remaining = bookings
      .filter(b => b.status === 'waiting' && b.id !== excludeId)
      .sort((a, b) => a.position - b.position);
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].position !== i + 1) {
        await supabase.from('bookings').update({ position: i + 1 }).eq('id', remaining[i].id);
      }
    }
    return remaining;
  };

  // Send proximity notifications for customers within 3 positions
  const sendProximityNotifications = async (waitingList: any[]) => {
    for (const b of waitingList.slice(0, 3)) {
      const pos = waitingList.indexOf(b) + 1;
      const estWait = pos * (business.avg_service_mins || 15);
      await supabase.from('notifications').insert({
        user_id: b.user_id,
        title: pos === 1 ? "You're next!" : 'Almost your turn!',
        message: `Position ${pos} at ${business.name}. Est. wait: ~${estWait} min.`,
        type: 'reminder',
        booking_id: b.id,
      });
    }
  };

  // Auto-call next waiting user
  const autoCallNext = async (excludeId: string) => {
    const callingOthers = bookings.filter(b => b.status === 'calling' && b.id !== excludeId);
    if (callingOthers.length > 0) return;

    const remaining = bookings
      .filter(b => b.status === 'waiting' && b.id !== excludeId)
      .sort((a, b) => a.position - b.position);
    
    if (remaining.length > 0) {
      const next = remaining[0];
      await supabase.from('bookings').update({ status: 'calling' }).eq('id', next.id);
      await supabase.from('notifications').insert({
        user_id: next.user_id,
        title: "You are next! Please arrive in 10 minutes",
        message: `You're being called at ${business.name}. Please proceed to the counter within 10 minutes or your slot may be skipped.`,
        type: 'calling',
        booking_id: next.id,
      });
    }
  };

  const callNext = async (bookingId: string, userId: string) => {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'calling' })
      .eq('id', bookingId);
    if (!error) {
      await supabase.from('notifications').insert({
        user_id: userId,
        title: "You are next! Please arrive in 10 minutes",
        message: `You're being called at ${business.name}. Please proceed to the counter within 10 minutes or your slot may be skipped.`,
        type: 'calling',
        booking_id: bookingId,
      });
      toast({ title: 'Customer called!' });
    }
  };

  const startService = async (bookingId: string, userId: string) => {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'in_progress' })
      .eq('id', bookingId);
    if (!error) {
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Service started',
        message: `Your service at ${business.name} has begun.`,
        type: 'info',
        booking_id: bookingId,
      });
      toast({ title: 'Service started!' });
    }
  };

  const completeService = async (bookingId: string, userId: string) => {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', bookingId);

    if (!error) {
      const remaining = await recalcPositions(bookingId);
      await autoCallNext(bookingId);
      await sendProximityNotifications(remaining);
      toast({ title: 'Service completed!' });
    }
  };

  const markNoShow = async (bookingId: string, userId: string) => {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'no_show', completed_at: new Date().toISOString() })
      .eq('id', bookingId);

    if (!error) {
      const remaining = await recalcPositions(bookingId);
      await autoCallNext(bookingId);
      await sendProximityNotifications(remaining);

      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Your slot was skipped',
        message: `You were skipped at ${business.name} due to delay. You can rejoin the queue if needed.`,
        type: 'info',
        booking_id: bookingId,
      });
      toast({ title: 'Marked as no-show, next customer called' });
    }
  };

  const toggleQueuePause = async () => {
    const newValue = !business.is_queue_paused;
    const { error } = await supabase
      .from('businesses')
      .update({ is_queue_paused: newValue })
      .eq('id', business.id);
    if (!error) {
      setBusiness({ ...business, is_queue_paused: newValue });
      toast({ title: newValue ? 'Queue paused' : 'Queue resumed' });
    }
  };

  const sendNotification = async (userId: string, bookingId: string) => {
    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Please arrive or your slot may be skipped',
      message: `Reminder from ${business.name}: please be ready, your turn is approaching soon. If you don't arrive, your slot may be skipped.`,
      type: 'reminder',
      booking_id: bookingId,
    });
    toast({ title: 'Reminder sent!' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (showSetup) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-6"
        >
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Set Up Your Business</h1>
            <p className="text-sm text-muted-foreground mt-1">Create your business to start managing queues</p>
          </div>
          <form onSubmit={createBusiness} className="space-y-4">
            <div className="space-y-2">
              <Label>Business Name *</Label>
              <Input value={setupForm.name} onChange={e => setSetupForm(p => ({ ...p, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={setupForm.category} onChange={e => setSetupForm(p => ({ ...p, category: e.target.value }))} placeholder="e.g. Salon, Clinic" />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={setupForm.address} onChange={e => setSetupForm(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={setupForm.phone} onChange={e => setSetupForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Avg. Service Duration (mins)</Label>
              <Input type="number" value={setupForm.avg_service_mins} onChange={e => setSetupForm(p => ({ ...p, avg_service_mins: e.target.value }))} />
            </div>
            <Button type="submit" className="w-full" disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Business
            </Button>
          </form>
        </motion.div>
      </div>
    );
  }

  const waitingCount = bookings.filter(b => b.status === 'waiting').length;
  const callingCount = bookings.filter(b => b.status === 'calling').length;
  const inProgressCount = bookings.filter(b => b.status === 'in_progress').length;
  const maxQueue = business.max_queue_size || 50;

  const statusBadge = (status: string) => {
    switch (status) {
      case 'waiting': return <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10 text-[10px]">Waiting</Badge>;
      case 'calling': return <Badge variant="outline" className="text-success border-success/30 bg-success/10 text-[10px] animate-pulse">Called</Badge>;
      case 'in_progress': return <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 text-[10px]">In Service</Badge>;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-foreground">{business.name}</h1>
            <p className="text-xs text-muted-foreground">Dashboard • Live</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => signOut().then(() => navigate('/auth'))}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-6">
        {/* Pending Notice */}
        {business.status === 'pending' && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 text-center">
            <p className="text-sm font-medium text-warning">⏳ Your business is pending admin approval</p>
            <p className="text-xs text-muted-foreground mt-1">Customers won't see your business until it's approved.</p>
          </div>
        )}
        {business.status === 'rejected' && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-center">
            <p className="text-sm font-medium text-destructive">❌ Your business registration was rejected</p>
          </div>
        )}

        {/* Queue Pause Toggle */}
        <div className="flex items-center justify-between bg-card card-outline rounded-xl p-4">
          <div className="flex items-center gap-3">
            {business.is_queue_paused ? <Pause className="h-5 w-5 text-warning" /> : <Play className="h-5 w-5 text-success" />}
            <div>
              <p className="text-sm font-medium text-foreground">
                Queue {business.is_queue_paused ? 'Paused' : 'Active'}
              </p>
              <p className="text-xs text-muted-foreground">
                {business.is_queue_paused ? 'No new customers can join' : 'Accepting new customers'}
              </p>
            </div>
          </div>
          <Switch checked={!business.is_queue_paused} onCheckedChange={toggleQueuePause} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-2">
          <div className="bg-card card-outline rounded-xl p-3 text-center">
            <Users className="h-4 w-4 mx-auto text-muted-foreground" />
            <p className="text-xl font-bold text-foreground mt-1">{waitingCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Waiting</p>
          </div>
          <div className="bg-card card-outline rounded-xl p-3 text-center">
            <Phone className="h-4 w-4 mx-auto text-success" />
            <p className="text-xl font-bold text-foreground mt-1">{callingCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Called</p>
          </div>
          <div className="bg-card card-outline rounded-xl p-3 text-center">
            <PlayCircle className="h-4 w-4 mx-auto text-primary" />
            <p className="text-xl font-bold text-foreground mt-1">{inProgressCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Serving</p>
          </div>
          <div className="bg-card card-outline rounded-xl p-3 text-center">
            <Clock className="h-4 w-4 mx-auto text-muted-foreground" />
            <p className="text-xl font-bold text-foreground mt-1">~{waitingCount * business.avg_service_mins}m</p>
            <p className="text-[10px] text-muted-foreground uppercase">Wait</p>
          </div>
          <div className="bg-card card-outline rounded-xl p-3 text-center">
            <CheckCircle2 className="h-4 w-4 mx-auto text-primary" />
            <p className="text-xl font-bold text-foreground mt-1">{completedToday.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Done</p>
          </div>
        </div>

        {/* Queue capacity bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Queue capacity</span>
            <span>{waitingCount + callingCount + inProgressCount}/{maxQueue}</span>
          </div>
          <Progress value={((waitingCount + callingCount + inProgressCount) / maxQueue) * 100} className="h-2" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="queue" className="flex-1">Live Queue ({bookings.length})</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">Today ({completedToday.length})</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="mt-4 space-y-2">
            {bookings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No customers in queue</p>
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
                    className={`flex items-center justify-between p-4 bg-card card-outline rounded-xl ${
                      b.status === 'calling' ? 'ring-2 ring-success/50' :
                      b.status === 'in_progress' ? 'ring-2 ring-primary/50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground w-8">{b.position}.</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-card-foreground">
                            {b.profiles?.full_name || 'Customer'}
                          </h4>
                          {statusBadge(b.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {b.services?.name} • Token #{b.token_number}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => sendNotification(b.user_id, b.id)} title="Send reminder">
                        <Bell className="h-3.5 w-3.5" />
                      </Button>
                      {b.status === 'waiting' && (
                        <Button size="sm" onClick={() => callNext(b.id, b.user_id)}>Call</Button>
                      )}
                      {b.status === 'calling' && (
                        <>
                          <Button
                            size="sm"
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={() => startService(b.id, b.user_id)}
                          >
                            <PlayCircle className="h-3.5 w-3.5 mr-1" />
                            Start
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive/20 hover:bg-destructive/5"
                            onClick={() => markNoShow(b.id, b.user_id)}
                            title="Skip / No-show"
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {b.status === 'in_progress' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive/20 hover:bg-destructive/5"
                            onClick={() => markNoShow(b.id, b.user_id)}
                            title="Skip"
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-success border-success/20 hover:bg-success/5"
                            onClick={() => completeService(b.id, b.user_id)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Done
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
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No completed services today</p>
              </div>
            ) : (
              completedToday.map(b => (
                <div key={b.id} className="flex items-center justify-between p-3 bg-card card-outline rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{b.profiles?.full_name || 'Customer'}</p>
                    <p className="text-xs text-muted-foreground">{b.services?.name} • Token #{b.token_number}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    b.status === 'completed' ? 'bg-success/10 text-success' :
                    b.status === 'cancelled' ? 'bg-muted text-muted-foreground' :
                    'bg-destructive/10 text-destructive'
                  }`}>
                    {b.status === 'completed' ? 'Completed' : b.status === 'cancelled' ? 'Cancelled' : 'No-show'}
                  </span>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="settings" className="mt-4 space-y-4">
            <Dialog open={showAddService} onOpenChange={setShowAddService}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Service
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Service</DialogTitle>
                </DialogHeader>
                <form onSubmit={addService} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Service Name</Label>
                    <Input value={serviceForm.name} onChange={e => setServiceForm(p => ({ ...p, name: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (mins)</Label>
                    <Input type="number" value={serviceForm.duration_mins} onChange={e => setServiceForm(p => ({ ...p, duration_mins: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Price ($)</Label>
                    <Input type="number" step="0.01" value={serviceForm.price} onChange={e => setServiceForm(p => ({ ...p, price: e.target.value }))} />
                  </div>
                  <Button type="submit" className="w-full">Add Service</Button>
                </form>
              </DialogContent>
            </Dialog>

            <div className="bg-card card-outline rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-medium text-foreground">Queue Settings</h3>
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">Max queue size</Label>
                <span className="text-sm font-medium text-foreground">{maxQueue}</span>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">Avg service time</Label>
                <span className="text-sm font-medium text-foreground">{business.avg_service_mins} min</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
