// Agent Attachments Service
// Manages charts and runes attached to historical agents

import { prisma } from './db'
import { getAlchemicalQuantitiesLegacy } from './backend'
import type {
  agent_attachments as AgentAttachment,
  agent_attachment_usage as AgentAttachmentUsage,
} from '@prisma/client'

export interface AttachmentChart {
  date: Date
  time?: string
  location: {
    lat: number
    lon: number
    name: string
    timezone?: string
  }
  name?: string
}

export interface AttachmentRune {
  runeType: string
  runePower: number
  runeEffects: string[]
  runeCost: {
    spirit: number
    essence: number
    matter: number
    substance: number
  }
}

export class AgentAttachmentsService {
  /**
   * Add a birth chart attachment to an agent
   */
  static async addBirthChart(
    agentId: string,
    chartData: AttachmentChart,
    description?: string
  ): Promise<AgentAttachment> {
    // Calculate the birth chart and alchemical data
    const alchmData = await getAlchemicalQuantitiesLegacy(
      chartData.date,
      chartData.location.lat,
      chartData.location.lon
    )

    return await prisma.agentAttachment.create({
      data: {
        agentId,
        name: chartData.name || `Birth Chart - ${chartData.date.toLocaleDateString()}`,
        description,
        type: 'birth_chart',
        birthDate: chartData.date,
        birthTime: chartData.time || 'unknown',
        birthLocation: chartData.location,
        alchmData,
        natalChart: alchmData, // For now, use alchm data as natal chart
        isActive: true,
        priority: 0,
      },
    })
  }

  /**
   * Add a moment chart attachment to an agent
   */
  static async addMomentChart(
    agentId: string,
    chartData: AttachmentChart,
    momentName: string,
    description?: string
  ): Promise<AgentAttachment> {
    // Calculate planetary positions and alchemical data for this moment
    const alchmData = await getAlchemicalQuantitiesLegacy(
      chartData.date,
      chartData.location.lat,
      chartData.location.lon
    )

    return await prisma.agentAttachment.create({
      data: {
        agentId,
        name: chartData.name || `${momentName} - ${chartData.date.toLocaleDateString()}`,
        description,
        type: 'moment_chart',
        birthDate: chartData.date,
        birthTime: chartData.time || 'unknown',
        birthLocation: chartData.location,
        momentName,
        alchmData,
        planetaryPositions: alchmData, // Current positions for the moment
        isActive: true,
        priority: 0,
      },
    })
  }

  /**
   * Add a rune attachment to an agent
   */
  static async addRune(
    agentId: string,
    runeData: AttachmentRune,
    name: string,
    description?: string
  ): Promise<AgentAttachment> {
    return await prisma.agentAttachment.create({
      data: {
        agentId,
        name,
        description,
        type: 'rune',
        runeType: runeData.runeType,
        runePower: runeData.runePower,
        runeEffects: runeData.runeEffects,
        runeCost: runeData.runeCost,
        isActive: true,
        priority: 0,
      },
    })
  }

