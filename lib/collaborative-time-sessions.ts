/**
 * Collaborative Time Exploration Sessions
 * ======================================
 * Real-time collaborative system for shared temporal analysis exploration.
 * Supports WebSocket-based synchronization, shared cursors, and collaborative
 * pattern discovery across multiple users.
 */

import type {
  TemporalQuery,
  TemporalAnalysisResult,
  AgentTransitEvent,
} from './temporal-analysis-engine'

export interface CollaborativeSession {
  id: string
  sessionCode: string
  title: string
  description?: string

  // Session State
  isActive: boolean
  createdBy: string
  maxUsers: number
  currentUserCount: number

  // Exploration Context
  currentQuery?: TemporalQuery
  currentResults?: TemporalAnalysisResult
  sharedCursor?: {
    degree: number
    timestamp: Date
    userId: string
    username: string
  }

  // Session Configuration
  allowedAgents?: string[]
  timeRangeStart?: Date
  timeRangeEnd?: Date
  explorationMode: 'open' | 'guided' | 'structured'

  // Permissions
  moderators: string[]
  settings: {
    allowGuestUsers: boolean
    requireApprovalForQueries: boolean
    enableVoiceChat: boolean
    recordSession: boolean
  }

  // Metadata
  createdAt: Date
  lastActivity: Date
  expiresAt: Date
}

export interface SessionParticipant {
  id: string
  sessionId: string
  userId: string
  username: string

  // Participation State
  joinedAt: Date
  lastActive: Date
  isOnline: boolean

  // Permissions
  canModerate: boolean
  canQuery: boolean
  canShare: boolean

  // Current Focus
  currentDegree?: number
  currentTime?: Date
  selectedAgents?: string[]

  // User Preferences
  preferences: {
    colorScheme: 'dark' | 'light' | 'auto'
    notifications: boolean
    shareLocation: boolean
  }
}

export interface SessionUpdate {
  id: string
  sessionId: string
  userId?: string
  username?: string

  // Update Data
  type: 'query' | 'cursor_move' | 'pattern_discovery' | 'bookmark' | 'chat' | 'system'
  data: any

  // Broadcast Info
  shouldBroadcast: boolean
  broadcastedAt?: Date
  acknowledgments: string[] // User IDs who have seen this update

  timestamp: Date
}

export interface SessionBookmark {
  id: string
  sessionId: string
  userId: string
  username: string

  title: string
  description?: string

  // Bookmark Content
  query: TemporalQuery
  results?: TemporalAnalysisResult
  degreePosition?: number
  timePosition?: Date

  // Collaboration
  isPublic: boolean
  sharedWith: string[]
  likes: string[]
  comments: SessionComment[]

  createdAt: Date
}

export interface SessionComment {
  id: string
  userId: string
  username: string
  content: string
  timestamp: Date
  replyTo?: string
}

export interface SessionAnalytics {
  sessionId: string

  // Participation Metrics
  totalParticipants: number
  peakConcurrentUsers: number
  averageSessionDuration: number
  totalQueriesRun: number

  // Exploration Metrics
  degreesExplored: number[]
  agentsConsulted: string[]
  patternsDiscovered: number
  bookmarksCreated: number

  // Collaboration Quality
  interactionScore: number // 0-1 based on collaboration quality
  knowledgeSharing: number // Amount of insights shared
  consensusLevel: number // Agreement on findings

  // Time Analysis
  sessionDuration: number
  activeExplorationTime: number
  collaborativeInsights: number
}

export class CollaborativeTimeSessionManager {
  private static sessions = new Map<string, CollaborativeSession>()
  private static participants = new Map<string, SessionParticipant[]>()
  private static updates = new Map<string, SessionUpdate[]>()
  private static websockets = new Map<string, WebSocket[]>()

