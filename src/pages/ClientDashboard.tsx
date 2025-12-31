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
import { Loader2, CheckCircle, XCircle, Clock, Upload, MessageSquare, FileText, LogOut, User, Settings, Save, Target } from 'lucide-react';
import { ProjectPortal } from '@/components/client/ProjectPortal';

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
      // First fetch the profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('id', user?.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setProfileForm({ full_name: profileData.full_name || '' });

        // Then try to find matching client
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

      // Send email notification to admin
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
      // Send email notification to admin
      sendNotification('new_message', { messagePreview: messageText.substring(0, 200) });
    }
    setSending(false);
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show account page even if no client project
  const displayName = clientData?.name || profile?.full_name || profile?.email || 'User';
  const displayEmail = profile?.email || '';

  return (
    <div className="min-h-screen bg-gradient-hero py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Welcome, {displayName}</h1>
            <p className="text-muted-foreground">{displayEmail}</p>
          </div>
          <Button onClick={handleSignOut} variant="outline">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        <Tabs defaultValue={clientData ? "designs" : "account"} className="w-full">
          <TabsList className={`grid w-full mb-8 ${clientData ? 'grid-cols-4' : 'grid-cols-1'}`}>
            <TabsTrigger value="account">
              <User className="mr-2 h-4 w-4" />
              Account
            </TabsTrigger>
            {clientData && (
              <>
                <TabsTrigger value="project">
                  <Target className="mr-2 h-4 w-4" />
                  Project
                </TabsTrigger>
                <TabsTrigger value="designs">
                  <FileText className="mr-2 h-4 w-4" />
                  Designs
                </TabsTrigger>
                <TabsTrigger value="chat">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Chat
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Account Tab - Always visible */}
          <TabsContent value="account">
            <div className="space-y-6 max-w-2xl">
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <User className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Profile Information</h3>
                </div>
                
                {editingProfile ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Full Name</Label>
                      <Input
                        value={profileForm.full_name}
                        onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input value={displayEmail} disabled className="bg-muted" />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleUpdateProfile}>
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </Button>
                      <Button variant="outline" onClick={() => setEditingProfile(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{displayName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{displayEmail}</p>
                    </div>
                    {clientData?.company && (
                      <div>
                        <p className="text-sm text-muted-foreground">Company</p>
                        <p className="font-medium">{clientData.company}</p>
                      </div>
                    )}
                    {clientData?.phone && (
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{clientData.phone}</p>
                      </div>
                    )}
                    <Button variant="outline" onClick={() => setEditingProfile(true)}>
                      <Settings className="mr-2 h-4 w-4" />
                      Edit Profile
                    </Button>
                  </div>
                )}
              </Card>

              {!clientData && (
                <Card className="p-6 border-dashed">
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Active Project</h3>
                    <p className="text-muted-foreground mb-4">
                      You don't have an active project yet. Once you start a project with us, 
                      you'll be able to view design submissions and chat with our team here.
                    </p>
                    <Button onClick={() => navigate('/contact')}>
                      Start a Project
                    </Button>
                  </div>
                </Card>
              )}

              {clientData && (
                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <FileText className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Project Summary</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold text-primary">{submissions.length}</p>
                      <p className="text-sm text-muted-foreground">Total Designs</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold text-green-500">
                        {submissions.filter(s => s.status === 'approved').length}
                      </p>
                      <p className="text-sm text-muted-foreground">Approved</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold text-yellow-500">
                        {submissions.filter(s => s.status === 'pending').length}
                      </p>
                      <p className="text-sm text-muted-foreground">Pending</p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Project Portal Tab - Only if client has project */}
          {clientData && (
            <TabsContent value="project">
              <ProjectPortal clientId={clientData.id} />
            </TabsContent>
          )}

          {/* Design Approvals Tab - Only if client has project */}
          {clientData && (
            <TabsContent value="designs">
              <div className="space-y-4">
                {submissions.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-muted-foreground">No design submissions yet</p>
                  </Card>
                ) : (
                  submissions.map((submission) => (
                    <Card key={submission.id} className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-semibold mb-2">{submission.title}</h3>
                          <p className="text-muted-foreground mb-4">{submission.description}</p>
                        </div>
                        <Badge
                          variant={
                            submission.status === 'approved'
                              ? 'default'
                              : submission.status === 'rejected'
                              ? 'destructive'
                              : 'secondary'
                          }
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
                        className="w-full h-64 object-cover rounded-lg mb-4"
                      />

                      {submission.status === 'pending' && (
                        <div className="space-y-4">
                          <Textarea
                            placeholder="Add feedback (optional)"
                            value={feedback[submission.id] || ''}
                            onChange={(e) =>
                              setFeedback((prev) => ({ ...prev, [submission.id]: e.target.value }))
                            }
                          />
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleApproval(submission.id, 'approved')}
                              className="flex-1"
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              onClick={() => handleApproval(submission.id, 'rejected')}
                              variant="destructive"
                              className="flex-1"
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      )}

                      {submission.feedback && (
                        <div className="mt-4 p-4 bg-muted rounded-lg">
                          <p className="text-sm font-medium mb-1">Your Feedback:</p>
                          <p className="text-sm text-muted-foreground">{submission.feedback}</p>
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          )}

          {/* Chat Tab - Only if client has project */}
          {clientData && (
            <TabsContent value="chat">
              <Card className="p-6">
                <div className="mb-6">
                  <label className="block mb-2 text-sm font-medium">Upload File</label>
                  <Input
                    type="file"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="cursor-pointer"
                  />
                  {uploading && (
                    <p className="text-sm text-muted-foreground mt-2">Uploading...</p>
                  )}
                </div>

                <div className="h-[400px] overflow-y-auto mb-4 space-y-4 p-4 border rounded-lg">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
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
                          className={`max-w-[70%] rounded-lg p-3 ${
                            message.sender_id === user?.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm">{message.message}</p>
                          {message.file_url && (
                            <a
                              href={message.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs underline mt-2 block"
                            >
                              View File
                            </a>
                          )}
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(message.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-2">
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
                    className="flex-1"
                  />
                  <Button onClick={handleSendMessage} disabled={sending || !newMessage.trim()}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
                  </Button>
                </div>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
