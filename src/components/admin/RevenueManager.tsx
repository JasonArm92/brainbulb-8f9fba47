import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, PoundSterling, TrendingUp, Calendar } from 'lucide-react';

interface RevenueEntry {
  id: string;
  client_id: string | null;
  client_name: string;
  amount: number;
  currency: string;
  description: string;
  payment_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  invoice_number: string | null;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
}

export function RevenueManager() {
  const [entries, setEntries] = useState<RevenueEntry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<RevenueEntry | null>(null);
  const [formData, setFormData] = useState<{
    client_id: string;
    amount: string;
    description: string;
    payment_date: string;
    status: 'pending' | 'paid' | 'overdue' | 'cancelled';
    invoice_number: string;
  }>({
    client_id: '',
    amount: '',
    description: '',
    payment_date: new Date().toISOString().split('T')[0],
    status: 'pending',
    invoice_number: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [clientsRes, entriesRes] = await Promise.all([
      supabase.from('clients').select('id, name'),
      supabase.from('revenue_entries').select('*').order('payment_date', { ascending: false }),
    ]);

    if (clientsRes.data) setClients(clientsRes.data);
    if (entriesRes.data) {
      setEntries(entriesRes.data.map((e) => ({
        ...e,
        amount: Number(e.amount),
        status: e.status as RevenueEntry['status'],
      })));
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.amount || !formData.description) {
      toast.error('Please fill in required fields');
      return;
    }

    const client = clients.find((c) => c.id === formData.client_id);
    const entryData = {
      client_id: formData.client_id || null,
      client_name: client?.name || 'General',
      amount: parseFloat(formData.amount),
      description: formData.description,
      payment_date: formData.payment_date,
      status: formData.status,
      invoice_number: formData.invoice_number || null,
    };

    if (editingEntry) {
      const { error } = await supabase
        .from('revenue_entries')
        .update(entryData)
        .eq('id', editingEntry.id);

      if (error) {
        toast.error('Failed to update entry');
        console.error(error);
        return;
      }
      toast.success('Entry updated');
    } else {
      const { error } = await supabase.from('revenue_entries').insert(entryData);

      if (error) {
        toast.error('Failed to add entry');
        console.error(error);
        return;
      }
      toast.success('Entry added');
    }

    resetForm();
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('revenue_entries').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete entry');
      console.error(error);
      return;
    }
    toast.success('Entry deleted');
    fetchData();
  };

  const resetForm = () => {
    setDialogOpen(false);
    setEditingEntry(null);
    setFormData({
      client_id: '',
      amount: '',
      description: '',
      payment_date: new Date().toISOString().split('T')[0],
      status: 'pending',
      invoice_number: '',
    });
  };

  const openEdit = (entry: RevenueEntry) => {
    setEditingEntry(entry);
    setFormData({
      client_id: entry.client_id || '',
      amount: entry.amount.toString(),
      description: entry.description,
      payment_date: entry.payment_date,
      status: entry.status,
      invoice_number: entry.invoice_number || '',
    });
    setDialogOpen(true);
  };

  const totalRevenue = entries
    .filter((e) => e.status === 'paid')
    .reduce((sum, e) => sum + e.amount, 0);

  const pendingRevenue = entries
    .filter((e) => e.status === 'pending')
    .reduce((sum, e) => sum + e.amount, 0);

  const thisMonthRevenue = entries
    .filter((e) => {
      const date = new Date(e.payment_date);
      const now = new Date();
      return e.status === 'paid' && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    })
    .reduce((sum, e) => sum + e.amount, 0);

  const statusColors: { [key: string]: string } = {
    paid: 'bg-green-500/20 text-green-500',
    pending: 'bg-yellow-500/20 text-yellow-500',
    overdue: 'bg-destructive/20 text-destructive',
    cancelled: 'bg-muted text-muted-foreground',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Revenue Tracking</h2>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Entry
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Paid</p>
              <p className="text-2xl font-bold">£{totalRevenue.toLocaleString()}</p>
            </div>
            <PoundSterling className="h-8 w-8 text-green-500" />
          </div>
        </Card>
        <Card className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">£{pendingRevenue.toLocaleString()}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
        <Card className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-2xl font-bold">£{thisMonthRevenue.toLocaleString()}</p>
            </div>
            <Calendar className="h-8 w-8 text-primary" />
          </div>
        </Card>
      </div>

      <Card className="glass-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No revenue entries yet. Click "Add Entry" to start tracking.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{new Date(entry.payment_date).toLocaleDateString()}</TableCell>
                  <TableCell>{entry.client_name}</TableCell>
                  <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                  <TableCell>{entry.invoice_number || '-'}</TableCell>
                  <TableCell className="font-medium">£{entry.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[entry.status]}>{entry.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(entry)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(entry.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Edit Entry' : 'Add Revenue Entry'}</DialogTitle>
            <DialogDescription>Track payments and invoices for your projects.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Client (optional)</Label>
              <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">General</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (£) *</Label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Description *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Website design - Phase 1"
              />
            </div>
            <div>
              <Label>Invoice Number</Label>
              <Input
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                placeholder="e.g., INV-001"
              />
            </div>
            <div>
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v: any) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button onClick={handleSubmit}>{editingEntry ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