  /**
   * Create a new collaborative session
   */
  static async createSession(
    createdBy: string,
    options: {
      title: string
      description?: string
      maxUsers?: number
      explorationMode?: 'open' | 'guided' | 'structured'
      allowedAgents?: string[]
      timeRange?: { start: Date; end: Date }
      expiresInHours?: number
    }
  ): Promise<CollaborativeSession> {
    const sessionId = `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const sessionCode = this.generateSessionCode()

    const session: CollaborativeSession = {
      id: sessionId,
      sessionCode,
      title: options.title,
      description: options.description,
      isActive: true,
      createdBy,
      maxUsers: options.maxUsers || 5,
      currentUserCount: 0,
      allowedAgents: options.allowedAgents,
      timeRangeStart: options.timeRange?.start,
      timeRangeEnd: options.timeRange?.end,
      explorationMode: options.explorationMode || 'open',
      moderators: [createdBy],
      settings: {
        allowGuestUsers: true,
        requireApprovalForQueries: false,
        enableVoiceChat: false,
        recordSession: true,
      },
      createdAt: new Date(),
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + (options.expiresInHours || 24) * 60 * 60 * 1000),
    }

    this.sessions.set(sessionId, session)
    this.participants.set(sessionId, [])
    this.updates.set(sessionId, [])
    this.websockets.set(sessionId, [])

    return session
  }

  /**
   * Join an existing session
   */
  static async joinSession(
    sessionCode: string,
    userId: string,
    username: string
  ): Promise<{ session: CollaborativeSession; participant: SessionParticipant } | null> {
    const session = this.findSessionByCode(sessionCode)
    if (!session) return null

    if (!session.isActive) throw new Error('Session is not active')
    if (session.currentUserCount >= session.maxUsers) throw new Error('Session is full')

    const existingParticipants = this.participants.get(session.id) || []
    const existingParticipant = existingParticipants.find(p => p.userId === userId)

    if (existingParticipant) {
      // Rejoin existing participant
      existingParticipant.isOnline = true
      existingParticipant.lastActive = new Date()
      return { session, participant: existingParticipant }
    }

    // Create new participant
    const participant: SessionParticipant = {
      id: `participant_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      sessionId: session.id,
      userId,
      username,
      joinedAt: new Date(),
      lastActive: new Date(),
      isOnline: true,
      canModerate: session.moderators.includes(userId),
      canQuery: true,
      canShare: true,
      preferences: {
        colorScheme: 'auto',
        notifications: true,
        shareLocation: false,
      },
    }

    existingParticipants.push(participant)
    this.participants.set(session.id, existingParticipants)

    // Update session user count
    session.currentUserCount = existingParticipants.filter(p => p.isOnline).length
    session.lastActivity = new Date()

    // Broadcast join event
    this.broadcastUpdate(session.id, {
      id: `update_${Date.now()}`,
      sessionId: session.id,
      userId,
      username,
      type: 'system',
      data: {
        action: 'user_joined',
        username,
        userCount: session.currentUserCount,
      },
      shouldBroadcast: true,
      acknowledgments: [],
      timestamp: new Date(),
    })

