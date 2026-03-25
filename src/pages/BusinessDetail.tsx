import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Users, MapPin, Loader2, Check, LogIn, AlertCircle, Navigation, Zap, Timer, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

type Service = Tables<'services'>;
type Business = Tables<'businesses'>;

export default function BusinessDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [queueCount, setQueueCount] = useState(0);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{ token: number; position: number; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasActiveBooking, setHasActiveBooking] = useState(false);
  const [confirmedOnWay, setConfirmedOnWay] = useState(false);

  const refreshUserBooking = useCallback(async () => {
    if (!user || !id) return;
    const { data: myBooking } = await supabase
      .from('bookings').select('token_number, position, status')
      .eq('business_id', id).eq('user_id', user.id)
      .in('status', ['waiting', 'calling', 'in_progress'])
      .maybeSingle();
    if (myBooking) {
      setTokenInfo({ token: myBooking.token_number, position: myBooking.position, status: myBooking.status });
      setJoined(true);
      setHasActiveBooking(true);
    } else {
      setJoined(false); setTokenInfo(null); setHasActiveBooking(false);
    }
  }, [user, id]);

  const refreshQueueCount = useCallback(async () => {
    if (!id) return;
    const { count } = await supabase
      .from('bookings').select('*', { count: 'exact', head: true })
      .eq('business_id', id).eq('status', 'waiting');
    setQueueCount(count || 0);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchData();
  }, [id, user]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`queue-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `business_id=eq.${id}` }, () => {
        refreshQueueCount();
        refreshUserBooking();
      })
      .subscribe();
    const interval = setInterval(() => {
      refreshQueueCount();
      if (user && joined) refreshUserBooking();
    }, 5000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, [id, user, joined, refreshQueueCount, refreshUserBooking]);

  const fetchData = async () => {
    setLoading(true);
    const [bizRes, svcRes, countRes] = await Promise.all([
      supabase.from('businesses').select('*').eq('id', id!).single(),
      supabase.from('services').select('*').eq('business_id', id!).eq('is_active', true),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('business_id', id!).eq('status', 'waiting'),
    ]);
    if (bizRes.data) setBusiness(bizRes.data);
    if (svcRes.data) setServices(svcRes.data);
    setQueueCount(countRes.count || 0);
    if (user) await refreshUserBooking();
    setLoading(false);
  };

  const handleJoinQueue = async () => {
    if (!user) { navigate(`/auth?redirect=/business/${id}`); return; }
    if (!selectedService || !business) return;
    setJoining(true);
    try {
      if (business.max_queue_size && queueCount >= business.max_queue_size) {
        toast({ title: 'Queue Full', description: 'Try again later.', variant: 'destructive' });
        setJoining(false); return;
      }
      if (business.is_queue_paused) {
        toast({ title: 'Queue Paused', description: 'Check back later.', variant: 'destructive' });
        setJoining(false); return;
      }
      const today = new Date().toISOString().split('T')[0];
      const { data: lastToken } = await supabase
        .from('bookings').select('token_number').eq('business_id', business.id)
        .gte('created_at', today).order('token_number', { ascending: false }).limit(1).maybeSingle();
      const nextToken = (lastToken?.token_number || 0) + 1;
      const { count } = await supabase
        .from('bookings').select('*', { count: 'exact', head: true })
        .eq('business_id', business.id).in('status', ['waiting', 'calling']);
      const position = (count || 0) + 1;
      const bookingPayload: TablesInsert<'bookings'> = {
        user_id: user.id, business_id: business.id, service_id: selectedService,
        token_number: nextToken, position, status: 'waiting',
      };
      const { data: insertedBooking, error } = await supabase
        .from('bookings').insert(bookingPayload).select('id, business_id, status, token_number, position').single();
      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Already in Queue', description: 'You have an active booking here.', variant: 'destructive' });
          setHasActiveBooking(true);
        } else throw error;
        setJoining(false); return;
      }
      await supabase.from('notifications').insert({
        user_id: user.id, title: 'Your slot is confirmed!',
        message: `Token #${nextToken} at ${business.name}. Position: ${position}. Est. wait: ~${position * business.avg_service_mins} min.`,
        type: 'confirmation',
      });
      const eta = position * business.avg_service_mins;
      if (eta <= 10) {
        await supabase.from('notifications').insert({
          user_id: user.id, title: "You're close to your turn!",
          message: `Estimated wait is only ~${eta} min at ${business.name}. Please be ready.`,
          type: 'reminder',
        });
      }
      setTokenInfo({ token: nextToken, position, status: 'waiting' });
      setJoined(true); setHasActiveBooking(true);
      await Promise.all([refreshQueueCount(), refreshUserBooking()]);
      toast({ title: 'Queue joined!', description: `Your token is #${nextToken}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setJoining(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Business not found</p>
      </div>
    );
  }

  const estimatedWait = queueCount * business.avg_service_mins;
  const isQueuePaused = business.is_queue_paused;
  const isQueueFull = business.max_queue_size ? queueCount >= business.max_queue_size : false;
  const maxQ = business.max_queue_size || 50;
  const slotsLeft = maxQ - queueCount;

  const statusColor = isQueueFull ? 'status-full' : (queueCount / maxQ >= 0.7) ? 'status-busy' : 'status-available';
  const statusLabel = isQueueFull ? '🔴 Full' : (queueCount / maxQ >= 0.7) ? '🟡 Busy' : '🟢 Available';

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/70 backdrop-blur-2xl border-b border-border/30">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-foreground truncate">{business.name}</h1>
            {business.category && <p className="text-xs text-muted-foreground">{business.category}</p>}
          </div>
          <span className={`inline-flex items-center text-[10px] font-semibold px-2.5 py-1 rounded-full border ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {/* Hero banner */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="gradient-hero text-primary-foreground rounded-2xl p-6 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_60%)]" />
          <div className="relative z-10 grid grid-cols-3 gap-4 text-center">
            <div>
              <Users className="h-5 w-5 mx-auto opacity-70" />
              <p className="text-3xl font-extrabold mt-1">{queueCount}</p>
              <p className="text-[10px] opacity-70 font-medium">In Queue</p>
            </div>
            <div>
              <Clock className="h-5 w-5 mx-auto opacity-70" />
              <p className="text-3xl font-extrabold mt-1">~{estimatedWait}m</p>
              <p className="text-[10px] opacity-70 font-medium">Est. Wait</p>
            </div>
            <div>
              <Timer className="h-5 w-5 mx-auto opacity-70" />
              <p className="text-3xl font-extrabold mt-1">{business.avg_service_mins}m</p>
              <p className="text-[10px] opacity-70 font-medium">Avg Service</p>
            </div>
          </div>
          {slotsLeft <= 5 && slotsLeft > 0 && (
            <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-bold bg-primary-foreground/15 rounded-full py-1.5 px-3">
              <Zap className="h-3 w-3" /> Only {slotsLeft} slots left — join now!
            </div>
          )}
        </motion.div>

        {/* Queue capacity bar */}
        {queueCount > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground font-medium">
              <span>Queue capacity</span>
              <span>{queueCount}/{maxQ}</span>
            </div>
            <Progress value={(queueCount / maxQ) * 100} className="h-2" />
          </div>
        )}

        {business.address && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card card-glass rounded-xl p-3">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <span>{business.address}</span>
          </div>
        )}

        {/* Token Card — if joined */}
        {joined && tokenInfo && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={`${tokenInfo.status === 'calling' ? 'gradient-success' : 'gradient-primary'} text-primary-foreground p-6 rounded-2xl shadow-xl shadow-primary/20`}
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold opacity-70 uppercase tracking-wider">Your Token</span>
              {tokenInfo.status === 'calling' ? (
                <Badge className="bg-primary-foreground/20 text-primary-foreground border-none animate-pulse text-xs font-bold">🔔 Your Turn!</Badge>
              ) : tokenInfo.status === 'in_progress' ? (
                <Badge className="bg-primary-foreground/20 text-primary-foreground border-none text-xs font-bold">⚡ In Service</Badge>
              ) : (
                <Badge className="bg-primary-foreground/20 text-primary-foreground border-none text-xs font-bold">⏳ Waiting</Badge>
              )}
            </div>
            <div className="token-number mt-2">#{tokenInfo.token}</div>
            <div className="grid grid-cols-3 gap-4 pt-4 mt-4 border-t border-primary-foreground/15">
              <div>
                <p className="text-[10px] opacity-60 font-medium">Position</p>
                <p className="text-2xl font-bold">{tokenInfo.position}</p>
              </div>
              <div>
                <p className="text-[10px] opacity-60 font-medium">Ahead</p>
                <p className="text-2xl font-bold">{Math.max(0, tokenInfo.position - 1)}</p>
              </div>
              <div>
                <p className="text-[10px] opacity-60 font-medium">Est. Wait</p>
                <p className="text-2xl font-bold">~{tokenInfo.position * business.avg_service_mins}m</p>
              </div>
            </div>
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-[10px] opacity-60">
                <span>Queue progress</span>
              </div>
              <Progress
                value={Math.max(5, ((queueCount - tokenInfo.position + 1) / Math.max(1, queueCount)) * 100)}
                className="h-2 bg-primary-foreground/20"
              />
            </div>
          </motion.div>
        )}

        {/* "I'm on my way" button */}
        {joined && tokenInfo && tokenInfo.position <= 5 && !confirmedOnWay && (
          <Button
            onClick={() => { setConfirmedOnWay(true); toast({ title: "Confirmed!", description: "The business knows you're on your way." }); }}
            className="w-full h-12 rounded-xl gradient-success text-success-foreground font-semibold shadow-lg shadow-success/20"
          >
            <Navigation className="mr-2 h-4 w-4" />
            I'm on my way!
          </Button>
        )}

        {/* Services selection */}
        {!joined && !hasActiveBooking && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Select Service</h2>
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No services available</p>
            ) : (
              <div className="space-y-2">
                {services.map(svc => (
                  <motion.button
                    key={svc.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedService(svc.id)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
                      selectedService === svc.id
                        ? 'border-primary bg-accent shadow-md shadow-primary/10'
                        : 'border-border/50 bg-card hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-card-foreground">{svc.name}</h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{svc.duration_mins} min</span>
                          {svc.price && <><span>·</span><span className="font-semibold text-foreground">${Number(svc.price).toFixed(2)}</span></>}
                        </div>
                      </div>
                      {selectedService === svc.id && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="h-6 w-6 rounded-full gradient-primary flex items-center justify-center"
                        >
                          <Check className="h-3.5 w-3.5 text-primary-foreground" />
                        </motion.div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        )}

        {hasActiveBooking && !joined && (
          <Alert className="rounded-xl"><AlertCircle className="h-4 w-4" /><AlertDescription>You already have an active queue here.</AlertDescription></Alert>
        )}

        {joined && (
          <Button variant="outline" onClick={() => navigate('/my-bookings')} className="w-full rounded-xl h-12">
            View My Bookings
          </Button>
        )}
      </div>

      {/* Sticky bottom CTA */}
      {!joined && !hasActiveBooking && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-2xl border-t border-border/30 p-4 z-20">
          <div className="max-w-lg mx-auto">
            {isQueueFull ? (
              <Button disabled className="w-full h-14 rounded-2xl text-base font-bold">Queue is Full</Button>
            ) : isQueuePaused ? (
              <Button disabled className="w-full h-14 rounded-2xl text-base font-bold">Queue Paused</Button>
            ) : !user ? (
              <Button onClick={() => navigate(`/auth?redirect=/business/${id}`)} className="w-full h-14 rounded-2xl gradient-primary text-primary-foreground text-base font-bold shadow-xl shadow-primary/25">
                <LogIn className="mr-2 h-5 w-5" />
                Sign In to Join Queue
              </Button>
            ) : (
              <Button
                onClick={handleJoinQueue}
                disabled={!selectedService || joining}
                className="w-full h-14 rounded-2xl gradient-primary text-primary-foreground text-base font-bold shadow-xl shadow-primary/25 disabled:opacity-50"
              >
                {joining ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Zap className="mr-2 h-5 w-5" />}
                Join Queue Now
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
