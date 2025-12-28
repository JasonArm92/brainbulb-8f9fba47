import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, startOfWeek, startOfMonth, parseISO, subMonths } from 'date-fns';
import { TrendingUp, Calendar, BarChart3 } from 'lucide-react';

interface RevenueEntry {
  id: string;
  amount: number;
  payment_date: string;
  status: string;
  client_name: string;
}

interface RevenueChartProps {
  entries: RevenueEntry[];
}

type ViewMode = 'weekly' | 'monthly';
type ChartType = 'area' | 'bar';

export function RevenueChart({ entries }: RevenueChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [chartType, setChartType] = useState<ChartType>('area');

  const chartData = useMemo(() => {
    const paidEntries = entries.filter(e => e.status === 'paid');
    
    if (viewMode === 'weekly') {
      const weeklyData: { [key: string]: number } = {};
      paidEntries.forEach(entry => {
        const weekStart = startOfWeek(parseISO(entry.payment_date), { weekStartsOn: 1 });
        const key = format(weekStart, 'MMM d');
        weeklyData[key] = (weeklyData[key] || 0) + Number(entry.amount);
      });
      return Object.entries(weeklyData)
        .map(([week, amount]) => ({ period: week, amount }))
        .slice(-12);
    } else {
      const monthlyData: { [key: string]: number } = {};
      // Initialize last 6 months with 0
      for (let i = 5; i >= 0; i--) {
        const month = subMonths(new Date(), i);
        const key = format(month, 'MMM yyyy');
        monthlyData[key] = 0;
      }
      paidEntries.forEach(entry => {
        const monthStart = startOfMonth(parseISO(entry.payment_date));
        const key = format(monthStart, 'MMM yyyy');
        if (monthlyData.hasOwnProperty(key)) {
          monthlyData[key] = monthlyData[key] + Number(entry.amount);
        }
      });
      return Object.entries(monthlyData).map(([period, amount]) => ({ period, amount }));
    }
  }, [entries, viewMode]);

  const totalRevenue = useMemo(() => {
    return entries
      .filter(e => e.status === 'paid')
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [entries]);

  const averageRevenue = useMemo(() => {
    const data = chartData.filter(d => d.amount > 0);
    if (data.length === 0) return 0;
    return data.reduce((sum, d) => sum + d.amount, 0) / data.length;
  }, [chartData]);

  return (
    <Card className="glass-card p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Revenue Trends
          </h3>
          <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
            <span>Total: <span className="font-bold text-foreground">£{totalRevenue.toLocaleString()}</span></span>
            <span>Avg: <span className="font-bold text-foreground">£{averageRevenue.toLocaleString()}</span></span>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg overflow-hidden border border-border">
            <Button
              size="sm"
              variant={viewMode === 'weekly' ? 'default' : 'ghost'}
              onClick={() => setViewMode('weekly')}
              className="rounded-none"
            >
              <Calendar className="h-4 w-4 mr-1" />
              Weekly
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'monthly' ? 'default' : 'ghost'}
              onClick={() => setViewMode('monthly')}
              className="rounded-none"
            >
              <Calendar className="h-4 w-4 mr-1" />
              Monthly
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setChartType(chartType === 'area' ? 'bar' : 'area')}
          >
            <BarChart3 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'area' ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="period" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `£${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                }}
                formatter={(value: number) => [`£${value.toLocaleString()}`, 'Revenue']}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#revenueGradient)"
              />
            </AreaChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="period" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `£${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                }}
                formatter={(value: number) => [`£${value.toLocaleString()}`, 'Revenue']}
              />
              <Bar 
                dataKey="amount" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}