import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Clock, Users, ChevronRight, Bell, User, Navigation, Zap, Flame, Timer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BusinessWithQueue {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  avg_service_mins: number;
  is_open: boolean;
  is_queue_paused: boolean | null;
  max_queue_size: number | null;
  queue_count: number;
  estimated_wait: number;
}

export default function CustomerHome() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<BusinessWithQueue[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchBusinesses();
    fetchUnreadNotifications();
    const interval = setInterval(fetchUnreadNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchBusinesses = async () => {
    setLoading(true);
    const { data: bizData } = await supabase
      .from('businesses')
      .select('id, name, category, address, avg_service_mins, is_open, is_queue_paused, max_queue_size')
      .eq('is_open', true);

    if (bizData) {
      const withQueue = await Promise.all(
        bizData.map(async (biz) => {
          const { count } = await supabase
            .from('bookings').select('*', { count: 'exact', head: true })
            .eq('business_id', biz.id).eq('status', 'waiting');
          return {
            ...biz,
            queue_count: count || 0,
            estimated_wait: (count || 0) * biz.avg_service_mins,
          };
        })
      );
      setBusinesses(withQueue);
    }
    setLoading(false);
  };

  const fetchUnreadNotifications = async () => {
    if (!user) return;
    const { count } = await supabase
      .from('notifications').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('is_read', false);
    setUnreadCount(count || 0);
  };

  const getStatusInfo = (biz: BusinessWithQueue) => {
    if (biz.is_queue_paused) return { label: 'Paused', class: 'status-busy', emoji: '⏸️' };
    const maxQ = biz.max_queue_size || 50;
    const ratio = biz.queue_count / maxQ;
    if (ratio >= 1) return { label: 'Full', class: 'status-full', emoji: '🔴' };
    if (ratio >= 0.7) return { label: 'Busy', class: 'status-busy', emoji: '🟡' };
    return { label: 'Available', class: 'status-available', emoji: '🟢' };
  };

  const filtered = businesses.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    (b.category && b.category.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/70 backdrop-blur-2xl border-b border-border/30">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-foreground tracking-tight">
            Smart<span className="text-primary">Q</span>
          </h1>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="relative rounded-full" onClick={() => navigate('/notifications')}>
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4.5 w-4.5 rounded-full gradient-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold min-w-[18px] h-[18px]">
                  {unreadCount}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate('/profile')}>
              <User className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search businesses..."
            className="pl-11 h-12 rounded-2xl bg-card border-border/50 shadow-sm"
          />
        </div>

        {/* Active booking banner */}
        <ActiveBookingBanner />

        {/* Business list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Nearby</h2>
            <span className="text-xs text-muted-foreground">{filtered.length} businesses</span>
          </div>

          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card rounded-2xl p-5 space-y-3 card-glass">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24" />
                <div className="flex gap-4"><Skeleton className="h-10 w-20" /><Skeleton className="h-10 w-20" /></div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <MapPin className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">No businesses found</p>
            </div>
          ) : (
            <AnimatePresence>
              {filtered.map((biz, i) => {
                const status = getStatusInfo(biz);
                const maxQ = biz.max_queue_size || 50;
                const slotsLeft = maxQ - biz.queue_count;
                const isUrgent = slotsLeft <= 3 && slotsLeft > 0;

                return (
                  <motion.div
                    key={biz.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <button
                      onClick={() => navigate(`/business/${biz.id}`)}
                      className="w-full text-left p-5 bg-card card-glass rounded-2xl hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-card-foreground text-base">{biz.name}</h3>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${status.class}`}>
                              {status.emoji} {status.label}
                            </span>
                          </div>
                          {biz.category && (
                            <span className="text-xs bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full font-medium inline-block">
                              {biz.category}
                            </span>
                          )}
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Users className="h-3.5 w-3.5" />
                              <span className="font-semibold text-foreground">{biz.queue_count}</span> in queue
                            </div>
                            <div className="flex items-center gap-1.5 text-xs">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-bold text-foreground text-sm">~{biz.estimated_wait}m</span>
                            </div>
                          </div>
                          {isUrgent && (
                            <span className="urgency-badge bg-destructive/10 text-destructive inline-flex items-center gap-1">
                              <Zap className="h-2.5 w-2.5" /> Only {slotsLeft} slots left
                            </span>
                          )}
                          {biz.queue_count >= 5 && (
                            <span className="urgency-badge bg-warning/10 text-warning inline-flex items-center gap-1 ml-1">
                              <Flame className="h-2.5 w-2.5" /> Popular
                            </span>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary transition-colors mt-1 shrink-0" />
                      </div>
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-2xl border-t border-border/30 z-20 safe-area-pb">
        <div className="max-w-lg mx-auto flex">
          <button onClick={() => navigate('/home')} className="bottom-nav-item bottom-nav-active">
            <MapPin className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Explore</span>
          </button>
          <button onClick={() => navigate('/my-bookings')} className="bottom-nav-item bottom-nav-inactive">
            <Clock className="h-5 w-5" />
            <span className="text-[10px] font-semibold">My Queue</span>
          </button>
          <button onClick={() => navigate('/notifications')} className="bottom-nav-item bottom-nav-inactive relative">
            <Bell className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Alerts</span>
            {unreadCount > 0 && <span className="absolute top-1.5 right-1/4 h-2 w-2 rounded-full bg-destructive" />}
          </button>
          <button onClick={() => navigate('/profile')} className="bottom-nav-item bottom-nav-inactive">
            <User className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

function ActiveBookingBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('bookings')
        .select('*, businesses(name, avg_service_mins)')
        .eq('user_id', user.id)
        .in('status', ['waiting', 'calling', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setBooking(data);
    };
    fetch();

    const channel = supabase
      .channel('active-booking-banner')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `user_id=eq.${user.id}` }, () => fetch())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (!booking) return null;

  const isCalling = booking.status === 'calling';
  const avgMins = booking.businesses?.avg_service_mins || 15;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`${isCalling ? 'gradient-success' : 'gradient-primary'} text-primary-foreground p-5 rounded-2xl cursor-pointer shadow-lg shadow-primary/20`}
      onClick={() => navigate('/my-bookings')}
    >
      <div className="flex justify-between items-start">
        <span className="text-xs font-bold opacity-80 uppercase tracking-wider">Active Queue</span>
        <Badge
          variant="outline"
          className={`text-[10px] border-primary-foreground/30 text-primary-foreground font-bold ${isCalling ? 'animate-pulse' : ''}`}
        >
          {isCalling ? '🔔 Your Turn!' : booking.status === 'in_progress' ? '⚡ In Service' : '⏳ Waiting'}
        </Badge>
      </div>
      <div className="token-number mt-2">#{booking.token_number}</div>
      <div className="grid grid-cols-3 gap-4 pt-4 mt-4 border-t border-primary-foreground/15">
        <div>
          <p className="text-[10px] opacity-60 font-medium">Position</p>
          <p className="text-lg font-bold">{booking.position}</p>
        </div>
        <div>
          <p className="text-[10px] opacity-60 font-medium">Est. Wait</p>
          <p className="text-lg font-bold">~{booking.position * avgMins}m</p>
        </div>
        <div>
          <p className="text-[10px] opacity-60 font-medium">Business</p>
          <p className="text-sm font-semibold truncate">{booking.businesses?.name}</p>
        </div>
      </div>
    </motion.div>
  );
}
