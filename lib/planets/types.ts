export interface PlanetData {
  'Dignity Effect': Record<string, number>
  Elements: string[]
  Alchemy: {
    Spirit: number
    Essence: number
    Matter: number
    Substance: number
  }
  'Diurnal Element': string
  'Nocturnal Element': string
  AstronomicalData?: {
    DistanceFromSun?: string
    DistanceFromEarth?: {
      Minimum?: string
      Maximum?: string
    }
    Diameter?: string
    SurfaceTemperature?: string
    AtmosphericComposition?: string
    RotationPeriod?: string
    OrbitPeriod?: string
    'Axial Tilt'?: string
    PhaseCycle?: string
    SunlightTravelTime?: string
    ZodiacalRestriction?: string
    PhysicalCharacteristics?: {
      Surface?: string
      MagneticField?: string
      Composition?: string
      NotableFeatures?: string
    }
  }
  AstrologicalProperties?: {
    AlchemicalName?: string
    BeneficType?: string
    MaleficType?: string
    DualDomicile?: {
      Spring?: string
      Summer?: string
      Autumn?: string
      Winter?: string
    }
    HouseJoy?: number
    CyclePeriod?: {
      Return?: string
      Retrograde?: string
    }
    MorningEveningStar?: {
      MorningStar?: string
      EveningStar?: string
    }
    CoRules?: string[]
    Exaltation?: string
    Fall?: string
    Detriment?: string[]
    Keywords?: string[]
    Colors?: string[]
    Day?: string
    Metal?: string
    BodyParts?: string[]
    Animals?: string[]
    Stones?: string[]
  }
  ElementalConnections?: {
    DayEmission?: string
    NightEmission?: string
    ElementalBridges?: string[]
    SharedElements?: Record<string, string[]>
    AssociatedQualities?: string[]
  }
  HerbalAssociations?: {
    Herbs?: string[]
    Flowers?: string[]
    Woods?: string[]
    Scents?: string[]
  }
  RetrogradeEffect?: {
    Spirit: number
    Essence: number
    Matter: number
    Substance: number
  }
  ANumberModifiers?: {
    Base: number
    HighDignitiy: number
    LowDignity: number
    AspectBonus: Record<string, number>
    SeasonalAdjustment?: Record<string, number>
  }
  FoodAssociations?: string[]
  FlavorProfiles?: {
    Sweet: number
    Sour: number
    Salty: number
    Bitter: number
    Umami: number
    Spicy: number
  }
  CulinaryInfluences?: string[]
  AspectsEffect?: Record<
    string,
    {
      Conjunction: number
      Opposition: number
      Trine: number
      Square: number
      Sextile: number
    }
  >
  PlanetSpecific?: {
    TransitDates?: TransitData
    MoonCalculations?: {
      calculateTransits?: Function
    }
    [key: string]: unknown
  }
}

// Type for Moon-specific data
export interface MoonSpecificData {
  Phases: Record<
    string,
    {
      Spirit: number
      Essence: number
      Matter: number
      Substance: number
      CulinaryEffect: string
    }
  >
  Nodes: {
    North: {
      Element: string
      CulinaryEffect: string
    }
    South: {
      Element: string
      CulinaryEffect: string
    }
  }
}

// Type for Sun-specific data
export interface SunSpecificData {
  SolarCycles: {
    Solstice: {
      Summer: {
        Element: string
        CulinaryEffect: string
      }
      Winter: {
        Element: string
        CulinaryEffect: string
      }
    }
    Equinox: {
      Spring: {
        Element: string
        CulinaryEffect: string
      }
      Fall: {
        Element: string
        CulinaryEffect: string
      }
    }
  }
  Eclipse: {
    Solar: {
      ElementalShift: string
      CulinaryEffect: string
    }
  }
}

// Type for Mercury-specific data
export interface MercurySpecificData {
  RetrogradeIntensity: number
  CommunicationEffects: {
    Direct: string
    Retrograde: string
  }
  FlavorModulation: {
    Direct: Record<string, number>
    Retrograde: Record<string, number>
  }
}

// Additional planet-specific interfaces can be added as needed

// Transit Data Types
export interface TransitPeriod {
  start: string
  end: string
}

export interface TransitData {
  // For sign-based transits
  [signName: string]: TransitPeriod | string | unknown

  // Alternative formats
  hasOwnProperty?: (prop: string) => boolean
}
