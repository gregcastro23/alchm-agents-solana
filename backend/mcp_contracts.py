"""Typed, transport-independent contracts for the nine Planetary Agents tools.

The adapter removes transport metadata before calling this module. Validation
never resolves credentials, contacts a service, or includes input values in its
errors. Successful validation preserves the original JSON payload, including
optional upstream fields and the exact menu used for publication idempotency.
"""

from __future__ import annotations

import copy
import json
import math
from datetime import datetime
from typing import Annotated, Any, Dict, List, Literal, Optional, Tuple, Union

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    JsonValue,
    StrictBool,
    StrictInt,
    StringConstraints,
    TypeAdapter,
    ValidationError,
    field_validator,
    model_validator,
)


class ContractValidationError(ValueError):
    """A safe contract failure whose message never contains submitted values."""


def _not_blank(value: str) -> str:
    if not value.strip():
        raise ValueError("must not be blank")
    return value


Name = Annotated[str, StringConstraints(strict=True, min_length=1, max_length=200), AfterValidator(_not_blank)]
ShortText = Annotated[str, StringConstraints(strict=True, max_length=2000)]
ErrorText = Annotated[str, StringConstraints(strict=True, min_length=1, max_length=2000), AfterValidator(_not_blank)]
ChatText = Annotated[str, StringConstraints(strict=True, min_length=1, max_length=20000), AfterValidator(_not_blank)]
Session = Annotated[str, StringConstraints(strict=True, min_length=1, max_length=512), AfterValidator(_not_blank)]
ModelTier = Literal["free", "cheap_fast", "primary", "reflective"]
Planet = Literal["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]
JingMove = Literal["Meltdown", "Freeze", "TectonicRoot", "Vacuum", "Erode"]
MealType = Literal["breakfast", "lunch", "dinner", "snack"]
JsonObject = Dict[str, JsonValue]
PositiveNumber = Annotated[float, Field(strict=True, gt=0, le=1000)]


class RequestModel(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")


class ResultModel(BaseModel):
    # HTTP services may add receipt, provenance, or provider fields. The JSON
    # guard below bounds those extensions without silently discarding them.
    model_config = ConfigDict(strict=True, extra="allow")


class ChatRequest(RequestModel):
    agentName: Name
    message: Annotated[str, StringConstraints(strict=True, min_length=1, max_length=12000), AfterValidator(_not_blank)]
    conversationHistory: Optional[Annotated[List[ChatText], Field(max_length=24)]] = None
    sessionId: Optional[Session] = None
    modelTier: Optional[ModelTier] = None
    context: Optional[JsonObject] = None


class ListAgentsRequest(RequestModel):
    query: Optional[Annotated[str, StringConstraints(strict=True, max_length=200)]] = None
    limit: Optional[Annotated[StrictInt, Field(ge=1, le=100)]] = None
    sign: Optional[Name] = None
    archetype: Optional[Name] = None


class FeedDiscussionRequest(RequestModel):
    threadId: Name


class CulinaryDebateRequest(RequestModel):
    ingredients: Annotated[List[Name], Field(min_length=1, max_length=64)]
    agents: Optional[Annotated[List[Name], Field(min_length=1, max_length=6)]] = None
    modelTier: Optional[ModelTier] = None


class ChartDuelRequest(RequestModel):
    casterName: Name
    targetName: Name
    modelTier: Optional[ModelTier] = None


class WordDuelRequest(RequestModel):
    agentName: Optional[Name] = None
    rack: Annotated[str, StringConstraints(strict=True, min_length=1, max_length=64), AfterValidator(_not_blank)]
    candidates: Annotated[List[Annotated[str, StringConstraints(strict=True, min_length=1, max_length=64), AfterValidator(_not_blank)]], Field(min_length=1, max_length=256)]
    context: Optional[JsonObject] = None
    sessionId: Optional[Session] = None


class JingArenaRequest(RequestModel):
    planet: Planet
    opening: JingMove
    agentName: Optional[Name] = None


class MenuPlanRequest(RequestModel):
    agentName: Name
    weekStartDate: Optional[Annotated[str, StringConstraints(strict=True, min_length=1, max_length=64)]] = None
    status: Literal["draft"] = "draft"
    shareToFeed: Literal[False] = False

    @field_validator("shareToFeed", mode="before")
    @classmethod
    def actual_boolean(cls, value: Any) -> Any:
        # Literal[False] otherwise accepts integer zero in Pydantic.
        if type(value) is not bool:
            raise ValueError("must be a boolean")
        return value

    @field_validator("weekStartDate")
    @classmethod
    def iso_date(cls, value: Optional[str]) -> Optional[str]:
        if value is not None:
            _iso_datetime(value)
        return value


def _iso_datetime(value: str) -> str:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("must be an ISO timestamp") from exc
    if parsed.tzinfo is None:
        raise ValueError("timestamp must include a timezone")
    return value


class MenuRecipe(ResultModel):
    id: Name
    name: Annotated[str, StringConstraints(strict=True, min_length=1, max_length=500), AfterValidator(_not_blank)]
    cuisine: Optional[Name] = None
    ingredients: Optional[Annotated[List[ShortText], Field(max_length=200)]] = None
    nutrition: Optional[JsonObject] = None
    elementalProperties: Optional[JsonObject] = None


class MenuMeal(ResultModel):
    id: Name
    dayOfWeek: Annotated[StrictInt, Field(ge=0, le=6)]
    mealType: MealType
    servings: PositiveNumber
    recipe: Optional[MenuRecipe] = None
    planetarySnapshot: Optional[JsonObject] = None
    notes: Optional[ShortText] = None


class WeeklyMenu(ResultModel):
    id: Optional[Name] = None
    agentSlug: Name
    agentDisplayName: Name
    weekStartDate: Annotated[str, StringConstraints(strict=True, min_length=1, max_length=64), AfterValidator(_iso_datetime)]
    status: Literal["draft", "completed"]
    shareToFeed: StrictBool
    title: Annotated[str, StringConstraints(strict=True, min_length=1, max_length=500), AfterValidator(_not_blank)]
    summary: Annotated[str, StringConstraints(strict=True, max_length=5000)]
    meals: Annotated[List[MenuMeal], Field(min_length=28, max_length=28)]

    @model_validator(mode="after")
    def unique_slots(self) -> "WeeklyMenu":
        if len({(meal.dayOfWeek, meal.mealType) for meal in self.meals}) != 28:
            raise ValueError("must include each day and meal type exactly once")
        return self


class MenuPublishRequest(RequestModel):
    menu: WeeklyMenu
    idempotencyKey: Annotated[str, StringConstraints(strict=True, min_length=1, max_length=200, pattern=r"^[!-~]+$")]


class ChatResult(ResultModel):
    agentName: Name
    agentId: Name
    text: ChatText
    sessionId: Optional[Session] = None
    metadata: Optional[JsonObject] = None
    liveSkyState: Optional[JsonObject] = None


class AgentSummary(ResultModel):
    agentId: Name
    name: Name
    title: Optional[ShortText] = None
    historicalEra: Optional[ShortText] = None
    culture: Optional[ShortText] = None
    consciousnessLevel: Optional[Name] = None
    dominantElement: Optional[Name] = None


class AgentFilters(ResultModel):
    query: Optional[ShortText] = None
    limit: Annotated[StrictInt, Field(ge=1, le=100)]
    sign: Optional[Name] = None
    archetype: Optional[Name] = None


class ListAgentsResult(ResultModel):
    success: Literal[True]
    count: Annotated[StrictInt, Field(ge=0, le=100)]
    agents: Annotated[List[AgentSummary], Field(max_length=100)]
    filters: AgentFilters

    @model_validator(mode="after")
    def matching_count(self) -> "ListAgentsResult":
        if self.count != len(self.agents):
            raise ValueError("count must match agents")
        return self


class FeedFoundResult(ResultModel):
    threadId: Name
    found: Literal[True]
    event: JsonObject
    thread: Annotated[List[JsonValue], Field(max_length=1000)]


class FeedMissingResult(ResultModel):
    threadId: Name
    found: Literal[False]
    availableEventIds: Annotated[List[Optional[Name]], Field(max_length=20)]


class DialogueError(ResultModel):
    agentName: Name
    agentId: Name
    error: ErrorText


class CulinaryDebateResult(ResultModel):
    ingredients: Annotated[List[Name], Field(min_length=1, max_length=64)]
    agents: Annotated[List[Name], Field(min_length=1, max_length=6)]
    alchemicalScan: JsonObject
    recipeCandidates: JsonObject
    liveSkyState: Optional[JsonObject]
    triggeredJing: Optional[JsonObject]
    dataErrors: Annotated[List[ErrorText], Field(max_length=20)]
    dialogue: Annotated[List[Union[ChatResult, DialogueError]], Field(min_length=1, max_length=6)]

    @model_validator(mode="after")
    def matching_dialogue(self) -> "CulinaryDebateResult":
        if len(self.agents) != len(self.dialogue):
            raise ValueError("dialogue must match requested agents")
        return self


class ChartAspect(ResultModel):
    type: Name
    planetA: Name
    planetB: Name
    orb: Annotated[float, Field(strict=True, ge=0, le=6)]
    harmonic: Name


class TriggeredChartDuelResult(ResultModel):
    triggered: Literal[True]
    caster: Name
    casterId: Name
    target: Name
    targetId: Name
    moveId: Name
    moveName: JingMove
    element: Name
    aspect: ChartAspect
    description: ShortText
    scores: JsonObject
    casterVoice: ChatText
    targetVoice: ChatText


class UntriggeredChartDuelResult(ResultModel):
    triggered: Literal[False]
    reason: ErrorText


class WordMove(ResultModel):
    word: Annotated[str, StringConstraints(strict=True, max_length=64)]
    rationale: Annotated[str, StringConstraints(strict=True, min_length=1, max_length=5000), AfterValidator(_not_blank)]
    score: Annotated[float, Field(strict=True, ge=0)]
    source: Optional[Literal["model", "fallback", "yield"]] = None
    provider: Optional[Name] = None
    model: Optional[Name] = None
    latencyMs: Optional[Annotated[StrictInt, Field(ge=0)]] = None


class WordDuelResult(ResultModel):
    success: Literal[True]
    agentKey: Name
    planet: Planet
    move: WordMove
    timestamp: Optional[Annotated[str, StringConstraints(strict=True, max_length=64)]] = None


class JingArenaResult(ResultModel):
    success: Literal[True]
    planet: Planet
    move: JingMove
    voice: ChatText
    element: Name
    source: Optional[Literal["counter"]] = None
    timestamp: Optional[Annotated[str, StringConstraints(strict=True, max_length=64)]] = None


class MenuPlanResult(ResultModel):
    success: Literal[True]
    message: ShortText
    menu: WeeklyMenu
    feedShared: Literal[False]

    @model_validator(mode="after")
    def draft_only(self) -> "MenuPlanResult":
        if self.menu.status != "draft" or self.menu.shareToFeed is not False:
            raise ValueError("planning must return an unpublished draft")
        return self


class SavedMenuReceipt(ResultModel):
    id: Name


class MenuPublishResult(ResultModel):
    success: Literal[True]
    menu: SavedMenuReceipt
    feedShared: Optional[StrictBool] = None
    agentEmail: Optional[Annotated[str, StringConstraints(strict=True, max_length=320)]] = None
    userId: Optional[Name] = None
    feedMetadata: Optional[JsonObject] = None


class ErrorResult(ResultModel):
    error: ErrorText
    message: Optional[ErrorText] = None
    code: Optional[Name] = None
    backendUrl: Optional[Annotated[str, StringConstraints(strict=True, max_length=2048)]] = None
    frontendUrl: Optional[Annotated[str, StringConstraints(strict=True, max_length=2048)]] = None
    liveSkyState: Optional[JsonObject] = None


_REQUESTS = {
    "chat_with_planetary_agent": ChatRequest,
    "list_planetary_agents": ListAgentsRequest,
    "get_agent_feed_discussion": FeedDiscussionRequest,
    "synthesize_culinary_debate": CulinaryDebateRequest,
    "trigger_chart_specific_jing_duel": ChartDuelRequest,
    "play_agent_word_duel": WordDuelRequest,
    "play_jing_arena_move": JingArenaRequest,
    "plan_weekly_menu": MenuPlanRequest,
    "publish_weekly_menu": MenuPublishRequest,
}
_RESULTS = {
    "chat_with_planetary_agent": TypeAdapter(ChatResult),
    "list_planetary_agents": TypeAdapter(ListAgentsResult),
    "get_agent_feed_discussion": TypeAdapter(Union[FeedFoundResult, FeedMissingResult]),
    "synthesize_culinary_debate": TypeAdapter(CulinaryDebateResult),
    "trigger_chart_specific_jing_duel": TypeAdapter(Union[TriggeredChartDuelResult, UntriggeredChartDuelResult]),
    "play_agent_word_duel": TypeAdapter(WordDuelResult),
    "play_jing_arena_move": TypeAdapter(JingArenaResult),
    "plan_weekly_menu": TypeAdapter(MenuPlanResult),
    "publish_weekly_menu": TypeAdapter(MenuPublishResult),
}
TOOL_NAMES = frozenset(_REQUESTS)


def _check_json(value: Any, *, result: bool) -> None:
    """Bound flexible contexts and extension fields as well as typed fields."""
    node_count = 0

    def visit(item: Any, depth: int) -> None:
        nonlocal node_count
        node_count += 1
        if depth > 20 or node_count > 50000:
            raise ContractValidationError("JSON payload exceeds complexity limits")
        if item is None or type(item) in (bool, int):
            return
        if type(item) is float:
            if not math.isfinite(item):
                raise ContractValidationError("JSON numbers must be finite")
        elif type(item) is str:
            if len(item) > 20000:
                raise ContractValidationError("JSON string exceeds 20000 characters")
        elif type(item) is list:
            if len(item) > 1000:
                raise ContractValidationError("JSON array exceeds 1000 items")
            for child in item:
                visit(child, depth + 1)
        elif type(item) is dict:
            if len(item) > 200:
                raise ContractValidationError("JSON object exceeds 200 properties")
            for key, child in item.items():
                if type(key) is not str or not 1 <= len(key) <= 200:
                    raise ContractValidationError("JSON object keys must contain 1–200 characters")
                visit(child, depth + 1)
        else:
            raise ContractValidationError("Payload must contain only JSON values")

    if type(value) is not dict:
        raise ContractValidationError("Tool payload must be an object")
    visit(value, 0)
    maximum = 1048576 if result else 131072
    if len(json.dumps(value, ensure_ascii=True, allow_nan=False).encode("utf-8")) > maximum:
        raise ContractValidationError("Tool payload exceeds its encoded size limit")


def _safe_validation_error(exc: ValidationError) -> ContractValidationError:
    # Pydantic's default exception includes rejected values, which can contain
    # private prompts or API keys accidentally placed in the wrong field.
    issues = []
    for issue in exc.errors(include_input=False, include_context=False, include_url=False)[:8]:
        location = ".".join(str(part) for part in issue["loc"]) or "payload"
        # Never echo arbitrary unknown keys as a field location.
        if issue["type"] == "extra_forbidden":
            location = "payload"
        issues.append(f"{location}: {issue['type']}")
    return ContractValidationError("Invalid tool payload (" + "; ".join(issues) + ")")


def _known_tool(name: str) -> None:
    if name not in _REQUESTS:
        raise ContractValidationError("Unknown tool")


def validate_arguments(name: str, arguments: Any) -> Dict[str, Any]:
    """Validate and normalize supported legacy persona aliases, without I/O."""
    _known_tool(name)
    _check_json(arguments, result=False)
    normalized = copy.deepcopy(arguments)
    if name in {"play_agent_word_duel", "play_jing_arena_move"}:
        aliases = ["agentId", "planet"] if name == "play_agent_word_duel" else ["agentId"]
        for alias in aliases:
            if alias in normalized:
                if "agentName" not in normalized:
                    normalized["agentName"] = normalized[alias]
                normalized.pop(alias)
    if name == "play_jing_arena_move" and isinstance(normalized.get("planet"), str):
        normalized["planet"] = normalized["planet"].strip().title()
    try:
        _REQUESTS[name].model_validate(normalized)
    except ValidationError as exc:
        raise _safe_validation_error(exc) from None
    return normalized


def validate_result(name: str, payload: Any, is_error: bool = False) -> Dict[str, Any]:
    """Validate a business payload and preserve its exact JSON representation."""
    _known_tool(name)
    _check_json(payload, result=True)
    # Literal booleans otherwise consider 0/1 equal to False/True. Every status
    # discriminator must be an actual JSON boolean before union validation.
    for field in ("success", "found", "triggered", "feedShared"):
        if field in payload and type(payload[field]) is not bool:
            raise ContractValidationError(f"Invalid tool payload ({field}: bool_type)")
    try:
        if is_error:
            ErrorResult.model_validate(payload)
        else:
            if "error" in payload:
                raise ContractValidationError("A successful tool result cannot contain an error")
            _RESULTS[name].validate_python(payload)
    except ValidationError as exc:
        raise _safe_validation_error(exc) from None
    return copy.deepcopy(payload)


def tool_schemas(name: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Return discovery schemas; errors are accepted only with MCP isError."""
    _known_tool(name)
    request = _REQUESTS[name].model_json_schema()
    result = _RESULTS[name].json_schema()
    # A union generates anyOf without a root type. MCP outputSchema requires
    # an object root; all accepted success alternatives are object models.
    result["type"] = "object"
    return copy.deepcopy(request), copy.deepcopy(result)