  /**
   * Get all attachments for an agent
   */
  static async getAgentAttachments(
    agentId: string,
    type?: string,
    activeOnly: boolean = true
  ): Promise<AgentAttachment[]> {
    const where: any = { agentId }

    if (activeOnly) {
      where.isActive = true
    }

    if (type) {
      where.type = type
    }

    return await prisma.agentAttachment.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    })
  }

  /**
   * Update an attachment
   */
  static async updateAttachment(
    attachmentId: string,
    updates: {
      name?: string
      description?: string
      priority?: number
      isActive?: boolean
      tags?: string[]
    }
  ): Promise<AgentAttachment> {
    return await prisma.agentAttachment.update({
      where: { id: attachmentId },
      data: updates,
    })
  }

  /**
   * Delete an attachment
   */
  static async deleteAttachment(attachmentId: string): Promise<void> {
    await prisma.agentAttachment.delete({
      where: { id: attachmentId },
    })
  }

  /**
   * Record usage of an attachment by an agent
   */
  static async recordAttachmentUsage(
    agentId: string,
    attachmentId: string,
    usageType: string,
    context: string,
    relevanceScore: number = 0.5,
    conversationId?: string
  ): Promise<AgentAttachmentUsage> {
    return await prisma.agentAttachmentUsage.create({
      data: {
        agentId,
        attachmentId,
        conversationId,
        usageType,
        context,
        relevanceScore: Math.max(0, Math.min(1, relevanceScore)),
      },
    })
  }

  /**
   * Get attachment usage statistics
   */
  static async getAttachmentUsageStats(attachmentId: string): Promise<{
    totalUsages: number
    averageRelevance: number
    usageTypes: { [key: string]: number }
    recentUsages: AgentAttachmentUsage[]
  }> {
    const usages = await prisma.agentAttachmentUsage.findMany({
      where: { attachmentId },
      orderBy: { usedAt: 'desc' },
      take: 10,
    })

    const totalUsages = usages.length
    const averageRelevance =
      totalUsages > 0
        ? usages.reduce(
            (sum: number, usage: AgentAttachmentUsage) => sum + usage.relevanceScore,
            0
          ) / totalUsages
        : 0

    const usageTypes = usages.reduce(
      (acc: { [key: string]: number }, usage: AgentAttachmentUsage) => {
        acc[usage.usageType] = (acc[usage.usageType] || 0) + 1
        return acc
      },
      {} as { [key: string]: number }
    )

    return {
      totalUsages,
      averageRelevance,
      usageTypes,
      recentUsages: usages,
    }
  }

  /**
   * Get most relevant attachments for a query or context
   */
  static async getMostRelevantAttachments(
    agentId: string,
    context: string,
    maxResults: number = 5
  ): Promise<AgentAttachment[]> {
    // For now, return all active attachments ordered by priority
    // Later we can implement semantic search or other relevance algorithms
    return await prisma.agentAttachment.findMany({
      where: {
        agentId,
        isActive: true,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: maxResults,
    })
  }
}

// Helper function to format attachment data for agent consumption
export function formatAttachmentForAgent(attachment: AgentAttachment): string {
  let formatted = `**${attachment.name}**\n`

  if (attachment.description) {
    formatted += `Description: ${attachment.description}\n`
  }

  switch (attachment.type) {
    case 'birth_chart':
      formatted += `Type: Birth Chart\n`
      if (attachment.birthDate) {
        formatted += `Birth Date: ${attachment.birthDate.toLocaleDateString()}\n`
        formatted += `Birth Time: ${attachment.birthTime}\n`
      }
      if (attachment.birthLocation) {
        const location = attachment.birthLocation as any
        formatted += `Location: ${location.name}\n`
      }
      if (attachment.alchmData) {
        const alchm = attachment.alchmData as any
        formatted += `Alchemical Profile: Spirit ${alchm?.spirit?.toFixed(2)}, Essence ${alchm?.essence?.toFixed(2)}, Matter ${alchm?.matter?.toFixed(2)}, Substance ${alchm?.substance?.toFixed(2)}\n`
      }
      break

    case 'moment_chart':
      formatted += `Type: Moment Chart - ${attachment.momentName}\n`
      if (attachment.birthDate) {
        formatted += `Date: ${attachment.birthDate.toLocaleDateString()}\n`
        formatted += `Time: ${attachment.birthTime}\n`
      }
      break

    case 'rune':
      formatted += `Type: ${attachment.runeType} Rune\n`
      if (attachment.runePower) {
        formatted += `Power Level: ${attachment.runePower}\n`
      }
      if (attachment.runeEffects) {
        const effects = attachment.runeEffects as string[]
        formatted += `Effects: ${effects.join(', ')}\n`
      }
      break
  }

  return formatted
}
