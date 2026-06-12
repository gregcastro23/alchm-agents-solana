import Link from 'next/link'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function AstrologicalAgentsPage() {
  const agents = [
    {
      title: 'Planetary Wisdom',
      description: 'Consult with agents representing each planet in their specific dignity',
      link: '/planetary-agents',
      icon: '🪐',
    },
    {
      title: 'Chart Interpreter',
      description: 'Get a comprehensive analysis of your birth chart',
      link: '/chart-interpreter',
      icon: '🔮',
    },
  ]

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold text-center mb-2">Astrological Agents</h1>
      <p className="text-center mb-8 max-w-2xl mx-auto">
        Explore the wisdom of the stars through our specialized astrological agents
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map(agent => (
          <Card key={agent.title} className="flex flex-col">
            <CardHeader>
              <div className="text-4xl mb-2 text-center">{agent.icon}</div>
              <CardTitle className="text-center">{agent.title}</CardTitle>
              <CardDescription className="text-center">{agent.description}</CardDescription>
            </CardHeader>
            <CardFooter className="mt-auto pt-4">
              <Button asChild className="w-full">
                <Link href={agent.link}>Consult Agent</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
