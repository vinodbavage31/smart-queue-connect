import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, Clock, Phone, CheckCircle2, Loader2, LogOut, Settings, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function OwnerDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [business, setBusiness] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [setupForm, setSetupForm] = useState({
    name: '', category: '', address: '', phone: '', avg_service_mins: '15',
  });
  const [creating, setCreating] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [serviceForm, setServiceForm] = useState({ name: '', duration_mins: '15', price: '' });

  useEffect(() => {
    fetchBusiness();
  }, [user]);

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
      await fetchBookings(biz.id);
    } else {
      setShowSetup(true);
    }
    setLoading(false);
  };

  const fetchBookings = async (bizId: string) => {
    const { data } = await supabase
      .from('bookings')
      .select('*, profiles(full_name, phone), services(name)')
      .eq('business_id', bizId)
      .in('status', ['waiting', 'calling', 'in_progress'])
      .order('position', { ascending: true });
    setBookings(data || []);
  };

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

  const callNext = async (bookingId: string, userId: string) => {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'calling' })
      .eq('id', bookingId);
    if (!error) {
      // Send notification
      await supabase.from('notifications').insert({
        user_id: userId,
        title: "It's your turn!",
        message: `You're being called at ${business.name}. Please proceed to the counter.`,
        type: 'calling',
        booking_id: bookingId,
      });
      toast({ title: 'Customer called!' });
      await fetchBookings(business.id);
    }
  };

  const completeService = async (bookingId: string, userId: string) => {
    // Mark as completed
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', bookingId);

    if (!error) {
      // Decrement positions for remaining waiting bookings
      const waitingBookings = bookings.filter(b => b.status === 'waiting');
      for (const b of waitingBookings) {
        await supabase
          .from('bookings')
          .update({ position: Math.max(1, b.position - 1) })
          .eq('id', b.id);
      }

      // Notify user whose turn is within 3 positions
      const nearFront = waitingBookings.find(b => b.position <= 4);
      if (nearFront) {
        const estWait = (nearFront.position - 1) * (business.avg_service_mins || 15);
        await supabase.from('notifications').insert({
          user_id: nearFront.user_id,
          title: 'Almost your turn!',
          message: `You're ${nearFront.position - 1 > 0 ? `position ${nearFront.position - 1}` : 'next'} at ${business.name}. Estimated wait: ~${estWait} minutes.`,
          type: 'reminder',
          booking_id: nearFront.id,
        });
      }

      toast({ title: 'Service completed!' });
      await fetchBookings(business.id);
    }
  };

  const sendNotification = async (userId: string, bookingId: string) => {
    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Update from ' + business.name,
      message: 'Please be ready, your turn is approaching soon.',
      type: 'reminder',
      booking_id: bookingId,
    });
    toast({ title: 'Notification sent!' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Business setup form
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-foreground">{business.name}</h1>
            <p className="text-xs text-muted-foreground">Dashboard</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => signOut().then(() => navigate('/auth'))}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card card-outline rounded-xl p-4 text-center">
            <Users className="h-5 w-5 mx-auto text-muted-foreground" />
            <p className="text-2xl font-bold text-foreground mt-1">{waitingCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Waiting</p>
          </div>
          <div className="bg-card card-outline rounded-xl p-4 text-center">
            <Phone className="h-5 w-5 mx-auto text-success" />
            <p className="text-2xl font-bold text-foreground mt-1">{callingCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Calling</p>
          </div>
          <div className="bg-card card-outline rounded-xl p-4 text-center">
            <Clock className="h-5 w-5 mx-auto text-muted-foreground" />
            <p className="text-2xl font-bold text-foreground mt-1">~{waitingCount * business.avg_service_mins}m</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Wait</p>
          </div>
        </div>

        {/* Add Service */}
        <Dialog open={showAddService} onOpenChange={setShowAddService}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
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

        {/* Queue List */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Live Queue
          </h2>
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
                  transition={{ delay: i * 0.05 }}
                  className={`flex items-center justify-between p-4 bg-card card-outline rounded-xl ${
                    b.status === 'calling' ? 'ring-2 ring-success/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-bold text-muted-foreground w-8">{b.position}.</span>
                    <div>
                      <h4 className="font-semibold text-card-foreground">
                        {b.profiles?.full_name || 'Customer'}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {b.services?.name} • Token #{b.token_number}
                        {b.status === 'calling' && (
                          <span className="text-success font-medium ml-1">• Called</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => sendNotification(b.user_id, b.id)}
                      title="Send reminder"
                    >
                      <Bell className="h-4 w-4" />
                    </Button>
                    {b.status === 'waiting' && (
                      <Button
                        size="sm"
                        onClick={() => callNext(b.id, b.user_id)}
                      >
                        Call
                      </Button>
                    )}
                    {(b.status === 'calling' || b.status === 'in_progress') && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-success border-success/20 hover:bg-success/5"
                        onClick={() => completeService(b.id, b.user_id)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Done
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
