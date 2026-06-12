'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Bell,
  BellRing,
  Check,
  X,
  Clock,
  AlertTriangle,
  Star,
  Zap,
  Calendar,
  Settings,
  Filter,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

interface TransitNotification {
  id: string
  title: string
  message: string
  notifyDate: string
  transitDate: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  urgency: 'normal' | 'urgent' | 'time_sensitive'
  category: 'personal_transit' | 'agent_activation' | 'consciousness_breakthrough'
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'dismissed'
  deliveryMethod: string
  interactionCount: number
  createdAt: string
  natalChart?: {
    chartName: string
    dominantElement: string
    dominantModality: string
  }
}

interface NotificationStatistics {
  total: number
  unread: number
  byPriority: Record<string, number>
  byCategory: Record<string, number>
  recentActivity: number
}

interface TransitNotificationCenterProps {
  userId: string
}

export function TransitNotificationCenter({ userId }: TransitNotificationCenterProps) {
  const [notifications, setNotifications] = useState<TransitNotification[]>([])
  const [statistics, setStatistics] = useState<NotificationStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('unread')
  const [showSettings, setShowSettings] = useState(false)

  // Load notifications and statistics
  const loadNotifications = async () => {
    try {
      setLoading(true)

      // Load notifications
      const params = new URLSearchParams({
        userId,
        limit: '50',
        includeRead: filterStatus === 'all' ? 'true' : 'false',
      })

      if (filterPriority !== 'all') {
        params.set('priorities', filterPriority)
      }
      if (filterCategory !== 'all') {
        params.set('categories', filterCategory)
      }

      const [notificationsResponse, statsResponse] = await Promise.all([
        fetch(`/api/transit-notifications?${params}`),
        fetch(`/api/transit-notifications?userId=${userId}&stats=true`),
      ])

      if (!notificationsResponse.ok || !statsResponse.ok) {
        throw new Error('Failed to load notifications')
      }

      const notificationsData = await notificationsResponse.json()
      const statsData = await statsResponse.json()

      setNotifications(notificationsData.notifications || [])
      setStatistics(statsData.statistics)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [userId, filterPriority, filterCategory, filterStatus])

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(
        `/api/transit-notifications/${notificationId}?userId=${userId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mark_read' }),
        }
      )

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === notificationId ? { ...n, status: 'read' } : n))
        )
        // Update statistics
        setStatistics(prev =>
          prev
            ? {
                ...prev,
                unread: Math.max(0, prev.unread - 1),
              }
            : null
        )
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }

  // Dismiss notification
  const dismissNotification = async (notificationId: string) => {
    try {
      const response = await fetch(
        `/api/transit-notifications/${notificationId}?userId=${userId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'dismiss' }),
        }
      )

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === notificationId ? { ...n, status: 'dismissed' } : n))
        )
        // Update statistics
        setStatistics(prev =>
          prev
            ? {
                ...prev,
                unread: Math.max(0, prev.unread - 1),
              }
            : null
        )
      }
    } catch (err) {
      console.error('Failed to dismiss notification:', err)
    }
  }

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch(
        `/api/transit-notifications/${notificationId}?userId=${userId}`,
        {
          method: 'DELETE',
        }
      )

      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
        setStatistics(prev =>
          prev
            ? {
                ...prev,
                total: prev.total - 1,
                unread: Math.max(0, prev.unread - 1),
              }
            : null
        )
      }
    } catch (err) {
      console.error('Failed to delete notification:', err)
    }
  }

  // Get priority icon and color
  const getPriorityInfo = (priority: string) => {
    switch (priority) {
      case 'critical':
        return { icon: AlertTriangle, color: 'text-red-500', bgColor: 'bg-red-50 border-red-200' }
      case 'high':
        return { icon: Zap, color: 'text-orange-500', bgColor: 'bg-orange-50 border-orange-200' }
      case 'medium':
        return { icon: Clock, color: 'text-yellow-500', bgColor: 'bg-yellow-50 border-yellow-200' }
      default:
        return { icon: Bell, color: 'text-blue-500', bgColor: 'bg-blue-50 border-blue-200' }
    }
  }

  // Get category icon and color
  const getCategoryInfo = (category: string) => {
    switch (category) {
      case 'agent_activation':
        return { icon: Star, color: 'text-purple-500' }
      case 'consciousness_breakthrough':
        return { icon: Zap, color: 'text-green-500' }
      default:
        return { icon: Calendar, color: 'text-indigo-500' }
    }
  }

  // Filter notifications based on current filters
  const filteredNotifications = notifications.filter(notification => {
    if (filterStatus === 'unread' && notification.status === 'read') return false
    if (filterStatus === 'read' && notification.status !== 'read') return false
    if (filterPriority !== 'all' && notification.priority !== filterPriority) return false
    if (filterCategory !== 'all' && notification.category !== filterCategory) return false
    return true
  })

  const unreadCount = statistics?.unread || 0

  return (
    <div className="space-y-6">
      {/* Header with notification count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            {unreadCount > 0 ? (
              <BellRing className="w-6 h-6 text-primary" />
            ) : (
              <Bell className="w-6 h-6 text-muted-foreground" />
            )}
            {unreadCount > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs flex items-center justify-center bg-red-500">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold">Transit Notifications</h2>
            <p className="text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                : 'Stay updated on your astrological transits'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>

          <Button variant="outline" size="sm" onClick={loadNotifications} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Statistics Overview */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{statistics.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-red-500">{statistics.unread}</p>
                  <p className="text-xs text-muted-foreground">Unread</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{statistics.byPriority.critical || 0}</p>
                  <p className="text-xs text-muted-foreground">Critical</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{statistics.recentActivity}</p>
                  <p className="text-xs text-muted-foreground">This Week</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="personal_transit">Personal Transit</SelectItem>
                  <SelectItem value="agent_activation">Agent Activation</SelectItem>
                  <SelectItem value="consciousness_breakthrough">Consciousness</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Notifications</h3>
            <p className="text-muted-foreground text-center mb-4">{error}</p>
            <Button onClick={loadNotifications}>Try Again</Button>
          </CardContent>
        </Card>
      ) : filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Notifications</h3>
            <p className="text-muted-foreground text-center">
              {filterStatus === 'unread'
                ? 'You have no unread notifications. Great job staying on top of your transits!'
                : 'No notifications match your current filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredNotifications.map(notification => {
            const priorityInfo = getPriorityInfo(notification.priority)
            const categoryInfo = getCategoryInfo(notification.category)
            const PriorityIcon = priorityInfo.icon
            const CategoryIcon = categoryInfo.icon

            return (
              <Card
                key={notification.id}
                className={`${priorityInfo.bgColor} ${notification.status === 'read' ? 'opacity-75' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <PriorityIcon className={`w-4 h-4 ${priorityInfo.color}`} />
                        <Badge
                          variant={
                            notification.priority === 'critical' ? 'destructive' : 'secondary'
                          }
                        >
                          {notification.priority}
                        </Badge>
                        <CategoryIcon className={`w-4 h-4 ${categoryInfo.color}`} />
                        <Badge variant="outline">{notification.category.replace('_', ' ')}</Badge>
                        {notification.status === 'read' && (
                          <Badge variant="outline" className="text-green-600">
                            <Check className="w-3 h-3 mr-1" />
                            Read
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg">{notification.title}</CardTitle>
                      <CardDescription className="mt-1">{notification.message}</CardDescription>
                    </div>

                    <div className="flex gap-1 ml-4">
                      {notification.status !== 'read' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead(notification.id)}
                          title="Mark as read"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" title="Dismiss">
                            <X className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Dismiss Notification</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to dismiss this notification? You can always
                              view dismissed notifications later.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => dismissNotification(notification.id)}>
                              Dismiss
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Notification</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to permanently delete this notification? This
                              action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteNotification(notification.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      {notification.natalChart && (
                        <span>Chart: {notification.natalChart.chartName}</span>
                      )}
                      <span>Transit: {format(new Date(notification.transitDate), 'PPP')}</span>
                      <span>
                        Created:{' '}
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>{notification.interactionCount} interactions</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