    return { session, participant }
  }

  /**
   * Leave a session
   */
  static async leaveSession(sessionId: string, userId: string): Promise<void> {
    const participants = this.participants.get(sessionId) || []
    const participant = participants.find(p => p.userId === userId)

    if (participant) {
      participant.isOnline = false
      participant.lastActive = new Date()

      const session = this.sessions.get(sessionId)
      if (session) {
        session.currentUserCount = participants.filter(p => p.isOnline).length
        session.lastActivity = new Date()

        // Broadcast leave event
        this.broadcastUpdate(sessionId, {
          id: `update_${Date.now()}`,
          sessionId,
          userId,
          username: participant.username,
          type: 'system',
          data: {
            action: 'user_left',
            username: participant.username,
            userCount: session.currentUserCount,
          },
          shouldBroadcast: true,
          acknowledgments: [],
          timestamp: new Date(),
        })
      }
    }
  }

  /**
   * Submit a collaborative query
   */
  static async submitCollaborativeQuery(
    sessionId: string,
    userId: string,
    query: TemporalQuery
  ): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error('Session not found')

    const participant = this.getParticipant(sessionId, userId)
    if (!participant || !participant.canQuery) throw new Error('No query permission')

    // Check if approval is required
    if (session.settings.requireApprovalForQueries && !participant.canModerate) {
      this.broadcastUpdate(sessionId, {
        id: `update_${Date.now()}`,
        sessionId,
        userId,
        username: participant.username,
        type: 'query',
        data: {
          action: 'query_pending_approval',
          query,
          username: participant.username,
        },
        shouldBroadcast: true,
        acknowledgments: [],
        timestamp: new Date(),
      })
      return
    }

    // Set as current query
    session.currentQuery = query
    session.lastActivity = new Date()

    // Broadcast query start
    this.broadcastUpdate(sessionId, {
      id: `update_${Date.now()}`,
      sessionId,
      userId,
      username: participant.username,
      type: 'query',
      data: {
        action: 'query_started',
        query,
        username: participant.username,
      },
      shouldBroadcast: true,
      acknowledgments: [],
      timestamp: new Date(),
    })
  }

  /**
   * Update shared cursor position
   */
  static async updateSharedCursor(
    sessionId: string,
    userId: string,
    position: { degree?: number; timestamp?: Date }
  ): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error('Session not found')

    const participant = this.getParticipant(sessionId, userId)
    if (!participant) throw new Error('Participant not found')

    // Update participant's current position
    if (position.degree !== undefined) participant.currentDegree = position.degree
    if (position.timestamp !== undefined) participant.currentTime = position.timestamp

    // Update shared cursor
    session.sharedCursor = {
      degree: position.degree || participant.currentDegree || 0,
      timestamp: position.timestamp || participant.currentTime || new Date(),
      userId,
      username: participant.username,
    }

    session.lastActivity = new Date()

    // Broadcast cursor update
    this.broadcastUpdate(sessionId, {
      id: `update_${Date.now()}`,
      sessionId,
      userId,
      username: participant.username,
      type: 'cursor_move',
      data: {
        action: 'cursor_updated',
        position: session.sharedCursor,
        username: participant.username,
      },
      shouldBroadcast: true,
      acknowledgments: [],
      timestamp: new Date(),
    })
  }

  /**
   * Create a session bookmark
   */
  static async createBookmark(
    sessionId: string,
    userId: string,
    bookmark: {
      title: string
      description?: string
      query: TemporalQuery
      results?: TemporalAnalysisResult
      degreePosition?: number
      timePosition?: Date
      isPublic?: boolean
    }
  ): Promise<SessionBookmark> {
    const participant = this.getParticipant(sessionId, userId)
    if (!participant || !participant.canShare) throw new Error('No bookmark permission')

    const sessionBookmark: SessionBookmark = {
      id: `bookmark_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      userId,
      username: participant.username,
      title: bookmark.title,
      description: bookmark.description,
      query: bookmark.query,
      results: bookmark.results,
      degreePosition: bookmark.degreePosition,
      timePosition: bookmark.timePosition,
      isPublic: bookmark.isPublic ?? true,
      sharedWith: [],
      likes: [],
      comments: [],
      createdAt: new Date(),
    }

    // Broadcast bookmark creation
    this.broadcastUpdate(sessionId, {
      id: `update_${Date.now()}`,
      sessionId,
      userId,
      username: participant.username,
      type: 'bookmark',
      data: {
        action: 'bookmark_created',
        bookmark: sessionBookmark,
        username: participant.username,
      },
      shouldBroadcast: true,
      acknowledgments: [],
      timestamp: new Date(),
    })

    return sessionBookmark
  }

  /**
   * Get session analytics
   */
  static async getSessionAnalytics(sessionId: string): Promise<SessionAnalytics> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error('Session not found')

    const participants = this.participants.get(sessionId) || []
    const updates = this.updates.get(sessionId) || []

    const queriesRun = updates.filter(u => u.type === 'query').length
    const bookmarksCreated = updates.filter(u => u.type === 'bookmark').length
    const totalDuration = Date.now() - session.createdAt.getTime()

    const degreesExplored = [
      ...new Set(
        updates
          .filter(u => u.type === 'cursor_move')
          .map(u => u.data?.position?.degree)
          .filter(d => d !== undefined)
      ),
    ]

    return {
      sessionId,
      totalParticipants: participants.length,
      peakConcurrentUsers: Math.max(...[session.currentUserCount, participants.length]),
      averageSessionDuration: totalDuration / Math.max(participants.length, 1),
      totalQueriesRun: queriesRun,
      degreesExplored,
      agentsConsulted: session.allowedAgents || [],
      patternsDiscovered: 0, // Would be calculated from actual results
      bookmarksCreated,
      interactionScore: Math.min(updates.length / 100, 1), // Simplified calculation
      knowledgeSharing: bookmarksCreated / Math.max(participants.length, 1),
      consensusLevel: 0.8, // Would be calculated from user agreements
      sessionDuration: totalDuration,
      activeExplorationTime: totalDuration * 0.7, // Estimate
      collaborativeInsights: Math.floor(updates.length / 10),
    }
  }

  // Private helper methods

  private static generateSessionCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  private static findSessionByCode(sessionCode: string): CollaborativeSession | null {
    for (const session of this.sessions.values()) {
      if (session.sessionCode === sessionCode) {
        return session
      }
    }
    return null
  }

  private static getParticipant(sessionId: string, userId: string): SessionParticipant | null {
    const participants = this.participants.get(sessionId) || []
    return participants.find(p => p.userId === userId) || null
  }

  private static broadcastUpdate(sessionId: string, update: SessionUpdate): void {
    // Store update
    const updates = this.updates.get(sessionId) || []
    updates.push(update)
    this.updates.set(sessionId, updates)

    // Broadcast to all connected WebSocket clients
    const websockets = this.websockets.get(sessionId) || []
    const message = JSON.stringify({
      type: 'session_update',
      data: update,
    })

    websockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message)
        } catch (error) {
          console.error('Error broadcasting to WebSocket:', error)
        }
      }
    })
  }

  /**
   * WebSocket connection management
   */
  static addWebSocketConnection(sessionId: string, ws: WebSocket): void {
    const websockets = this.websockets.get(sessionId) || []
    websockets.push(ws)
    this.websockets.set(sessionId, websockets)
    ;(ws as any).on('close', () => {
      const updatedSockets = websockets.filter(socket => socket !== ws)
      this.websockets.set(sessionId, updatedSockets)
    })
  }

  /**
   * Cleanup expired sessions
   */
  static cleanupExpiredSessions(): void {
    const now = new Date()
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now || (!session.isActive && session.currentUserCount === 0)) {
        this.sessions.delete(sessionId)
        this.participants.delete(sessionId)
        this.updates.delete(sessionId)
        this.websockets.delete(sessionId)
      }
    }
  }

  /**
   * Get all sessions for a user
   */
  static getUserSessions(userId: string): CollaborativeSession[] {
    const userSessions: CollaborativeSession[] = []

    for (const session of this.sessions.values()) {
      const participants = this.participants.get(session.id) || []
      const isParticipant = participants.some(p => p.userId === userId)

      if (session.createdBy === userId || isParticipant) {
        userSessions.push(session)
      }
    }

    return userSessions.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
  }

  /**
   * Get active sessions (public method for API)
   */
  static getActiveSessions(): CollaborativeSession[] {
    return Array.from(this.sessions.values())
      .filter(session => session.isActive && session.currentUserCount > 0)
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
  }
}
