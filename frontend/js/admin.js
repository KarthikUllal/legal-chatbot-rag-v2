// Admin Dashboard JavaScript

const BACKEND_URL = "http://localhost:8003"; // Make sure this matches your backend port

// DOM Elements
const totalDocuments = document.getElementById("totalDocuments");
const totalChunks = document.getElementById("totalChunks");
const systemStatus = document.getElementById("systemStatus");
const embeddingModel = document.getElementById("embeddingModel");
const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("fileInput");
const uploadProgress = document.getElementById("uploadProgress");
const documentsList = document.getElementById("documentsList");
const refreshDocuments = document.getElementById("refreshDocuments");
const refreshStats = document.getElementById("refreshStats");
const testBackend = document.getElementById("testBackend");
const clearAllData = document.getElementById("clearAllData");
const uploadSample = document.getElementById("uploadSample");
const systemLogs = document.getElementById("systemLogs");
const logoutBtn = document.getElementById("logoutBtn");
const backendUrlSpan = document.getElementById("backendUrl");

if (backendUrlSpan) {
    backendUrlSpan.textContent = BACKEND_URL;
}

// Check authentication
if (sessionStorage.getItem("adminAuthenticated") !== "true") {
    window.location.href = "admin-login.html";
}

// Initialize
document.addEventListener("DOMContentLoaded", function() {
    loadSystemStats();
    loadDocumentsList();
    setupEventListeners();
    addLog("✅ Admin dashboard initialized");
    addLog(`🔗 Connected to backend: ${BACKEND_URL}`);
});

function setupEventListeners() {
    // Upload functionality
    uploadArea.addEventListener("click", () => fileInput.click());
    uploadArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadArea.classList.add("dragover");
    });
    uploadArea.addEventListener("dragleave", () => {
        uploadArea.classList.remove("dragover");
    });
    uploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadArea.classList.remove("dragover");
        handleFileUpload(e.dataTransfer.files);
    });
    fileInput.addEventListener("change", (e) =>
        handleFileUpload(e.target.files)
    );

    // Control buttons
    refreshStats.addEventListener("click", loadSystemStats);
    refreshDocuments.addEventListener("click", loadDocumentsList);
    testBackend.addEventListener("click", testBackendConnection);
    
    if (clearAllData) {
        clearAllData.addEventListener("click", clearAllDocuments);
    }
    
    if (uploadSample) {
        uploadSample.addEventListener("click", uploadSampleDocuments);
    }
    
    logoutBtn.addEventListener("click", logout);
}

async function loadSystemStats() {
    addLog('📊 Loading system stats...');

    try {
        // Show loading state
        totalDocuments.textContent = '...';
        totalChunks.textContent = '...';
        systemStatus.textContent = 'Loading...';

        // Test health endpoint
        const healthResponse = await fetch(`${BACKEND_URL}/health`);
        if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            systemStatus.textContent = healthData.status || 'Active';
            systemStatus.className = 'text-xl font-bold text-green-600 mt-2';
            addLog('✅ Backend health check passed', 'success');
        } else {
            throw new Error('Health check failed');
        }

        // Get stats from admin/documents endpoint
        const docsResponse = await fetch(`${BACKEND_URL}/admin/documents`);
        if (docsResponse.ok) {
            const docsData = await docsResponse.json();
            if (docsData.status === 'success') {
                totalDocuments.textContent = docsData.total_documents || 0;
                totalChunks.textContent = docsData.total_chunks || 0;
            }
        }

        // Set embedding model
        embeddingModel.textContent = 'all-MiniLM-L6-v2';

        addLog('✅ System stats loaded successfully', 'success');

    } catch (error) {
        console.error('Error loading stats:', error);
        systemStatus.textContent = 'Offline';
        systemStatus.className = 'text-xl font-bold text-red-600 mt-2';
        totalDocuments.textContent = '0';
        totalChunks.textContent = '0';
        addLog(`❌ Error loading stats: ${error.message}`, 'error');
    }
}

