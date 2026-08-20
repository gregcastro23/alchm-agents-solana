from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import List, Optional, Dict, Any, Union, Literal
from datetime import datetime

class BirthLocation(BaseModel):
    lat: float
    lon: float
    name: str

class AgentBase(BaseModel):
    agentId: str
    name: str
    title: Optional[str] = None
    birthDate: Optional[datetime] = None
    birthTime: Optional[str] = None
    birthLocation: Optional[BirthLocation] = None
    birthYear: Optional[int] = None
    deathYear: Optional[int] = None
    
    consciousnessLevel: Optional[str] = None
    monicaConstant: Optional[float] = None
    dominantElement: Optional[str] = None
    dominantModality: Optional[str] = None
    
    specialty: Optional[str] = None
    wisdomDomains: Optional[List[str]] = []
    
    avatar: Optional[str] = None
    color: Optional[str] = None
    symbol: Optional[str] = None
    
    personalityCore: Optional[Dict[str, Any]] = None
    personalityShadows: Optional[List[Dict[str, Any]]] = None
    personalityGifts: Optional[List[Dict[str, Any]]] = None
    personalityChallenges: Optional[List[Dict[str, Any]]] = None
    traits: Optional[Union[List[str], Dict[str, Any]]] = None

class AgentCreate(AgentBase):
    # Cosmic EV & Leveling — optional; planetary agents are created at the cap.
    # Left None for ordinary agents so model/DB defaults apply (see crud.create_agent).
    level: Optional[int] = None
    xp: Optional[int] = None
    evolutionStage: Optional[int] = None
    evolutionValues: Optional[Dict[str, Any]] = None
    evTotal: Optional[int] = None

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    consciousnessLevel: Optional[str] = None
    monicaConstant: Optional[float] = None
    currentMood: Optional[str] = None
    evolutionStage: Optional[int] = None
    avatar: Optional[str] = None

class Agent(AgentBase):
    id: Union[str, int]
    historicalEra: Optional[str] = None
    culture: Optional[str] = None
    geography: Optional[str] = None
    
    personalityCore: Optional[Dict[str, Any]] = None
    personalityShadows: Optional[List[Dict[str, Any]]] = None
    personalityGifts: Optional[List[Dict[str, Any]]] = None
    personalityChallenges: Optional[List[Dict[str, Any]]] = None
    
    currentMood: Optional[str] = None
    evolutionStage: int = 0
    
    conversations: int = 0
    wisdomShared: int = 0
    resonanceScore: float = 0.5
    evolutionPoints: int = 0

    # Cosmic EV & Leveling
    level: int = 1
    xp: int = 0
    evolutionValues: Optional[Dict[str, Any]] = None
    evTotal: int = 0
    ivSnapshot: Optional[Dict[str, Any]] = None

    lastActive: datetime
    isActive: bool = True

    model_config = ConfigDict(from_attributes=True)

class ConversationBase(BaseModel):
    agentId: str
    sessionId: str
    userId: Optional[str] = None
    userMessage: str
    agentResponse: str

class ConversationCreate(ConversationBase):
    contextData: Optional[Dict[str, Any]] = None
    responseTime: Optional[float] = None
    modelUsed: Optional[str] = None
    temperature: Optional[float] = None
    tokenCount: Optional[int] = None

class Conversation(ConversationBase):
    id: Union[str, int]
    createdAt: datetime
    
    model_config = ConfigDict(from_attributes=True)

class ChatRequest(BaseModel):
    agentId: str
    message: str
    sessionId: Optional[str] = None
    userId: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    # Verbatim system prompt assembled by the TS persona builder.
    # When present, backend skips the Python template and uses this directly.
    systemPromptOverride: Optional[str] = None
    # Stable hash of the persona content — drives prompt-cache reuse.
    personaCacheKey: Optional[str] = None
    # Cost tier: 'free' | 'cheap_fast' | 'primary' | 'reflective'.
    # Default applied server-side is 'cheap_fast' (Haiku 4.5).
    modelTier: Optional[str] = None
    # BYOK: caller's own provider keys, e.g. {"anthropic": "sk-ant-...",
    # "openai": "sk-..."}. Used in place of the app keys for the matching
    # provider. Never persisted or logged backend-side.
    userProviderKeys: Optional[Dict[str, str]] = None

