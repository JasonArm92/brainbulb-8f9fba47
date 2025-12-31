import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, Calendar, CheckCircle2, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import { format, isPast, isToday, parseISO } from 'date-fns';

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  progress: number;
}

interface ProjectPortalProps {
  clientId: string;
}

export function ProjectPortal({ clientId }: ProjectPortalProps) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMilestones();
  }, [clientId]);

  const fetchMilestones = async () => {
    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('client_id', clientId)
      .order('due_date', { ascending: true });

    if (!error && data) {
      setMilestones(data);
    }
    setLoading(false);
  };

  const getStatusIcon = (status: string, dueDate: string | null) => {
    if (status === 'completed') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (dueDate && isPast(parseISO(dueDate)) && !isToday(parseISO(dueDate))) {
      return <AlertCircle className="h-5 w-5 text-destructive" />;
    }
    return <Clock className="h-5 w-5 text-yellow-500" />;
  };

  const getStatusBadge = (status: string, dueDate: string | null) => {
    if (status === 'completed') {
      return <Badge className="bg-green-500/20 text-green-600 border-green-500/50">Completed</Badge>;
    }
    if (dueDate && isPast(parseISO(dueDate)) && !isToday(parseISO(dueDate))) {
      return <Badge className="bg-destructive/20 text-destructive border-destructive/50">Overdue</Badge>;
    }
    if (status === 'in_progress') {
      return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/50">In Progress</Badge>;
    }
    return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/50">Pending</Badge>;
  };

  const completedMilestones = milestones.filter(m => m.status === 'completed').length;
  const overallProgress = milestones.length > 0 
    ? Math.round(milestones.reduce((sum, m) => sum + m.progress, 0) / milestones.length) 
    : 0;
  const upcomingMilestones = milestones.filter(m => 
    m.status !== 'completed' && m.due_date && !isPast(parseISO(m.due_date))
  ).length;
  const overdueMilestones = milestones.filter(m => 
    m.status !== 'completed' && m.due_date && isPast(parseISO(m.due_date)) && !isToday(parseISO(m.due_date))
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <TrendingUp className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="text-2xl font-bold text-primary">{overallProgress}%</p>
          <p className="text-sm text-muted-foreground">Overall Progress</p>
        </Card>
        <Card className="p-4 text-center">
          <CheckCircle2 className="h-6 w-6 mx-auto text-green-500 mb-2" />
          <p className="text-2xl font-bold text-green-500">{completedMilestones}</p>
          <p className="text-sm text-muted-foreground">Completed</p>
        </Card>
        <Card className="p-4 text-center">
          <Clock className="h-6 w-6 mx-auto text-yellow-500 mb-2" />
          <p className="text-2xl font-bold text-yellow-500">{upcomingMilestones}</p>
          <p className="text-sm text-muted-foreground">Upcoming</p>
        </Card>
        <Card className="p-4 text-center">
          <AlertCircle className="h-6 w-6 mx-auto text-destructive mb-2" />
          <p className="text-2xl font-bold text-destructive">{overdueMilestones}</p>
          <p className="text-sm text-muted-foreground">Overdue</p>
        </Card>
      </div>

      {/* Overall Progress Bar */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Project Progress
          </h3>
          <span className="text-lg font-bold text-primary">{overallProgress}%</span>
        </div>
        <Progress value={overallProgress} className="h-3" />
        <p className="text-sm text-muted-foreground mt-2">
          {completedMilestones} of {milestones.length} milestones completed
        </p>
      </Card>

      {/* Milestones List */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Project Milestones
        </h3>

        {milestones.length === 0 ? (
          <Card className="p-8 text-center">
            <Target className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No milestones set for this project yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Check back soon for project updates!</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {milestones.map((milestone) => (
              <Card key={milestone.id} className="p-5">
                <div className="flex items-start gap-4">
                  {getStatusIcon(milestone.status, milestone.due_date)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h4 className="font-semibold">{milestone.title}</h4>
                      {getStatusBadge(milestone.status, milestone.due_date)}
                    </div>
                    {milestone.description && (
                      <p className="text-sm text-muted-foreground mb-3">{milestone.description}</p>
                    )}
                    {milestone.due_date && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mb-3">
                        <Calendar className="h-4 w-4" />
                        Due: {format(parseISO(milestone.due_date), 'MMMM d, yyyy')}
                      </p>
                    )}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{milestone.progress}%</span>
                      </div>
                      <Progress value={milestone.progress} className="h-2" />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
