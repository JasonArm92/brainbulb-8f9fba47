import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { 
  TrendingUp, 
  Users, 
  Briefcase, 
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { RevenueChart } from './RevenueChart';

interface AnalyticsData {
  totalClients: number;
  newClientsThisMonth: number;
  totalProjects: number;
  pendingSubmissions: number;
  approvedSubmissions: number;
  rejectedSubmissions: number;
  clientsByStatus: { status: string; count: number }[];
  clientsByPriority: { priority: string; count: number }[];
}

interface RevenueEntry {
  id: string;
  amount: number;
  payment_date: string;
  status: string;
  client_name: string;
}

export function AnalyticsManager() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [revenueEntries, setRevenueEntries] = useState<RevenueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Fetch clients
      const { data: clients } = await supabase
        .from('clients')
        .select('id, created_at, status, priority');

      // Fetch design submissions
      const { data: submissions } = await supabase
        .from('design_submissions')
        .select('id, status');

      // Fetch portfolio projects
      const { data: projects } = await supabase
        .from('portfolio_projects')
        .select('id');

      // Fetch revenue entries
      const { data: revenue } = await supabase
        .from('revenue_entries')
        .select('id, amount, payment_date, status, client_name')
        .order('payment_date', { ascending: true });

      setRevenueEntries(revenue || []);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const newClientsThisMonth = clients?.filter(
        (c) => new Date(c.created_at) >= startOfMonth
      ).length || 0;

      // Count by status
      const statusCounts: { [key: string]: number } = {};
      clients?.forEach((c) => {
        const status = c.status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      // Count by priority
      const priorityCounts: { [key: string]: number } = {};
      clients?.forEach((c) => {
        const priority = c.priority || 'medium';
        priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
      });

      setAnalytics({
        totalClients: clients?.length || 0,
        newClientsThisMonth,
        totalProjects: projects?.length || 0,
        pendingSubmissions: submissions?.filter((s) => s.status === 'pending').length || 0,
        approvedSubmissions: submissions?.filter((s) => s.status === 'approved').length || 0,
        rejectedSubmissions: submissions?.filter((s) => s.status === 'rejected').length || 0,
        clientsByStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
        clientsByPriority: Object.entries(priorityCounts).map(([priority, count]) => ({ priority, count })),
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-12 bg-muted rounded" />
          </Card>
        ))}
      </div>
    );
  }

  if (!analytics) return null;

  const statCards = [
    {
      title: 'Total Clients',
      value: analytics.totalClients,
      icon: Users,
      color: 'text-primary',
    },
    {
      title: 'New This Month',
      value: analytics.newClientsThisMonth,
      icon: TrendingUp,
      color: 'text-green-500',
    },
    {
      title: 'Portfolio Projects',
      value: analytics.totalProjects,
      icon: Briefcase,
      color: 'text-accent',
    },
    {
      title: 'Pending Reviews',
      value: analytics.pendingSubmissions,
      icon: Clock,
      color: 'text-yellow-500',
    },
  ];

  const submissionStats = [
    {
      title: 'Approved Designs',
      value: analytics.approvedSubmissions,
      icon: CheckCircle,
      color: 'text-green-500',
    },
    {
      title: 'Rejected Designs',
      value: analytics.rejectedSubmissions,
      icon: XCircle,
      color: 'text-destructive',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.title} className="glass-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Revenue Chart */}
      <RevenueChart entries={revenueEntries} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4">Design Submissions</h3>
          <div className="space-y-4">
            {submissionStats.map((stat) => (
              <div key={stat.title} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  <span>{stat.title}</span>
                </div>
                <span className="text-xl font-bold">{stat.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4">Clients by Status</h3>
          <div className="space-y-3">
            {analytics.clientsByStatus.map((item) => (
              <div key={item.status} className="flex items-center justify-between">
                <span className="capitalize">{item.status.replace('_', ' ')}</span>
                <div className="flex items-center gap-2">
                  <div 
                    className="h-2 bg-primary rounded-full" 
                    style={{ 
                      width: `${Math.max(20, (item.count / analytics.totalClients) * 100)}px` 
                    }} 
                  />
                  <span className="text-sm font-medium w-8 text-right">{item.count}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-4">Clients by Priority</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {analytics.clientsByPriority.map((item) => {
            const colors: { [key: string]: string } = {
              high: 'bg-destructive/20 border-destructive text-destructive',
              medium: 'bg-yellow-500/20 border-yellow-500 text-yellow-500',
              low: 'bg-green-500/20 border-green-500 text-green-500',
            };
            return (
              <div 
                key={item.priority} 
                className={`p-4 rounded-lg border ${colors[item.priority] || 'bg-muted border-border'}`}
              >
                <p className="text-sm font-medium capitalize">{item.priority} Priority</p>
                <p className="text-2xl font-bold mt-1">{item.count}</p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
