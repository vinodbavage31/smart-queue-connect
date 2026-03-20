import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { Loader2, Users, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type AppRole = 'customer' | 'owner';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AppRole>('customer');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const redirectTo = searchParams.get('redirect') || '/home';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        navigate(redirectTo);
      } else {
        await signUp(email, password, fullName, role);
        toast({
          title: 'Account created!',
          description: 'You can now sign in.',
        });
        // Auto sign in after signup
        try {
          await signIn(email, password);
          navigate(redirectTo);
        } catch {
          setIsLogin(true);
        }
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Smart<span className="text-primary">Q</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>I am a</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('customer')}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                      role === 'customer'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    <span className="text-sm font-medium">Customer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('owner')}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                      role === 'owner'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    <Building2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Business</span>
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLogin ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary font-medium hover:underline"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
