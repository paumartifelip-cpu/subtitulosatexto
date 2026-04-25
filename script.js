document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const removeFileBtn = document.getElementById('removeFileBtn');
    const uploadContent = document.querySelector('.upload-content');
    
    const keepTimestampsToggle = document.getElementById('keepTimestampsToggle');
    const convertBtn = document.getElementById('convertBtn');
    
    const outputText = document.getElementById('outputText');
    const copyBtn = document.getElementById('copyBtn');
    const downloadBtn = document.getElementById('downloadBtn');

    // AI Elements
    const aiAnalyzeBtn = document.getElementById('aiAnalyzeBtn');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const aiOutputContainer = document.getElementById('aiOutputContainer');
    const aiOutputText = document.getElementById('aiOutputText');

    let currentFile = null;
    let parsedText = '';

    // Load API Key from local storage if exists
    const savedApiKey = localStorage.getItem('openai_api_key');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
    }

    // Event Listeners for File Selection
    browseBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // Drag and Drop Events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('drag-active');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('drag-active');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    removeFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetFile();
    });

    // Convert Action
    convertBtn.addEventListener('click', async () => {
        if (!currentFile) return;

        // Button Loading State
        const originalText = convertBtn.innerHTML;
        convertBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Transformando...';
        convertBtn.disabled = true;

        try {
            const text = await currentFile.text();
            parsedText = convertVttToTxt(text, keepTimestampsToggle.checked);
            
            outputText.value = parsedText;
            
            // Enable Actions
            copyBtn.disabled = false;
            downloadBtn.disabled = false;
            aiAnalyzeBtn.disabled = false;
            
            // Highlight text area momentarily
            outputText.style.borderColor = 'var(--success)';
            setTimeout(() => {
                outputText.style.borderColor = 'var(--border-color)';
            }, 1000);

        } catch (error) {
            console.error('Error al leer el archivo:', error);
            alert('Hubo un error al procesar el archivo. Por favor, intenta de nuevo.');
        } finally {
            convertBtn.innerHTML = originalText;
            convertBtn.disabled = false;
        }
    });

    // Copy Action
    copyBtn.addEventListener('click', () => {
        if (!parsedText) return;
        
        navigator.clipboard.writeText(parsedText).then(() => {
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado!';
            copyBtn.style.color = 'var(--success)';
            copyBtn.style.borderColor = 'var(--success)';
            
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.style.color = '';
                copyBtn.style.borderColor = '';
            }, 2000);
        });
    });

    // Download Action
    downloadBtn.addEventListener('click', () => {
        if (!parsedText) return;

        const blob = new Blob([parsedText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        // Use original file name but change extension
        const baseName = currentFile.name.replace(/\.[^/.]+$/, "");
        a.href = url;
        a.download = `${baseName}_limpio.txt`;
        
        document.body.appendChild(a);
        a.click();
        
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Listen to toggle changes to re-convert if there is text
    keepTimestampsToggle.addEventListener('change', () => {
        if (currentFile && outputText.value) {
            convertBtn.click();
        }
    });

    // AI Analysis Action
    aiAnalyzeBtn.addEventListener('click', async () => {
        if (!parsedText) return;
        
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            alert('Por favor, introduce tu API Key de OpenAI.');
            return;
        }
        
        // Save to local storage for future use
        localStorage.setItem('openai_api_key', apiKey);

        // Si no hay tiempos, advertimos
        if (!keepTimestampsToggle.checked) {
            const proceed = confirm('Recomendamos activar "Conservar tiempos" antes de analizar, para que la IA sepa en qué minuto está cada frase. ¿Deseas continuar de todas formas?');
            if (!proceed) return;
        }

        aiOutputContainer.style.display = 'block';
        aiOutputText.value = 'Pensando y analizando el texto para extraer los mejores clips... Esto puede tardar unos segundos dependiendo del tamaño del archivo. \n\nPor favor, espera...';
        
        const originalTextBtn = aiAnalyzeBtn.innerHTML;
        aiAnalyzeBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Analizando...';
        aiAnalyzeBtn.disabled = true;

        try {
            const prompt = `Eres un experto creador de contenido y editor de video viral.
Tu tarea es leer la siguiente transcripción de un video (que incluye marcas de tiempo) y seleccionar los mejores fragmentos (de 30 a 60 segundos aproximadamente) que podrían funcionar de maravilla como clips cortos para TikTok, Reels o YouTube Shorts.

Por cada clip que identifiques, proporciona:
1. **Título Atractivo:** Un título gancho para el clip.
2. **Minuto de inicio - Minuto de fin:** Extraídos de las marcas de tiempo.
3. **Resumen/Por qué funciona:** Una breve explicación de qué se trata y por qué es interesante.
4. **Transcripción del clip:** El texto exacto de esa parte.

Aquí tienes la transcripción:
\n\n${parsedText}`;

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini", // Using gpt-4o-mini for speed and cost efficiency
                    messages: [
                        { role: "system", content: "Eres un asistente experto en creación de contenido viral." },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'Error en la llamada a la API');
            }

            const data = await response.json();
            aiOutputText.value = data.choices[0].message.content;
            
        } catch (error) {
            console.error('Error con OpenAI:', error);
            aiOutputText.value = 'Hubo un error al comunicarse con la Inteligencia Artificial:\n' + error.message;
        } finally {
            aiAnalyzeBtn.innerHTML = originalTextBtn;
            aiAnalyzeBtn.disabled = false;
        }
    });

    // Helper Functions
    function handleFile(file) {
        if (!file.name.endsWith('.vtt')) {
            alert('Por favor, selecciona un archivo .vtt válido.');
            return;
        }

        currentFile = file;
        fileName.textContent = file.name;
        
        uploadContent.classList.add('hidden');
        fileInfo.classList.remove('hidden');
        convertBtn.disabled = false;
        
        // Auto convert
        convertBtn.click();
    }

    function resetFile() {
        currentFile = null;
        parsedText = '';
        fileInput.value = '';
        outputText.value = '';
        
        uploadContent.classList.remove('hidden');
        fileInfo.classList.add('hidden');
        
        convertBtn.disabled = true;
        copyBtn.disabled = true;
        downloadBtn.disabled = true;
        aiAnalyzeBtn.disabled = true;
        aiOutputContainer.style.display = 'none';
        aiOutputText.value = '';
    }

    function convertVttToTxt(vttString, keepTimestamps) {
        const lines = vttString.split(/\r?\n/);
        let result = [];
        let isMetadata = true;
        let currentTimestamp = '';
        let currentText = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Skip the WEBVTT header and any metadata block
            if (isMetadata) {
                if (line === '') {
                    isMetadata = false; // end of header block
                }
                continue;
            }

            if (line === '') {
                // End of a cue block
                if (currentText.length > 0) {
                    let textJoined = currentText.join(' ');
                    if (keepTimestamps && currentTimestamp) {
                        result.push(`[${currentTimestamp}]\n${textJoined}\n`);
                    } else {
                        result.push(`${textJoined}\n`);
                    }
                    currentText = [];
                    currentTimestamp = '';
                }
                continue;
            }

            // Check for timestamp
            if (line.includes('-->')) {
                // Simplify timestamp (e.g., 00:00:01.000 --> 00:00:04.000)
                currentTimestamp = line.replace(/-->/g, '-').replace(/\s+/g, ' ').trim();
                continue;
            }

            // Check if it's a cue identifier (next line has -->)
            if (i + 1 < lines.length && lines[i + 1].includes('-->')) {
                continue;
            }

            // It's text, strip VTT tags
            let cleanText = line.replace(/<[^>]+>/g, '');
            cleanText = cleanText.replace(/\s+/g, ' ').trim();
            
            if (cleanText) {
                currentText.push(cleanText);
            }
        }

        // Handle last block if file doesn't end with newline
        if (currentText.length > 0) {
            let textJoined = currentText.join(' ');
            if (keepTimestamps && currentTimestamp) {
                result.push(`[${currentTimestamp}]\n${textJoined}\n`);
            } else {
                result.push(`${textJoined}\n`);
            }
        }

        return result.join('\n');
    }
});
