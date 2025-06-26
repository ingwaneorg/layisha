class LayishaUploader {
    constructor() {
        this.apiKey = this.getApiKeyFromUrl();
        this.backendUrl = 'http://192.168.1.227:8080'; // Update with your backend URL
        this.initializeElements();
        this.setupEventListeners();
        this.checkApiKey();
    }
    
    getApiKeyFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const key = urlParams.get('key');
        if (key) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        return key;
    }
    
    initializeElements() {
        this.uploadZone = document.getElementById('uploadZone');
        this.fileInput = document.getElementById('fileInput');
        this.resultSection = document.getElementById('resultSection');
        this.resultUrl = document.getElementById('resultUrl');
        this.markdownUrl = document.getElementById('markdownUrl');
        this.copyBtn = document.getElementById('copyBtn');
        this.copyMarkdownBtn = document.getElementById('copyMarkdownBtn');
        this.alertContainer = document.getElementById('alertContainer');
        this.apiKeyWarning = document.getElementById('apiKeyWarning');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressBar = document.querySelector('.progress-bar');
        this.imagePreview = document.getElementById('imagePreview');
    }
    
    checkApiKey() {
        if (!this.apiKey) {
            this.apiKeyWarning.classList.remove('d-none');
            this.uploadZone.style.opacity = '0.5';
            this.uploadZone.style.pointerEvents = 'none';
        } else {
            this.apiKeyWarning.classList.add('d-none');
        }
    }
    
    setupEventListeners() {
        // Drag and drop
        this.uploadZone.addEventListener('dragover', this.handleDragOver.bind(this));
        this.uploadZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.uploadZone.addEventListener('drop', this.handleDrop.bind(this));
        
        // Click to browse
        this.uploadZone.addEventListener('click', () => this.fileInput.click());
        document.getElementById('browseFiles').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Prevents the event from bubbling up to upload zone
            this.fileInput.click();
        });
        
        // File input change
        this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        
        // Paste from clipboard
        document.addEventListener('paste', this.handlePaste.bind(this));
        
        // Copy buttons
        this.copyBtn.addEventListener('click', () => this.copyToClipboard(this.resultUrl.value));
        this.copyMarkdownBtn.addEventListener('click', () => this.copyToClipboard(this.markdownUrl.value));
        
    }
    
    handleDragOver(e) {
        e.preventDefault();
        this.uploadZone.classList.add('dragover');
    }
    
    handleDragLeave(e) {
        e.preventDefault();
        this.uploadZone.classList.remove('dragover');
    }
    
    handleDrop(e) {
        e.preventDefault();
        this.uploadZone.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.uploadFile(files[0]);
        }
    }
    
    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.uploadFile(files[0]);
        }
    }
    
    handlePaste(e) {
        const items = e.clipboardData.items;
        for (let item of items) {
            if (item.type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = item.getAsFile();
                this.uploadFile(file);
                break;
            }
        }
    }

    
    // TEMPORARY: Mock upload for testing
    /*
    async uploadFile(file) {
        if (!this.apiKey) {
            this.showAlert('danger', 'API key required. Please use the bookmarked URL.');
            return;
        }

        if (!file.type.startsWith('image/')) {
            this.showAlert('danger', 'Please select an image file.');
            return;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB
            this.showAlert('danger', 'File size must be less than 10MB.');
            return;
        }

        // Simulate upload delay
        this.showUploadProgress(true);
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Simulate successful upload
        const mockUrl = `https://storage.googleapis.com/ingwane-layisha/octopus.png`;
        //const mockUrl = `https://storage.googleapis.com/ingwane-layisha/test-${Date.now()}.png`;
        this.showUploadResult(mockUrl);
        this.showUploadProgress(false);
    }
    */

    // Production settings
    async uploadFile(file) {
        if (!this.apiKey) {
            this.showAlert('danger', 'API key required. Please use the bookmarked URL.');
            return;
        }
        
        if (!file.type.startsWith('image/')) {
            this.showAlert('danger', 'Please select an image file.');
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) { // 10MB
            this.showAlert('danger', 'File size must be less than 10MB.');
            return;
        }
        
        try {
            this.showUploadProgress(true);
            
            const formData = new FormData();
            formData.append('image', file);
            
            const response = await fetch(`${this.backendUrl}/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }
            
            const result = await response.json();
            this.showUploadResult(result.url);
            
        } catch (error) {
            console.error('Upload error:', error);
            this.showAlert('danger', `Upload failed: ${error.message}`);
        } finally {
            this.showUploadProgress(false);
        }
    }

    showUploadProgress(show) {
        if (show) {
            this.progressContainer.classList.remove('d-none');
            this.progressBar.style.width = '100%';
        } else {
            this.progressContainer.classList.add('d-none');
            this.progressBar.style.width = '0%';
        }
    }
    
    showUploadResult(url) {
        // Set URLs
        this.resultUrl.value = url;
        this.markdownUrl.value = `![Image](${url})`;
        
        // Show preview
        this.imagePreview.innerHTML = `<img src="${url}" alt="Uploaded image" class="img-thumbnail mt-3" style="max-width: 300px;">`;
        
        // Show result section
        this.resultSection.style.display = 'block';
        this.resultSection.scrollIntoView({ behavior: 'smooth' });
        
        this.showAlert('success', 'Image uploaded successfully!');
    }
    
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showAlert('info', 'Copied to clipboard!');
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showAlert('info', 'Copied to clipboard!');
        }
    }
    
    resetUploader() {
        this.resultSection.style.display = 'none';
        this.fileInput.value = '';
        this.alertContainer.innerHTML = '';
        this.uploadZone.scrollIntoView({ behavior: 'smooth' });
    }
    
    showAlert(type, message) {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show`;
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        this.alertContainer.innerHTML = '';
        this.alertContainer.appendChild(alert);
        
        // Auto-hide success and info alerts
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                alert.classList.remove('show');
                setTimeout(() => alert.remove(), 150);
            }, 3000);
        }
    }
}

// Initialize the uploader when page loads
document.addEventListener('DOMContentLoaded', () => {
    new LayishaUploader();
});
