import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Save, User, Mail, Bell, Shield, Palette } from 'lucide-react';

interface BusinessSettings {
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  businessAddress: string;
  notifyOnNewClient: boolean;
  notifyOnDesignApproval: boolean;
  notifyOnMessage: boolean;
  autoArchiveCompleted: boolean;
}

export function SettingsManager() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({ full_name: '', email: '' });
  const [settings, setSettings] = useState<BusinessSettings>({
    businessName: 'Brain Bulb',
    businessEmail: '',
    businessPhone: '',
    businessAddress: '',
    notifyOnNewClient: true,
    notifyOnDesignApproval: true,
    notifyOnMessage: true,
    autoArchiveCompleted: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
      loadSettings();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user?.id)
      .single();

    if (data) {
      setProfile({ full_name: data.full_name || '', email: data.email });
    }
  };

  const loadSettings = () => {
    const saved = localStorage.getItem('brainbulb_settings');
    if (saved) {
      setSettings({ ...settings, ...JSON.parse(saved) });
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: profile.full_name })
      .eq('id', user?.id);

    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated');
    }
    setSaving(false);
  };

  const handleSaveSettings = () => {
    localStorage.setItem('brainbulb_settings', JSON.stringify(settings));
    toast.success('Settings saved');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold mb-2">Settings</h2>
        <p className="text-muted-foreground">Manage your account and business settings</p>
      </div>

      {/* Profile Section */}
      <Card className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <User className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Profile</h3>
        </div>
        <div className="space-y-4">
          <div>
            <Label>Full Name</Label>
            <Input
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              placeholder="Your name"
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={profile.email} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
          </div>
          <Button onClick={handleSaveProfile} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            Save Profile
          </Button>
        </div>
      </Card>

      {/* Business Info Section */}
      <Card className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Palette className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Business Information</h3>
        </div>
        <div className="space-y-4">
          <div>
            <Label>Business Name</Label>
            <Input
              value={settings.businessName}
              onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
            />
          </div>
          <div>
            <Label>Business Email</Label>
            <Input
              type="email"
              value={settings.businessEmail}
              onChange={(e) => setSettings({ ...settings, businessEmail: e.target.value })}
              placeholder="contact@brainbulb.com"
            />
          </div>
          <div>
            <Label>Business Phone</Label>
            <Input
              value={settings.businessPhone}
              onChange={(e) => setSettings({ ...settings, businessPhone: e.target.value })}
              placeholder="+44 ..."
            />
          </div>
          <div>
            <Label>Business Address</Label>
            <Textarea
              value={settings.businessAddress}
              onChange={(e) => setSettings({ ...settings, businessAddress: e.target.value })}
              placeholder="Your business address"
              rows={3}
            />
          </div>
        </div>
      </Card>

      {/* Notifications Section */}
      <Card className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Notifications</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">New Client Notifications</p>
              <p className="text-sm text-muted-foreground">Get notified when a new lead submits a form</p>
            </div>
            <Switch
              checked={settings.notifyOnNewClient}
              onCheckedChange={(checked) => setSettings({ ...settings, notifyOnNewClient: checked })}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Design Approval Notifications</p>
              <p className="text-sm text-muted-foreground">Get notified when a client approves/rejects a design</p>
            </div>
            <Switch
              checked={settings.notifyOnDesignApproval}
              onCheckedChange={(checked) => setSettings({ ...settings, notifyOnDesignApproval: checked })}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Message Notifications</p>
              <p className="text-sm text-muted-foreground">Get notified when you receive a new message</p>
            </div>
            <Switch
              checked={settings.notifyOnMessage}
              onCheckedChange={(checked) => setSettings({ ...settings, notifyOnMessage: checked })}
            />
          </div>
        </div>
      </Card>

      {/* Workflow Section */}
      <Card className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Workflow</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Auto-Archive Completed Projects</p>
              <p className="text-sm text-muted-foreground">Automatically archive clients when all designs are approved</p>
            </div>
            <Switch
              checked={settings.autoArchiveCompleted}
              onCheckedChange={(checked) => setSettings({ ...settings, autoArchiveCompleted: checked })}
            />
          </div>
        </div>
      </Card>

      <Button onClick={handleSaveSettings} size="lg" className="w-full">
        <Save className="mr-2 h-4 w-4" />
        Save All Settings
      </Button>
    </div>
  );
}
