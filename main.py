async def call_groq_vision(req: GenerateRequest) -> dict:
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {req.api_key}",
        "Content-Type": "application/json"
    }
    
    user_prompt = f"Optimize for {req.platform}. {req.custom_prompt}. You MUST return ONLY a valid JSON object. No extra text."
    
    payload = {
        "model": req.model,
        # Groq এর কিছু বিটা মডেলে response_format দিলে এরর আসে, তাই এটি রিমুভ করা হলো
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": [
                {"type": "text", "text": user_prompt},
                {"type": "image_url", "image_url": {"url": req.image_base64}}
            ]}
        ],
        "max_tokens": 800,
        "temperature": 0.2
    }

    async with httpx.AsyncClient() as client:
        # Timeout বাড়ানো হয়েছে যেন বড় ছবি প্রসেস হতে সময় পায়
        response = await client.post(url, headers=headers, json=payload, timeout=90.0)
        
    if response.status_code != 200:
        # আসল এরর মেসেজটি বের করে ফ্রন্টএন্ডে পাঠানো হচ্ছে
        error_msg = response.text
        try:
            err_json = response.json()
            error_msg = err_json.get("error", {}).get("message", response.text)
        except:
            pass
        raise HTTPException(status_code=response.status_code, detail=f"Groq Error: {error_msg}")
        
    try:
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        
        # মডেল যদি ভুল করে ```json ... ``` ফরম্যাটে টেক্সট দেয়, তা ক্লিন করা হচ্ছে
        content = content.replace("```json", "").replace("```", "").strip()
        return json.loads(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"JSON Parse Error: {str(e)}")

@app.post("/api/generate")
async def generate_metadata(req: GenerateRequest):
    try:
        if req.provider == "OpenAI":
            result = await call_openai_vision(req)
        elif req.provider == "Groq":
            result = await call_groq_vision(req)
        else:
            raise HTTPException(status_code=400, detail="Invalid Provider")
            
        return result
    except HTTPException as he:
        raise he # HTTP এররগুলো সরাসরি পাস করা হবে
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
