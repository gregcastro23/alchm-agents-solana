import { Flame, Droplets, Wind, Mountain } from 'lucide-react'

export const TIER_COSTS = {
  base: 0,
  premium: 500, // Total ESMS Quantity Coins (125 Spirit, 125 Essence, 125 Matter, 125 Substance)
}

export const ELEMENT_MAPPING = {
  Fire: {
    icon: Flame,
    color: 'text-alchemical-substance',
    bg: 'bg-alchemical-substance',
    border: 'border-alchemical-substance',
    models: {
      base: 'alchm-agent-fire-1.5b.gguf',
      premium: 'alchm-agent-fire-8b.gguf',
    },
  },
  Water: {
    icon: Droplets,
    color: 'text-alchemical-matter',
    bg: 'bg-alchemical-matter',
    border: 'border-alchemical-matter',
    models: {
      base: 'alchm-agent-water-1.5b.gguf',
      premium: 'alchm-agent-water-8b.gguf',
    },
  },
  Air: {
    icon: Wind,
    color: 'text-alchemical-spirit',
    bg: 'bg-alchemical-spirit',
    border: 'border-alchemical-spirit',
    models: {
      base: 'alchm-agent-air-1.5b.gguf',
      premium: 'alchm-agent-air-8b.gguf',
    },
  },
  Earth: {
    icon: Mountain,
    color: 'text-alchemical-essence',
    bg: 'bg-alchemical-essence',
    border: 'border-alchemical-essence',
    models: {
      base: 'alchm-agent-earth-1.5b.gguf',
      premium: 'alchm-agent-earth-8b.gguf',
    },
  },
}