async function loadDocumentsList() {
    addLog('📄 Loading documents list...');

    try {
        const response = await fetch(`${BACKEND_URL}/admin/documents`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        
        if (data.status === 'success' && data.documents && data.documents.length > 0) {
            renderDocumentsList(data.documents);
            addLog(`✅ Loaded ${data.documents.length} documents`, 'success');
        } else {
            // No documents found
            documentsList.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-folder-open text-4xl mb-3 text-gray-400"></i>
                    <p class="font-medium">No documents in vector store</p>
                    <p class="text-sm mt-2">Upload a PDF document to get started</p>
                    <button onclick="document.getElementById('fileInput').click()" 
                        class="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm">
                        <i class="fas fa-upload mr-2"></i>Upload Now
                    </button>
                </div>
            `;
            addLog('ℹ️ No documents found in vector store', 'info');
        }

    } catch (error) {
        console.error('Error loading documents:', error);
        addLog(`❌ Error loading documents: ${error.message}`, 'error');
        
        documentsList.innerHTML = `
            <div class="text-center py-8 text-red-500">
                <i class="fas fa-exclamation-triangle text-4xl mb-3"></i>
                <p class="font-medium">Failed to load documents</p>
                <p class="text-sm mt-2">${error.message}</p>
                <button onclick="loadDocumentsList()" 
                    class="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm">
                    <i class="fas fa-sync-alt mr-2"></i>Retry
                </button>
            </div>
        `;
    }
}

// Update the renderDocumentsList function
function renderDocumentsList(documents) {
    if (!documents || documents.length === 0) {
        documentsList.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-folder-open text-4xl mb-3 text-gray-400"></i>
                <p class="font-medium">No documents in vector store</p>
                <p class="text-sm mt-2">Upload a PDF document to get started</p>
                <button onclick="document.getElementById('fileInput').click()" 
                    class="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm">
                    <i class="fas fa-upload mr-2"></i>Upload Now
                </button>
            </div>
        `;
        return;
    }

    let html = '';
    
    documents.forEach(doc => {
        const name = doc.name || 'Unknown Document';
        const chunks = doc.chunks || 0;
        const filename = doc.filename || 'unknown.pdf';
        const docId = doc.id;
        const uploadDate = doc.upload_date ? new Date(doc.upload_date).toLocaleDateString() : 'Unknown';
        
        // Get a sample preview from the first chunk
        const sample = doc.sample || 'No preview available';
        
        html += `
            <div class="document-card border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-all">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-file-pdf text-red-500"></i>
                        <h4 class="font-bold text-gray-800">${escapeHtml(name)}</h4>
                    </div>
                    <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">${chunks} chunks</span>
                </div>
                <p class="text-xs text-gray-500 mb-2">
                    <i class="fas fa-file mr-1"></i> ${escapeHtml(filename)}
                </p>
                <p class="text-xs text-gray-600 line-clamp-2 mb-3 bg-gray-50 p-2 rounded">
                    "${escapeHtml(sample)}"
                </p>
                <div class="flex justify-between items-center text-xs text-gray-400 mb-3">
                    <span><i class="fas fa-folder mr-1"></i>ID: ${escapeHtml(docId.substring(0, 8))}...</span>
                    <span><i class="fas fa-calendar mr-1"></i>${uploadDate}</span>
                </div>
                <div class="flex gap-2 mt-2">
                    <button class="delete-doc-btn text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded hover:bg-red-200 transition flex items-center gap-1" 
                        data-id="${docId}">
                        <i class="fas fa-trash"></i> Delete Document
                    </button>
                    <button class="view-doc-btn text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200 transition flex items-center gap-1" 
                        data-id="${docId}">
                        <i class="fas fa-eye"></i> Preview
                    </button>
                </div>
            </div>
        `;
    });

    documentsList.innerHTML = html;

    // Add event listeners
    document.querySelectorAll('.delete-doc-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteDocument(btn.dataset.id));
    });

    document.querySelectorAll('.view-doc-btn').forEach(btn => {
        btn.addEventListener('click', () => viewDocument(btn.dataset.id));
    });
}

// Add clear all function
async function clearAllDocuments() {
    if (!confirm("⚠️ Are you sure you want to clear ALL documents? This action cannot be undone.")) {
        return;
    }

    addLog('🗑️ Clearing all documents...');

    try {
        const response = await fetch(`${BACKEND_URL}/admin/clear-all`, {
            method: "DELETE",
        });

        const data = await response.json();

        if (response.ok) {
            addLog(`✅ ${data.message}`, 'success');
            showNotification('All documents cleared successfully', 'success');
            
            // Refresh lists
            loadDocumentsList();
            loadSystemStats();
        } else {
            throw new Error(data.detail || 'Failed to clear documents');
        }
    } catch (error) {
        addLog(`❌ Error clearing documents: ${error.message}`, 'error');
        showNotification('Failed to clear documents', 'error');
    }
}

async function deleteDocument(docId) {
    if (!confirm(`Are you sure you want to delete this document?`)) {
        return;
    }

    addLog(`🗑️ Deleting document: ${docId}`);

    try {
        const response = await fetch(`${BACKEND_URL}/admin/documents/${docId}`, {
            method: "DELETE",
        });

        const data = await response.json();

        if (response.ok && data.status === 'success') {
            addLog(`✅ Document deleted successfully`, 'success');
            showNotification('Document deleted successfully', 'success');
            // Refresh both lists
            loadDocumentsList();
            loadSystemStats();
        } else {
            throw new Error(data.message || 'Delete failed');
        }
    } catch (error) {
        addLog(`❌ Error deleting document: ${error.message}`, 'error');
        showNotification(`Delete failed: ${error.message}`, 'error');
    }
}

function viewDocument(docId) {
    addLog(`🔍 Viewing document: ${docId}`, 'info');
    showNotification('Document preview feature coming soon!', 'info');
}

async function handleFileUpload(files) {
    if (!files || files.length === 0) return;

    addLog(`📤 Starting upload of ${files.length} file(s)`);

    const filesToUpload = Array.from(files);

    for (const file of filesToUpload) {
        // Check file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            addLog(`⚠️ File too large: ${file.name} (max 10MB)`, "warning");
            showNotification(`File too large: ${file.name}`, 'error');
            continue;
        }

        if (!file.type.includes("pdf")) {
            addLog(`⚠️ Skipped non-PDF file: ${file.name}`, "warning");
            showNotification(`Only PDF files are supported: ${file.name}`, 'warning');
            continue;
        }

        await uploadSingleFile(file);
    }
}

