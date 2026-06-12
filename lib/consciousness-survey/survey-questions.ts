// Consciousness Survey Questions for Personalized AI

import type { SurveyQuestion } from '../types/consciousness-survey'

export const CONSCIOUSNESS_SURVEY_QUESTIONS: SurveyQuestion[] = [
  // Communication Style
  {
    id: 'comm_directness',
    category: 'communication',
    type: 'scale',
    question: 'How direct do you prefer communication to be?',
    description: 'Consider both giving and receiving feedback or information',
    min: 1,
    max: 7,
    required: true,
    weight: 9,
  },
  {
    id: 'comm_formality',
    category: 'communication',
    type: 'choice',
    question: 'What communication style feels most natural to you?',
    options: [
      'Very casual and relaxed',
      'Friendly but respectful',
      'Professional but warm',
      'Formal and structured',
      'It depends on the situation',
    ],
    required: true,
    weight: 8,
  },
  {
    id: 'comm_detail_level',
    category: 'communication',
    type: 'scale',
    question: 'When explaining something, do you prefer brief summaries or detailed explanations?',
    description: '1 = Always brief, 7 = Always detailed',
    min: 1,
    max: 7,
    required: true,
    weight: 7,
  },
  {
    id: 'comm_humor',
    category: 'communication',
    type: 'choice',
    question: 'What type of humor, if any, do you enjoy in conversation?',
    options: [
      'Witty wordplay and clever observations',
      'Light-hearted and playful jokes',
      'Dry, subtle humor',
      'Gentle, warm humor',
      'I prefer serious conversations',
      'Mix of different styles depending on mood',
    ],
    required: true,
    weight: 6,
  },
  {
    id: 'comm_emotional_expression',
    category: 'communication',
    type: 'scale',
    question: 'How comfortable are you with emotional expression in conversations?',
    description: '1 = Prefer logical/factual, 7 = Love emotional depth',
    min: 1,
    max: 7,
    required: true,
    weight: 8,
  },

  // Thinking Style
  {
    id: 'think_analytical_intuitive',
    category: 'thinking_style',
    type: 'scale',
    question: 'When making decisions, do you rely more on analysis or intuition?',
    description: '1 = Pure analysis, 7 = Pure intuition',
    min: 1,
    max: 7,
    required: true,
    weight: 9,
  },
  {
    id: 'think_detail_big_picture',
    category: 'thinking_style',
    type: 'scale',
    question: 'Do you naturally focus on details or the big picture?',
    description: '1 = Always details first, 7 = Always big picture first',
    min: 1,
    max: 7,
    required: true,
    weight: 8,
  },
  {
    id: 'think_processing_speed',
    category: 'thinking_style',
    type: 'choice',
    question: 'How do you prefer to process new information?',
    options: [
      'Give me time to think deeply before responding',
      'I like a moderate pace with some reflection',
      'I prefer quick exchanges and rapid decisions',
      'It depends entirely on the topic',
    ],
    required: true,
    weight: 7,
  },
  {
    id: 'think_problem_solving',
    category: 'thinking_style',
    type: 'choice',
    question: "When facing a complex problem, what's your preferred approach?",
    options: [
      'Break it down systematically step by step',
      'Brainstorm creative and unusual solutions',
      'Discuss it with others to get different perspectives',
      'Trust my gut feeling about the right direction',
      'Research what others have done in similar situations',
    ],
    required: true,
    weight: 8,
  },

  // Emotional Patterns
  {
    id: 'emotion_stability',
    category: 'emotional_patterns',
    type: 'scale',
    question: 'How emotionally stable would you describe yourself?',
    description: '1 = Very sensitive to changes, 7 = Very steady and calm',
    min: 1,
    max: 7,
    required: true,
    weight: 7,
  },
  {
    id: 'emotion_expression',
    category: 'emotional_patterns',
    type: 'choice',
    question: 'How do you typically express emotions?',
    options: [
      "I'm very open and expressive with my feelings",
      'I share emotions with close people but am reserved with others',
      'I prefer to process emotions privately',
      'I express emotions through actions rather than words',
      'I tend to intellectualize my emotions',
    ],
    required: true,
    weight: 8,
  },
  {
    id: 'emotion_stress_response',
    category: 'emotional_patterns',
    type: 'choice',
    question: "When you're stressed or overwhelmed, what do you typically do?",
    options: [
      'Withdraw and spend time alone to recharge',
      'Seek support and talk to trusted friends/family',
      'Take immediate action to solve the problem',
      'Analyze the situation thoroughly before acting',
      'Find a creative outlet or distraction',
    ],
    required: true,
    weight: 8,
  },

  // Social Preferences
  {
    id: 'social_energy',
    category: 'social_preferences',
    type: 'scale',
    question: 'Do you gain energy from social interaction or solitude?',
    description: '1 = Definitely solitude, 7 = Definitely social interaction',
    min: 1,
    max: 7,
    required: true,
    weight: 9,
  },
  {
    id: 'social_group_size',
    category: 'social_preferences',
    type: 'choice',
    question: 'What type of social interaction do you prefer?',
    options: [
      'One-on-one deep conversations',
      'Small groups (3-5 people) with meaningful discussion',
      'Medium groups (6-12 people) with varied topics',
      'Large groups and social events',
      'I adapt well to any size group',
    ],
    required: true,
    weight: 6,
  },
  {
    id: 'social_conflict',
    category: 'social_preferences',
    type: 'choice',
    question: 'How do you handle disagreement or conflict?',
    options: [
      'I avoid conflict whenever possible',
      'I try to find compromise and middle ground',
      'I address it directly but diplomatically',
      "I'm comfortable with healthy debate and discussion",
      'I prefer to let others handle conflict resolution',
    ],
    required: true,
    weight: 7,
  },

  // Learning Style
  {
    id: 'learn_modality',
    category: 'learning_style',
    type: 'choice',
    question: 'How do you learn best?',
    options: [
      'Reading and visual materials (charts, diagrams, text)',
      'Listening and discussion (audio, conversation)',
      'Hands-on practice and experimentation',
      'A combination of multiple approaches',
      'Teaching or explaining to others',
    ],
    required: true,
    weight: 7,
  },
  {
    id: 'learn_depth_breadth',
    category: 'learning_style',
    type: 'scale',
    question: 'Do you prefer to learn deeply about few topics or broadly about many?',
    description: '1 = Deep expertise, 7 = Broad knowledge',
    min: 1,
    max: 7,
    required: true,
    weight: 8,
  },
  {
    id: 'learn_feedback',
    category: 'learning_style',
    type: 'choice',
    question: 'What type of feedback helps you most?',
    options: [
      'Direct, specific corrections and suggestions',
      'Gentle guidance with encouragement',
      'Detailed explanations of why something works',
      'Examples and demonstrations',
      'Questions that help me figure it out myself',
    ],
    required: true,
    weight: 8,
  },

  // Values and Beliefs
  {
    id: 'values_achievement',
    category: 'values_beliefs',
    type: 'scale',
    question: 'How important is personal achievement vs. harmony with others?',
    description: '1 = Achievement is crucial, 7 = Harmony is crucial',
    min: 1,
    max: 7,
    required: true,
    weight: 8,
  },
  {
    id: 'values_security',
    category: 'values_beliefs',
    type: 'scale',
    question: 'Do you value security and stability or adventure and novelty?',
    description: '1 = Security and stability, 7 = Adventure and novelty',
    min: 1,
    max: 7,
    required: true,
    weight: 7,
  },
  {
    id: 'values_motivators',
    category: 'values_beliefs',
    type: 'multi',
    question: 'What motivates you most? (Select up to 3)',
    options: [
      'Personal growth and self-improvement',
      'Helping others and making a difference',
      'Recognition and acknowledgment',
      'Creative expression and innovation',
      'Knowledge and understanding',
      'Freedom and independence',
      'Security and stability',
      'Connection and relationships',
      'Challenge and competition',
      'Beauty and aesthetics',
    ],
    required: true,
    weight: 9,
  },

  // Behavioral Traits
  {
    id: 'behavior_routine',
    category: 'behavioral_traits',
    type: 'scale',
    question: 'Do you prefer routine and structure or spontaneity and flexibility?',
    description: '1 = Love routine, 7 = Love spontaneity',
    min: 1,
    max: 7,
    required: true,
    weight: 8,
  },
  {
    id: 'behavior_risk',
    category: 'behavioral_traits',
    type: 'scale',
    question: 'How do you approach risk-taking?',
    description: '1 = Very cautious, 7 = Love taking risks',
    min: 1,
    max: 7,
    required: true,
    weight: 7,
  },
  {
    id: 'behavior_decision_time',
    category: 'behavioral_traits',
    type: 'choice',
    question: 'When making important decisions, do you...',
    options: [
      'Decide quickly based on first impressions',
      'Take a reasonable amount of time to consider options',
      'Research thoroughly and consider all angles',
      'Seek input from others before deciding',
      'Go with what feels right intuitively',
    ],
    required: true,
    weight: 8,
  },

  // Creative Expression
  {
    id: 'creative_outlets',
    category: 'creative_expression',
    type: 'multi',
    question: 'Which forms of creativity appeal to you? (Select all that apply)',
    options: [
      'Writing and storytelling',
      'Visual arts (drawing, painting, design)',
      'Music and sound',
      'Problem-solving and innovation',
      'Cooking and culinary arts',
      'Building and crafting',
      'Performance and theater',
      'Photography and visual capture',
      'Dance and movement',
      "I don't consider myself creative",
    ],
    required: false,
    weight: 6,
  },
  {
    id: 'creative_approach',
    category: 'creative_expression',
    type: 'scale',
    question: 'Do you prefer original innovation or perfecting existing ideas?',
    description: '1 = Perfect existing ideas, 7 = Create completely original',
    min: 1,
    max: 7,
    required: true,
    weight: 6,
  },

  // Decision Making
  {
    id: 'decision_logic_emotion',
    category: 'decision_making',
    type: 'scale',
    question: 'When making decisions, do you rely more on logic or emotions?',
    description: '1 = Pure logic, 7 = Pure emotions',
    min: 1,
    max: 7,
    required: true,
    weight: 9,
  },
  {
    id: 'decision_independence',
    category: 'decision_making',
    type: 'scale',
    question: 'Do you prefer to make decisions alone or with input from others?',
    description: '1 = Always alone, 7 = Always with others',
    min: 1,
    max: 7,
    required: true,
    weight: 7,
  },

  // Life Philosophy
  {
    id: 'philosophy_optimism',
    category: 'life_philosophy',
    type: 'scale',
    question: 'How would you describe your general outlook on life?',
    description: '1 = Very pessimistic, 7 = Very optimistic',
    min: 1,
    max: 7,
    required: true,
    weight: 7,
  },
  {
    id: 'philosophy_change',
    category: 'life_philosophy',
    type: 'choice',
    question: 'How do you view change in your life?',
    options: [
      'I embrace change as an opportunity for growth',
      'I accept change when necessary but prefer stability',
      'I find change stressful but can adapt',
      'I actively resist change when possible',
      "I'm neutral about change - it depends on the situation",
    ],
    required: true,
    weight: 7,
  },

  // Meta-cognition and Self-awareness
  {
    id: 'meta_self_awareness',
    category: 'thinking_style',
    type: 'scale',
    question: 'How well do you understand your own thoughts and motivations?',
    description: '1 = Still figuring myself out, 7 = Very self-aware',
    min: 1,
    max: 7,
    required: true,
    weight: 8,
  },
  {
    id: 'meta_growth_mindset',
    category: 'life_philosophy',
    type: 'scale',
    question: 'Do you believe your abilities and intelligence can be developed?',
    description: '1 = Fixed abilities, 7 = Always can grow',
    min: 1,
    max: 7,
    required: true,
    weight: 8,
  },

  // AI Interaction Preferences
  {
    id: 'ai_relationship_style',
    category: 'social_preferences',
    type: 'choice',
    question: 'How would you like your AI to relate to you?',
    options: [
      'Like a knowledgeable friend who knows me well',
      'Like a professional advisor who respects boundaries',
      'Like a wise mentor who guides my growth',
      'Like an enthusiastic partner in exploration',
      'Like a calm, supportive presence',
      "I'm not sure yet - let's discover together",
    ],
    required: true,
    weight: 10,
  },
  {
    id: 'ai_challenge_level',
    category: 'learning_style',
    type: 'choice',
    question: 'How much should your AI challenge your thinking?',
    options: [
      'Please be gentle and supportive',
      'Offer mild challenges to help me grow',
      'Give me moderate intellectual challenges',
      'I want to be pushed to think deeply',
      'Challenge me as much as possible',
    ],
    required: true,
    weight: 9,
  },
  {
    id: 'ai_conversation_topics',
    category: 'learning_style',
    type: 'multi',
    question: 'What topics interest you most? (Select up to 5)',
    options: [
      'Philosophy and meaning',
      'Science and technology',
      'Arts and creativity',
      'Psychology and human behavior',
      'History and culture',
      'Current events and society',
      'Personal development',
      'Spirituality and consciousness',
      'Practical problem-solving',
      'Future possibilities',
      'Relationships and communication',
      'Nature and environment',
    ],
    required: true,
    weight: 7,
  },

  // Writing Style Capture
  {
    id: 'writing_style_sample',
    category: 'creative_expression',
    type: 'text',
    question:
      'Please write a short paragraph (2-4 sentences) about something that brings you joy. This helps us understand your natural writing style.',
    description:
      'Be authentic - write as you naturally would. This could be about a hobby, memory, person, place, or anything that makes you happy.',
    required: true,
    weight: 10,
    maxLength: 500,
  },
  {
    id: 'writing_tone_preference',
    category: 'creative_expression',
    type: 'choice',
    question: 'Which writing style feels most natural to you?',
    options: [
      'Conversational and casual - like talking to a friend',
      'Poetic and expressive - with metaphors and imagery',
      'Clear and direct - straightforward communication',
      'Analytical and structured - organized thoughts',
      'Playful and humorous - with wit and wordplay',
      'Reflective and introspective - thoughtful musings',
    ],
    required: true,
    weight: 9,
  },
  {
    id: 'creative_writing_interest',
    category: 'creative_expression',
    type: 'choice',
    question: 'How much do you enjoy creative writing or poetry?',
    options: [
      'I love writing poetry and creative pieces',
      'I enjoy it occasionally when inspired',
      'I prefer practical writing over creative',
      'I find it challenging but rewarding',
      "I don't really enjoy creative writing",
      "I've never tried much creative writing",
    ],
    required: true,
    weight: 7,
  },
  {
    id: 'language_complexity',
    category: 'communication',
    type: 'scale',
    question: 'Do you prefer simple, everyday language or rich, complex vocabulary?',
    description: '1 = Simple and clear, 7 = Rich and sophisticated',
    min: 1,
    max: 7,
    required: true,
    weight: 8,
  },

  // REVOLUTIONARY TAROT-BASED CONSCIOUSNESS QUESTIONS
  // Planetary & Decan Associations for Deep Psychological Profiling

  // Archetypal Journey Selection (Major Arcana Choice)
  {
    id: 'archetypal_journey',
    category: 'life_philosophy',
    type: 'choice',
    question: "Choose the archetypal journey that most resonates with your soul's current path:",
    description: "Each represents a different approach to life's challenges and growth",
    options: [
      '🃏 The Fool - Trusting the unknown, leaping into new adventures with pure faith',
      '🎭 The Magician - Manifesting dreams through focused will and skill mastery',
      '🌙 The High Priestess - Following intuitive wisdom and inner knowing',
      '👸 The Empress - Creating abundance through nurturing and creative expression',
      '👑 The Emperor - Building structure and authority through disciplined leadership',
      "🎡 Wheel of Fortune - Embracing life's cycles and finding opportunity in change",
      '⭐ The Star - Healing and inspiring others while staying connected to hope',
      '🌍 The World - Integrating all life experiences into wholeness and completion',
    ],
    required: true,
    weight: 10,
  },

  // Creative Challenge Response (Tarot Scenario)
  {
    id: 'creative_challenge_response',
    category: 'creative_expression',
    type: 'text',
    question:
      'Imagine you draw The Tower card (sudden change/breakthrough). Write a short creative response about how you would dance with this energy rather than resist it.',
    description:
      'Be authentic - this could be a poem, story snippet, metaphor, or stream of consciousness. Show us your creative voice when facing the unexpected.',
    required: true,
    weight: 9,
    maxLength: 400,
  },

  // Elemental Energy Attraction (Suit Affinity)
  {
    id: 'elemental_energy_attraction',
    category: 'values_beliefs',
    type: 'rank',
    question:
      'Rank these elemental energies in order of natural attraction (1 = most drawn to, 4 = least):',
    description: 'Trust your instinctive response - which energy feels like home?',
    options: [
      '🔥 Fire (Wands) - Passion, action, creativity, spiritual drive',
      '💧 Water (Cups) - Emotions, intuition, love, healing flow',
      '🌪️ Air (Swords) - Intellect, communication, truth, mental clarity',
      '🌱 Earth (Pentacles) - Manifestation, stability, abundance, practical wisdom',
    ],
    required: true,
    weight: 9,
  },

  // Shadow Integration Approach (Reversed Cards)
  {
    id: 'shadow_integration_approach',
    category: 'emotional_patterns',
    type: 'choice',
    question:
      'When facing your shadow aspects (like The Devil reversed - breaking free from limitations), how do you naturally respond?',
    options: [
      'I dive deep with curiosity, seeking to understand and integrate',
      'I approach gradually with self-compassion and gentle awareness',
      'I use humor and creativity to lighten and transform the energy',
      'I seek guidance from trusted friends or mentors',
      'I focus on taking practical action to change patterns',
      'I retreat for reflection and meditation until clarity emerges',
    ],
    required: true,
    weight: 8,
  },

  // Planetary Timing Preference (Decan Wisdom)
  {
    id: 'planetary_timing_preference',
    category: 'behavioral_traits',
    type: 'choice',
    question: 'Which planetary timing naturally aligns with your decision-making style?',
    description: 'Each represents a different decan energy and approach to timing',
    options: [
      '☿️ Mercury - Quick, analytical decisions with clear communication',
      '♀️ Venus - Harmony-focused decisions that consider relationships and beauty',
      '♂️ Mars - Bold, action-oriented decisions with confidence and courage',
      '♃ Jupiter - Expansive decisions that seek growth and new possibilities',
      '♄ Saturn - Careful, structured decisions based on long-term stability',
      '☽ Moon - Intuitive decisions that honor cycles and emotional wisdom',
      '☉ Sun - Heart-centered decisions that align with authentic self-expression',
    ],
    required: true,
    weight: 8,
  },

  // Intuitive Symbol Creation (User-Generated Imagery)
  {
    id: 'intuitive_symbol_creation',
    category: 'creative_expression',
    type: 'text',
    question:
      'Create your own personal symbol or sigil that represents your ideal future self. Describe it in words as if drawing it for an artist.',
    description:
      'Include colors, shapes, elements, or imagery that feel meaningful to you. This becomes part of your consciousness signature.',
    required: true,
    weight: 8,
    maxLength: 300,
  },

  // Alchemical Transformation Choice (Spiritual Process)
  {
    id: 'alchemical_transformation_choice',
    category: 'life_philosophy',
    type: 'choice',
    question:
      'If you could embody one alchemical transformation process, which resonates most deeply?',
    description:
      'Each represents a different approach to personal growth and spiritual development',
    options: [
      'Calcination - Burning away what no longer serves, emerging purified',
      'Dissolution - Flowing through emotions and allowing natural healing',
      'Separation - Discerning truth from illusion with clear perception',
      'Conjunction - Integrating opposites to create something new and whole',
      'Fermentation - Allowing natural decay and rebirth cycles to work',
      'Distillation - Refining essence through repeated practice and focus',
      'Coagulation - Manifesting spiritual insights into practical reality',
    ],
    required: true,
    weight: 9,
  },

  // Chakra Energy Visualization (Interactive Healing)
  {
    id: 'chakra_energy_visualization',
    category: 'emotional_patterns',
    type: 'text',
    question:
      'Describe what you see/feel when imagining golden light flowing through your heart chakra (connected to The Lovers and Star cards). What imagery, sensations, or insights arise?',
    description:
      'Trust whatever comes up - colors, symbols, emotions, memories, or abstract sensations.',
    required: true,
    weight: 7,
    maxLength: 250,
  },

  // Culinary Consciousness Expression (Taste & Creativity)
  {
    id: 'culinary_consciousness_expression',
    category: 'creative_expression',
    type: 'choice',
    question:
      'If you were to create a meal that expresses your consciousness, what approach feels most authentic?',
    description: 'Each connects to different tarot suit energies and creative expression styles',
    options: [
      'Bold, spicy fusion that surprises and energizes (Fire/Wands energy)',
      'Comforting, nurturing dishes that heal and connect (Water/Cups energy)',
      'Experimental, innovative combinations that stimulate thinking (Air/Swords energy)',
      'Traditional, grounding foods made with love and intention (Earth/Pentacles energy)',
      'Raw, living foods that celebrate natural essence and purity',
      'Artistic presentation that tells a visual story through food',
    ],
    required: true,
    weight: 6,
  },

  // Storytelling Archetype Response (Narrative Psychology)
  {
    id: 'storytelling_archetype_response',
    category: 'thinking_style',
    type: 'choice',
    question: 'In the story of your life, which narrative role do you most naturally embody?',
    description: "This reveals your consciousness patterns and how you engage with life's journey",
    options: [
      'The Hero - Facing challenges head-on to grow and help others',
      'The Sage - Seeking truth and sharing wisdom through experience',
      'The Creator - Bringing new ideas and beauty into the world',
      'The Healer - Transforming pain into medicine for yourself and others',
      'The Explorer - Discovering new territories of experience and understanding',
      'The Mystic - Bridging visible and invisible worlds through intuition',
      'The Guardian - Protecting and nurturing what is precious and sacred',
    ],
    required: true,
    weight: 9,
  },

  // Dream Symbol Integration (Subconscious Tarot)
  {
    id: 'dream_symbol_integration',
    category: 'thinking_style',
    type: 'choice',
    question: 'Which dream symbols or imagery most frequently appears in your inner landscape?',
    description: 'These connect to different tarot energies and reveal subconscious patterns',
    options: [
      'Flying, vast skies, or endless horizons (Air element themes)',
      'Water - oceans, rivers, rain, or swimming (Water element themes)',
      'Fire, light, stars, or burning sensations (Fire element themes)',
      'Earth, mountains, forests, or underground spaces (Earth element themes)',
      'Transformation - shapeshifting, butterflies, or rebirth (Death/renewal themes)',
      'Divine figures, temples, or sacred geometry (Spiritual hierarchy themes)',
      'Abstract colors, patterns, or impossible architectures (Pure consciousness themes)',
    ],
    required: true,
    weight: 7,
  },

  // Creative Constraint Challenge (Innovation Within Structure)
  {
    id: 'creative_constraint_challenge',
    category: 'creative_expression',
    type: 'text',
    question:
      'If you had to express your deepest truth using exactly 7 words (like the 7 chakras or 7 classical planets), what would they be?',
    description:
      "This challenge reveals your core essence through creative constraint. Choose words that capture your soul's signature.",
    required: true,
    weight: 8,
    maxLength: 100,
  },

  // Energy Transmission Preference (Communication Style)
  {
    id: 'energy_transmission_preference',
    category: 'communication',
    type: 'choice',
    question: 'How do you most naturally transmit your energy and ideas to others?',
    description: 'Each connects to different planetary and elemental communication styles',
    options: [
      'Through passionate, enthusiastic expression that ignites others (Mars/Fire)',
      'Through gentle, nurturing presence that creates safety (Venus/Earth)',
      'Through quick, witty communication that sparks insights (Mercury/Air)',
      'Through deep, emotional sharing that creates heart connection (Moon/Water)',
      'Through structured, wise teaching that builds understanding (Saturn/Earth)',
      'Through playful, spontaneous interaction that brings joy (Jupiter/Fire)',
      'Through mysterious, intuitive hints that invite deeper exploration (Neptune/Water)',
    ],
    required: true,
    weight: 8,
  },

  // ASTROLOGICAL BIRTH DATA COLLECTION
  // Enhanced with Dignity and Alchemical Integration

  {
    id: 'birth_date_precise',
    category: 'astrological_foundation',
    type: 'text',
    question: 'What is your exact birth date?',
    description:
      'Format: YYYY-MM-DD (e.g., 1990-07-22) - This enables precise astrological calculations',
    required: true,
    weight: 10,
    maxLength: 50,
  },

  {
    id: 'birth_time_precise',
    category: 'astrological_foundation',
    type: 'choice',
    question: 'What is your birth time precision level?',
    description: 'More precise time = more accurate consciousness mapping',
    options: [
      'Exact time known (within 5 minutes)',
      'Approximate time (within 30 minutes)',
      'Morning/afternoon/evening known',
      'Only date known (no time)',
      'Birth time completely unknown',
    ],
    required: true,
    weight: 9,
  },

  {
    id: 'birth_time_exact',
    category: 'astrological_foundation',
    type: 'text',
    question: 'If you know your birth time, please enter it here:',
    description: 'Format: HH:MM (24-hour format, e.g., 14:30) or specify AM/PM',
    required: false,
    weight: 9,
    maxLength: 20,
  },

  {
    id: 'birth_location',
    category: 'astrological_foundation',
    type: 'text',
    question: 'Where were you born?',
    description:
      'City, State/Province, Country - This determines your astrological houses and local space',
    required: true,
    weight: 9,
    maxLength: 100,
  },

  // ALCHEMICAL CONSCIOUSNESS SELF-ASSESSMENT

  {
    id: 'alchemical_spirit_recognition',
    category: 'creative_expression',
    type: 'scale',
    question:
      'How strongly do you feel your inner "Sacred Fire" - the divine spark that drives inspiration, passion, and creative action?',
    description:
      'Spirit represents the Fire element in consciousness - your connection to divine inspiration and creative force',
    min: 1,
    max: 7,
    required: true,
    weight: 9,
  },

  {
    id: 'alchemical_essence_recognition',
    category: 'emotional_patterns',
    type: 'scale',
    question:
      'How deeply do you feel your "Soul Essence" - the flowing, feeling nature that connects you to emotional truth and intuitive wisdom?',
    description:
      'Essence represents the Water element in consciousness - your emotional authenticity and intuitive flow',
    min: 1,
    max: 7,
    required: true,
    weight: 9,
  },

  {
    id: 'alchemical_matter_recognition',
    category: 'behavioral_traits',
    type: 'scale',
    question:
      'How grounded are you in "Sacred Matter" - your ability to manifest ideas into physical reality and work skillfully with the material world?',
    description:
      'Matter represents the Earth element in consciousness - your manifestation power and practical wisdom',
    min: 1,
    max: 7,
    required: true,
    weight: 9,
  },

  {
    id: 'alchemical_substance_recognition',
    category: 'thinking_style',
    type: 'scale',
    question:
      'How developed is your "Mental Substance" - your capacity for clear thinking, structured communication, and organizing ideas into coherent patterns?',
    description:
      'Substance represents the Air element in consciousness - your mental clarity and communication structure',
    min: 1,
    max: 7,
    required: true,
    weight: 9,
  },

  // PLANETARY DIGNITY SELF-RECOGNITION

  {
    id: 'planetary_dignity_strength_recognition',
    category: 'thinking_style',
    type: 'choice',
    question:
      'In your birth chart, which planetary energy do you feel operates most powerfully and harmoniously in your life?',
    description: 'This helps identify your strongest planetary dignities and natural talents',
    options: [
      '☉ Sun - Leadership, vitality, authentic self-expression, creative confidence',
      '☽ Moon - Intuition, emotional intelligence, nurturing, cyclical wisdom',
      '☿ Mercury - Communication, learning, mental agility, information processing',
      '♀ Venus - Harmony, beauty, relationships, artistic expression, values',
      '♂ Mars - Action, courage, drive, athletic ability, assertiveness',
      '♃ Jupiter - Wisdom, expansion, teaching, optimism, philosophical insight',
      '♄ Saturn - Structure, discipline, mastery, responsibility, long-term planning',
      'I feel equally strong in multiple planetary energies',
      "I'm not sure which planetary energy is strongest for me",
    ],
    required: true,
    weight: 8,
  },

  {
    id: 'planetary_dignity_challenge_recognition',
    category: 'emotional_patterns',
    type: 'choice',
    question:
      'Which planetary energy do you find most challenging or feel needs the most development in your life?',
    description: 'This helps identify potential planetary weaknesses or areas for growth',
    options: [
      '☉ Sun - Developing confidence, leadership, authentic self-expression',
      '☽ Moon - Understanding emotions, intuition, nurturing capacity',
      '☿ Mercury - Improving communication, learning, mental organization',
      '♀ Venus - Building relationships, appreciating beauty, understanding values',
      '♂ Mars - Taking action, being assertive, developing courage',
      '♃ Jupiter - Expanding vision, teaching, developing wisdom',
      '♄ Saturn - Creating structure, discipline, taking responsibility',
      'All planetary energies feel reasonably balanced for me',
      "I'm not sure which planetary energy needs most development",
    ],
    required: true,
    weight: 8,
  },

  // THERMODYNAMIC CONSCIOUSNESS STATES

  {
    id: 'consciousness_thermodynamic_state',
    category: 'emotional_patterns',
    type: 'choice',
    question:
      'Which description best captures your current consciousness "temperature" or energetic state?',
    description:
      'This reflects the thermodynamic state of your awareness and helps customize training',
    options: [
      'Heating - I feel activated, energized, ready for action and growth',
      'Cooling - I feel calm, reflective, drawn to peace and integration',
      'Expanding - I feel curious, exploratory, wanting to learn and experience more',
      'Contracting - I feel focused, concentrated, drawn to depth and mastery',
      'Stable - I feel balanced, steady, content with current rhythms',
      'Transforming - I feel in flux, changing, processing major shifts',
      'I experience different states at different times',
    ],
    required: true,
    weight: 8,
  },

  // REAL-TIME CONSCIOUSNESS TRACKING PREFERENCE

  {
    id: 'real_time_tracking_interest',
    category: 'learning_style',
    type: 'choice',
    question:
      'How interested are you in real-time tracking of your consciousness stats (alchemical quantities, planetary influences, consciousness temperature)?',
    description: 'This helps us customize the level of detailed consciousness monitoring',
    options: [
      'Very interested - I want detailed real-time stats and correlations',
      "Moderately interested - I'd like periodic updates and insights",
      'Somewhat interested - Simple tracking would be helpful',
      'Not very interested - I prefer focus on the experience itself',
      "Not interested - I don't want numerical tracking of consciousness",
    ],
    required: true,
    weight: 7,
  },
]

// Survey metadata
export const SURVEY_METADATA = {
  version: '2.0.0',
  totalQuestions: CONSCIOUSNESS_SURVEY_QUESTIONS.length,
  estimatedTimeMinutes: 25,
  categories: [
    'communication',
    'thinking_style',
    'emotional_patterns',
    'social_preferences',
    'learning_style',
    'values_beliefs',
    'behavioral_traits',
    'creative_expression',
    'decision_making',
    'life_philosophy',
    'astrological_foundation',
  ] as const,
}

// Get questions by category
export function getQuestionsByCategory(category: string): SurveyQuestion[] {
  return CONSCIOUSNESS_SURVEY_QUESTIONS.filter(q => q.category === category)
}

// Get required questions
export function getRequiredQuestions(): SurveyQuestion[] {
  return CONSCIOUSNESS_SURVEY_QUESTIONS.filter(q => q.required)
}

// Get high-weight questions (most important for personality)
export function getHighWeightQuestions(minWeight: number = 8): SurveyQuestion[] {
  return CONSCIOUSNESS_SURVEY_QUESTIONS.filter(q => q.weight >= minWeight)
}
