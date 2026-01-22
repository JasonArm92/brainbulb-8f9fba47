import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, LogIn, UserPlus, Sparkles } from 'lucide-react';
import logoMain from '@/assets/logo-main.png';

export default function AdminAuth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, isAdmin, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate(isAdmin ? '/admin' : '/client');
    }
  }, [user, isAdmin, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signIn(email, password);

      if (error) {
        toast.error(error.message || 'Failed to sign in');
      } else {
        toast.success('Signed in successfully');
        navigate(isAdmin ? '/admin' : '/client');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signUp(email, password, fullName);

      if (error) {
        toast.error(error.message || 'Failed to sign up');
      } else {
        toast.success('Account created successfully');
        navigate('/client');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        toast.error(error.message || 'Failed to sign in with Google');
        setLoading(false);
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Aurora background */}
      <div className="aurora-bg fixed inset-0 pointer-events-none" />
      
      {/* Ambient orbs */}
      <div className="fixed top-[-15%] left-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-br from-primary/20 via-primary-glow/15 to-transparent blur-3xl pointer-events-none" />
      <div className="fixed bottom-[-15%] right-[-10%] w-[45vw] h-[45vw] max-w-[500px] max-h-[500px] rounded-full bg-gradient-to-tl from-accent-cyan/15 via-accent-pink/10 to-transparent blur-3xl pointer-events-none" />
      
      {/* Tech grid */}
      <div className="tech-grid fixed inset-0 pointer-events-none opacity-20" />
      
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-slide-up-premium">
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 bg-gradient-primary blur-[40px] opacity-40 scale-150" />
            <img 
              src={logoMain}
              alt="Brain Bulb" 
              className="h-16 relative z-10 drop-shadow-2xl"
            />
          </div>
          <h1 className="text-2xl font-bold font-display gradient-text mb-2">Welcome Back</h1>
          <p className="text-muted-foreground text-sm">Sign in to access your dashboard</p>
        </div>

        <Tabs defaultValue="signin" className="w-full animate-slide-up-premium stagger-2">
          <TabsList className="glass-card p-1.5 grid grid-cols-2 w-full mb-6 rounded-2xl border border-glass-border shadow-glass">
            <TabsTrigger 
              value="signin"
              className="rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow transition-all duration-300"
            >
              Sign In
            </TabsTrigger>
            <TabsTrigger 
              value="signup"
              className="rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow transition-all duration-300"
            >
              Sign Up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <Card className="glass-card border-glass-border rounded-3xl shadow-premium overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent-cyan/5 pointer-events-none" />
              <CardHeader className="space-y-1 relative z-10">
                <CardTitle className="text-2xl font-bold font-display">
                  <span className="gradient-text">Sign In</span>
                </CardTitle>
                <CardDescription>
                  Enter your credentials to access your account
                </CardDescription>
              </CardHeader>
              <CardContent className="relative z-10">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="glass-card border-glass-border rounded-xl focus:border-primary/50 focus:ring-primary/30 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="glass-card border-glass-border rounded-xl focus:border-primary/50 focus:ring-primary/30 transition-all"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full rounded-xl bg-gradient-primary hover:opacity-90 shadow-glow text-primary-foreground transition-all duration-300 group" 
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <LogIn className="mr-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                        Sign In
                      </>
                    )}
                  </Button>

                  <div className="relative my-6">
                    <Separator className="bg-glass-border" />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground rounded-full">
                      OR
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="glass"
                    className="w-full rounded-xl group"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                  >
                    <svg className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signup">
            <Card className="glass-card border-glass-border rounded-3xl shadow-premium overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/5 via-transparent to-primary/5 pointer-events-none" />
              <CardHeader className="space-y-1 relative z-10">
                <CardTitle className="text-2xl font-bold font-display">
                  <span className="gradient-text">Create Account</span>
                </CardTitle>
                <CardDescription>
                  Enter your information to create a new account
                </CardDescription>
              </CardHeader>
              <CardContent className="relative z-10">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="glass-card border-glass-border rounded-xl focus:border-primary/50 focus:ring-primary/30 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="glass-card border-glass-border rounded-xl focus:border-primary/50 focus:ring-primary/30 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="glass-card border-glass-border rounded-xl focus:border-primary/50 focus:ring-primary/30 transition-all"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full rounded-xl bg-gradient-primary hover:opacity-90 shadow-glow text-primary-foreground transition-all duration-300 group" 
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" />
                        Sign Up
                      </>
                    )}
                  </Button>

                  <div className="relative my-6">
                    <Separator className="bg-glass-border" />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground rounded-full">
                      OR
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="glass"
                    className="w-full rounded-xl group"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                  >
                    <svg className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
