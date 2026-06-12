export class ChartSynthesizer {
  synthesize({
    birthChart,
    momentChart,
    additionalCharts = [],
  }: {
    birthChart: any | null
    momentChart: any
    additionalCharts?: any[]
  }) {
    const spirit = momentChart?.['Alchemy Effects']?.['Total Spirit'] || 0
    const essence = momentChart?.['Alchemy Effects']?.['Total Essence'] || 0
    const matter = momentChart?.['Alchemy Effects']?.['Total Matter'] || 0
    const substance = momentChart?.['Alchemy Effects']?.['Total Substance'] || 0

    const monicaConstant = spirit + essence + matter + substance

    return {
      type: birthChart
        ? additionalCharts.length > 0
          ? 'multi-chart'
          : 'birth-moment'
        : 'moment-only',
      baseChart: birthChart,
      momentChart,
      additionalCharts,
      consciousness: { spirit, essence, matter, substance },
      monicaConstant,
      sourceCharts: [momentChart, ...(birthChart ? [birthChart] : []), ...additionalCharts],
    }
  }
}
