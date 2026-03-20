import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Clock, Users, ChevronRight, Bell, User, Loader2, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BusinessWithQueue {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  avg_service_mins: number;
  is_open: boolean;
  is_queue_paused: boolean | null;
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

    // Poll for unread notifications
    const interval = setInterval(fetchUnreadNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchBusinesses = async () => {
    setLoading(true);
    const { data: bizData } = await supabase
      .from('businesses')
      .select('id, name, category, address, avg_service_mins, is_open, is_queue_paused')
      .eq('is_open', true);

    if (bizData) {
      const withQueue = await Promise.all(
        bizData.map(async (biz) => {
          const { count } = await supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', biz.id)
            .eq('status', 'waiting');
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
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setUnreadCount(count || 0);
  };

  const filtered = businesses.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    (b.category && b.category.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-foreground">
            Smart<span className="text-primary">Q</span>
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative" onClick={() => navigate('/notifications')}>
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium">
                  {unreadCount}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
              <User className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search businesses..."
            className="pl-10"
          />
        </div>

        <ActiveBookingBanner />

        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Nearby Businesses
          </h2>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No businesses found</p>
            </div>
          ) : (
            <AnimatePresence>
              {filtered.map((biz, i) => (
                <motion.div
                  key={biz.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <button
                    onClick={() => navigate(`/business/${biz.id}`)}
                    className="w-full text-left p-4 bg-card card-outline rounded-xl hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-card-foreground">{biz.name}</h3>
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-success pulse-live" />
                            Open
                          </span>
                          {biz.is_queue_paused && (
                            <Badge variant="outline" className="text-[10px] text-warning border-warning/30">Paused</Badge>
                          )}
                        </div>
                        {biz.category && (
                          <p className="text-xs text-muted-foreground">{biz.category}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {biz.queue_count} in queue
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            ~{biz.estimated_wait} min wait
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border/50 z-20">
        <div className="max-w-lg mx-auto flex">
          <button onClick={() => navigate('/home')} className="flex-1 py-3 flex flex-col items-center gap-1 text-primary">
            <MapPin className="h-5 w-5" />
            <span className="text-[10px] font-medium">Explore</span>
          </button>
          <button onClick={() => navigate('/my-bookings')} className="flex-1 py-3 flex flex-col items-center gap-1 text-muted-foreground">
            <Clock className="h-5 w-5" />
            <span className="text-[10px] font-medium">My Queue</span>
          </button>
          <button onClick={() => navigate('/notifications')} className="flex-1 py-3 flex flex-col items-center gap-1 text-muted-foreground relative">
            <Bell className="h-5 w-5" />
            <span className="text-[10px] font-medium">Alerts</span>
            {unreadCount > 0 && (
              <span className="absolute top-2 right-1/4 h-2 w-2 rounded-full bg-destructive" />
            )}
          </button>
          <button onClick={() => navigate('/profile')} className="flex-1 py-3 flex flex-col items-center gap-1 text-muted-foreground">
            <User className="h-5 w-5" />
            <span className="text-[10px] font-medium">Profile</span>
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
        .select('*, businesses(name)')
        .eq('user_id', user.id)
        .in('status', ['waiting', 'calling', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setBooking(data);
    };
    fetch();

    // Realtime for active booking
    const channel = supabase
      .channel('active-booking-banner')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `user_id=eq.${user.id}`,
      }, () => fetch())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (!booking) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="gradient-primary text-primary-foreground p-4 rounded-xl cursor-pointer"
      onClick={() => navigate('/my-bookings')}
    >
      <div className="flex justify-between items-start">
        <span className="text-xs font-medium opacity-80 uppercase tracking-wider">Your Token</span>
        <Badge
          variant="outline"
          className={`text-[10px] border-primary-foreground/30 text-primary-foreground ${
            booking.status === 'calling' ? 'animate-pulse' : ''
          }`}
        >
          {booking.status === 'calling' ? '🔔 Your Turn!' : booking.status === 'in_progress' ? 'In Service' : 'Live'}
        </Badge>
      </div>
      <div className="token-number mt-1">#{booking.token_number}</div>
      <div className="grid grid-cols-2 gap-4 pt-3 mt-3 border-t border-primary-foreground/10">
        <div>
          <p className="text-[10px] opacity-70">Position</p>
          <p className="text-lg font-semibold">{booking.position}</p>
        </div>
        <div>
          <p className="text-[10px] opacity-70">Business</p>
          <p className="text-sm font-medium truncate">{booking.businesses?.name}</p>
        </div>
      </div>
    </motion.div>
  );
}
