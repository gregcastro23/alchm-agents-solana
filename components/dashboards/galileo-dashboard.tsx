'use client'

import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useGalileoLog } from '@/hooks/useGalileoLog'
import GalileoLogger from '@/components/misc/galileo-logger'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts'

// Mock data for demo purposes - in a real app this would come from Galileo's API
const mockMetricsData = [
  { name: 'Day 1', requests: 24, success: 20, failure: 4, avgLatency: 850 },
  { name: 'Day 2', requests: 32, success: 28, failure: 4, avgLatency: 720 },
  { name: 'Day 3', requests: 18, success: 15, failure: 3, avgLatency: 910 },
  { name: 'Day 4', requests: 45, success: 42, failure: 3, avgLatency: 650 },
  { name: 'Day 5', requests: 38, success: 35, failure: 3, avgLatency: 680 },
  { name: 'Day 6', requests: 52, success: 48, failure: 4, avgLatency: 740 },
  { name: 'Day 7', requests: 61, success: 58, failure: 3, avgLatency: 610 },
]

const GALILEO_PROJECT_ID = '1e7fd4a1-3e28-4fe1-a719-744f239a13be'
const GALILEO_LOG_STREAM_ID = '6ed50263-a348-4ad6-ab63-bd04d3a4ffdd'

export default function GalileoDashboard() {
  const { log } = useGalileoLog('GalileoDashboard')
  const [activeTab, setActiveTab] = useState('metrics')
  const [isLoading, setIsLoading] = useState(true)
  const [metricsData, setMetricsData] = useState<any[]>([])
  const [planetaryData, setPlanetaryData] = useState<any[]>([])

  // Fetch real conversation metrics on mount
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true)

      try {
        // Fetch real conversation metrics from database
        const response = await fetch('/api/admin/conversation-metrics')

        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setMetricsData(data.dailyMetrics || [])
            setPlanetaryData(data.agentMetrics || [])
          }
        }

        await log('Dashboard viewed', {
          metadata: {
            component: 'GalileoDashboard',
            action: 'view',
          },
        })
      } catch (error) {
        console.error('[GalileoDashboard] Failed to fetch metrics:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [log])

  const refreshData = async () => {
    setIsLoading(true)

    try {
      // Fetch updated metrics
      const response = await fetch('/api/admin/conversation-metrics')

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setMetricsData(data.dailyMetrics || [])
          setPlanetaryData(data.agentMetrics || [])
        }
      }

      await log('Dashboard refreshed', {
        metadata: {
          component: 'GalileoDashboard',
          action: 'refresh',
        },
      })
    } catch (error) {
      console.error('[GalileoDashboard] Refresh failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const openGalileoUI = () => {
    window.open(
      `https://app.galileo.ai/project/${GALILEO_PROJECT_ID}/log-streams/${GALILEO_LOG_STREAM_ID}`,
      '_blank'
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Galileo Monitoring Dashboard</h2>
        <div className="space-x-2">
          <Button variant="outline" onClick={refreshData} disabled={isLoading}>
            {isLoading ? 'Refreshing...' : 'Refresh Data'}
          </Button>
          <Button onClick={openGalileoUI}>Open Galileo UI</Button>
        </div>
      </div>

      <Tabs defaultValue="metrics" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="planets">Planetary Analysis</TabsTrigger>
          <TabsTrigger value="logger">Log Tester</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Request Volume</CardTitle>
              <CardDescription>Number of requests over the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mockMetricsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="requests"
                      stroke="#8884d8"
                      name="Total Requests"
                    />
                    <Line type="monotone" dataKey="success" stroke="#82ca9d" name="Successful" />
                    <Line type="monotone" dataKey="failure" stroke="#ff7300" name="Failed" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Average Latency</CardTitle>
              <CardDescription>Response time in milliseconds over the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metricsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="avgLatency"
                      stroke="#8884d8"
                      name="Avg Latency (ms)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
            <CardFooter className="text-sm text-gray-500">
              Based on traced requests via the Galileo SDK
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="planets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Requests by Planet</CardTitle>
              <CardDescription>Breakdown of requests for each planetary agent</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={planetaryData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="requests" fill="#8884d8" name="Total Requests" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Latency by Planet</CardTitle>
              <CardDescription>
                Average response time in milliseconds by planetary agent
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={planetaryData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="avgLatency" fill="#82ca9d" name="Avg Latency (ms)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
            <CardFooter className="text-sm text-gray-500">
              Tracked from request start to final response delivery
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="logger">
          <GalileoLogger />
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>About Galileo Monitoring</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p>The Galileo monitoring system provides:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Traces:</strong> Follow requests through your system with detailed logs
              </li>
              <li>
                <strong>Metrics:</strong> Track performance, usage patterns, and errors
              </li>
              <li>
                <strong>Alerts:</strong> Get notified about issues in your application
              </li>
              <li>
                <strong>Tags:</strong> Filter and organize your logs by different dimensions
              </li>
            </ul>
            <p className="mt-4">
              To set up custom alerts, dashboards, and more advanced analytics, visit the Galileo
              UI.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full" onClick={openGalileoUI}>
            Open Full Galileo Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
