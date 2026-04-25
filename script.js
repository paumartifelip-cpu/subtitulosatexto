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

    let currentFile = null;
    let parsedText = '';

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
