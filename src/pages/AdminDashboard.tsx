import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Check, X, Clock, Loader2, LogOut, MapPin, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

export default function AdminDashboard() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const fetchBusinesses = async () => {
    setLoading(true);
    const { data: bizData } = await supabase
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (bizData) {
      // Fetch owner profiles
      const ownerIds = [...new Set(bizData.map(b => b.owner_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ownerIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
      const enriched = bizData.map(b => ({
        ...b,
        owner_name: profileMap.get(b.owner_id) || 'Unknown',
      }));
      setBusinesses(enriched);
    }
    setLoading(false);
  };

  const updateStatus = async (bizId: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('businesses')
      .update({ status })
      .eq('id', bizId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `Business ${status}!` });
      fetchBusinesses();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10">Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="text-success border-success/30 bg-success/10">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredBiz = businesses.filter(b => {
    if (activeTab === 'all') return true;
    return b.status === activeTab;
  });

  const pendingCount = businesses.filter(b => b.status === 'pending').length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <h1 className="font-bold text-foreground">Admin Panel</h1>
              <p className="text-xs text-muted-foreground">Business Management</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => signOut().then(() => navigate('/auth'))}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card card-outline rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{businesses.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
          </div>
          <div className="bg-card card-outline rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-warning">{pendingCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending</p>
          </div>
          <div className="bg-card card-outline rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-success">{businesses.filter(b => b.status === 'approved').length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Approved</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="pending" className="flex-1">
              Pending {pendingCount > 0 && `(${pendingCount})`}
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex-1">Approved</TabsTrigger>
            <TabsTrigger value="rejected" className="flex-1">Rejected</TabsTrigger>
            <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4 space-y-3">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredBiz.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No {activeTab} businesses</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredBiz.map((biz) => (
                  <motion.div
                    key={biz.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    className="bg-card card-outline rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-card-foreground">{biz.name}</h3>
                          {getStatusBadge(biz.status)}
                        </div>
                        {biz.category && (
                          <p className="text-xs text-muted-foreground">{biz.category}</p>
                        )}
                        {biz.address && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {biz.address}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Owner: {biz.profiles?.full_name || 'Unknown'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Registered: {new Date(biz.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {biz.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => updateStatus(biz.id, 'approved')}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          onClick={() => updateStatus(biz.id, 'rejected')}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}

                    {biz.status === 'rejected' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(biz.id, 'approved')}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    )}

                    {biz.status === 'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => updateStatus(biz.id, 'rejected')}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
