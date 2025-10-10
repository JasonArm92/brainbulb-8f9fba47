import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  email: string;
}

interface Message {
  id: string;
  message: string;
  file_url: string | null;
  sender_id: string;
  created_at: string;
}

export const ChatManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      fetchMessages();
      subscribeToMessages();
    }
  }, [selectedClientId]);

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

  const fetchMessages = async () => {
    if (!selectedClientId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('client_id', selectedClientId)
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
    setLoading(false);
  };

  const subscribeToMessages = () => {
    if (!selectedClientId) return;

    const channel = supabase
      .channel('admin-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `client_id=eq.${selectedClientId}`,
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

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedClientId || !user) return;

    setSending(true);
    const { error } = await supabase.from('messages').insert({
      client_id: selectedClientId,
      sender_id: user.id,
      message: newMessage,
    });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    } else {
      setNewMessage('');
    }
    setSending(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Client Chat</h2>
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a client to chat with" />
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

      {selectedClientId && (
        <Card className="p-6">
          <div className="h-[400px] overflow-y-auto mb-4 space-y-4 p-4 border rounded-lg">
            {loading ? (
              <div className="flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
      )}
    </div>
  );
};
