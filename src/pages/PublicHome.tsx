import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Clock, Users, ChevronRight, LogIn, Navigation, Zap, TrendingUp, Timer, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BusinessWithQueue {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  avg_service_mins: number;
  is_open: boolean;
  is_queue_paused: boolean;
  max_queue_size: number;
  latitude: number | null;
  longitude: number | null;
  queue_count: number;
  estimated_wait: number;
  distance: number | null;
  services: { name: string; duration_mins: number; price: number | null }[];
}

const CATEGORIES = ['All', 'Barber Shop', 'Salon', 'Clinic', 'Restaurant', 'Car Service'];
const PAGE_SIZE = 10;

type SortMode = 'nearest' | 'fastest' | 'popular';

export default function PublicHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<BusinessWithQueue[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('nearest');

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  useEffect(() => { fetchBusinesses(0, true); }, []);

  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const fetchBusinesses = async (pageNum: number, reset = false) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: bizData } = await supabase
      .from('businesses')
      .select('id, name, category, address, avg_service_mins, is_open, is_queue_paused, max_queue_size, latitude, longitude')
      .eq('is_open', true)
      .range(from, to);

    if (bizData) {
      setHasMore(bizData.length === PAGE_SIZE);
      const withDetails = await Promise.all(
        bizData.map(async (biz) => {
          const [countRes, svcRes] = await Promise.all([
            supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('business_id', biz.id).eq('status', 'waiting'),
            supabase.from('services').select('name, duration_mins, price').eq('business_id', biz.id).eq('is_active', true).limit(5),
          ]);
          const dist = userLoc && biz.latitude && biz.longitude
            ? haversineDistance(userLoc.lat, userLoc.lng, biz.latitude, biz.longitude)
            : null;
          return {
            ...biz,
            is_queue_paused: biz.is_queue_paused ?? false,
            max_queue_size: biz.max_queue_size ?? 50,
            queue_count: countRes.count || 0,
            estimated_wait: (countRes.count || 0) * biz.avg_service_mins,
            distance: dist,
            services: svcRes.data || [],
          };
        })
      );
      if (reset) setBusinesses(withDetails); else setBusinesses(prev => [...prev, ...withDetails]);
      setPage(pageNum);
    }
    setLoading(false);
    setLoadingMore(false);
  };

  const getStatusInfo = (biz: BusinessWithQueue) => {
    if (biz.is_queue_paused) return { label: 'Paused', class: 'status-busy', emoji: '⏸️' };
    const ratio = biz.queue_count / biz.max_queue_size;
    if (ratio >= 1) return { label: 'Full', class: 'status-full', emoji: '🔴' };
    if (ratio >= 0.7) return { label: 'Busy', class: 'status-busy', emoji: '🟡' };
    return { label: 'Available', class: 'status-available', emoji: '🟢' };
  };

  const getSlotsLeft = (biz: BusinessWithQueue) => biz.max_queue_size - biz.queue_count;

  const filtered = businesses
    .filter(b => {
      const matchSearch = b.name.toLowerCase().includes(search.toLowerCase()) ||
        (b.category && b.category.toLowerCase().includes(search.toLowerCase()));
      const matchCat = category === 'All' || (b.category && b.category.toLowerCase() === category.toLowerCase());
      return matchSearch && matchCat;
    })
    .sort((a, b) => {
      if (sortMode === 'nearest' && a.distance !== null && b.distance !== null) return a.distance - b.distance;
      if (sortMode === 'fastest') return a.estimated_wait - b.estimated_wait;
      if (sortMode === 'popular') return b.queue_count - a.queue_count;
      return 0;
    });

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/70 backdrop-blur-2xl border-b border-border/30">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-foreground tracking-tight">
            Smart<span className="text-primary">Q</span>
          </h1>
          {!user ? (
            <Button size="sm" className="gradient-primary text-primary-foreground rounded-full px-4 shadow-lg shadow-primary/20" onClick={() => navigate('/auth')}>
              <LogIn className="h-3.5 w-3.5 mr-1.5" />
              Sign In
            </Button>
          ) : (
            <Button size="sm" variant="secondary" className="rounded-full" onClick={() => navigate('/home')}>
              Dashboard
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="gradient-hero text-primary-foreground rounded-3xl p-6 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_70%)]" />
          <div className="relative z-10">
            <h2 className="text-2xl font-extrabold leading-tight">Skip the Wait,<br />Join Instantly</h2>
            <p className="text-sm opacity-80 mt-2">Browse businesses near you and join queues remotely</p>
            {userLoc && (
              <div className="inline-flex items-center gap-1.5 mt-3 text-xs bg-primary-foreground/15 backdrop-blur-sm rounded-full px-3 py-1.5">
                <Navigation className="h-3 w-3" /> Location detected
              </div>
            )}
          </div>
        </motion.div>

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

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`shrink-0 text-xs font-semibold px-4 py-2 rounded-full transition-all duration-200 ${
                category === cat
                  ? 'gradient-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'bg-card text-muted-foreground border border-border/50 hover:border-primary/30 hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sort pills */}
        <div className="flex gap-2">
          {([
            { key: 'nearest' as SortMode, icon: Navigation, label: 'Nearest' },
            { key: 'fastest' as SortMode, icon: Timer, label: 'Fastest' },
            { key: 'popular' as SortMode, icon: TrendingUp, label: 'Popular' },
          ]).map(s => (
            <button
              key={s.key}
              onClick={() => setSortMode(s.key)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                sortMode === s.key
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <s.icon className="h-3 w-3" />
              {s.label}
            </button>
          ))}
        </div>

        {/* Results header */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            {category === 'All' ? 'All Businesses' : category}
          </p>
          <span className="text-xs text-muted-foreground">{filtered.length} found</span>
        </div>

        {/* Business cards */}
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card rounded-2xl p-5 space-y-3 card-glass">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24" />
                <div className="flex gap-4">
                  <Skeleton className="h-10 w-20" />
                  <Skeleton className="h-10 w-20" />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <MapPin className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">No businesses found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Try a different search or category</p>
            </div>
          ) : (
            <AnimatePresence>
              {filtered.map((biz, i) => {
                const status = getStatusInfo(biz);
                const slotsLeft = getSlotsLeft(biz);
                const isUrgent = slotsLeft <= 3 && slotsLeft > 0;

                return (
                  <motion.div
                    key={biz.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                  >
                    <button
                      onClick={() => navigate(`/business/${biz.id}`)}
                      className="w-full text-left p-5 bg-card card-glass rounded-2xl hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2.5 flex-1 min-w-0">
                          {/* Title row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-card-foreground text-base">{biz.name}</h3>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${status.class}`}>
                              {status.emoji} {status.label}
                            </span>
                          </div>

                          {/* Category + distance */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {biz.category && (
                              <span className="text-xs bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full font-medium">
                                {biz.category}
                              </span>
                            )}
                            {biz.distance !== null && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                <Navigation className="h-2.5 w-2.5" />
                                {biz.distance < 1 ? `${Math.round(biz.distance * 1000)}m` : `${biz.distance.toFixed(1)}km`}
                              </span>
                            )}
                          </div>

                          {/* Stats row */}
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Users className="h-3.5 w-3.5" />
                              <span className="font-semibold text-foreground">{biz.queue_count}</span> in queue
                            </div>
                            <div className="flex items-center gap-1.5 text-xs">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-bold text-foreground text-sm">~{biz.estimated_wait}m</span>
                              <span className="text-muted-foreground">wait</span>
                            </div>
                          </div>

                          {/* Urgency / social proof badges */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {isUrgent && (
                              <span className="urgency-badge bg-destructive/10 text-destructive flex items-center gap-1">
                                <Zap className="h-2.5 w-2.5" /> Only {slotsLeft} slots left
                              </span>
                            )}
                            {biz.queue_count >= 5 && (
                              <span className="urgency-badge bg-warning/10 text-warning flex items-center gap-1">
                                <Flame className="h-2.5 w-2.5" /> Popular right now
                              </span>
                            )}
                            {biz.estimated_wait <= 10 && biz.estimated_wait > 0 && (
                              <span className="urgency-badge bg-success/10 text-success flex items-center gap-1">
                                <Timer className="h-2.5 w-2.5" /> Quick wait
                              </span>
                            )}
                          </div>

                          {/* Services preview */}
                          {biz.services.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {biz.services.slice(0, 3).map((svc, idx) => (
                                <span key={idx} className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                  {svc.name}{svc.price ? ` · $${Number(svc.price).toFixed(0)}` : ''}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                          <div className="gradient-primary text-primary-foreground text-[10px] font-bold px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            Join Queue →
                          </div>
                        </div>
                      </div>
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}

          {hasMore && !loading && filtered.length > 0 && (
            <div className="text-center pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchBusinesses(page + 1)}
                disabled={loadingMore}
                className="rounded-full px-6"
              >
                {loadingMore ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" /> : null}
                Load More
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
