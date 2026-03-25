import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Clock, Loader2, X, RotateCcw, Ticket, CheckCircle2 } from 'lucide-react';
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
    const channel = supabase
      .channel('my-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `user_id=eq.${user.id}` }, () => fetchBookings())
      .subscribe();
    const interval = setInterval(fetchBookings, 5000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, [user]);

  const fetchBookings = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('bookings').select('*, businesses(name, avg_service_mins, id), services(name)')
      .eq('user_id', user.id).order('created_at', { ascending: false });
    setBookings(data || []);
    setLoading(false);
  };

  const cancelBooking = async (bookingId: string) => {
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Booking cancelled' });
  };

  const statusConfig: Record<string, { label: string; class: string; icon: string }> = {
    waiting: { label: 'Waiting', class: 'bg-warning/10 text-warning border-warning/20', icon: '⏳' },
    calling: { label: 'Your Turn!', class: 'bg-success/10 text-success border-success/20 animate-pulse', icon: '🔔' },
    in_progress: { label: 'In Service', class: 'bg-primary/10 text-primary border-primary/20', icon: '⚡' },
    completed: { label: 'Completed', class: 'bg-muted text-muted-foreground border-border', icon: '✅' },
    cancelled: { label: 'Cancelled', class: 'bg-destructive/10 text-destructive border-destructive/20', icon: '❌' },
    no_show: { label: 'Skipped', class: 'bg-destructive/10 text-destructive border-destructive/20', icon: '⏭️' },
  };

  const activeBookings = bookings.filter(b => ['waiting', 'calling', 'in_progress'].includes(b.status));
  const pastBookings = bookings.filter(b => !['waiting', 'calling', 'in_progress'].includes(b.status));

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="sticky top-0 z-10 bg-background/70 backdrop-blur-2xl border-b border-border/30">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-bold text-foreground text-lg">My Bookings</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-6">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl p-5 space-y-3 card-glass">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ))
        ) : bookings.length === 0 ? (
          <div className="text-center py-20">
            <Ticket className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-base font-semibold text-muted-foreground">No bookings yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Browse businesses and join a queue</p>
            <Button variant="outline" className="mt-5 rounded-full px-6" onClick={() => navigate('/')}>
              Browse Businesses
            </Button>
          </div>
        ) : (
          <>
            {/* Active bookings */}
            {activeBookings.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Active</h2>
                <AnimatePresence>
                  {activeBookings.map((b, i) => {
                    const cfg = statusConfig[b.status] || statusConfig.waiting;
                    const avgMins = b.businesses?.avg_service_mins || 15;

                    return (
                      <motion.div
                        key={b.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-card card-glass rounded-2xl overflow-hidden"
                      >
                        {/* Token card */}
                        <div className={`${b.status === 'calling' ? 'gradient-success' : 'gradient-primary'} text-primary-foreground p-5`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs font-bold opacity-70 uppercase tracking-wider">{b.businesses?.name}</p>
                              <div className="token-number mt-1">#{b.token_number}</div>
                            </div>
                            <Badge className={`border-none text-[10px] font-bold ${cfg.class}`}>
                              {cfg.icon} {cfg.label}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-4 pt-4 mt-4 border-t border-primary-foreground/15">
                            <div>
                              <p className="text-[10px] opacity-60 font-medium">Position</p>
                              <p className="text-xl font-bold">{b.position}</p>
                            </div>
                            <div>
                              <p className="text-[10px] opacity-60 font-medium">Est. Wait</p>
                              <p className="text-xl font-bold">~{b.position * avgMins}m</p>
                            </div>
                            <div>
                              <p className="text-[10px] opacity-60 font-medium">Service</p>
                              <p className="text-sm font-semibold truncate">{b.services?.name}</p>
                            </div>
                          </div>
                          {b.status === 'waiting' && (
                            <div className="mt-3">
                              <Progress
                                value={Math.max(5, (1 / Math.max(1, b.position)) * 100)}
                                className="h-1.5 bg-primary-foreground/20"
                              />
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="p-4 flex gap-2">
                          {b.status === 'waiting' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => cancelBooking(b.id)}
                              className="text-destructive border-destructive/20 hover:bg-destructive/5 rounded-xl flex-1"
                            >
                              <X className="h-3.5 w-3.5 mr-1.5" />
                              Cancel
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}

            {/* Past bookings */}
            {pastBookings.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">History</h2>
                {pastBookings.map((b) => {
                  const cfg = statusConfig[b.status] || statusConfig.completed;
                  return (
                    <div key={b.id} className="bg-card card-glass rounded-2xl p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-card-foreground text-sm">{b.businesses?.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{b.services?.name} · Token #{b.token_number}</p>
                        </div>
                        <Badge variant="outline" className={`text-[10px] font-semibold ${cfg.class}`}>
                          {cfg.icon} {cfg.label}
                        </Badge>
                      </div>
                      {(b.status === 'no_show' || b.status === 'cancelled') && (
                        <div className="mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/business/${b.businesses?.id || b.business_id}`)}
                            className="rounded-xl"
                          >
                            <RotateCcw className="h-3 w-3 mr-1.5" />
                            Rejoin Queue
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
