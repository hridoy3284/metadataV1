from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import httpx
import json

app = FastAPI(title="AI Image SEO Generator")

# Allow Frontend CORS (for dev environments, though serving static files mitigates this)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Schema
class GenerateRequest(BaseModel):
    image_base64: str
    provider: str
    model: str
    api_key: str
    custom_prompt: str
    platform: str
    transparent: bool
    isolated: bool

# System prompt optimized for microstock photography
SYSTEM_PROMPT = """
You are an expert SEO metadata generator for stock photography contributors.
Analyze the provided image and generate metadata optimized for search algorithms.
Return ONLY a raw JSON object with the following structure:
{
    "title": "A clear, descriptive title (max 150 characters)",
    "keywords": "A comma-separated list of 30-50 highly relevant keywords, ordered by importance",
    "description": "A detailed description of the image"
}
Ensure the output is strict JSON. Do not include markdown formatting like ```json.
"""

async def call_openai_vision(req: GenerateRequest) -> dict:
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {req.api_key}",
        "Content-Type": "application/json"
    }
    
    # Platform-specific prompt injection
    platform_rules = f"Optimize strictly for {req.platform} algorithms. "
    if req.transparent: platform_rules += "Note: The image has a transparent background. "
    if req.isolated: platform_rules += "Note: The subject is isolated on white. "
    
    user_prompt = platform_rules + req.custom_prompt

    payload = {
        "model": req.model,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": [
                {"type": "text", "text": user_prompt},
                {"type": "image_url", "image_url": {"url": req.image_base64}}
            ]}
        ],
        "max_tokens": 500
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload, timeout=60.0)
        
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)
        
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)

async def call_groq_vision(req: GenerateRequest) -> dict:
    # Groq uses the exact same Chat Completions API format as OpenAI
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {req.api_key}",
        "Content-Type": "application/json"
    }
    
    user_prompt = f"Optimize for {req.platform}. {req.custom_prompt}. You MUST return output in JSON format."
    
    payload = {
        "model": req.model,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": [
                {"type": "text", "text": user_prompt},
                {"type": "image_url", "image_url": {"url": req.image_base64}}
            ]}
        ],
        "max_tokens": 500
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload, timeout=60.0)
        
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)
        
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)

@app.post("/api/generate")
async def generate_metadata(req: GenerateRequest):
    try:
        if req.provider == "OpenAI":
            result = await call_openai_vision(req)
        elif req.provider == "Groq":
            result = await call_groq_vision(req)
        elif req.provider == "Gemini":
             # Placeholder for Google Gemini API integration
            raise HTTPException(status_code=501, detail="Gemini integration coming soon.")
        else:
            raise HTTPException(status_code=400, detail="Invalid Provider")
            
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Mount static files to serve the frontend
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def serve_index():
    return FileResponse("static/index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