class ChatResponse(BaseModel):
    text: str
    agentId: str
    sessionId: str
    ai_generated: bool = Field(default=True)
    metadata: Optional[Dict[str, Any]] = None

class MultiAgentChatRequest(BaseModel):
    agentIds: List[str] = Field(default_factory=lambda: ["sirius", "arcturus", "vega", "polaris"])
    message: str
    sessionId: Optional[str] = None
    userId: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    systemPromptOverrides: Optional[Dict[str, str]] = None
    modelTier: Optional[str] = None

class MultiAgentTurn(BaseModel):
    agentId: str
    name: str
    element: Optional[str] = None
    text: str

class MultiAgentChatResponse(BaseModel):
    responses: List[MultiAgentTurn]
    sessionId: str
    ai_generated: bool = Field(default=True)
    metadata: Optional[Dict[str, Any]] = None


class RecipeBirthData(BaseModel):
    dateTime: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    model_config = ConfigDict(extra="allow")

class CosmicRecipeRequest(BaseModel):
    prompt: str = Field(
        default="A nourishing, restorative meal aligned with today's cosmic energies.",
        min_length=1,
        max_length=2000,
    )
    dominantElement: Optional[Literal["Air", "Fire", "Water", "Earth"]] = None
    cuisine: Optional[str] = Field(default=None, max_length=120)
    topIngredients: List[str] = Field(default_factory=list, max_length=40)
    birthData: Optional[RecipeBirthData] = None
    dietPreference: Optional[str] = Field(default="omnivore", max_length=120)
    dietary: List[str] = Field(default_factory=list, max_length=20)
    alchemicalState: Optional[Dict[str, float]] = None
    thermodynamicProperties: Optional[Dict[str, float]] = None
    disallowedIngredients: List[str] = Field(default_factory=list, max_length=40)
    userId: Optional[str] = None
    modelTier: Optional[str] = None

    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def normalize_context_and_aliases(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value

        data = dict(value)
        context = data.pop("context", None)
        if isinstance(context, dict):
            merged = dict(context)
            merged.update({k: v for k, v in data.items() if v is not None})
            data = merged

        if "diet" in data and "dietPreference" not in data:
            data["dietPreference"] = data["diet"]
        if "dietaryRestrictions" in data and "dietary" not in data:
            data["dietary"] = data["dietaryRestrictions"]
        if "preferredCuisine" in data and "cuisine" not in data:
            data["cuisine"] = data["preferredCuisine"]
        if "ingredients_main" in data and "topIngredients" not in data:
            data["topIngredients"] = data["ingredients_main"]
        if "disallowed_ingredients" in data and "disallowedIngredients" not in data:
            data["disallowedIngredients"] = data["disallowed_ingredients"]
        if "tier" in data and "modelTier" not in data:
            data["modelTier"] = data["tier"]

        return data


def _coerce_numeric(val: Any, default: float = 0.0) -> float:
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        import re
        match = re.search(r"[-+]?\d*\.?\d+", val.replace(",", ""))
        if match:
            try:
                return float(match.group(0))
            except ValueError:
                pass
    return default


class AlignmentScore(BaseModel):
    overall: float = Field(default=85.0, ge=0, le=100)
    ingredients_fit: float = Field(default=85.0, ge=0, le=100)
    diet_fit: float = Field(default=85.0, ge=0, le=100)
    time_fit: float = Field(default=85.0, ge=0, le=100)
    astro_fit: float = Field(default=85.0, ge=0, le=100)

    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def coerce_scores(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        data = dict(value)
        for k in ["overall", "ingredients_fit", "diet_fit", "time_fit", "astro_fit"]:
            if k in data:
                raw_num = _coerce_numeric(data[k], 85.0)
                data[k] = max(0.0, min(100.0, raw_num))
            else:
                data[k] = 85.0
        return data


class RecipeTags(BaseModel):
    diet: List[str] = Field(default_factory=list)
    cuisine: List[str] = Field(default_factory=list)
    meal_type: str = Field(default="Dinner")
    flavor_profile: List[str] = Field(default_factory=list)
    cooking_methods: List[str] = Field(default_factory=list)
    elements: List[str] = Field(default_factory=list)
    planets: List[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def coerce_tags(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        data = dict(value)
        list_fields = ["diet", "cuisine", "flavor_profile", "cooking_methods", "elements", "planets"]
        for lf in list_fields:
            v = data.get(lf)
            if v is None:
                data[lf] = []
            elif isinstance(v, str):
                data[lf] = [s.strip() for s in v.split(",") if s.strip()]
            elif not isinstance(v, list):
                data[lf] = [str(v)]
        if "meal_type" not in data or not data["meal_type"]:
            data["meal_type"] = "Dinner"
        elif isinstance(data["meal_type"], list):
            data["meal_type"] = data["meal_type"][0] if data["meal_type"] else "Dinner"
        return data


class RecipeIngredient(BaseModel):
    name: str
    quantity: str = Field(default="1")
    unit: str = Field(default="serving")
    household_description: Optional[str] = None
    optional: bool = Field(default=False)
    substitutions: List[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def coerce_ingredient(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        data = dict(value)
        if "name" not in data or not data["name"]:
            data["name"] = "Seasonal Ingredient"
        data["quantity"] = str(data.get("quantity", "1"))
        data["unit"] = str(data.get("unit", "portion") or "portion")
        if "optional" in data:
            opt = data["optional"]
            if isinstance(opt, str):
                data["optional"] = opt.lower() in ("true", "1", "yes")
            else:
                data["optional"] = bool(opt)
        else:
            data["optional"] = False
        subs = data.get("substitutions")
        if subs is None:
            data["substitutions"] = []
        elif isinstance(subs, str):
            data["substitutions"] = [s.strip() for s in subs.split(",") if s.strip()]
        return data


class RecipeStep(BaseModel):
    step_number: int = Field(ge=1)
    instruction: str
    time_minutes: float = Field(default=5.0, ge=0)
    cooking_method: str = Field(default="prepare")
    tips: List[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def coerce_step(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        data = dict(value)
        if "step_number" in data:
            data["step_number"] = max(1, int(_coerce_numeric(data["step_number"], 1)))
        else:
            data["step_number"] = 1
        if "time_minutes" in data:
            data["time_minutes"] = max(0.0, _coerce_numeric(data["time_minutes"], 5.0))
        else:
            data["time_minutes"] = 5.0
        if "cooking_method" not in data or not data["cooking_method"]:
            data["cooking_method"] = "prepare"
        tips = data.get("tips")
        if tips is None:
            data["tips"] = []
        elif isinstance(tips, str):
            data["tips"] = [s.strip() for s in tips.split(",") if s.strip()]
        return data


class ElementalBalance(BaseModel):
    fire: float = Field(default=25.0, ge=0, le=100)
    earth: float = Field(default=25.0, ge=0, le=100)
    water: float = Field(default=25.0, ge=0, le=100)
    air: float = Field(default=25.0, ge=0, le=100)

    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def coerce_balance(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        data = dict(value)
        for elem in ["fire", "earth", "water", "air"]:
            raw_num = _coerce_numeric(data.get(elem, 25.0), 25.0)
            data[elem] = max(0.0, min(100.0, raw_num))
        return data


class RecipeNutrition(BaseModel):
    calories: float = Field(default=400.0, ge=0)
    protein: float = Field(default=20.0, ge=0)
    carbohydrates: float = Field(default=45.0, ge=0)
    fat: float = Field(default=15.0, ge=0)

    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def coerce_nutrition(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        data = dict(value)
        defaults = {"calories": 400.0, "protein": 20.0, "carbohydrates": 45.0, "fat": 15.0}
        for k, def_val in defaults.items():
            raw_num = _coerce_numeric(data.get(k, def_val), def_val)
            data[k] = max(0.0, raw_num)
        return data


class FinishingAndServing(BaseModel):
    garnish_and_plating: str = Field(default="Serve immediately on warm plates.")
    doneness_cues: str = Field(default="Aromatic and cooked to desired doneness.")
    serving_suggestions: str = Field(default="Enjoy alongside fresh seasonal sides.")

    model_config = ConfigDict(extra="ignore")


class LeftoversAndStorage(BaseModel):
    can_store: bool = Field(default=True)
    storage_instructions: str = Field(default="Refrigerate in an airtight container.")
    storage_lifespan_days: float = Field(default=3.0, ge=0)

    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def coerce_storage(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        data = dict(value)
        if "can_store" in data:
            cs = data["can_store"]
            if isinstance(cs, str):
                data["can_store"] = cs.lower() in ("true", "1", "yes")
            else:
                data["can_store"] = bool(cs)
        else:
            data["can_store"] = True
        if "storage_lifespan_days" in data:
            data["storage_lifespan_days"] = max(0.0, _coerce_numeric(data["storage_lifespan_days"], 3.0))
        else:
            data["storage_lifespan_days"] = 3.0
        return data


class AstroExplanation(BaseModel):
    summary: str = Field(default="Aligned with current planetary energies.")
    correspondences: List[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def coerce_astro(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        data = dict(value)
        if "summary" not in data or not data["summary"]:
            data["summary"] = "Harmonized with cosmic transit elements."
        corr = data.get("correspondences")
        if corr is None:
            data["correspondences"] = []
        elif isinstance(corr, str):
            data["correspondences"] = [s.strip() for s in corr.split(",") if s.strip()]
        return data


_VALID_CATEGORIES = {
    "Beverages",
    "Breakfast",
    "Dessert",
    "Dinner",
    "Lunch",
    "Salad",
    "Sauce",
    "Side",
    "Soup",
    "Appetizer",
    "Condiment",
}

_CATEGORY_ALIASES = {
    "beverage": "Beverages",
    "beverages": "Beverages",
    "drink": "Beverages",
    "drinks": "Beverages",
    "cocktail": "Beverages",
    "smoothie": "Beverages",
    "tea": "Beverages",
    "breakfast": "Breakfast",
    "brunch": "Breakfast",
    "dessert": "Dessert",
    "desserts": "Dessert",
    "sweet": "Dessert",
    "dinner": "Dinner",
    "main": "Dinner",
    "main course": "Dinner",
    "entree": "Dinner",
    "entr\u00e9e": "Dinner",
    "lunch": "Lunch",
    "salad": "Salad",
    "salads": "Salad",
    "sauce": "Sauce",
    "sauces": "Sauce",
    "side": "Side",
    "sides": "Side",
    "side dish": "Side",
    "soup": "Soup",
    "soups": "Soup",
    "stew": "Soup",
    "appetizer": "Appetizer",
    "appetizers": "Appetizer",
    "starter": "Appetizer",
    "snack": "Appetizer",
    "snacks": "Appetizer",
    "condiment": "Condiment",
    "condiments": "Condiment",
    "dip": "Condiment",
}

_DIFFICULTY_ALIASES = {
    "easy": "beginner",
    "simple": "beginner",
    "beginner": "beginner",
    "medium": "intermediate",
    "moderate": "intermediate",
    "intermediate": "intermediate",
    "hard": "advanced",
    "complex": "advanced",
    "advanced": "advanced",
    "expert": "advanced",
}


class CosmicRecipeResponse(BaseModel):
    id: str
    title: str
    short_description: str
    category: Literal[
        "Beverages",
        "Breakfast",
        "Dessert",
        "Dinner",
        "Lunch",
        "Salad",
        "Sauce",
        "Side",
        "Soup",
        "Appetizer",
        "Condiment",
    ]
    cuisine: str
    difficulty: Literal["beginner", "intermediate", "advanced"]
    yields: float = Field(gt=0)
    total_time: float = Field(gt=0)
    alignment_score: AlignmentScore
    alignment_notes: List[str]
    tags: RecipeTags
    ingredients: List[RecipeIngredient] = Field(min_length=1)
    steps: List[RecipeStep] = Field(min_length=1)
    elementalBalance: ElementalBalance
    nutrition: RecipeNutrition
    vitamins: Optional[List[str]] = None
    minerals: Optional[List[str]] = None
    finishing_and_serving: FinishingAndServing
    leftovers_and_storage: LeftoversAndStorage
    astro_explanation: AstroExplanation
    ai_generated: bool = Field(default=True)

    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def coerce_recipe(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        data = dict(value)

        # 1. Title & ID
        title = str(data.get("title", "") or "Cosmic Dish").strip()
        data["title"] = title
        if "id" not in data or not data["id"]:
            import re
            slug = re.sub(r"[^a-zA-Z0-9]+", "-", title.lower()).strip("-")
            data["id"] = slug or "cosmic-recipe"

        # 2. Short description
        if "short_description" not in data or not data["short_description"]:
            data["short_description"] = f"A vibrant cosmic recipe for {title}."

        # 3. Category coercion
        cat = str(data.get("category", "")).strip()
        cat_lower = cat.lower()
        if cat in _VALID_CATEGORIES:
            data["category"] = cat
        elif cat_lower in _CATEGORY_ALIASES:
            data["category"] = _CATEGORY_ALIASES[cat_lower]
        else:
            data["category"] = "Dinner"

        # 4. Cuisine
        if "cuisine" not in data or not data["cuisine"]:
            data["cuisine"] = "Cosmic Fusion"

        # 5. Difficulty coercion
        diff = str(data.get("difficulty", "")).strip().lower()
        data["difficulty"] = _DIFFICULTY_ALIASES.get(diff, "beginner")

        # 6. Yields & total_time coercion
        data["yields"] = max(1.0, _coerce_numeric(data.get("yields", 2.0), 2.0))
        data["total_time"] = max(5.0, _coerce_numeric(data.get("total_time", 30.0), 30.0))

        # 7. Alignment notes
        notes = data.get("alignment_notes")
        if notes is None:
            data["alignment_notes"] = ["Harmonized with cosmic energy."]
        elif isinstance(notes, str):
            data["alignment_notes"] = [s.strip() for s in notes.split("\n") if s.strip()]

        # 8. Ingredients & steps fallback
        ings = data.get("ingredients")
        if not ings or not isinstance(ings, list):
            data["ingredients"] = [
                {"name": "Olive Oil", "quantity": "1", "unit": "tbsp", "optional": False}
            ]

        steps = data.get("steps")
        if not steps or not isinstance(steps, list):
            data["steps"] = [
                {
                    "step_number": 1,
                    "instruction": "Prepare fresh ingredients and cook with intention.",
                    "time_minutes": data["total_time"],
                    "cooking_method": "combine",
                    "tips": ["Cook with mindfulness."],
                }
            ]

        # 9. Finishing, leftovers, astro sub-objects
        if "finishing_and_serving" not in data or not isinstance(data["finishing_and_serving"], dict):
            data["finishing_and_serving"] = {
                "garnish_and_plating": "Plate artfully and serve warm.",
                "doneness_cues": "Aromatic and cooked through.",
                "serving_suggestions": "Enjoy fresh.",
            }
        if "leftovers_and_storage" not in data or not isinstance(data["leftovers_and_storage"], dict):
            data["leftovers_and_storage"] = {
                "can_store": True,
                "storage_instructions": "Store in an airtight container in the refrigerator.",
                "storage_lifespan_days": 3.0,
            }
        if "astro_explanation" not in data or not isinstance(data["astro_explanation"], dict):
            data["astro_explanation"] = {
                "summary": "Attuned to planetary alignments.",
                "correspondences": ["Vitality", "Harmony"],
            }

        return data

# --- Tilt Skillet / Recipe-as-a-Circuit batch planner ---
# Mirrors WTEN's tiltSkilletBatchSchema (src/types/tiltSkilletSchema.ts). WTEN computes the
# deterministic circuit grounding (circuitContext) and proxies here; this owns the LLM step.

class TiltSkilletStageIngredientInput(BaseModel):
    name: str
    amount: float
    unit: str

class TiltSkilletStageInput(BaseModel):
    name: Optional[str] = None
    ingredients: List[TiltSkilletStageIngredientInput] = Field(default_factory=list)

class TiltSkilletRequest(BaseModel):
    prompt: str = Field(
        default="A large-batch braise for the week ahead.",
        min_length=1,
        max_length=2000,
    )
    batchServings: Optional[int] = Field(default=12, ge=1, le=500)
    cuisine: Optional[str] = Field(default=None, max_length=120)
    dietPreference: Optional[str] = Field(default="omnivore", max_length=120)
    dietary: List[str] = Field(default_factory=list, max_length=20)
    disallowedIngredients: List[str] = Field(default_factory=list, max_length=40)
    stages: List[TiltSkilletStageInput] = Field(default_factory=list, max_length=12)
    # Precomputed recipe-as-a-circuit grounding from WTEN's computeBatchCircuit (per-stage + series).
    circuitContext: Optional[Dict[str, Any]] = None
    userId: Optional[str] = None
    tier: Optional[str] = None
    modelTier: Optional[str] = None

    model_config = ConfigDict(extra="ignore")

class TiltSkilletStageIngredient(BaseModel):
    ingredient: str
    quantity: str
    unit: str

class TiltSkilletStage(BaseModel):
    step_number: int = Field(ge=1)
    name: str
    instruction: str
    add_to_skillet: List[TiltSkilletStageIngredient] = Field(default_factory=list)
    skillet_position: str
    tilt_angle_degrees: float = Field(ge=0, le=45)
    temperature_f: float = Field(ge=0)
    time_minutes: float = Field(ge=0)
    technique: str
    circuit_role: Literal["source", "resistor", "capacitor", "load"]
    reaction_note: str
    sensory_cues: List[str]

class TiltSkilletCircuitSummary(BaseModel):
    total_voltage: float
    total_current: float
    total_resistance: float
    total_power: float
    efficiency: float
    kalchm: float
    monica: float
    narrative: str

class TiltSkilletPlanResponse(BaseModel):
    id: str
    title: str
    summary: str
    cuisine: str
    batch_yield: str
    total_time: float = Field(gt=0)
    equipment_notes: str
    stages: List[TiltSkilletStage] = Field(min_length=1)
    elementalBalance: ElementalBalance
    circuit_summary: TiltSkilletCircuitSummary
    alignment_notes: List[str]
    finishing_and_serving: FinishingAndServing
    leftovers_and_storage: LeftoversAndStorage

    model_config = ConfigDict(extra="ignore")

class HealthResponse(BaseModel):
    status: str
    service: str
    database: str

class BulkPositionsRequest(BaseModel):
    startDate: datetime
    endDate: datetime
    intervalHours: float = 1.0
    latitude: float = 0.0
    longitude: float = 0.0

class BulkPositionsResponse(BaseModel):
    samples: List[Dict[str, Any]]
    count: int
    degraded: bool = False

class PhilosophersStonePositionsRequest(BaseModel):
    year: Optional[int] = None
    month: Optional[int] = None
    day: Optional[int] = None
    hour: Optional[int] = None
    minute: Optional[int] = None
    customPlanets: Optional[Dict[str, Any]] = None

class PhilosophersStonePositionsResponse(BaseModel):
    elementalProperties: Dict[str, float]
    thermodynamicProperties: Dict[str, float]
    esms: Dict[str, float]
    planetaryMomentum: Dict[str, float]
    kalchm: float
    monica: float
    score: float
    normalized: bool
    confidence: float
    metadata: Dict[str, Any]
    perPlanet: Optional[Dict[str, Any]] = None

class AgentSyncPayload(BaseModel):
    agentId: str
    displayName: str
    email: Optional[str] = None
    title: Optional[str] = None
    avatar: Optional[str] = None
    color: Optional[str] = None
    symbol: Optional[str] = None

class AgentSyncResponse(BaseModel):
    success: bool
    agentId: str
    action: str

class DeleteChatHistoryRequest(BaseModel):
    userId: Optional[str] = None

class DeleteChatHistoryResponse(BaseModel):
    success: bool
    purgedCount: int
    userId: Optional[str] = None
    message: str
