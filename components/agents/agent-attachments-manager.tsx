'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, MapPin, Scroll, Trash2, Plus } from 'lucide-react'

interface Attachment {
  id: string
  name: string
  description?: string
  type: string
  birthDate?: string
  birthTime?: string
  birthLocation?: any
  momentName?: string
  runeType?: string
  runePower?: number
  runeEffects?: string[]
  isActive: boolean
  createdAt: string
}

interface AgentAttachmentsManagerProps {
  agentId: string
  agentName: string
}

export function AgentAttachmentsManager({ agentId, agentName }: AgentAttachmentsManagerProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newAttachment, setNewAttachment] = useState({
    type: 'birth_chart',
    name: '',
    description: '',
    birthDate: '',
    birthTime: '',
    birthLocation: { lat: 0, lon: 0, name: '', timezone: '' },
    momentName: '',
    runeType: 'consciousness',
    runePower: 50,
    runeEffects: [''],
  })

  useEffect(() => {
    loadAttachments()
  }, [agentId])

  const loadAttachments = async () => {
    try {
      const response = await fetch(`/api/agent-attachments?agentId=${agentId}`)
      const data = await response.json()

      if (data.success) {
        setAttachments(data.attachments)
      }
    } catch (error) {
      console.error('Failed to load attachments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddAttachment = async () => {
    try {
      let requestData: any = {
        agentId,
        type: newAttachment.type,
        name: newAttachment.name,
        description: newAttachment.description,
      }

      if (newAttachment.type === 'birth_chart') {
        requestData = {
          ...requestData,
          birthDate: newAttachment.birthDate,
          birthTime: newAttachment.birthTime,
          birthLocation: newAttachment.birthLocation,
        }
      } else if (newAttachment.type === 'moment_chart') {
        requestData = {
          ...requestData,
          momentDate: newAttachment.birthDate,
          momentTime: newAttachment.birthTime,
          momentLocation: newAttachment.birthLocation,
          momentName: newAttachment.momentName,
        }
      } else if (newAttachment.type === 'rune') {
        requestData = {
          ...requestData,
          runeType: newAttachment.runeType,
          runePower: newAttachment.runePower,
          runeEffects: newAttachment.runeEffects.filter(effect => effect.trim() !== ''),
        }
      }

      const response = await fetch('/api/agent-attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })

      const data = await response.json()

      if (data.success) {
        await loadAttachments()
        setShowAddForm(false)
        resetForm()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Failed to add attachment:', error)
      alert('Failed to add attachment')
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm('Are you sure you want to delete this attachment?')) return

    try {
      const response = await fetch(`/api/agent-attachments?attachmentId=${attachmentId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        await loadAttachments()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Failed to delete attachment:', error)
      alert('Failed to delete attachment')
    }
  }

  const resetForm = () => {
    setNewAttachment({
      type: 'birth_chart',
      name: '',
      description: '',
      birthDate: '',
      birthTime: '',
      birthLocation: { lat: 0, lon: 0, name: '', timezone: '' },
      momentName: '',
      runeType: 'consciousness',
      runePower: 50,
      runeEffects: [''],
    })
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'birth_chart':
      case 'moment_chart':
        return <Calendar className="w-4 h-4" />
      case 'rune':
        return <Scroll className="w-4 h-4" />
      default:
        return <div className="w-4 h-4" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'birth_chart':
        return 'bg-blue-100 text-blue-800'
      case 'moment_chart':
        return 'bg-green-100 text-green-800'
      case 'rune':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading attachments...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">Attachments for {agentName}</h3>
          <p className="text-gray-600">Charts and runes attached to this agent</p>
        </div>
        <Button onClick={() => setShowAddForm(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Attachment
        </Button>
      </div>

      {/* Add Attachment Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Attachment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="type">Type</Label>
              <Select
                value={newAttachment.type}
                onValueChange={value => setNewAttachment(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select attachment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="birth_chart">Birth Chart</SelectItem>
                  <SelectItem value="moment_chart">Moment Chart</SelectItem>
                  <SelectItem value="rune">Rune</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newAttachment.name}
                onChange={e => setNewAttachment(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter attachment name"
              />
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={newAttachment.description}
                onChange={e => setNewAttachment(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter description"
              />
            </div>

            {/* Chart-specific fields */}
            {(newAttachment.type === 'birth_chart' || newAttachment.type === 'moment_chart') && (
              <>
                {newAttachment.type === 'moment_chart' && (
                  <div>
                    <Label htmlFor="momentName">Moment Name</Label>
                    <Input
                      id="momentName"
                      value={newAttachment.momentName}
                      onChange={e =>
                        setNewAttachment(prev => ({ ...prev, momentName: e.target.value }))
                      }
                      placeholder="e.g., Wedding Day, First Meeting"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="birthDate">Date</Label>
                    <Input
                      id="birthDate"
                      type="date"
                      value={newAttachment.birthDate}
                      onChange={e =>
                        setNewAttachment(prev => ({ ...prev, birthDate: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="birthTime">Time (Optional)</Label>
                    <Input
                      id="birthTime"
                      type="time"
                      value={newAttachment.birthTime}
                      onChange={e =>
                        setNewAttachment(prev => ({ ...prev, birthTime: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="locationName">Location</Label>
                  <Input
                    id="locationName"
                    value={newAttachment.birthLocation.name}
                    onChange={e =>
                      setNewAttachment(prev => ({
                        ...prev,
                        birthLocation: { ...prev.birthLocation, name: e.target.value },
                      }))
                    }
                    placeholder="e.g., New York, NY, USA"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="latitude">Latitude</Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="0.000001"
                      value={newAttachment.birthLocation.lat}
                      onChange={e =>
                        setNewAttachment(prev => ({
                          ...prev,
                          birthLocation: {
                            ...prev.birthLocation,
                            lat: parseFloat(e.target.value) || 0,
                          },
                        }))
                      }
                      placeholder="40.7128"
                    />
                  </div>
                  <div>
                    <Label htmlFor="longitude">Longitude</Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="0.000001"
                      value={newAttachment.birthLocation.lon}
                      onChange={e =>
                        setNewAttachment(prev => ({
                          ...prev,
                          birthLocation: {
                            ...prev.birthLocation,
                            lon: parseFloat(e.target.value) || 0,
                          },
                        }))
                      }
                      placeholder="-74.0060"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Rune-specific fields */}
            {newAttachment.type === 'rune' && (
              <>
                <div>
                  <Label htmlFor="runeType">Rune Type</Label>
                  <Select
                    value={newAttachment.runeType}
                    onValueChange={value =>
                      setNewAttachment(prev => ({ ...prev, runeType: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consciousness">Consciousness</SelectItem>
                      <SelectItem value="protection">Protection</SelectItem>
                      <SelectItem value="enhancement">Enhancement</SelectItem>
                      <SelectItem value="divination">Divination</SelectItem>
                      <SelectItem value="manifestation">Manifestation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="runePower">Power Level (0-100)</Label>
                  <Input
                    id="runePower"
                    type="number"
                    min="0"
                    max="100"
                    value={newAttachment.runePower}
                    onChange={e =>
                      setNewAttachment(prev => ({
                        ...prev,
                        runePower: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="runeEffects">Effects (one per line)</Label>
                  <Textarea
                    id="runeEffects"
                    value={newAttachment.runeEffects.join('\n')}
                    onChange={e =>
                      setNewAttachment(prev => ({
                        ...prev,
                        runeEffects: e.target.value.split('\n'),
                      }))
                    }
                    placeholder="Enhanced intuition&#10;Increased awareness&#10;Spiritual protection"
                  />
                </div>
              </>
            )}

            <div className="flex gap-2 pt-4">
              <Button onClick={handleAddAttachment}>Add Attachment</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false)
                  resetForm()
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attachments List */}
      <div className="space-y-4">
        {attachments.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-500">
                No attachments yet. Add a birth chart, moment chart, or rune to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          attachments.map(attachment => (
            <Card key={attachment.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getTypeIcon(attachment.type)}
                      <h4 className="font-semibold">{attachment.name}</h4>
                      <Badge className={getTypeColor(attachment.type)}>
                        {attachment.type.replace('_', ' ')}
                      </Badge>
                    </div>

                    {attachment.description && (
                      <p className="text-gray-600 text-sm mb-2">{attachment.description}</p>
                    )}

                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                      {attachment.birthDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(attachment.birthDate).toLocaleDateString()}
                        </div>
                      )}

                      {attachment.birthTime && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {attachment.birthTime}
                        </div>
                      )}

                      {attachment.birthLocation?.name && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {attachment.birthLocation.name}
                        </div>
                      )}

                      {attachment.momentName && (
                        <div className="text-blue-600">Moment: {attachment.momentName}</div>
                      )}

                      {attachment.runeType && (
                        <div className="text-purple-600">
                          {attachment.runeType} rune • Power: {attachment.runePower}
                        </div>
                      )}
                    </div>

                    {attachment.runeEffects && attachment.runeEffects.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs text-gray-500">Effects: </span>
                        <span className="text-xs">{attachment.runeEffects.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteAttachment(attachment.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
