import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Target, Calendar, CheckCircle2, Clock, AlertCircle, Trash2, Pencil } from 'lucide-react';
import { format, isPast, isToday, parseISO } from 'date-fns';

interface Milestone {
  id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  progress: number;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
}

export function MilestoneTracker() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    client_id: '',
    status: 'pending',
    progress: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [milestonesRes, clientsRes] = await Promise.all([
      supabase.from('milestones').select('*').order('due_date', { ascending: true }),
      supabase.from('clients').select('id, name'),
    ]);

    if (milestonesRes.error) {
      toast.error('Failed to fetch milestones');
    } else {
      setMilestones(milestonesRes.data || []);
    }

    if (!clientsRes.error) {
      setClients(clientsRes.data || []);
    }

    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.title) {
      toast.error('Title is required');
      return;
    }

    const data = {
      title: formData.title,
      description: formData.description || null,
      due_date: formData.due_date || null,
      client_id: formData.client_id || null,
      status: formData.status,
      progress: formData.progress,
    };

    if (editingMilestone) {
      const { error } = await supabase
        .from('milestones')
        .update(data)
        .eq('id', editingMilestone.id);

      if (error) {
        toast.error('Failed to update milestone');
      } else {
        toast.success('Milestone updated');
        fetchData();
      }
    } else {
      const { error } = await supabase.from('milestones').insert(data);

      if (error) {
        toast.error('Failed to create milestone');
      } else {
        toast.success('Milestone created');
        fetchData();
      }
    }

    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this milestone?')) return;

    const { error } = await supabase.from('milestones').delete().eq('id', id);

    if (error) {
      toast.error('Failed to delete milestone');
    } else {
      toast.success('Milestone deleted');
      fetchData();
    }
  };

  const handleProgressChange = async (id: string, progress: number) => {
    const status = progress === 100 ? 'completed' : progress > 0 ? 'in_progress' : 'pending';
    
    const { error } = await supabase
      .from('milestones')
      .update({ progress, status })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update progress');
    } else {
      fetchData();
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      due_date: '',
      client_id: '',
      status: 'pending',
      progress: 0,
    });
    setEditingMilestone(null);
    setIsDialogOpen(false);
  };

  const openEditDialog = (milestone: Milestone) => {
    setEditingMilestone(milestone);
    setFormData({
      title: milestone.title,
      description: milestone.description || '',
      due_date: milestone.due_date || '',
      client_id: milestone.client_id || '',
      status: milestone.status,
      progress: milestone.progress,
    });
    setIsDialogOpen(true);
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
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Completed</Badge>;
    }
    if (dueDate && isPast(parseISO(dueDate)) && !isToday(parseISO(dueDate))) {
      return <Badge className="bg-destructive/20 text-destructive border-destructive/50">Overdue</Badge>;
    }
    if (status === 'in_progress') {
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">In Progress</Badge>;
    }
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">Pending</Badge>;
  };

  const getClientName = (clientId: string | null) => {
    if (!clientId) return null;
    return clients.find(c => c.id === clientId)?.name;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="glass-card p-8 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-muted font-medium">Loading milestones...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Project Milestones
          </h2>
          <p className="text-muted-foreground mt-1">Track project phases and deadlines</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-primary to-primary-glow">
              <Plus className="h-4 w-4 mr-2" />
              Add Milestone
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-2 border-glass-border">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {editingMilestone ? 'Edit Milestone' : 'New Milestone'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Title *</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Design Review"
                  className="glass"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Milestone details..."
                  className="glass"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Due Date</label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="glass"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Client</label>
                  <Select
                    value={formData.client_id}
                    onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                  >
                    <SelectTrigger className="glass">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No client</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Progress: {formData.progress}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={formData.progress}
                  onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>
              <Button onClick={handleSubmit} className="w-full">
                {editingMilestone ? 'Update' : 'Create'} Milestone
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {milestones.length === 0 ? (
        <Card className="glass-card p-12 text-center">
          <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No milestones yet</h3>
          <p className="text-muted-foreground mb-4">Create your first milestone to track project progress</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {milestones.map((milestone) => (
            <Card key={milestone.id} className="glass-card p-6 hover:shadow-premium transition-all duration-300">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  {getStatusIcon(milestone.status, milestone.due_date)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{milestone.title}</h3>
                      {getStatusBadge(milestone.status, milestone.due_date)}
                      {getClientName(milestone.client_id) && (
                        <Badge variant="outline" className="glass">
                          {getClientName(milestone.client_id)}
                        </Badge>
                      )}
                    </div>
                    {milestone.description && (
                      <p className="text-muted-foreground text-sm mb-3">{milestone.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm">
                      {milestone.due_date && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {format(parseISO(milestone.due_date), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-semibold">{milestone.progress}%</span>
                      </div>
                      <Progress value={milestone.progress} className="h-2" />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={milestone.progress}
                        onChange={(e) => handleProgressChange(milestone.id, parseInt(e.target.value))}
                        className="w-full mt-2 opacity-50 hover:opacity-100 transition-opacity"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(milestone)}
                    className="glass"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(milestone.id)}
                    className="glass text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}