async function uploadSingleFile(file) {
    const progressId = "upload-" + Date.now() + '-' + Math.random().toString(36).substr(2, 5);

    const progressHtml = `
        <div id="${progressId}" class="border border-gray-200 rounded-lg p-4 bg-white mb-3">
            <div class="flex items-center gap-3">
                <i class="fas fa-file-pdf text-red-500"></i>
                <div class="flex-1">
                    <p class="font-medium text-gray-800">${escapeHtml(file.name)}</p>
                    <p class="text-sm text-gray-500">Size: ${formatFileSize(file.size)} | Uploading...</p>
                    <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div class="bg-blue-600 h-2 rounded-full progress-bar" style="width: 0%"></div>
                    </div>
                </div>
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
    `;

    uploadProgress.insertAdjacentHTML("afterbegin", progressHtml);
    
    // Animate progress
    const progressElement = document.getElementById(progressId);
    const progressBar = progressElement.querySelector('.progress-bar');
    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        if (progress <= 90) {
            progressBar.style.width = progress + '%';
        }
    }, 200);

    try {
        const formData = new FormData();
        formData.append("file", file);

        addLog(`📤 Uploading: ${file.name}`, 'info');

        const response = await fetch(`${BACKEND_URL}/admin/upload`, {
            method: "POST",
            body: formData,
        });

        clearInterval(interval);
        progressBar.style.width = '100%';

        if (response.ok) {
            const result = await response.json();
            
            setTimeout(() => {
                progressElement.innerHTML = `
                    <div class="flex items-center gap-3">
                        <i class="fas fa-check-circle text-green-500 text-xl"></i>
                        <div class="flex-1">
                            <p class="font-medium text-gray-800">${escapeHtml(file.name)}</p>
                            <p class="text-sm text-green-600 font-medium">✓ Upload successful!</p>
                            <p class="text-xs text-gray-500">${result.message || 'Document indexed successfully'}</p>
                        </div>
                    </div>
                `;
            }, 500);

            addLog(`✅ Upload successful: ${file.name}`, "success");
            showNotification(`Uploaded: ${file.name}`, 'success');

            // Refresh stats and documents after a short delay
            setTimeout(() => {
                loadSystemStats();
                loadDocumentsList();
            }, 1500);

        } else {
            const errorText = await response.text();
            throw new Error(`Upload failed: ${response.status} - ${errorText}`);
        }

    } catch (error) {
        clearInterval(interval);
        console.error('Upload error:', error);
        
        progressElement.innerHTML = `
            <div class="flex items-center gap-3">
                <i class="fas fa-times-circle text-red-500 text-xl"></i>
                <div class="flex-1">
                    <p class="font-medium text-gray-800">${escapeHtml(file.name)}</p>
                    <p class="text-sm text-red-600 font-medium">✗ Upload failed</p>
                    <p class="text-xs text-gray-500">${error.message}</p>
                </div>
            </div>
        `;
        addLog(`❌ Upload failed: ${file.name} - ${error.message}`, "error");
        showNotification(`Upload failed: ${file.name}`, 'error');
    }
}

