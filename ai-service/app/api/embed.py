from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from app.schemas.embed import (
    ClassifyResponse,
    EmbedInfoResponse,
    EmbedResponse,
    TextEmbedRequest,
)

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}


async def read_image_or_400(file: UploadFile) -> bytes:
    """Kiểm tra content-type/kích thước rồi đọc hết file ảnh."""
    if not file.content_type or file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type: {file.content_type}. "
            f"Allowed: {', '.join(sorted(ALLOWED_CONTENT_TYPES))}",
        )

    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large: {len(image_bytes)} bytes. Max: {MAX_FILE_SIZE}",
        )
    return image_bytes


def parse_json_field(value: str, field_name: str) -> list[str]:
    """Parse field multipart dạng JSON array ('["dog","car"]')."""
    import json

    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} không phải JSON hợp lệ: {exc}",
        ) from exc
    if not isinstance(parsed, list) or any(not isinstance(x, str) or not x for x in parsed):
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} phải là JSON array các chuỗi không rỗng.",
        )
    return parsed


@router.post("/embed/image", response_model=EmbedResponse)
async def embed_image(request: Request, file: UploadFile = File(...)):
    """Mã hoá 1 ảnh thành vector embedding (CLIP image encoder)."""
    image_bytes = await read_image_or_400(file)

    provider = request.app.state.embed_provider
    embedding = provider.encode_image(image_bytes)

    return EmbedResponse(
        provider=provider.name,
        model=provider.model,
        dimension=provider.dimension,
        embedding=embedding,
    )


@router.post("/embed/text", response_model=EmbedResponse)
async def embed_text(request: Request, payload: TextEmbedRequest):
    """Mã hoá câu truy vấn text thành vector embedding (CLIP text encoder)."""
    provider = request.app.state.embed_provider
    embedding = provider.encode_text(payload.text)

    return EmbedResponse(
        provider=provider.name,
        model=provider.model,
        dimension=provider.dimension,
        embedding=embedding,
    )


@router.post("/classify", response_model=ClassifyResponse)
async def classify_image(
    request: Request,
    file: UploadFile = File(...),
    labels: str = Form(..., description='JSON array nhãn, vd ["dog","car","cat"]'),
    templates: str = Form(
        '["a photo of a {}"]',
        description="JSON array prompt templates CLIP (chứa {} cho nhãn).",
    ),
):
    """Zero-shot classify — demo giống CLIP paper.

    Gửi 1 ảnh + danh sách nhãn → trả xác suất softmax từng nhãn
    (so cosine image/text rồi scale bằng logit_scale của model).
    """
    image_bytes = await read_image_or_400(file)
    label_list = parse_json_field(labels, "labels")
    template_list = parse_json_field(templates, "templates")
    if len(label_list) < 2:
        raise HTTPException(
            status_code=400,
            detail="labels phải có ít nhất 2 nhãn (softmax cần ≥2 lớp).",
        )

    provider = request.app.state.embed_provider
    predictions = provider.classify(image_bytes, label_list, template_list)

    return ClassifyResponse(
        provider=provider.name,
        model=provider.model,
        dimension=provider.dimension,
        templates=template_list,
        predictions=predictions,
    )


@router.get("/embed/info", response_model=EmbedInfoResponse)
async def embed_info(request: Request):
    """Thông tin provider embedding đang dùng (provider/model/dimension)."""
    provider = request.app.state.embed_provider
    return EmbedInfoResponse(
        provider=provider.name,
        model=provider.model,
        dimension=provider.dimension,
    )
