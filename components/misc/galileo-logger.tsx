'use client'

import { useState } from 'react'
import { useGalileoLog } from '@/hooks/useGalileoLog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

export default function GalileoLogger() {
  const { log, isLogging, lastResult } = useGalileoLog()
  const [message, setMessage] = useState('')
  const [level, setLevel] = useState('info')
  const [metadata, setMetadata] = useState('{}')
  const [isLoggedSuccessfully, setIsLoggedSuccessfully] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoggedSuccessfully(false)

    let parsedMetadata = {}
    try {
      parsedMetadata = JSON.parse(metadata)
    } catch (error) {
      alert('Invalid JSON in metadata field')
      return
    }

    const result = await log(message, {
      level: level as 'info' | 'warning' | 'error' | 'debug',
      metadata: parsedMetadata,
    })

    if (result.success) {
      setIsLoggedSuccessfully(true)
      // Reset success indicator after 3 seconds
      setTimeout(() => setIsLoggedSuccessfully(false), 3000)
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Galileo Log Stream</CardTitle>
        <CardDescription>
          Send log messages to Anthropic Claude for analysis and insights
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">Log Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Enter log message here..."
              className="min-h-[80px]"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="level">Log Level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Select log level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="metadata">
              Metadata (JSON)
              <span className="text-xs text-muted-foreground ml-2">Optional</span>
            </Label>
            <Textarea
              id="metadata"
              value={metadata}
              onChange={e => setMetadata(e.target.value)}
              placeholder='{"key": "value"}'
              className="font-mono text-sm"
            />
          </div>

          <div className="pt-2">
            <Button type="submit" className="w-full" disabled={isLogging || !message.trim()}>
              {isLogging ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending Log...
                </>
              ) : (
                'Send to Galileo Log Stream'
              )}
            </Button>
          </div>
        </form>
      </CardContent>

      {(lastResult || isLoggedSuccessfully) && (
        <CardFooter className="border-t">
          <div
            className={`flex items-center w-full p-2 ${lastResult?.success ? 'bg-green-50' : 'bg-red-50'}`}
          >
            {lastResult?.success ? (
              <CheckCircle2 className="text-green-500 h-5 w-5 mr-2" />
            ) : (
              <AlertCircle className="text-red-500 h-5 w-5 mr-2" />
            )}
            <div className="text-sm">
              {lastResult?.success ? (
                <span className="font-medium text-green-700">Log successfully sent to Galileo</span>
              ) : (
                <span className="font-medium text-red-700">Error: {lastResult?.error}</span>
              )}
            </div>
          </div>
        </CardFooter>
      )}
    </Card>
  )
}
