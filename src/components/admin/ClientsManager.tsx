import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Pencil, Trash2, Mail, Phone, Building2, Search, Filter, TrendingUp, Users, Clock, Star } from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

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

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const matchesSearch = 
        client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        '';
      const matchesStatus = statusFilter === 'all' || client.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || client.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [clients, searchQuery, statusFilter, priorityFilter]);

  const stats = useMemo(() => {
    const total = clients.length;
    const newClients = clients.filter(c => c.status === 'new').length;
    const converted = clients.filter(c => c.status === 'converted').length;
    const highPriority = clients.filter(c => c.priority === 'high').length;
    return { total, newClients, converted, highPriority };
  }, [clients]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="glass-card p-8 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-muted font-medium">Loading clients...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card p-6 group hover:shadow-premium transition-all duration-500 animate-slide-up-fade border-2 border-glass-border">
          <div className="flex items-center justify-between mb-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <TrendingUp className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-3xl font-bold bg-gradient-to-br from-primary to-primary-glow bg-clip-text text-transparent">{stats.total}</p>
          <p className="text-sm text-muted-foreground mt-1">Total Clients</p>
        </Card>

        <Card className="glass-card p-6 group hover:shadow-premium transition-all duration-500 animate-slide-up-fade border-2 border-glass-border" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Clock className="h-6 w-6 text-blue-400" />
            </div>
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">{stats.newClients}</Badge>
          </div>
          <p className="text-3xl font-bold text-foreground">{stats.newClients}</p>
          <p className="text-sm text-muted-foreground mt-1">New Leads</p>
        </Card>

        <Card className="glass-card p-6 group hover:shadow-premium transition-all duration-500 animate-slide-up-fade border-2 border-glass-border" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <TrendingUp className="h-6 w-6 text-green-400" />
            </div>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/50">{stats.converted}</Badge>
          </div>
          <p className="text-3xl font-bold text-foreground">{stats.converted}</p>
          <p className="text-sm text-muted-foreground mt-1">Converted</p>
        </Card>

        <Card className="glass-card p-6 group hover:shadow-premium transition-all duration-500 animate-slide-up-fade border-2 border-glass-border" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Star className="h-6 w-6 text-red-400" />
            </div>
            <Badge className="bg-red-500/20 text-red-400 border-red-500/50">{stats.highPriority}</Badge>
          </div>
          <p className="text-3xl font-bold text-foreground">{stats.highPriority}</p>
          <p className="text-sm text-muted-foreground mt-1">High Priority</p>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="glass-card p-6 animate-slide-up-fade" style={{ animationDelay: '0.4s' }}>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients by name, email, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="glass w-full md:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="glass w-full md:w-[180px]">
              <Star className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Clients Grid */}
      <div className="grid gap-4">
        {filteredClients.map((client, index) => (
          <Card 
            key={client.id} 
            className="glass-card p-6 hover:shadow-premium hover:scale-[1.01] transition-all duration-500 group border-2 border-glass-border animate-slide-up-fade"
            style={{ animationDelay: `${0.5 + index * 0.05}s` }}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent group-hover:from-primary group-hover:to-primary-glow transition-all duration-300">{client.name}</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={`${getStatusColor(client.status)} font-semibold`}>
                        {client.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <Badge className={`${getPriorityColor(client.priority)} font-semibold`}>
                        {client.priority.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="glass text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(client.created_at).toLocaleDateString()}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10 group-hover:border-primary/20 transition-colors">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground font-medium">Email</p>
                      <a href={`mailto:${client.email}`} className="text-sm text-foreground hover:text-primary transition-colors truncate block font-medium">
                        {client.email}
                      </a>
                    </div>
                  </div>
                  {client.phone && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10 group-hover:border-primary/20 transition-colors">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Phone className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground font-medium">Phone</p>
                        <a href={`tel:${client.phone}`} className="text-sm text-foreground hover:text-primary transition-colors truncate block font-medium">
                          {client.phone}
                        </a>
                      </div>
                    </div>
                  )}
                  {client.company && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10 group-hover:border-primary/20 transition-colors md:col-span-2">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground font-medium">Company</p>
                        <p className="text-sm text-foreground truncate font-medium">{client.company}</p>
                      </div>
                    </div>
                  )}
                </div>

                {client.message && (
                  <div className="glass-card p-4 rounded-xl border-2 border-glass-border">
                    <p className="text-xs font-bold text-primary mb-2 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                      INITIAL MESSAGE
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">{client.message}</p>
                  </div>
                )}

                {client.notes && (
                  <div className="glass-card p-4 rounded-xl border-2 border-yellow-500/20 bg-yellow-500/5">
                    <p className="text-xs font-bold text-yellow-400 mb-2 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
                      INTERNAL NOTES
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">{client.notes}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 ml-4 flex-shrink-0">
                <Dialog open={isDialogOpen && editingClient?.id === client.id} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="glass hover:shadow-glow hover:scale-105 transition-all duration-300"
                      onClick={() => setEditingClient(client)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="glass-card max-w-2xl border-2 border-glass-border">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">Edit Client</DialogTitle>
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
                          className="w-full hover:shadow-glow transition-all duration-300"
                        >
                          💾 Save Changes
                        </Button>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>

                <Button
                  size="sm"
                  variant="outline"
                  className="glass hover:bg-destructive/20 hover:border-destructive/50 hover:scale-105 transition-all duration-300"
                  onClick={() => handleDeleteClient(client.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {filteredClients.length === 0 && clients.length > 0 && (
          <Card className="glass-card p-12 text-center border-2 border-glass-border">
            <div className="max-w-md mx-auto">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Search className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">No Results Found</h3>
              <p className="text-muted-foreground">No clients match your current filters. Try adjusting your search criteria.</p>
            </div>
          </Card>
        )}

        {clients.length === 0 && (
          <Card className="glass-card p-12 text-center border-2 border-glass-border">
            <div className="max-w-md mx-auto">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Users className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">No Clients Yet</h3>
              <p className="text-muted-foreground">Leads from the contact form will appear here. Your first client is just around the corner!</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};