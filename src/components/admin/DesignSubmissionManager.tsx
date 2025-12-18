import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';
import { Loader2, Upload, Plus, Trash2, Bell, BellOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Client {
  id: string;
  name: string;
  email: string;
}

interface DesignSubmission {
  id: string;
  title: string;
  description: string;
  file_url: string;
  status: string;
  feedback: string | null;
  client_id: string;
  clients: { name: string };
  created_at: string;
}

export const DesignSubmissionManager = () => {
  const { toast } = useToast();
  const { permission, requestPermission, showNotification, isSupported } = useBrowserNotifications();
  const [clients, setClients] = useState<Client[]>([]);
  const [submissions, setSubmissions] = useState<DesignSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    client_id: '',
    title: '',
    description: '',
    file: null as File | null,
  });

  // Subscribe to design status changes for notifications
  useEffect(() => {
    const channel = supabase
      .channel('admin-design-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'design_submissions',
        },
        async (payload) => {
          const updated = payload.new as DesignSubmission;
          const old = payload.old as DesignSubmission;
          
          // Only notify if status changed
          if (updated.status !== old.status && permission === 'granted') {
            const statusEmoji = updated.status === 'approved' ? '✅' : updated.status === 'rejected' ? '❌' : '🔄';
            showNotification(`${statusEmoji} Design ${updated.status}`, {
              body: `"${updated.title}" has been ${updated.status}`,
              tag: 'design-update',
            });
          }
          
          // Refresh the list
          fetchSubmissions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [permission, showNotification]);

  useEffect(() => {
    fetchClients();
    fetchSubmissions();
  }, []);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, email')
      .order('name');

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load clients',
        variant: 'destructive',
      });
    } else {
      setClients(data || []);
    }
  };

  const fetchSubmissions = async () => {
    const { data, error } = await supabase
      .from('design_submissions')
      .select('*, clients(name)')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load submissions',
        variant: 'destructive',
      });
    } else {
      setSubmissions(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.file || !formData.client_id || !formData.title) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = formData.file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('design-submissions')
        .upload(fileName, formData.file);

      if (uploadError) throw uploadError;

      // Use signed URL since bucket is now private
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('design-submissions')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year expiry for design files

      if (signedUrlError) throw signedUrlError;

      const { error: insertError } = await supabase.from('design_submissions').insert({
        client_id: formData.client_id,
        title: formData.title,
        description: formData.description,
        file_url: signedUrlData.signedUrl,
        status: 'pending',
      });

      if (insertError) throw insertError;

      toast({
        title: 'Success',
        description: 'Design submitted successfully',
      });

      setFormData({
        client_id: '',
        title: '',
        description: '',
        file: null,
      });
      setDialogOpen(false);
      fetchSubmissions();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit design',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, fileUrl: string) => {
    try {
      const fileName = fileUrl.split('/').pop();
      if (fileName) {
        await supabase.storage.from('design-submissions').remove([fileName]);
      }

      const { error } = await supabase
        .from('design_submissions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Design deleted successfully',
      });
      fetchSubmissions();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete design',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <h2 className="text-2xl font-bold">Design Submissions</h2>
        <div className="flex gap-2">
          {isSupported && (
            <Button
              variant={permission === 'granted' ? 'secondary' : 'outline'}
              size="sm"
              onClick={requestPermission}
              disabled={permission === 'granted'}
              title={permission === 'granted' ? 'Notifications enabled' : 'Enable notifications'}
            >
              {permission === 'granted' ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Upload Design
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Design for Client</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="client">Client</Label>
                <Select
                  value={formData.client_id}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, client_id: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name} ({client.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="file">Design File</Label>
                <Input
                  id="file"
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      file: e.target.files?.[0] || null,
                    }))
                  }
                  required
                />
              </div>

              <Button type="submit" disabled={uploading} className="w-full">
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid gap-4">
        {submissions.map((submission) => (
          <Card key={submission.id} className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{submission.title}</h3>
                <p className="text-sm text-muted-foreground">
                  Client: {submission.clients.name}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Status: <span className="capitalize">{submission.status}</span>
                </p>
                {submission.feedback && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Feedback: {submission.feedback}
                  </p>
                )}
              </div>
              <Button
                variant="destructive"
                size="icon"
                onClick={() => handleDelete(submission.id, submission.file_url)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
