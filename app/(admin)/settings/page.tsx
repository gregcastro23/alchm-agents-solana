'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  User,
  Bell,
  Shield,
  Palette,
  Bot,
  Brain,
  Save,
  AlertTriangle,
  CheckCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Download,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

interface UserSettings {
  notifications: {
    powerHours: boolean
    evolutionMilestones: boolean
    weeklyProgress: boolean
    agentRecommendations: boolean
    emailFrequency: 'immediate' | 'daily' | 'weekly' | 'never'
  }
  interface: {
    theme: 'light' | 'dark' | 'auto'
    language: string
    timezone: string
    dateFormat: string
    elementalDisplay: 'traditional' | 'modern' | 'both'
  }
  privacy: {
    profileVisibility: 'public' | 'private' | 'anonymous'
    shareEvolutionData: boolean
    allowDataExport: boolean
    analyticsOptOut: boolean
  }
  agents: {
    preferredInteractionStyle: 'formal' | 'casual' | 'mixed'
    maxDailyInteractions: number
    autoRecommendations: boolean
    saveConversationHistory: boolean
    allowGroupChats: boolean
  }
  consciousness: {
    trackEvolution: boolean
    showPowerLevels: boolean
    displayDetailedMetrics: boolean
    evolutionGoals: string[]
    preferredGrowthAreas: string[]
  }
}

