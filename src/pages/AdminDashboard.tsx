import { ProtectedRoute } from '@/components/admin/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClientsManager } from '@/components/admin/ClientsManager';
import { PortfolioManager } from '@/components/admin/PortfolioManager';
import { DesignSubmissionManager } from '@/components/admin/DesignSubmissionManager';
import { ChatManager } from '@/components/admin/ChatManager';
import { AnalyticsManager } from '@/components/admin/AnalyticsManager';
import { RevenueManager } from '@/components/admin/RevenueManager';
import { SettingsManager } from '@/components/admin/SettingsManager';
import { MilestoneTracker } from '@/components/admin/MilestoneTracker';
import { LogOut, Users, Briefcase, FileImage, MessageSquare, BarChart3, PoundSterling, Settings, Target, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

function AdminDashboardContent() {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden pb-24">
      {/* Aurora background */}
      <div className="aurora-bg fixed inset-0 pointer-events-none" />
      
      {/* Ambient orbs */}
      <div className="fixed top-[-10%] left-[-5%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] rounded-full bg-gradient-to-br from-primary/15 via-primary-glow/10 to-transparent blur-3xl pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[35vw] h-[35vw] max-w-[400px] max-h-[400px] rounded-full bg-gradient-to-tl from-accent-cyan/10 via-primary/10 to-transparent blur-3xl pointer-events-none" />
      
      {/* Tech grid */}
      <div className="tech-grid fixed inset-0 pointer-events-none opacity-20" />
      
      <div className="relative z-10 container mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="animate-slide-up-premium">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-4xl font-bold font-display">
                <span className="gradient-text">CRM Dashboard</span>
              </h1>
            </div>
            <p className="text-muted-foreground ml-13">Manage your clients and portfolio</p>
          </div>
          <Button 
            onClick={handleSignOut} 
            variant="glass" 
            className="rounded-full px-6 group animate-slide-up-premium"
          >
            <LogOut className="mr-2 h-4 w-4 group-hover:rotate-12 transition-transform" />
            Sign Out
          </Button>
        </div>

        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="glass-card p-1.5 grid grid-cols-4 lg:grid-cols-8 w-full rounded-2xl border border-glass-border shadow-glass animate-slide-up-premium stagger-2">
            <TabsTrigger 
              value="analytics" 
              className="flex items-center gap-2 rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow transition-all duration-300"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger 
              value="clients" 
              className="flex items-center gap-2 rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow transition-all duration-300"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Clients</span>
            </TabsTrigger>
            <TabsTrigger 
              value="milestones" 
              className="flex items-center gap-2 rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow transition-all duration-300"
            >
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Milestones</span>
            </TabsTrigger>
            <TabsTrigger 
              value="designs" 
              className="flex items-center gap-2 rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow transition-all duration-300"
            >
              <FileImage className="h-4 w-4" />
              <span className="hidden sm:inline">Designs</span>
            </TabsTrigger>
            <TabsTrigger 
              value="chat" 
              className="flex items-center gap-2 rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow transition-all duration-300"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
            <TabsTrigger 
              value="portfolio" 
              className="flex items-center gap-2 rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow transition-all duration-300"
            >
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Portfolio</span>
            </TabsTrigger>
            <TabsTrigger 
              value="revenue" 
              className="flex items-center gap-2 rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow transition-all duration-300"
            >
              <PoundSterling className="h-4 w-4" />
              <span className="hidden sm:inline">Revenue</span>
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="flex items-center gap-2 rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow transition-all duration-300"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <div className="animate-slide-up-premium stagger-3">
            <TabsContent value="analytics">
              <AnalyticsManager />
            </TabsContent>

            <TabsContent value="clients">
              <ClientsManager />
            </TabsContent>

            <TabsContent value="milestones">
              <MilestoneTracker />
            </TabsContent>

            <TabsContent value="designs">
              <DesignSubmissionManager />
            </TabsContent>

            <TabsContent value="chat">
              <ChatManager />
            </TabsContent>

            <TabsContent value="portfolio">
              <PortfolioManager />
            </TabsContent>

            <TabsContent value="revenue">
              <RevenueManager />
            </TabsContent>

            <TabsContent value="settings">
              <SettingsManager />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <ProtectedRoute>
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}
