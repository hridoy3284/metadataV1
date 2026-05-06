document.addEventListener('DOMContentLoaded', () => {
    
    // API Keys Inputs
    const keyOpenAI = document.getElementById('keyOpenAI');
    const keyGroq = document.getElementById('keyGroq');
    const saveKeysBtn = document.getElementById('saveKeysBtn');

    // Upload Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const thumbnailContainer = document.getElementById('thumbnailContainer');
    const clearBtn = document.getElementById('clearBtn');
    
    // Actions & Results
    const generateBatchBtn = document.getElementById('generateBatchBtn');
    const btnText = document.getElementById('btnText');
    const resultsHeader = document.getElementById('resultsHeader');
    const resultsContainer = document.getElementById('resultsContainer');
    const downloadCsvBtn = document.getElementById('downloadCsvBtn');

    // Settings
    const platform = document.getElementById('platform');
    const customPrompt = document.getElementById('customPrompt');
    const checkTransparent = document.getElementById('checkTransparent');
    const checkIsolated = document.getElementById('checkIsolated');

    let uploadedImages = []; // Stores { id, file, base64, filename }
    let globalResults = [];  // Stores generated data for CSV export

    // 1. Initial Setup: Load API Keys
    function init() {
        keyOpenAI.value = localStorage.getItem('key_OpenAI') || '';
        keyGroq.value = localStorage.getItem('key_Groq') || '';
    }

    saveKeysBtn.addEventListener('click', () => {
        localStorage.setItem('key_OpenAI', keyOpenAI.value.trim());
        localStorage.setItem('key_Groq', keyGroq.value.trim());
        alert("API Keys saved locally!");
    });

    // 2. Drag, Drop & File Selection
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-active'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-active'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    function handleFiles(files) {
        Array.from(files).forEach(file => {
            if (!file.type.match('image.*')) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const imgId = 'img_' + Math.random().toString(36).substr(2, 9);
                uploadedImages.push({
                    id: imgId,
                    filename: file.name,
                    base64: e.target.result
                });
                renderThumbnails();
            };
            reader.readAsDataURL(file);
        });
    }

    function renderThumbnails() {
        if (uploadedImages.length === 0) {
            thumbnailContainer.classList.add('hidden');
            return;
        }
        thumbnailContainer.classList.remove('hidden');
        thumbnailContainer.innerHTML = uploadedImages.map(img => `
            <div class="relative w-20 h-20 bg-gray-800 rounded-md border border-gray-700 overflow-hidden group">
                <img src="${img.base64}" class="w-full h-full object-cover">
                <button onclick="removeImage('${img.id}')" class="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs hidden group-hover:block">&times;</button>
            </div>
        `).join('');
    }

    window.removeImage = (id) => {
        uploadedImages = uploadedImages.filter(img => img.id !== id);
        renderThumbnails();
    };

    clearBtn.addEventListener('click', () => {
        uploadedImages = [];
        globalResults = [];
        renderThumbnails();
        resultsContainer.innerHTML = '';
        resultsHeader.classList.add('hidden');
    });

    // 3. Batch API Calling Logic
    generateBatchBtn.addEventListener('click', async () => {
        if (uploadedImages.length === 0) return alert("Please upload at least one image.");
        
        // Get selected models
        const selectedCheckboxes = document.querySelectorAll('.model-cb:checked');
        if (selectedCheckboxes.length === 0) return alert("Please select at least one AI Model.");

        const activeModels = Array.from(selectedCheckboxes).map(cb => {
            const [provider, modelId] = cb.value.split('|');
            return { provider, modelId };
        });

        // Validate API Keys based on selection
        for (let m of activeModels) {
            if (m.provider === 'OpenAI' && !keyOpenAI.value.trim()) return alert("Missing OpenAI API Key.");
            if (m.provider === 'Groq' && !keyGroq.value.trim()) return alert("Missing Groq API Key.");
        }

        // Prepare UI for generation
        generateBatchBtn.disabled = true;
        btnText.textContent = "Processing... Please wait";
        resultsHeader.classList.remove('hidden');
        resultsContainer.innerHTML = '';
        globalResults = [];

        // Build UI structure first
        uploadedImages.forEach(img => {
            let modelCardsHTML = activeModels.map(m => `
                <div id="result-${img.id}-${m.modelId}" class="bg-gray-800 p-4 rounded-lg border border-gray-700 relative">
                    <h4 class="text-sm font-bold text-indigo-400 mb-2 uppercase">${m.provider}: ${m.modelId.replace('llama-', 'Llama ')}</h4>
                    <div class="status-loader flex items-center gap-2 text-sm text-gray-400 my-4">
                        <div class="loader"></div> Generating metadata...
                    </div>
                    <div class="result-data hidden space-y-3">
                        <input type="text" class="res-title w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white" readonly placeholder="Title">
                        <textarea class="res-keywords w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white h-24 resize-none" readonly placeholder="Keywords"></textarea>
                        <textarea class="res-desc w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white h-16 resize-none" readonly placeholder="Description"></textarea>
                    </div>
                </div>
            `).join('');

            const row = document.createElement('div');
            row.className = 'bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row gap-6';
            row.innerHTML = `
                <div class="w-full md:w-1/4 lg:w-48 flex-shrink-0 flex flex-col items-center gap-2">
                    <img src="${img.base64}" class="w-full rounded-lg border border-gray-700 object-contain max-h-48 bg-black">
                    <p class="text-xs text-gray-400 truncate w-full text-center">${img.filename}</p>
                </div>
                <div class="flex-1 grid grid-cols-1 lg:grid-cols-${activeModels.length > 1 ? '2' : '1'} gap-4">
                    ${modelCardsHTML}
                </div>
            `;
            resultsContainer.appendChild(row);
        });

        // Fire all API requests concurrently
        const promises = [];

        for (const img of uploadedImages) {
            for (const m of activeModels) {
                const apiKey = m.provider === 'OpenAI' ? keyOpenAI.value.trim() : keyGroq.value.trim();
                
                const payload = {
                    image_base64: img.base64,
                    provider: m.provider,
                    model: m.modelId,
                    api_key: apiKey,
                    custom_prompt: customPrompt.value.trim(),
                    platform: platform.value,
                    transparent: checkTransparent.checked,
                    isolated: checkIsolated.checked
                };

                // Create a promise for each Image + Model combination
                const reqPromise = fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                .then(res => {
                    if (!res.ok) throw new Error("API Error");
                    return res.json();
                })
                .then(data => {
                    updateResultCard(img.id, m.modelId, data);
                    // Save to global results for CSV
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
            }
        }

        // Wait for ALL requests to finish
        await Promise.allSettled(promises);
        
        generateBatchBtn.disabled = false;
        btnText.textContent = "✨ Run Selected Models";
    });

    // Helper functions to update UI
    function updateResultCard(imgId, modelId, data) {
        const card = document.getElementById(`result-${imgId}-${modelId}`);
        if (!card) return;
        
        card.querySelector('.status-loader').classList.add('hidden');
        card.querySelector('.result-data').classList.remove('hidden');
        
        card.querySelector('.res-title').value = data.title || '';
        card.querySelector('.res-keywords').value = data.keywords || '';
        card.querySelector('.res-desc').value = data.description || '';
    }

    function updateResultCardError(imgId, modelId, errorMsg) {
        const card = document.getElementById(`result-${imgId}-${modelId}`);
        if (!card) return;
        
        card.querySelector('.status-loader').innerHTML = `<span class="text-red-500 text-xs">❌ Error: ${errorMsg}</span>`;
    }

    // 4. Batch CSV Export
    downloadCsvBtn.addEventListener('click', () => {
        if (globalResults.length === 0) return alert("No metadata generated yet.");
        
        const escapeCSV = (str) => `"${(str || '').replace(/"/g, '""')}"`;
        
        let csvContent = `Filename,AI Model,Title,Keywords,Description\n`;
        globalResults.forEach(res => {
            csvContent += `${escapeCSV(res.filename)},${escapeCSV(res.model)},${escapeCSV(res.title)},${escapeCSV(res.keywords)},${escapeCSV(res.description)}\n`;
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "batch_metadata_results.csv";
        link.click();
    });

    init();
});
