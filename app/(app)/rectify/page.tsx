import { Compass } from 'lucide-react'
import { BirthTimeRectifierPanel } from '@/components/rectification/BirthTimeRectifierPanel'

export const metadata = {
  title: 'Birth Time Rectifier · Alchm',
  description:
    'Estimate your Ascendant through Bayesian Expected Information Gain questioning and Swiss Ephemeris transits, progressions, and profections.',
}

export default function PublicRectifyPage() {
  return (
    <main className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="space-y-3 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-violet-300">
          <Compass className="h-3.5 w-3.5" aria-hidden="true" />
          Interactive Birth Time Rectification
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Find Your Working Ascendant
        </h1>
        <p className="mx-auto max-w-3xl text-sm text-slate-300 sm:text-base">
          Instead of a subjective personality quiz, this tool scans every minute of your birth day
          with Swiss Ephemeris and recommends the highest information-gain question next — narrowing
          to a verified &ge; 70% rising sign and &le; 180-minute credible window.
        </p>
      </div>

      <BirthTimeRectifierPanel mode="standalone" allowUnconfirmedApply />
    </main>
  )
}