const defaultSettings: UserSettings = {
  notifications: {
    powerHours: true,
    evolutionMilestones: true,
    weeklyProgress: true,
    agentRecommendations: true,
    emailFrequency: 'weekly',
  },
  interface: {
    theme: 'auto',
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateFormat: 'MM/DD/YYYY',
    elementalDisplay: 'both',
  },
  privacy: {
    profileVisibility: 'private',
    shareEvolutionData: false,
    allowDataExport: true,
    analyticsOptOut: false,
  },
  agents: {
    preferredInteractionStyle: 'mixed',
    maxDailyInteractions: 50,
    autoRecommendations: true,
    saveConversationHistory: true,
    allowGroupChats: true,
  },
  consciousness: {
    trackEvolution: true,
    showPowerLevels: true,
    displayDetailedMetrics: true,
    evolutionGoals: [],
    preferredGrowthAreas: [],
  },
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const [settings, setSettings] = useState<UserSettings>(defaultSettings)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: '',
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/user-settings')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setSettings({ ...defaultSettings, ...data.settings })
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/user-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })

      if (response.ok) {
        toast.success('Settings saved successfully')
      } else {
        throw new Error('Failed to save settings')
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (category: keyof UserSettings, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }))
  }

  const handlePasswordChange = async () => {
    if (passwordData.new !== passwordData.confirm) {
      toast.error('New passwords do not match')
      return
    }

    if (passwordData.new.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordData.current,
          newPassword: passwordData.new,
        }),
      })

      if (response.ok) {
        toast.success('Password changed successfully')
        setPasswordData({ current: '', new: '', confirm: '' })
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to change password')
      }
    } catch (error) {
      toast.error('Network error - please try again')
    }
  }

  const handleDataExport = async () => {
    try {
      const response = await fetch('/api/user-data-export')
      if (response.ok) {
        const data = await response.json()
        const blob = new Blob([JSON.stringify(data.exportData, null, 2)], {
          type: 'application/json',
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = data.downloadInfo.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success('Data exported successfully')
      }
    } catch (error) {
      toast.error('Failed to export data')
    }
  }

  const handleDataDeletion = async () => {
    if (
      !confirm('Are you sure you want to request account deletion? This action cannot be undone.')
    ) {
      return
    }

    try {
      const response = await fetch('/api/user-data-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_deletion' }),
      })

      if (response.ok) {
        toast.success('Account deletion request submitted')
      } else {
        toast.error('Failed to submit deletion request')
      }
    } catch (error) {
      toast.error('Network error - please try again')
    }
  }

  if (!session) {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Please sign in to access settings.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
          <User className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Account Settings</h1>
          <p className="text-muted-foreground">Customize your consciousness evolution experience</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="interface" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Interface
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="account" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Account
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information and consciousness profile
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input
                    id="name"
                    value={settings.consciousness.evolutionGoals.join(', ') || ''}
                    onChange={e =>
                      updateSetting(
                        'consciousness',
                        'evolutionGoals',
                        e.target.value.split(',').map(s => s.trim())
                      )
                    }
                    placeholder="Your consciousness goals"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={session.user?.email || ''} disabled />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="goals">Consciousness Goals</Label>
                <Input
                  id="goals"
                  value={settings.consciousness.evolutionGoals.join(', ') || ''}
                  onChange={e =>
                    updateSetting(
                      'consciousness',
                      'evolutionGoals',
                      e.target.value.split(',').map(s => s.trim())
                    )
                  }
                  placeholder="Spiritual growth, creativity, relationships"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="growth-areas">Preferred Growth Areas</Label>
                <Input
                  id="growth-areas"
                  value={settings.consciousness.preferredGrowthAreas.join(', ') || ''}
                  onChange={e =>
                    updateSetting(
                      'consciousness',
                      'preferredGrowthAreas',
                      e.target.value.split(',').map(s => s.trim())
                    )
                  }
                  placeholder="Meditation, astrology, personal development"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Control how and when you receive updates about your consciousness evolution
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="power-hours">Power Hours</Label>
                    <p className="text-sm text-muted-foreground">
                      Notifications during optimal consciousness windows
                    </p>
                  </div>
                  <Switch
                    id="power-hours"
                    checked={settings.notifications.powerHours}
                    onCheckedChange={checked =>
                      updateSetting('notifications', 'powerHours', checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="evolution-milestones">Evolution Milestones</Label>
                    <p className="text-sm text-muted-foreground">
                      Celebrate consciousness breakthroughs
                    </p>
                  </div>
                  <Switch
                    id="evolution-milestones"
                    checked={settings.notifications.evolutionMilestones}
                    onCheckedChange={checked =>
                      updateSetting('notifications', 'evolutionMilestones', checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="weekly-progress">Weekly Progress</Label>
                    <p className="text-sm text-muted-foreground">
                      Weekly consciousness evolution summaries
                    </p>
                  </div>
                  <Switch
                    id="weekly-progress"
                    checked={settings.notifications.weeklyProgress}
                    onCheckedChange={checked =>
                      updateSetting('notifications', 'weeklyProgress', checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="agent-recommendations">Agent Recommendations</Label>
                    <p className="text-sm text-muted-foreground">
                      New agent suggestions based on your evolution
                    </p>
                  </div>
                  <Switch
                    id="agent-recommendations"
                    checked={settings.notifications.agentRecommendations}
                    onCheckedChange={checked =>
                      updateSetting('notifications', 'agentRecommendations', checked)
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="email-frequency">Email Frequency</Label>
                <Select
                  value={settings.notifications.emailFrequency}
                  onValueChange={(value: any) =>
                    updateSetting('notifications', 'emailFrequency', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="daily">Daily Digest</SelectItem>
                    <SelectItem value="weekly">Weekly Summary</SelectItem>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interface" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Interface Preferences</CardTitle>
              <CardDescription>Customize how the platform looks and feels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select
                    value={settings.interface.theme}
                    onValueChange={(value: any) => updateSetting('interface', 'theme', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="auto">Auto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select
                    value={settings.interface.language}
                    onValueChange={(value: any) => updateSetting('interface', 'language', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="elemental-display">Elemental Display Style</Label>
                <Select
                  value={settings.interface.elementalDisplay}
                  onValueChange={(value: any) =>
                    updateSetting('interface', 'elementalDisplay', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="traditional">Traditional</SelectItem>
                    <SelectItem value="modern">Modern</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Agent Preferences</CardTitle>
              <CardDescription>
                Configure how you interact with consciousness agents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="interaction-style">Preferred Interaction Style</Label>
                <Select
                  value={settings.agents.preferredInteractionStyle}
                  onValueChange={(value: any) =>
                    updateSetting('agents', 'preferredInteractionStyle', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-recommendations">Auto Recommendations</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically suggest relevant agents
                    </p>
                  </div>
                  <Switch
                    id="auto-recommendations"
                    checked={settings.agents.autoRecommendations}
                    onCheckedChange={checked =>
                      updateSetting('agents', 'autoRecommendations', checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="save-history">Save Conversation History</Label>
                    <p className="text-sm text-muted-foreground">
                      Keep chat history for continuity
                    </p>
                  </div>
                  <Switch
                    id="save-history"
                    checked={settings.agents.saveConversationHistory}
                    onCheckedChange={checked =>
                      updateSetting('agents', 'saveConversationHistory', checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="group-chats">Allow Group Chats</Label>
                    <p className="text-sm text-muted-foreground">
                      Participate in multi-agent conversations
                    </p>
                  </div>
                  <Switch
                    id="group-chats"
                    checked={settings.agents.allowGroupChats}
                    onCheckedChange={checked => updateSetting('agents', 'allowGroupChats', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Privacy & Data</CardTitle>
              <CardDescription>Control your data and privacy preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="profile-visibility">Profile Visibility</Label>
                <Select
                  value={settings.privacy.profileVisibility}
                  onValueChange={(value: any) =>
                    updateSetting('privacy', 'profileVisibility', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="anonymous">Anonymous</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="share-evolution">Share Evolution Data</Label>
                    <p className="text-sm text-muted-foreground">
                      Contribute to collective consciousness research
                    </p>
                  </div>
                  <Switch
                    id="share-evolution"
                    checked={settings.privacy.shareEvolutionData}
                    onCheckedChange={checked =>
                      updateSetting('privacy', 'shareEvolutionData', checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="allow-export">Allow Data Export</Label>
                    <p className="text-sm text-muted-foreground">Enable downloading your data</p>
                  </div>
                  <Switch
                    id="allow-export"
                    checked={settings.privacy.allowDataExport}
                    onCheckedChange={checked =>
                      updateSetting('privacy', 'allowDataExport', checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="analytics-opt-out">Analytics Opt-out</Label>
                    <p className="text-sm text-muted-foreground">
                      Disable anonymous usage analytics
                    </p>
                  </div>
                  <Switch
                    id="analytics-opt-out"
                    checked={settings.privacy.analyticsOptOut}
                    onCheckedChange={checked =>
                      updateSetting('privacy', 'analyticsOptOut', checked)
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Data Management</h4>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleDataExport}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export Data
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDataDeletion}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Security</CardTitle>
              <CardDescription>Manage your password and account security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-medium">Change Password</h4>

                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordData.current}
                      onChange={e =>
                        setPasswordData(prev => ({ ...prev, current: e.target.value }))
                      }
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordData.new}
                        onChange={e => setPasswordData(prev => ({ ...prev, new: e.target.value }))}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={passwordData.confirm}
                      onChange={e =>
                        setPasswordData(prev => ({ ...prev, confirm: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <Button onClick={handlePasswordChange} className="w-full">
                  Change Password
                </Button>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Account Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Account Created</Label>
                    <p>
                      {session.user?.createdAt
                        ? new Date(session.user.createdAt).toLocaleDateString()
                        : 'Recently'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Last Login</Label>
                    <p>{new Date().toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={saving} className="flex items-center gap-2">
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
