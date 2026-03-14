import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Clock, Loader2, X } from 'lucide-react';
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
  }, [user]);

  const fetchBookings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bookings')
      .select('*, businesses(name, avg_service_mins), services(name)')
      .eq('user_id', user!.id)
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
      fetchBookings();
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'bg-warning/10 text-warning';
      case 'calling': return 'bg-success/10 text-success';
      case 'in_progress': return 'bg-primary/10 text-primary';
      case 'completed': return 'bg-muted text-muted-foreground';
      case 'cancelled': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
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
          </div>
        ) : (
          <AnimatePresence>
            {bookings.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card card-outline rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-card-foreground">{b.businesses?.name}</h3>
                    <p className="text-xs text-muted-foreground">{b.services?.name}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-1 rounded-full uppercase ${statusColor(b.status)}`}>
                    {b.status === 'calling' ? '🔔 Your Turn!' : b.status.replace('_', ' ')}
                  </span>
                </div>

                {(b.status === 'waiting' || b.status === 'calling') && (
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
                  </div>
                )}

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
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