async function clearAllDocuments() {
    if (!confirm("⚠️ Are you sure you want to clear ALL documents? This action cannot be undone.")) {
        return;
    }

    addLog('🗑️ Clearing all documents...');

    try {
        // Get all documents first
        const response = await fetch(`${BACKEND_URL}/admin/documents`);
        const data = await response.json();
        
        if (data.status === 'success' && data.documents) {
            let deletedCount = 0;
            
            // Delete each document
            for (const doc of data.documents) {
                const docId = doc.id || doc.doc_id;
                if (docId) {
                    await fetch(`${BACKEND_URL}/admin/documents/${docId}`, {
                        method: "DELETE",
                    });
                    deletedCount++;
                }
            }
            
            addLog(`✅ Cleared ${deletedCount} documents`, 'success');
            showNotification(`Cleared ${deletedCount} documents`, 'success');
            
            // Refresh lists
            loadDocumentsList();
            loadSystemStats();
        }
    } catch (error) {
        addLog(`❌ Error clearing documents: ${error.message}`, 'error');
        showNotification('Failed to clear documents', 'error');
    }
}

async function uploadSampleDocuments() {
    addLog('📚 Uploading sample documents...', 'info');
    showNotification('Sample documents feature coming soon!', 'info');
}

async function testBackendConnection() {
    addLog('🔌 Testing backend connection...');

    try {
        const endpoints = [
            { url: `${BACKEND_URL}/health`, name: 'Health Check' },
            { url: `${BACKEND_URL}/admin/documents`, name: 'Documents API' },
            { url: `${BACKEND_URL}/admin/upload`, name: 'Upload API', method: 'OPTIONS' }
        ];

        let successCount = 0;

        for (const endpoint of endpoints) {
            try {
                const options = {
                    method: endpoint.method || 'GET',
                    headers: { 'Content-Type': 'application/json' }
                };
                const response = await fetch(endpoint.url, options);
                
                if (response.ok || response.status === 405) {
                    successCount++;
                    addLog(`✅ ${endpoint.name} - OK`, 'success');
                } else {
                    addLog(`❌ ${endpoint.name} - HTTP ${response.status}`, 'error');
                }
            } catch (error) {
                addLog(`❌ ${endpoint.name} - Connection failed`, 'error');
            }
        }

        if (successCount === endpoints.length) {
            addLog('✅ All backend endpoints are working correctly!', 'success');
            showNotification('Backend connection successful!', 'success');
        } else {
            addLog(`⚠️ Backend partially available (${successCount}/${endpoints.length} endpoints working)`, 'warning');
            showNotification('Backend partially available', 'warning');
        }

    } catch (error) {
        addLog(`❌ Backend connection test failed: ${error.message}`, 'error');
        showNotification('Cannot connect to backend!', 'error');
    }
}

function addLog(message, type = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const colors = {
        error: "text-red-600 border-red-200 bg-red-50",
        success: "text-green-600 border-green-200 bg-green-50",
        warning: "text-yellow-600 border-yellow-200 bg-yellow-50",
        info: "text-gray-600 border-gray-200 bg-gray-50"
    };
    const icons = {
        error: "❌",
        success: "✅",
        warning: "⚠️",
        info: "ℹ️"
    };

    const logEntry = document.createElement("div");
    logEntry.className = `text-xs ${colors[type]} mb-2 p-2 rounded border font-mono`;
    logEntry.innerHTML = `
        <span class="text-gray-400">[${timestamp}]</span> 
        <span class="mx-1">${icons[type]}</span>
        ${escapeHtml(message)}
    `;

    systemLogs.insertBefore(logEntry, systemLogs.firstChild);

    // Keep only last 100 logs
    while (systemLogs.children.length > 100) {
        systemLogs.removeChild(systemLogs.lastChild);
    }
}

function showNotification(message, type = 'success') {
    const colors = {
        success: 'bg-green-100 border-green-400 text-green-700',
        error: 'bg-red-100 border-red-400 text-red-700',
        warning: 'bg-yellow-100 border-yellow-400 text-yellow-700',
        info: 'bg-blue-100 border-blue-400 text-blue-700'
    };
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 ${colors[type]} px-6 py-3 rounded-lg shadow-lg z-50 border flex items-center gap-3 animate-slide-in`;
    notification.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span>${escapeHtml(message)}</span>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function logout() {
    addLog('👋 Logging out...', 'info');

    // Clear ALL authentication data
    localStorage.removeItem("adminAuthenticated");
    sessionStorage.removeItem("adminAuthenticated");
    localStorage.removeItem("authTimestamp");

    showNotification('Logged out successfully', 'success');

    // Force redirect to login page
    setTimeout(() => {
        window.location.href = "admin-login.html";
    }, 500);
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions globally available
window.deleteDocument = deleteDocument;
window.viewDocument = viewDocument;