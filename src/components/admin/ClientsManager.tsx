import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus, Mail, Phone, Building2 } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  message?: string;
  status: string;
  priority: string;
  notes?: string;
  created_at: string;
}

export const ClientsManager = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch clients');
    } else {
      setClients(data || []);
    }
    setLoading(false);
  };

  const handleUpdateClient = async (client: Client) => {
    const { error } = await supabase
      .from('clients')
      .update({
        status: client.status,
        priority: client.priority,
        notes: client.notes,
      })
      .eq('id', client.id);

    if (error) {
      toast.error('Failed to update client');
    } else {
      toast.success('Client updated successfully');
      fetchClients();
      setIsDialogOpen(false);
      setEditingClient(null);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client?')) return;

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete client');
    } else {
      toast.success('Client deleted successfully');
      fetchClients();
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      contacted: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      in_progress: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
      converted: 'bg-green-500/20 text-green-400 border-green-500/50',
      lost: 'bg-red-500/20 text-red-400 border-red-500/50',
    };
    return colors[status] || colors.new;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
      medium: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
      high: 'bg-red-500/20 text-red-400 border-red-500/50',
    };
    return colors[priority] || colors.medium;
  };

  if (loading) {
    return <div className="text-center py-12">Loading clients...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Client Management</h2>
          <p className="text-muted">Total clients: {clients.length}</p>
        </div>
      </div>

      <div className="grid gap-4">
        {clients.map((client) => (
          <Card key={client.id} className="glass-card p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">{client.name}</h3>
                    <div className="flex gap-2 mt-2">
                      <Badge className={getStatusColor(client.status)}>
                        {client.status.replace('_', ' ')}
                      </Badge>
                      <Badge className={getPriorityColor(client.priority)}>
                        {client.priority}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted">
                    <Mail className="h-4 w-4" />
                    <a href={`mailto:${client.email}`} className="hover:text-primary transition-colors">
                      {client.email}
                    </a>
                  </div>
                  {client.phone && (
                    <div className="flex items-center gap-2 text-muted">
                      <Phone className="h-4 w-4" />
                      <a href={`tel:${client.phone}`} className="hover:text-primary transition-colors">
                        {client.phone}
                      </a>
                    </div>
                  )}
                  {client.company && (
                    <div className="flex items-center gap-2 text-muted">
                      <Building2 className="h-4 w-4" />
                      {client.company}
                    </div>
                  )}
                </div>

                {client.message && (
                  <div className="bg-background/50 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">Message:</span> {client.message}</p>
                  </div>
                )}

                {client.notes && (
                  <div className="bg-background/50 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">Notes:</span> {client.notes}</p>
                  </div>
                )}

                <p className="text-xs text-muted">
                  Submitted: {new Date(client.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex gap-2 ml-4">
                <Dialog open={isDialogOpen && editingClient?.id === client.id} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="glass"
                      onClick={() => setEditingClient(client)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="glass-card max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Edit Client</DialogTitle>
                    </DialogHeader>
                    {editingClient && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Status</label>
                          <Select
                            value={editingClient.status}
                            onValueChange={(value) =>
                              setEditingClient({ ...editingClient, status: value })
                            }
                          >
                            <SelectTrigger className="glass">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="contacted">Contacted</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="converted">Converted</SelectItem>
                              <SelectItem value="lost">Lost</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">Priority</label>
                          <Select
                            value={editingClient.priority}
                            onValueChange={(value) =>
                              setEditingClient({ ...editingClient, priority: value })
                            }
                          >
                            <SelectTrigger className="glass">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">Notes</label>
                          <Textarea
                            value={editingClient.notes || ''}
                            onChange={(e) =>
                              setEditingClient({ ...editingClient, notes: e.target.value })
                            }
                            className="glass min-h-[100px]"
                            placeholder="Add internal notes about this client..."
                          />
                        </div>

                        <Button
                          onClick={() => handleUpdateClient(editingClient)}
                          className="w-full"
                        >
                          Save Changes
                        </Button>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>

                <Button
                  size="sm"
                  variant="outline"
                  className="glass hover:bg-destructive/20"
                  onClick={() => handleDeleteClient(client.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {clients.length === 0 && (
          <Card className="glass-card p-12 text-center">
            <p className="text-muted text-lg">No clients yet. Leads from the contact form will appear here.</p>
          </Card>
        )}
      </div>
    </div>
  );
};