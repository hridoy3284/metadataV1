// Create a promise for each Image + Model combination
                const reqPromise = fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                .then(async res => {
                    // API থেকে আসা আসল এরর মেসেজ রিড করা হচ্ছে
                    if (!res.ok) {
                        const errData = await res.json();
                        throw new Error(errData.detail || "Unknown API Error");
                    }
                    return res.json();
                })
                .then(data => {
                    updateResultCard(img.id, m.modelId, data);
                    globalResults.push({
                        filename: img.filename,
                        model: m.modelId,
                        title: data.title,
                        keywords: data.keywords,
                        description: data.description
                    });
                })
                .catch(err => {
                    updateResultCardError(img.id, m.modelId, err.message);
                });

                promises.push(reqPromise);
