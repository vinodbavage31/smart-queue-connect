import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Clock, Users, ChevronRight, Loader2, LogIn, Navigation, Filter } from 'lucide-react';
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

  // Detect user location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {} // silently fail
      );
    }
  }, []);

  useEffect(() => {
    fetchBusinesses(0, true);
  }, []);

  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const fetchBusinesses = async (pageNum: number, reset = false) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

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
            supabase
              .from('bookings')
              .select('*', { count: 'exact', head: true })
              .eq('business_id', biz.id)
              .eq('status', 'waiting'),
            supabase
              .from('services')
              .select('name, duration_mins, price')
              .eq('business_id', biz.id)
              .eq('is_active', true)
              .limit(5),
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

      if (reset) {
        setBusinesses(withDetails);
      } else {
        setBusinesses(prev => [...prev, ...withDetails]);
      }
      setPage(pageNum);
    }
    setLoading(false);
    setLoadingMore(false);
  };

  const filtered = businesses
    .filter(b => {
      const matchSearch = b.name.toLowerCase().includes(search.toLowerCase()) ||
        (b.category && b.category.toLowerCase().includes(search.toLowerCase()));
      const matchCat = category === 'All' || (b.category && b.category.toLowerCase() === category.toLowerCase());
      return matchSearch && matchCat;
    })
    .sort((a, b) => {
      // Sort by distance if available
      if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
      return 0;
    });

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-foreground">
            Smart<span className="text-primary">Q</span>
          </h1>
          {!user ? (
            <Button size="sm" onClick={() => navigate('/auth')}>
              <LogIn className="h-4 w-4 mr-1.5" />
              Sign In
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => navigate('/home')}>
              Dashboard
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Skip the Wait</h2>
          <p className="text-sm text-muted-foreground">
            Browse businesses near you and join queues remotely
          </p>
          {userLoc && (
            <p className="text-xs text-success flex items-center justify-center gap-1">
              <Navigation className="h-3 w-3" /> Location detected — sorted by distance
            </p>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or category..."
            className="pl-10"
          />
        </div>

        {/* Category filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                category === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/30'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Filter className="h-3 w-3" />
            {category === 'All' ? 'Open Businesses' : category} ({filtered.length})
          </h3>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Loading businesses...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No businesses found</p>
              <p className="text-xs mt-1">Try a different search or category</p>
            </div>
          ) : (
            <AnimatePresence>
              {filtered.map((biz, i) => (
                <motion.div
                  key={biz.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <button
                    onClick={() => navigate(`/business/${biz.id}`)}
                    className="w-full text-left p-4 bg-card card-outline rounded-xl hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-card-foreground">{biz.name}</h3>
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded-full shrink-0">
                            <span className="h-1.5 w-1.5 rounded-full bg-success pulse-live" />
                            Open
                          </span>
                          {biz.is_queue_paused && (
                            <Badge variant="outline" className="text-[10px] text-warning border-warning/30">Paused</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {biz.category && (
                            <span className="inline-block text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                              {biz.category}
                            </span>
                          )}
                          {biz.distance !== null && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Navigation className="h-2.5 w-2.5" />
                              {biz.distance < 1 ? `${Math.round(biz.distance * 1000)}m` : `${biz.distance.toFixed(1)}km`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {biz.queue_count} in queue
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            ~{biz.estimated_wait}m wait
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Avg: {biz.avg_service_mins}m
                          </span>
                        </div>
                        <Progress value={(biz.queue_count / biz.max_queue_size) * 100} className="h-1" />
                        {biz.services.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {biz.services.map((svc, idx) => (
                              <span key={idx} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {svc.name}
                                {svc.price ? ` • $${Number(svc.price).toFixed(0)}` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mt-1 shrink-0" />
                    </div>
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {hasMore && !loading && filtered.length > 0 && (
            <div className="text-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchBusinesses(page + 1)}
                disabled={loadingMore}
              >
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Load More
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
