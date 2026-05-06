document.addEventListener('DOMContentLoaded', () => {
    
    // UI Elements
    const providerSelect = document.getElementById('provider');
    const modelSelect = document.getElementById('model');
    const apiKeyInput = document.getElementById('apiKey');
    const saveKeyBtn = document.getElementById('saveKeyBtn');
    
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const imagePreview = document.getElementById('imagePreview');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    
    const platformSelect = document.getElementById('platform');
    const customPromptInput = document.getElementById('customPrompt');
    const checkTransparent = document.getElementById('checkTransparent');
    const checkIsolated = document.getElementById('checkIsolated');
    
    const generateBtn = document.getElementById('generateBtn');
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');
    
    const resTitle = document.getElementById('resTitle');
    const resKeywords = document.getElementById('resKeywords');
    const resDescription = document.getElementById('resDescription');
    const keywordCount = document.getElementById('keywordCount');
    
    const copyAllBtn = document.getElementById('copyAllBtn');
    const downloadCsvBtn = document.getElementById('downloadCsvBtn');

    let currentBase64Image = null;

    // Model configuration map
    const models = {
        'OpenAI': [
            { id: 'gpt-4o', name: 'GPT-4o (Best)' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo Vision' }
        ],
        'Groq': [
            { id: 'llama-3.2-11b-vision-preview', name: 'LLaMA 3.2 11B Vision' },
            { id: 'llama-3.2-90b-vision-preview', name: 'LLaMA 3.2 90B Vision' }
        ],
        'Gemini': [
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' }
        ]
    };

    // 1. Initial Setup & Local Storage
    function init() {
        // Load API Keys
        const savedKey = localStorage.getItem(`apikey_${providerSelect.value}`);
        if (savedKey) apiKeyInput.value = savedKey;

        updateModels();
    }

    function updateModels() {
        const provider = providerSelect.value;
        modelSelect.innerHTML = '';
        models[provider].forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            modelSelect.appendChild(option);
        });
        
        // Update input field with provider's key
        apiKeyInput.value = localStorage.getItem(`apikey_${provider}`) || '';
    }

    providerSelect.addEventListener('change', updateModels);

    saveKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        const provider = providerSelect.value;
        if (key) {
            localStorage.setItem(`apikey_${provider}`, key);
            showToast('API Key saved securely to local storage.');
        } else {
            localStorage.removeItem(`apikey_${provider}`);
            showToast('API Key removed.');
        }
    });

    // 2. Image Drag & Drop and Preview
    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-active');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-active');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });

    function handleFile(file) {
        if (!file.type.match('image.*')) {
            alert("Please upload a JPG or PNG image.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            currentBase64Image = e.target.result; // This includes 'data:image/jpeg;base64,...'
            imagePreview.src = currentBase64Image;
            imagePreview.classList.remove('hidden');
            uploadPlaceholder.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }

    // 3. API Call Logic
    generateBtn.addEventListener('click', async () => {
        if (!currentBase64Image) return alert("Please upload an image first.");
        
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) return alert("Please enter your API Key.");

        const payload = {
            image_base64: currentBase64Image,
            provider: providerSelect.value,
            model: modelSelect.value,
            api_key: apiKey,
            custom_prompt: customPromptInput.value.trim(),
            platform: platformSelect.value,
            transparent: checkTransparent.checked,
            isolated: checkIsolated.checked
        };

        // Loading State
        btnText.textContent = "Analyzing Image...";
        btnLoader.classList.remove('hidden');
        generateBtn.disabled = true;
        
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'API Error');
            }

            const data = await response.json();
            
            // Update UI
            resTitle.value = data.title || "";
            resKeywords.value = data.keywords || "";
            resDescription.value = data.description || "";
            
            // Count Keywords
            const count = data.keywords ? data.keywords.split(',').length : 0;
            keywordCount.textContent = `${count} words`;

        } catch (error) {
            alert(`Error generating metadata: ${error.message}`);
        } finally {
            btnText.textContent = "✨ Generate SEO Metadata";
            btnLoader.classList.add('hidden');
            generateBtn.disabled = false;
        }
    });

    // 4. Export Functions
    copyAllBtn.addEventListener('click', () => {
        if (!resTitle.value) return;
        const textToCopy = `Title:\n${resTitle.value}\n\nKeywords:\n${resKeywords.value}\n\nDescription:\n${resDescription.value}`;
        navigator.clipboard.writeText(textToCopy)
            .then(() => showToast('Metadata copied to clipboard!'))
            .catch(err => alert('Failed to copy text'));
    });

    downloadCsvBtn.addEventListener('click', () => {
        if (!resTitle.value || !resKeywords.value) return alert("No metadata to export.");
        
        // Escape quotes for CSV
        const escapeCSV = (str) => `"${str.replace(/"/g, '""')}"`;
        
        const filename = fileInput.files[0] ? fileInput.files[0].name : 'image.jpg';
        const csvContent = `Filename,Title,Keywords,Description\n${escapeCSV(filename)},${escapeCSV(resTitle.value)},${escapeCSV(resKeywords.value)},${escapeCSV(resDescription.value)}`;
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "stock_metadata.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Utility: Simple Toast Notification
    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 bg-gray-800 border border-gray-700 text-white px-4 py-2 rounded shadow-lg toast-anim z-50 text-sm';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    init();
});
