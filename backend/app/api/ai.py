"""
FastAPI endpoints for SENTINEL's optional local AI investigator.

The AI layer is deliberately separate from SENTINEL's core detection,
correlation, and deterministic investigation pipeline.

If Ollama is unavailable, core security functionality remains
operational.
"""

from datetime import (
    datetime,
    timezone,
)

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from sqlalchemy.orm import Session

from app.database.dependencies import (
    get_db,
)

from app.schemas.ai_investigation import (
    AIInvestigationResponse,
    AIServiceStatus,
)

from app.schemas.ai_chat import (
    AIIncidentChatRequest,
    AIIncidentChatResponse,
)

from app.services.ai_evidence import (
    AIEvidenceBuilder,
    GroundTruthLeakageError,
)

from app.services.ai_prompt_builder import (
    AIPromptBuilder,
)

from app.services.ollama_service import (
    OllamaDisabledError,
    OllamaInvalidResponseError,
    OllamaModelUnavailableError,
    OllamaService,
    OllamaTimeoutError,
    OllamaUnavailableError,
)

from app.services.ai_chat_service import (
    AIChatService,
)


# ============================================================
# Router
# ============================================================

router = APIRouter(
    prefix="/ai",
    tags=[
        "Local AI Investigation",
    ],
)


# ============================================================
# Service status
# ============================================================

@router.get(
    "/status",
    response_model=AIServiceStatus,
)
def get_ai_status() -> AIServiceStatus:
    """
    Report whether SENTINEL's optional local Ollama provider is
    enabled, reachable, and has the configured model available.
    """

    service = OllamaService()

    return service.get_status()


# ============================================================
# AI-assisted incident investigation
# ============================================================

@router.post(
    "/incidents/{incident_id}/investigation",
    response_model=AIInvestigationResponse,
)
def generate_ai_investigation(
    incident_id: str,

    db: Session = Depends(
        get_db
    ),
) -> AIInvestigationResponse:
    """
    Generate an evidence-grounded local AI investigation.

    The language model receives only operational evidence already
    produced by SENTINEL's detection, correlation, and deterministic
    investigation pipeline.

    Simulator ground-truth fields are explicitly excluded.
    """

    # --------------------------------------------------------
    # Build trusted operational evidence
    # --------------------------------------------------------

    try:
        evidence = (
            AIEvidenceBuilder(
                db
            )
            .build_dict(
                incident_id
            )
        )

    except LookupError as exc:
        raise HTTPException(
            status_code=404,
            detail=(
                "Incident was not found."
            ),
        ) from exc

    except GroundTruthLeakageError as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "AI evidence safety validation failed."
            ),
        ) from exc

    except RuntimeError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(
                exc
            ),
        ) from exc


    # --------------------------------------------------------
    # Build grounded prompt
    # --------------------------------------------------------

    prompt = (
        AIPromptBuilder()
        .build(
            evidence
        )
    )


    # --------------------------------------------------------
    # Generate locally through Ollama
    # --------------------------------------------------------

    service = OllamaService()

    try:
        result = (
            service
            .generate_investigation(
                prompt
            )
        )

    except OllamaDisabledError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Local AI investigation is disabled."
            ),
        ) from exc

    except OllamaModelUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(
                exc
            ),
        ) from exc

    except OllamaUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Local AI provider is unavailable."
            ),
        ) from exc

    except OllamaTimeoutError as exc:
        raise HTTPException(
            status_code=504,
            detail=str(
                exc
            ),
        ) from exc

    except OllamaInvalidResponseError as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Local AI returned an invalid "
                "structured response."
            ),
        ) from exc


    # --------------------------------------------------------
    # Validated public response
    # --------------------------------------------------------

    return AIInvestigationResponse(
        incident_id=(
            incident_id
        ),

        model=(
            result.model
        ),

        generated_at=(
            datetime.now(
                timezone.utc
            )
        ),

        generation_duration_ms=(
            result.generation_duration_ms
        ),

        grounded_on_deterministic_evidence=True,

        content=(
            result.content
        ),
    )


# ============================================================
# Incident-scoped AI analyst chat
# ============================================================

@router.post(
    "/incidents/{incident_id}/chat",
    response_model=AIIncidentChatResponse,
)
def chat_with_incident_ai(
    incident_id: str,

    request: AIIncidentChatRequest,

    db: Session = Depends(
        get_db
    ),
) -> AIIncidentChatResponse:
    """
    Ask a grounded follow-up question about one selected incident.

    The chat assistant is intentionally incident-scoped.

    It may:
    - answer questions supported by incident evidence,
    - reject incoherent questions,
    - reject unrelated questions,
    - state when incident evidence is insufficient.

    It does not receive simulator ground truth or evaluation-only
    metadata.
    """

    service = AIChatService(
        db
    )

    try:
        return service.chat(
            incident_id=incident_id,
            request=request,
        )

    # --------------------------------------------------------
    # Incident / evidence errors
    # --------------------------------------------------------

    except LookupError as exc:
        raise HTTPException(
            status_code=404,
            detail=(
                "Incident was not found."
            ),
        ) from exc

    except GroundTruthLeakageError as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "AI evidence safety validation failed."
            ),
        ) from exc

    # --------------------------------------------------------
    # Local AI provider errors
    #
    # IMPORTANT:
    # OllamaServiceError subclasses RuntimeError.
    # Specific provider exceptions must therefore be handled
    # before the generic RuntimeError branch below.
    # --------------------------------------------------------

    except OllamaDisabledError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Local AI chat is disabled."
            ),
        ) from exc

    except OllamaModelUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(
                exc
            ),
        ) from exc

    except OllamaUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Local AI provider is unavailable."
            ),
        ) from exc

    except OllamaTimeoutError as exc:
        raise HTTPException(
            status_code=504,
            detail=str(
                exc
            ),
        ) from exc

    except OllamaInvalidResponseError as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Local AI returned an invalid "
                "chat response."
            ),
        ) from exc

    # --------------------------------------------------------
    # Remaining incident/evidence runtime errors
    # --------------------------------------------------------

    except RuntimeError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(
                exc
            ),
        ) from exc

    # --------------------------------------------------------
    # Local AI provider errors
    # --------------------------------------------------------

    except OllamaDisabledError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Local AI chat is disabled."
            ),
        ) from exc

    except OllamaModelUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(
                exc
            ),
        ) from exc

    except OllamaUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Local AI provider is unavailable."
            ),
        ) from exc

    except OllamaTimeoutError as exc:
        raise HTTPException(
            status_code=504,
            detail=str(
                exc
            ),
        ) from exc

    except OllamaInvalidResponseError as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Local AI returned an invalid "
                "chat response."
            ),
        ) from exc