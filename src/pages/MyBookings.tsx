import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Clock, Loader2, X, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function MyBookings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchBookings();

    // Realtime + polling for live updates
    const channel = supabase
      .channel('my-bookings')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `user_id=eq.${user.id}`,
      }, () => fetchBookings())
      .subscribe();

    const interval = setInterval(fetchBookings, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user]);

  const fetchBookings = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('bookings')
      .select('*, businesses(name, avg_service_mins, id), services(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setBookings(data || []);
    setLoading(false);
  };

  const cancelBooking = async (bookingId: string) => {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Booking cancelled' });
    }
  };

  const rejoinQueue = async (booking: any) => {
    navigate(`/business/${booking.businesses?.id || booking.business_id}`);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'waiting': return <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10 text-[10px]">Waiting</Badge>;
      case 'calling': return <Badge variant="outline" className="text-success border-success/30 bg-success/10 text-[10px] animate-pulse">🔔 Your Turn!</Badge>;
      case 'in_progress': return <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 text-[10px]">In Service</Badge>;
      case 'completed': return <Badge variant="outline" className="text-muted-foreground border-border text-[10px]">Completed</Badge>;
      case 'cancelled': return <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10 text-[10px]">Cancelled</Badge>;
      case 'no_show': return <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10 text-[10px]">Skipped</Badge>;
      default: return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-foreground">My Bookings</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No bookings yet</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/')}>
              Browse Businesses
            </Button>
          </div>
        ) : (
          <AnimatePresence>
            {bookings.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-card card-outline rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-card-foreground">{b.businesses?.name}</h3>
                    <p className="text-xs text-muted-foreground">{b.services?.name}</p>
                  </div>
                  {statusBadge(b.status)}
                </div>

                {['waiting', 'calling', 'in_progress'].includes(b.status) && (
                  <div className="gradient-primary text-primary-foreground p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] opacity-70">Token</p>
                        <p className="text-3xl font-extrabold tracking-tighter" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          #{b.token_number}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] opacity-70">Position</p>
                        <p className="text-xl font-semibold">{b.position}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] opacity-70">Est. Wait</p>
                        <p className="text-xl font-semibold">~{b.position * (b.businesses?.avg_service_mins || 15)}m</p>
                      </div>
                    </div>
                    {b.status === 'waiting' && (
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-[10px] opacity-70">
                          <span>Queue progress</span>
                        </div>
                        <Progress
                          value={Math.max(5, (1 / Math.max(1, b.position)) * 100)}
                          className="h-1.5 bg-primary-foreground/20"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  {b.status === 'waiting' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cancelBooking(b.id)}
                      className="text-destructive border-destructive/20 hover:bg-destructive/5"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  )}
                  {(b.status === 'no_show' || b.status === 'cancelled') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => rejoinQueue(b)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Rejoin Queue
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
