import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Users, MapPin, Loader2, Check, LogIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

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
  const [tokenInfo, setTokenInfo] = useState<{ token: number; position: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchData();
  }, [id]);

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
    setLoading(false);
  };

  const handleJoinQueue = async () => {
    // If not authenticated, redirect to auth with return URL
    if (!user) {
      navigate(`/auth?redirect=/business/${id}`);
      return;
    }

    if (!selectedService || !business) return;
    setJoining(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: lastToken } = await supabase
        .from('bookings')
        .select('token_number')
        .eq('business_id', business.id)
        .gte('created_at', today)
        .order('token_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextToken = (lastToken?.token_number || 0) + 1;

      const { count } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .eq('status', 'waiting');

      const position = (count || 0) + 1;

      const { error } = await supabase.from('bookings').insert({
        user_id: user.id,
        business_id: business.id,
        service_id: selectedService,
        token_number: nextToken,
        position: position,
        status: 'waiting',
      });

      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Queue Joined!',
        message: `You joined the queue at ${business.name}. Token #${nextToken}, position ${position}.`,
        type: 'confirmation',
      });

      setTokenInfo({ token: nextToken, position });
      setJoined(true);
      setQueueCount(prev => prev + 1);

      toast({ title: 'Queue joined!', description: `Your token number is #${nextToken}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-foreground truncate">{business.name}</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-6">
        {/* Business Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-1 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-success pulse-live" />
              Open Now
            </span>
            {business.category && (
              <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full">
                {business.category}
              </span>
            )}
          </div>
          {business.address && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {business.address}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card card-outline rounded-lg p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> Queue Length
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">{queueCount}</p>
            </div>
            <div className="bg-card card-outline rounded-lg p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Est. Wait
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">~{estimatedWait}m</p>
            </div>
          </div>
        </div>

        {/* Token Card (after joining) */}
        {joined && tokenInfo && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="gradient-primary text-primary-foreground p-6 rounded-2xl shadow-lg"
          >
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium opacity-80 uppercase tracking-wider">Your Token</span>
              <span className="bg-primary-foreground/20 px-2 py-1 rounded text-xs">Live Update</span>
            </div>
            <div className="token-number mt-2">#{tokenInfo.token}</div>
            <div className="grid grid-cols-2 gap-4 pt-4 mt-4 border-t border-primary-foreground/10">
              <div>
                <p className="text-xs opacity-70">Position</p>
                <p className="text-xl font-semibold">{tokenInfo.position}</p>
              </div>
              <div>
                <p className="text-xs opacity-70">Est. Wait</p>
                <p className="text-xl font-semibold">~{tokenInfo.position * business.avg_service_mins}m</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Services */}
        {!joined && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Select Service
            </h2>
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No services available</p>
            ) : (
              <div className="space-y-2">
                {services.map(svc => (
                  <button
                    key={svc.id}
                    onClick={() => setSelectedService(svc.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      selectedService === svc.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border bg-card hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-card-foreground">{svc.name}</h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{svc.duration_mins} min</span>
                          {svc.price && <span>• ${Number(svc.price).toFixed(2)}</span>}
                        </div>
                      </div>
                      {selectedService === svc.id && (
                        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!user ? (
              <Button
                onClick={() => navigate(`/auth?redirect=/business/${id}`)}
                className="w-full h-12 text-base font-semibold"
              >
                <LogIn className="mr-2 h-4 w-4" />
                Sign In to Join Queue
              </Button>
            ) : (
              <Button
                onClick={handleJoinQueue}
                disabled={!selectedService || joining}
                className="w-full h-12 text-base font-semibold"
              >
                {joining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Join Queue
              </Button>
            )}
          </div>
        )}

        {joined && (
          <Button
            variant="outline"
            onClick={() => navigate('/my-bookings')}
            className="w-full"
          >
            View My Bookings
          </Button>
        )}
      </div>
    </div>
  );
}
