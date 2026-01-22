import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Clock, Upload, MessageSquare, FileText, LogOut, User, Settings, Save, Target, FolderOpen, Sparkles } from 'lucide-react';
import { ProjectPortal } from '@/components/client/ProjectPortal';
import { FileSharing } from '@/components/client/FileSharing';
import logoMain from '@/assets/logo-main.png';

interface DesignSubmission {
  id: string;
  title: string;
  description: string;
  file_url: string;
  status: 'pending' | 'approved' | 'rejected';
  feedback: string | null;
  created_at: string;
}

interface Message {
  id: string;
  message: string;
  file_url: string | null;
  sender_id: string;
  created_at: string;
}

interface ClientData {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
}

interface ProfileData {
  id: string;
  email: string;
  full_name: string | null;
}

export default function ClientDashboard() {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [submissions, setSubmissions] = useState<DesignSubmission[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [feedback, setFeedback] = useState<{ [key: string]: string }>({});
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: '' });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/admin-auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfileAndClientData();
    }
  }, [user]);

  useEffect(() => {
    if (clientData) {
      fetchSubmissions();
      fetchMessages();
      const unsubscribe = subscribeToMessages();
      return unsubscribe;
    }
  }, [clientData]);

  const fetchProfileAndClientData = async () => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('id', user?.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setProfileForm({ full_name: profileData.full_name || '' });

        const { data: client } = await supabase
          .from('clients')
          .select('id, name, email, company, phone')
          .eq('email', profileData.email)
          .single();

        if (client) {
          setClientData(client);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    if (!clientData) return;

    const { data, error } = await supabase
      .from('design_submissions')
      .select('*')
      .eq('client_id', clientData.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load design submissions',
        variant: 'destructive',
      });
    } else {
      setSubmissions((data as DesignSubmission[]) || []);
    }
  };

  const fetchMessages = async () => {
    if (!clientData) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('client_id', clientData.id)
      .order('created_at', { ascending: true });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive',
      });
    } else {
      setMessages(data || []);
    }
  };

  const subscribeToMessages = () => {
    if (!clientData) return () => {};

    const channel = supabase
      .channel('client-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `client_id=eq.${clientData.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendNotification = async (type: 'design_approved' | 'design_rejected' | 'new_message', extra: { designTitle?: string; messagePreview?: string; feedback?: string }) => {
    try {
      await supabase.functions.invoke('send-notification', {
        body: {
          type,
          clientName: clientData?.name || profile?.full_name || 'Client',
          clientEmail: profile?.email,
          ...extra,
        },
      });
    } catch (err) {
      console.error('Failed to send notification:', err);
    }
  };

  const handleApproval = async (submissionId: string, status: 'approved' | 'rejected') => {
    const submission = submissions.find((s) => s.id === submissionId);
    const { error } = await supabase
      .from('design_submissions')
      .update({
        status,
        feedback: feedback[submissionId] || null,
      })
      .eq('id', submissionId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update submission',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: `Design ${status}`,
      });

      sendNotification(
        status === 'approved' ? 'design_approved' : 'design_rejected',
        { designTitle: submission?.title || 'Unknown', feedback: feedback[submissionId] }
      );

      fetchSubmissions();
      setFeedback((prev) => {
        const newFeedback = { ...prev };
        delete newFeedback[submissionId];
        return newFeedback;
      });
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !clientData || !user) return;

    setSending(true);
    const messageText = newMessage;
    const { error } = await supabase.from('messages').insert({
      client_id: clientData.id,
      sender_id: user.id,
      message: messageText,
    });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    } else {
      setNewMessage('');
      sendNotification('new_message', { messagePreview: messageText.substring(0, 200) });
    }
    setSending(false);
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const ALLOWED_FILE_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !clientData || !user) return;

    const file = e.target.files[0];

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 10MB',
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Allowed: images, PDFs, Word, Excel, and text files',
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('client-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('client-files')
        .createSignedUrl(fileName, 60 * 60 * 24 * 7);

      if (signedUrlError) throw signedUrlError;

      const { error: messageError } = await supabase.from('messages').insert({
        client_id: clientData.id,
        sender_id: user.id,
        message: `Uploaded file: ${file.name}`,
        file_url: signedUrlData.signedUrl,
      });

      if (messageError) throw messageError;

      toast({
        title: 'Success',
        description: 'File uploaded successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to upload file',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: profileForm.full_name })
      .eq('id', user.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Profile updated',
      });
      setEditingProfile(false);
      fetchProfileAndClientData();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin-auth');
  };

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="aurora-bg fixed inset-0 pointer-events-none" />
        <div className="relative z-10">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const displayName = clientData?.name || profile?.full_name || profile?.email || 'User';
  const displayEmail = profile?.email || '';

  return (
    <div className="min-h-screen relative overflow-hidden pb-24">
      {/* Aurora background */}
      <div className="aurora-bg fixed inset-0 pointer-events-none" />
      
      {/* Ambient orbs */}
      <div className="fixed top-[-10%] left-[-5%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] rounded-full bg-gradient-to-br from-primary/15 via-primary-glow/10 to-transparent blur-3xl pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[35vw] h-[35vw] max-w-[400px] max-h-[400px] rounded-full bg-gradient-to-tl from-accent-cyan/10 via-primary/10 to-transparent blur-3xl pointer-events-none" />
      
      {/* Tech grid */}
      <div className="tech-grid fixed inset-0 pointer-events-none opacity-20" />
      
      <div className="relative z-10 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 animate-slide-up-premium">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-primary blur-xl opacity-40 scale-125" />
                <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow relative z-10">
                  <User className="w-7 h-7 text-primary-foreground" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold font-display">
                  Welcome, <span className="gradient-text">{displayName}</span>
                </h1>
                <p className="text-muted-foreground">{displayEmail}</p>
              </div>
            </div>
            <Button 
              onClick={handleSignOut} 
              variant="glass" 
              className="rounded-full px-6 group"
            >
              <LogOut className="mr-2 h-4 w-4 group-hover:rotate-12 transition-transform" />
              Sign Out
            </Button>
          </div>

          <Tabs defaultValue={clientData ? "designs" : "account"} className="w-full">
            <TabsList className={`glass-card p-1.5 grid w-full mb-8 rounded-2xl border border-glass-border shadow-glass animate-slide-up-premium stagger-2 ${clientData ? 'grid-cols-5' : 'grid-cols-1'}`}>
              <TabsTrigger 
                value="account"
                className="rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow transition-all duration-300"
              >
                <User className="mr-2 h-4 w-4" />
                Account
              </TabsTrigger>
              {clientData && (
                <>
                  <TabsTrigger 
                    value="project"
                    className="rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow transition-all duration-300"
                  >
                    <Target className="mr-2 h-4 w-4" />
                    Project
                  </TabsTrigger>
                  <TabsTrigger 
                    value="files"
                    className="rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow transition-all duration-300"
                  >
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Files
                  </TabsTrigger>
                  <TabsTrigger 
                    value="designs"
                    className="rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow transition-all duration-300"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Designs
                  </TabsTrigger>
                  <TabsTrigger 
                    value="chat"
                    className="rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow transition-all duration-300"
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Chat
                  </TabsTrigger>
                </>
              )}
            </TabsList>

            {/* Account Tab */}
            <TabsContent value="account" className="animate-slide-up-premium stagger-3">
              <div className="space-y-6 max-w-2xl">
                <Card className="glass-card border-glass-border rounded-3xl p-6 shadow-glass overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent-cyan/5 pointer-events-none" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
                        <User className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <h3 className="text-xl font-bold font-display gradient-text">Profile Information</h3>
                    </div>
                    
                    {editingProfile ? (
                      <div className="space-y-4">
                        <div>
                          <Label>Full Name</Label>
                          <Input
                            value={profileForm.full_name}
                            onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                            placeholder="Your name"
                            className="glass-card border-glass-border rounded-xl mt-1"
                          />
                        </div>
                        <div>
                          <Label>Email</Label>
                          <Input value={displayEmail} disabled className="bg-muted/50 rounded-xl mt-1" />
                        </div>
                        <div className="flex gap-3 pt-2">
                          <Button 
                            onClick={handleUpdateProfile}
                            className="rounded-xl bg-gradient-primary shadow-glow"
                          >
                            <Save className="mr-2 h-4 w-4" />
                            Save
                          </Button>
                          <Button variant="glass" className="rounded-xl" onClick={() => setEditingProfile(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-muted/30 border border-glass-border">
                          <p className="text-sm text-muted-foreground mb-1">Name</p>
                          <p className="font-semibold text-foreground">{displayName}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-muted/30 border border-glass-border">
                          <p className="text-sm text-muted-foreground mb-1">Email</p>
                          <p className="font-semibold text-foreground">{displayEmail}</p>
                        </div>
                        {clientData?.company && (
                          <div className="p-4 rounded-2xl bg-muted/30 border border-glass-border">
                            <p className="text-sm text-muted-foreground mb-1">Company</p>
                            <p className="font-semibold text-foreground">{clientData.company}</p>
                          </div>
                        )}
                        {clientData?.phone && (
                          <div className="p-4 rounded-2xl bg-muted/30 border border-glass-border">
                            <p className="text-sm text-muted-foreground mb-1">Phone</p>
                            <p className="font-semibold text-foreground">{clientData.phone}</p>
                          </div>
                        )}
                        <Button 
                          variant="glass" 
                          className="rounded-xl mt-2" 
                          onClick={() => setEditingProfile(true)}
                        >
                          <Settings className="mr-2 h-4 w-4" />
                          Edit Profile
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>

                {!clientData && (
                  <Card className="glass-card border-glass-border border-dashed rounded-3xl p-8 shadow-glass">
                    <div className="text-center py-8">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-xl font-bold font-display mb-2">No Active Project</h3>
                      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                        You don't have an active project yet. Once you start a project with us, 
                        you'll be able to view design submissions and chat with our team here.
                      </p>
                      <Button 
                        onClick={() => navigate('/contact')}
                        className="rounded-xl bg-gradient-primary shadow-glow"
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        Start a Project
                      </Button>
                    </div>
                  </Card>
                )}

                {clientData && (
                  <Card className="glass-card border-glass-border rounded-3xl p-6 shadow-glass overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/5 via-transparent to-primary/5 pointer-events-none" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-cyan to-accent-green flex items-center justify-center shadow-glow">
                          <FileText className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <h3 className="text-xl font-bold font-display gradient-text">Project Summary</h3>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 rounded-2xl bg-muted/30 border border-glass-border text-center group hover:shadow-glow transition-all duration-300">
                          <p className="text-3xl font-bold gradient-text group-hover:scale-110 transition-transform">{submissions.length}</p>
                          <p className="text-sm text-muted-foreground mt-1">Total Designs</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-muted/30 border border-glass-border text-center group hover:shadow-glow transition-all duration-300">
                          <p className="text-3xl font-bold text-accent-green group-hover:scale-110 transition-transform">
                            {submissions.filter(s => s.status === 'approved').length}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">Approved</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-muted/30 border border-glass-border text-center group hover:shadow-glow transition-all duration-300">
                          <p className="text-3xl font-bold text-warning group-hover:scale-110 transition-transform">
                            {submissions.filter(s => s.status === 'pending').length}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">Pending</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Project Portal Tab */}
            {clientData && (
              <TabsContent value="project" className="animate-slide-up-premium stagger-3">
                <ProjectPortal clientId={clientData.id} />
              </TabsContent>
            )}

            {/* Files Tab */}
            {clientData && (
              <TabsContent value="files" className="animate-slide-up-premium stagger-3">
                <FileSharing clientId={clientData.id} />
              </TabsContent>
            )}

            {/* Design Approvals Tab */}
            {clientData && (
              <TabsContent value="designs" className="animate-slide-up-premium stagger-3">
                <div className="space-y-6">
                  {submissions.length === 0 ? (
                    <Card className="glass-card border-glass-border rounded-3xl p-12 text-center shadow-glass">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground text-lg">No design submissions yet</p>
                    </Card>
                  ) : (
                    submissions.map((submission, index) => (
                      <Card 
                        key={submission.id} 
                        className="glass-card border-glass-border rounded-3xl p-6 shadow-glass overflow-hidden relative group"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                        <div className="relative z-10">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-xl font-bold font-display mb-2">{submission.title}</h3>
                              <p className="text-muted-foreground">{submission.description}</p>
                            </div>
                            <Badge
                              className={`rounded-full px-4 py-1.5 ${
                                submission.status === 'approved'
                                  ? 'bg-accent-green/20 text-accent-green border-accent-green/30'
                                  : submission.status === 'rejected'
                                  ? 'bg-destructive/20 text-destructive border-destructive/30'
                                  : 'bg-warning/20 text-warning border-warning/30'
                              }`}
                            >
                              {submission.status === 'approved' && <CheckCircle className="mr-1 h-4 w-4" />}
                              {submission.status === 'rejected' && <XCircle className="mr-1 h-4 w-4" />}
                              {submission.status === 'pending' && <Clock className="mr-1 h-4 w-4" />}
                              {submission.status}
                            </Badge>
                          </div>

                          <img
                            src={submission.file_url}
                            alt={submission.title}
                            className="w-full h-64 object-cover rounded-2xl mb-4 border border-glass-border shadow-glass"
                          />

                          {submission.status === 'pending' && (
                            <div className="space-y-4">
                              <Textarea
                                placeholder="Add feedback (optional)"
                                value={feedback[submission.id] || ''}
                                onChange={(e) =>
                                  setFeedback((prev) => ({ ...prev, [submission.id]: e.target.value }))
                                }
                                className="glass-card border-glass-border rounded-xl"
                              />
                              <div className="flex gap-3">
                                <Button
                                  onClick={() => handleApproval(submission.id, 'approved')}
                                  className="flex-1 rounded-xl bg-gradient-to-r from-accent-green to-accent-cyan shadow-glow"
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Approve
                                </Button>
                                <Button
                                  onClick={() => handleApproval(submission.id, 'rejected')}
                                  variant="destructive"
                                  className="flex-1 rounded-xl"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          )}

                          {submission.feedback && (
                            <div className="mt-4 p-4 rounded-2xl bg-muted/30 border border-glass-border">
                              <p className="text-sm font-semibold mb-1 text-foreground">Your Feedback:</p>
                              <p className="text-sm text-muted-foreground">{submission.feedback}</p>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            )}

            {/* Chat Tab */}
            {clientData && (
              <TabsContent value="chat" className="animate-slide-up-premium stagger-3">
                <Card className="glass-card border-glass-border rounded-3xl p-6 shadow-glass overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent-cyan/5 pointer-events-none" />
                  <div className="relative z-10">
                    <div className="mb-6">
                      <label className="block mb-2 text-sm font-semibold text-foreground">Upload File</label>
                      <Input
                        type="file"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="cursor-pointer glass-card border-glass-border rounded-xl"
                      />
                      {uploading && (
                        <p className="text-sm text-primary mt-2 flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Uploading...
                        </p>
                      )}
                    </div>

                    <div className="h-[400px] overflow-y-auto mb-4 space-y-4 p-4 rounded-2xl border border-glass-border bg-muted/20">
                      {messages.length === 0 ? (
                        <div className="text-center text-muted-foreground py-12">
                          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                            <MessageSquare className="h-7 w-7 opacity-50" />
                          </div>
                          <p>No messages yet. Start a conversation!</p>
                        </div>
                      ) : (
                        messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${
                              message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <div
                              className={`max-w-[70%] rounded-2xl p-4 shadow-glass ${
                                message.sender_id === user?.id
                                  ? 'bg-gradient-primary text-primary-foreground'
                                  : 'glass-card border border-glass-border'
                              }`}
                            >
                              <p className="text-sm">{message.message}</p>
                              {message.file_url && (
                                <a
                                  href={message.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs underline mt-2 block opacity-80 hover:opacity-100 transition-opacity"
                                >
                                  View File
                                </a>
                              )}
                              <p className="text-xs opacity-60 mt-2">
                                {new Date(message.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex gap-3">
                      <Textarea
                        placeholder="Type your message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        className="flex-1 glass-card border-glass-border rounded-xl"
                      />
                      <Button 
                        onClick={handleSendMessage} 
                        disabled={sending || !newMessage.trim()}
                        className="rounded-xl bg-gradient-primary shadow-glow px-6"
                      >
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
                      </Button>
                    </div>
                  </div>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
