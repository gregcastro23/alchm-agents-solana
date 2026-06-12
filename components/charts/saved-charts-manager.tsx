'use client'

import { useState } from 'react'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  BookmarkPlus,
  Bookmark,
  Download,
  Upload,
  Trash2,
  Calendar,
  MapPin,
  Clock,
  MoreVertical,
  FileText,
  Star,
  Copy,
  AlertTriangle,
} from 'lucide-react'
import { useSavedCharts, type SavedChart } from '@/hooks/useSavedCharts'
import { useToast } from '@/hooks/use-toast'

interface SavedChartsManagerProps {
  currentChart?: Partial<SavedChart>
  onLoadChart: (chart: SavedChart) => void
  onSaveChart?: () => void
  className?: string
}

export default function SavedChartsManager({
  currentChart,
  onLoadChart,
  onSaveChart,
  className = '',
}: SavedChartsManagerProps) {
  const {
    savedCharts,
    saveChart,
    deleteChart,
    exportCharts,
    importCharts,
    clearAllCharts,
    isStorage,
  } = useSavedCharts()
  const { toast } = useToast()
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [chartName, setChartName] = useState('')
  const [importData, setImportData] = useState('')

  const handleSaveChart = () => {
    if (!currentChart?.birthDate || !currentChart?.birthPlace) {
      toast({
        title: 'Cannot save chart',
        description: 'Please enter birth date and location first.',
        variant: 'destructive',
      })
      return
    }

    const success = saveChart({
      name: chartName || `Chart ${savedCharts.length + 1}`,
      birthDate: currentChart.birthDate,
      birthTime: currentChart.birthTime || '',
      birthPlace: currentChart.birthPlace,
      latitude: currentChart.latitude,
      longitude: currentChart.longitude,
      chartType: currentChart.chartType || 'birth',
      planets: currentChart.planets || {},
    })

    if (success) {
      toast({
        title: 'Chart saved',
        description: `"${chartName || `Chart ${savedCharts.length + 1}`}" has been saved to your collection.`,
      })
      setShowSaveDialog(false)
      setChartName('')
      onSaveChart?.()
    } else {
      toast({
        title: 'Save failed',
        description: 'Unable to save chart. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteChart = (chart: SavedChart) => {
    const success = deleteChart(chart.id)
    if (success) {
      toast({
        title: 'Chart deleted',
        description: `"${chart.name}" has been removed from your collection.`,
      })
    }
  }

  const handleExportCharts = () => {
    const data = exportCharts()
    if (data) {
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `planetary-charts-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: 'Charts exported',
        description: 'Your charts have been downloaded as a JSON file.',
      })
    }
  }

  const handleImportCharts = () => {
    if (!importData.trim()) return

    const success = importCharts(importData)
    if (success) {
      toast({
        title: 'Charts imported',
        description: 'Charts have been successfully imported.',
      })
      setShowImportDialog(false)
      setImportData('')
    } else {
      toast({
        title: 'Import failed',
        description: 'Invalid data format. Please check your JSON file.',
        variant: 'destructive',
      })
    }
  }

  const handleCopyChartData = (chart: SavedChart) => {
    navigator.clipboard.writeText(JSON.stringify(chart, null, 2))
    toast({
      title: 'Chart data copied',
      description: 'Chart data has been copied to clipboard.',
    })
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return dateString
    }
  }

  if (!isStorage) {
    return (
      <Alert className={className}>
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>
          Chart saving is not available in this browser. Your charts will not persist between
          sessions.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bookmark className="w-5 h-5 text-blue-500" />
              Saved Charts
            </CardTitle>
            <CardDescription>{savedCharts.length}/10 charts saved</CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={!currentChart?.birthDate}>
                  <BookmarkPlus className="w-4 h-4 mr-1" />
                  Save
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save Chart</DialogTitle>
                  <DialogDescription>
                    Give your chart a name to save it to your collection.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="chart-name">Chart Name</Label>
                    <Input
                      id="chart-name"
                      value={chartName}
                      onChange={e => setChartName(e.target.value)}
                      placeholder={`Chart ${savedCharts.length + 1}`}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <div>Date: {currentChart?.birthDate}</div>
                    <div>Location: {currentChart?.birthPlace}</div>
                    {currentChart?.birthTime && <div>Time: {currentChart.birthTime}</div>}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveChart}>Save Chart</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCharts} disabled={savedCharts.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  Export All Charts
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowImportDialog(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Charts
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={clearAllCharts}
                  disabled={savedCharts.length === 0}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All Charts
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-64">
          {savedCharts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bookmark className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No saved charts yet</p>
              <p className="text-sm">Save your first chart to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedCharts.map(chart => (
                <Card key={chart.id} className="p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 cursor-pointer" onClick={() => onLoadChart(chart)}>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{chart.name}</h4>
                        <Badge variant="secondary" className="text-xs">
                          {chart.chartType}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(chart.birthDate)}
                        </div>
                        {chart.birthTime && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {chart.birthTime}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {chart.birthPlace}
                        </div>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onLoadChart(chart)}>
                          <Star className="w-4 h-4 mr-2" />
                          Load Chart
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopyChartData(chart)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Data
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteChart(chart)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Charts</DialogTitle>
            <DialogDescription>Paste the exported JSON data to import charts.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="import-data">JSON Data</Label>
              <Textarea
                id="import-data"
                value={importData}
                onChange={e => setImportData(e.target.value)}
                placeholder="Paste your exported chart data here..."
                rows={10}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleImportCharts} disabled={!importData.trim()}>
                Import Charts
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
