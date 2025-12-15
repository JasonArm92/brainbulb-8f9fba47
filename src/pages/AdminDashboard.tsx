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
import { LogOut, Users, Briefcase, FileImage, MessageSquare, BarChart3, PoundSterling, Settings } from 'lucide-react';
import { toast } from 'sonner';

function AdminDashboardContent() {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="tech-grid opacity-30" />
      
      <div className="relative z-10 container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">
              CRM Dashboard
            </h1>
            <p className="text-muted mt-2">Manage your clients and portfolio</p>
          </div>
          <Button onClick={handleSignOut} variant="outline" className="glass">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="glass-card p-1 grid grid-cols-4 lg:grid-cols-7 w-full">
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="clients" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Clients</span>
            </TabsTrigger>
            <TabsTrigger value="designs" className="flex items-center gap-2">
              <FileImage className="h-4 w-4" />
              <span className="hidden sm:inline">Designs</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Portfolio</span>
            </TabsTrigger>
            <TabsTrigger value="revenue" className="flex items-center gap-2">
              <PoundSterling className="h-4 w-4" />
              <span className="hidden sm:inline">Revenue</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            <AnalyticsManager />
          </TabsContent>

          <TabsContent value="clients">
            <ClientsManager />
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
