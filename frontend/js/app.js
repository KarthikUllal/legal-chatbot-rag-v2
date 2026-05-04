//app.js
const BACKEND_URL = "http://localhost:8003";

let sessionId = localStorage.getItem("legal_chat_session_id");

if (!sessionId) {
    sessionId = "session_" + Date.now();
    localStorage.setItem("legal_chat_session_id", sessionId);
}

const chatBox = document.getElementById("chatBox");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

// Upload elements
const uploadBtn = document.getElementById("uploadBtn");
const fileUpload = document.getElementById("fileUpload");
const uploadStatus = document.getElementById("uploadStatus");

const clearChatBtn = document.getElementById("clearChat");
const newChatBtn = document.getElementById("newChatBtn");

const languageBtn = document.getElementById("languageBtn");
const languageDropdown = document.getElementById("languageDropdown");
const languageOptions = document.querySelectorAll(".language-option");
const currentLanguageSpan = document.getElementById("currentLanguage");

const maximizeBtn = document.getElementById("maximizeBtn");
const historyBtn = document.getElementById("historyBtn");
const downloadBtn = document.getElementById("download");
const downloadPdfBtn = document.getElementById("downloadPdf");

let currentLanguage = "en";
let isTranslating = false;
let chatMessages = []; // Store messages for transcript
let currentDocId = null; // ✅ FIX: Track uploaded doc for scoped queries

// ✅ FIX 10: Sync with backend supported_languages (removed ml, added mr + bn)
const languageNames = {
    'en': 'English',
    'hi': 'Hindi',
    'kn': 'Kannada',
    'ta': 'Tamil',
    'te': 'Telugu',
    'mr': 'Marathi',
    'bn': 'Bengali'
};

document.addEventListener("DOMContentLoaded", () => {
    // Chat functionality
    sendBtn.addEventListener("click", handleSend);
    userInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleSend();
    });

    // Upload functionality
    uploadBtn.addEventListener("click", () => fileUpload.click());
    fileUpload.addEventListener("change", uploadDocument);

    // Other functionality
    clearChatBtn.addEventListener("click", clearChat);
    newChatBtn.addEventListener("click", startNewChat);

    // Language dropdown
    languageBtn.addEventListener("click", toggleLanguageDropdown);
    languageOptions.forEach(btn => {
        btn.addEventListener("click", async () => {
            const newLang = btn.dataset.lang;
            currentLanguage = newLang;
            if (currentLanguageSpan) {
                currentLanguageSpan.textContent = newLang.toUpperCase();
            }
            languageDropdown.classList.add("hidden");

            showNotification(`Translating to ${languageNames[newLang] || newLang}...`, "info");

            // Translate all messages
            await translateAllMessages();

            showNotification(`Language changed to ${languageNames[newLang] || newLang}`, "success");
        });
    });

    maximizeBtn.addEventListener("click", toggleMaximizeChat);
    historyBtn.addEventListener("click", showHistory);
    downloadBtn.addEventListener("click", downloadChatTranscript);
    downloadPdfBtn.addEventListener("click", downloadChatTranscriptPDF);

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
        if (!languageBtn.contains(e.target) && !languageDropdown.contains(e.target)) {
            languageDropdown.classList.add("hidden");
        }
    });

    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const mobileMenu = document.getElementById("mobileMenu");

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener("click", () => {
            mobileMenu.classList.toggle("hidden");
        });
    }

    // Load news on page load
    loadNewsPreview();
});

// Translation function using Google Translate API
async function translateText(text, targetLang) {
    if (targetLang === 'en' || !text) return text;

    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        const data = await response.json();
        return data[0][0][0];
    } catch (error) {
        console.error('Translation error:', error);
        return text;
    }
}

// Translate all messages in chat
async function translateAllMessages() {
    if (isTranslating) return;

    isTranslating = true;
    const messages = chatBox.querySelectorAll('.chat-message');

    for (const msg of messages) {
        const textElement = msg.querySelector('p:first-child');
        if (textElement && !textElement.classList.contains('translated')) {
            const originalText = textElement.getAttribute('data-original') || textElement.textContent;
            textElement.setAttribute('data-original', originalText);

            if (currentLanguage !== 'en') {
                const translatedText = await translateText(originalText, currentLanguage);
                textElement.textContent = translatedText;
                textElement.classList.add('translated');
            } else {
                textElement.textContent = originalText;
                textElement.classList.remove('translated');
            }
        }
    }

    isTranslating = false;
}

function addMessage(message, isUser) {
    const msgDiv = document.createElement("div");
    msgDiv.className = "chat-message mb-6";

    const time = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });

    // Store message for transcript
    chatMessages.push({
        user_query: isUser ? message : null,
        legal_response: !isUser ? message : null,
        timestamp: time
    });

    if (isUser) {
        // ✅ USER MESSAGE (no formatting needed)
        msgDiv.innerHTML = `
            <div class="flex gap-3 md:gap-4 justify-end">
                <div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-3 md:p-4 rounded-2xl rounded-tr-none max-w-[80%] md:max-w-[70%] shadow-md">
                    <p class="text-sm md:text-base" data-original="${escapeHtml(message)}">
                        ${escapeHtml(message)}
                    </p>
                    <p class="text-xs mt-2 text-blue-100 text-right">${time}</p>
                </div>
                <div class="bg-gradient-to-br from-gray-700 to-gray-900 text-white w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                    <i class="fas fa-user text-xs md:text-sm"></i>
                </div>
            </div>
        `;
    } else {
        // ✅ BOT MESSAGE (WITH FORMATTING)
        msgDiv.innerHTML = `
            <div class="flex gap-3 md:gap-4">
                <div class="bg-gradient-to-br from-blue-600 to-purple-600 text-white w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                    <i class="fas fa-robot text-xs md:text-sm"></i>
                </div>
                <div class="bg-white p-3 md:p-4 rounded-2xl rounded-tl-none shadow-sm max-w-[80%] md:max-w-[70%] border border-gray-100">
                    
                    <div class="text-gray-800 text-sm md:text-base leading-relaxed space-y-2"
                         data-original="${escapeHtml(message)}">
                        ${formatMessage(escapeHtml(message))}
                    </div>

                    <p class="text-xs text-gray-500 mt-2 flex items-center gap-2">
                        <i class="fas fa-clock text-xs"></i> ${time}
                    </p>
                </div>
            </div>
        `;
    }

    chatBox.appendChild(msgDiv);

    // Translate if needed
    if (currentLanguage !== 'en') {
        translateAllMessages();
    }

    chatBox.scrollTop = chatBox.scrollHeight;
}
// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showTyping() {
    const typing = document.createElement("div");
    typing.id = "typing";
    typing.className = "chat-message mb-6";
    typing.innerHTML = `
        <div class="flex gap-3 md:gap-4">
            <div class="bg-gradient-to-br from-blue-600 to-purple-600 text-white w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                <i class="fas fa-robot"></i>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
    `;
    chatBox.appendChild(typing);
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function handleSend() {
    const message = userInput.value.trim();
    if (!message) return;

    addMessage(message, true);
    userInput.value = "";
    showTyping();

    try {
        // ✅ FIX 9: Use JSON body instead of query params (handles long/special-char questions)
        const payload = {
            question: message,
            language: currentLanguage,
            session_id: sessionId
        };

        // ✅ FIX 6: Include doc_id if a document was uploaded this session
        if (currentDocId) {
            payload.doc_id = currentDocId;
        }

        const response = await fetch(`${BACKEND_URL}/chat-translate`, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        document.getElementById("typing")?.remove();

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.detail || `Server error ${response.status}`);
        }

        const data = await response.json();
        addMessage(data.answer, false);
        saveCurrentChat();

    } catch (err) {
        document.getElementById("typing")?.remove();
        console.error("Chat error:", err);
        addMessage(`⚠️ ${err.message || "Server error. Please check if the backend is running and try again."}`, false);
    }
}
async function uploadDocument() {
    const file = fileUpload.files[0];
    if (!file) return;

    // ✅ Only PDF supported (matches backend)
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (fileExt !== '.pdf') {
        showNotification("Only PDF files are supported", "error");
        fileUpload.value = '';
        return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showNotification("File too large. Maximum size is 10MB", "error");
        fileUpload.value = '';
        return;
    }

    // Show upload progress
    uploadStatus.classList.remove("hidden");
    uploadStatus.className = "mt-3 text-sm text-center text-blue-600";
    uploadStatus.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Uploading and indexing document...';

    const formData = new FormData();
    formData.append("file", file);

    addMessage("📄 Uploading and processing document... ⏳", false);

    try {
        const res = await fetch(`${BACKEND_URL}/chat-upload`, {
            method: "POST",
            body: formData
        });

        if (res.ok) {
            const data = await res.json();

            // ✅ FIX 3: Store doc_id for scoped querying
            if (data.doc_id) {
                currentDocId = data.doc_id;
                console.log(`📎 Document scoped to doc_id: ${currentDocId}`);
            }

            const chunkCount = data.chunks || 0;

            uploadStatus.className = "mt-3 text-sm text-center text-green-600";
            uploadStatus.innerHTML = '<i class="fas fa-check-circle mr-2"></i>Document uploaded successfully!';

            addMessage(
                `✅ Document "${file.name}" uploaded and indexed.\n\n📦 ${chunkCount} sections indexed.\n🔍 All questions will now be answered from this document.\n\nYou can ask me anything about this document!`,
                false
            );

            fileUpload.value = '';

            setTimeout(() => {
                uploadStatus.classList.add("hidden");
            }, 3000);

        } else {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || 'Upload failed');
        }

    } catch (e) {
        uploadStatus.className = "mt-3 text-sm text-center text-red-600";
        uploadStatus.innerHTML = '<i class="fas fa-exclamation-circle mr-2"></i>Upload failed. Please try again.';
        console.error("Upload error:", e);
        addMessage(`⚠️ Upload failed: ${e.message}`, false);

        setTimeout(() => {
            uploadStatus.classList.add("hidden");
        }, 3000);
    }
}

function clearChat() {
    if (confirm("Are you sure you want to clear the chat?")) {
        chatBox.innerHTML = `
            <div class="chat-message mb-6 slide-in-up">
                <div class="flex gap-3 md:gap-4">
                    <div class="bg-gradient-to-br from-blue-600 to-purple-600 text-white w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                        <i class="fas fa-robot text-sm md:text-lg"></i>
                    </div>
                    <div class="bg-white p-4 md:p-6 rounded-2xl rounded-tl-none shadow-sm max-w-full md:max-w-3xl border border-gray-100 flex-1">
                        <p class="text-black-800 text-md font-bold md:text-base leading-relaxed" data-original="👋 Hello! I'm your AI Legal Assistant. What would you like to know about Indian laws today?">👋 Hello! I'm your AI Legal Assistant. What would you like to know about Indian laws today?</p>
                        <p class="text-xs md:text-sm text-gray-500 mt-2 md:mt-3 flex items-center gap-2">
                            <i class="fas fa-clock text-xs"></i> Just now
                        </p>
                    </div>
                </div>
            </div>
        `;

        // Clear chat messages array
        chatMessages = [];

        // Translate if needed
        if (currentLanguage !== 'en') {
            translateAllMessages();
        }

        showNotification("Chat cleared", "success");
    }
}

function startNewChat() {
    sessionId = "session_" + Date.now();
    localStorage.setItem("legal_chat_session_id", sessionId);
    chatMessages = []; // Clear messages array for new session
    currentDocId = null; // ✅ Reset doc scope for new session
    clearChat();
    showNotification("New chat started", "success");
}

function toggleLanguageDropdown() {
    languageDropdown.classList.toggle("hidden");
}

let maximized = false;

function toggleMaximizeChat() {
    const section = document.getElementById("chatbot");
    const icon = maximizeBtn.querySelector("i");

    if (!maximized) {
        section.classList.add("chat-maximized");
        document.body.style.overflow = "hidden";
        icon.className = "fas fa-compress";
        maximizeBtn.title = "Minimize Chat";
    } else {
        section.classList.remove("chat-maximized");
        document.body.style.overflow = "";
        icon.className = "fas fa-expand";
        maximizeBtn.title = "Maximize Chat";
    }
    maximized = !maximized;
}

function showHistory() {
    document.getElementById("historySidebar").classList.remove("hidden");
    document.getElementById("sidebarOverlay").classList.remove("hidden");
    loadHistory();
}

function closeHistory() {
    document.getElementById("historySidebar").classList.add("hidden");
    document.getElementById("sidebarOverlay").classList.add("hidden");
}

function loadHistory() {
    const history = JSON.parse(localStorage.getItem("chatHistory") || "[]");
    const list = document.getElementById("historyList");

    if (history.length === 0) {
        list.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-comments text-3xl mb-3"></i>
                <p>No saved conversations yet</p>
                <p class="text-sm mt-2">Your conversations will appear here</p>
            </div>
        `;
        return;
    }

    let html = "";
    history.slice(0, 10).forEach((h, index) => {
        html += `
            <div class="border border-gray-200 rounded-lg p-3 mb-2 cursor-pointer hover:bg-gray-50 transition-colors" onclick="loadConversation('${h.id}')">
                <div class="flex items-center gap-2">
                    <i class="fas fa-comment text-blue-500 text-sm"></i>
                    <span class="text-sm font-medium text-gray-700">${escapeHtml(h.preview)}</span>
                </div>
                <p class="text-xs text-gray-500 mt-1">${new Date(parseInt(h.id.split('_')[1])).toLocaleString()}</p>
            </div>
        `;
    });
    list.innerHTML = html;
}

function loadConversation(id) {
    const history = JSON.parse(localStorage.getItem("chatHistory") || "[]");
    const convo = history.find(h => h.id === id);
    if (convo) {
        chatBox.innerHTML = convo.html;
        sessionId = id;
        localStorage.setItem("legal_chat_session_id", id);

        // Rebuild chatMessages array from HTML
        rebuildChatMessages();

        // Translate if needed
        if (currentLanguage !== 'en') {
            translateAllMessages();
        }

        closeHistory();
        showNotification("Conversation loaded", "success");
    }
}

function rebuildChatMessages() {
    chatMessages = [];
    const messages = chatBox.querySelectorAll('.chat-message');

    messages.forEach(msg => {
        const isUser = msg.querySelector('.fa-user') !== null;
        const textElement = msg.querySelector('p:first-child');
        const timeElement = msg.querySelector('.text-xs:last-child');

        if (textElement) {
            const text = textElement.getAttribute('data-original') || textElement.textContent;
            const time = timeElement ? timeElement.textContent.trim() : '';

            if (isUser) {
                chatMessages.push({
                    user_query: text,
                    legal_response: null,
                    timestamp: time
                });
            } else {
                chatMessages.push({
                    user_query: null,
                    legal_response: text,
                    timestamp: time
                });
            }
        }
    });
}

function saveCurrentChat() {
    const html = chatBox.innerHTML;
    let history = JSON.parse(localStorage.getItem("chatHistory") || "[]");

    // Get first user message as preview
    const previewMatch = html.match(/<p[^>]*data-original="([^"]*)"[^>]*>/);
    const preview = previewMatch ? previewMatch[1].substring(0, 50) + "..." : "Conversation " + new Date().toLocaleString();

    // Remove existing session if present
    history = history.filter(h => h.id !== sessionId);

    history.unshift({
        id: sessionId,
        html: html,
        preview: preview
    });

    history = history.slice(0, 20);
    localStorage.setItem("chatHistory", JSON.stringify(history));
}

function clearAllHistory() {
    if (confirm("Are you sure you want to clear all chat history?")) {
        localStorage.removeItem("chatHistory");
        loadHistory();
        showNotification("All history cleared", "success");
    }
}

function showNotification(message, type) {
    const colors = {
        success: "bg-green-600",
        error: "bg-red-600",
        info: "bg-blue-600",
        warning: "bg-yellow-600"
    };

    const icons = {
        success: "fa-check-circle",
        error: "fa-exclamation-circle",
        info: "fa-info-circle",
        warning: "fa-exclamation-triangle"
    };

    const n = document.createElement("div");
    n.className = `fixed bottom-4 right-4 ${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg notification z-50 flex items-center gap-2`;
    n.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(n);
    setTimeout(() => {
        n.style.opacity = '0';
        n.style.transition = 'opacity 0.3s ease';
        setTimeout(() => n.remove(), 300);
    }, 3000);
}

// ============================================
// DOWNLOAD FUNCTIONS (WORKING WITHOUT BACKEND)
// ============================================

// Download TXT transcript locally
function downloadChatTranscript() {
    if (!sessionId) {
        showNotification("No active session found", "error");
        return;
    }

    try {
        showNotification("Generating transcript...", "info");

        const lines = [];
        const date = new Date();
        const formattedDate = date.toLocaleString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Header
        lines.push("=".repeat(80));
        lines.push(" ".repeat(20) + "LEGAL AI CHATBOT – CONSULTATION TRANSCRIPT");
        lines.push("=".repeat(80));
        lines.push(`Jurisdiction    : India`);
        lines.push(`Generated On    : ${formattedDate}`);
        lines.push(`Session ID      : ${sessionId}`);
        lines.push(`Language        : ${languageNames[currentLanguage] || 'English'}`);
        lines.push("=".repeat(80));

        // Get all messages
        const messages = chatBox.querySelectorAll('.chat-message');
        let queryCount = 0;
        let currentQuery = null;
        let currentResponse = null;

        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const isUser = msg.querySelector('.fa-user') !== null;
            const textElement = msg.querySelector('p:first-child');
            const timeElement = msg.querySelector('.text-xs:last-child');

            if (!textElement) continue;

            const text = textElement.getAttribute('data-original') || textElement.textContent;
            const time = timeElement ? timeElement.textContent.trim() : '';

            if (isUser) {
                // Save previous query-response pair if exists
                if (currentQuery && currentResponse) {
                    queryCount++;
                    lines.push(`\n${"=".repeat(80)}`);
                    lines.push(`CONSULTATION QUERY ${queryCount}`.padStart(45).padEnd(80));
                    lines.push(`${"=".repeat(80)}`);

                    lines.push("\n📝 CLIENT QUERY:");
                    lines.push("-".repeat(40));
                    lines.push(currentQuery.text);
                    lines.push(`\n⏰ Time: ${currentQuery.time}`);

                    lines.push("\n⚖️ LEGAL OPINION:");
                    lines.push("-".repeat(40));
                    lines.push(currentResponse.text);
                    lines.push(`\n⏰ Time: ${currentResponse.time}`);

                    lines.push("\n⚠️ DISCLAIMER:");
                    lines.push("-".repeat(40));
                    lines.push("This response is generated by an AI legal assistant for informational purposes only and does not constitute professional legal advice. Please consult with a qualified legal professional for specific legal guidance.");
                }

                // Start new query
                currentQuery = { text, time };
                currentResponse = null;
            } else {
                // This is a response
                currentResponse = { text, time };
            }
        }

        // Add last query-response if exists
        if (currentQuery && currentResponse) {
            queryCount++;
            lines.push(`\n${"=".repeat(80)}`);
            lines.push(`CONSULTATION QUERY ${queryCount}`.padStart(45).padEnd(80));
            lines.push(`${"=".repeat(80)}`);

            lines.push("\n📝 CLIENT QUERY:");
            lines.push("-".repeat(40));
            lines.push(currentQuery.text);
            lines.push(`\n⏰ Time: ${currentQuery.time}`);

            lines.push("\n⚖️ LEGAL OPINION:");
            lines.push("-".repeat(40));
            lines.push(currentResponse.text);
            lines.push(`\n⏰ Time: ${currentResponse.time}`);

            lines.push("\n⚠️ DISCLAIMER:");
            lines.push("-".repeat(40));
            lines.push("This response is generated by an AI legal assistant for informational purposes only and does not constitute professional legal advice. Please consult with a qualified legal professional for specific legal guidance.");
        }

        // Footer
        lines.push(`\n${"=".repeat(80)}`);
        lines.push(" ".repeat(35) + "END OF TRANSCRIPT");
        lines.push("=".repeat(80));
        lines.push("\n* This document is for informational purposes only.");
        lines.push("* Not a substitute for professional legal advice.");

        const content = lines.join('\n');

        // Create and download file
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `legal_consultation_${sessionId}_${date.toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showNotification("Transcript downloaded successfully", "success");

    } catch (error) {
        console.error("Download error:", error);
        showNotification("Failed to download transcript", "error");
    }
}

// Download as styled HTML (can be printed to PDF)
function downloadChatTranscriptPDF() {
    if (!sessionId) {
        showNotification("No active session found", "error");
        return;
    }

    try {
        showNotification("Downloading PDF...", "info");

        const link = document.createElement("a");
        link.href = `${BACKEND_URL}/transcript/download/pdf/${sessionId}`;
        link.download = `legal_consultation_${sessionId}.pdf`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification("PDF downloaded successfully", "success");

    } catch (error) {
        console.error("Download error:", error);
        showNotification("Failed to download PDF", "error");
    }
}

async function loadNewsPreview() {
    try {
        const res = await fetch(`${BACKEND_URL}/news`);
        if (!res.ok) throw new Error('News fetch failed');

        const data = await res.json();
        const container = document.getElementById("newsPreview");

        if (data.articles && data.articles.length > 0) {
            container.innerHTML = "";
            data.articles.slice(0, 4).forEach((a, index) => {
                container.innerHTML += `
                    <div class="bg-gray-50 p-4 rounded-lg hover:shadow-md transition-shadow">
                        <h3 class="font-bold text-gray-800 mb-2 text-sm line-clamp-2">${escapeHtml(a.title)}</h3>
                        <p class="text-xs text-gray-600 mb-2 line-clamp-2">${escapeHtml(a.description || a.title)}</p>
                        <div class="flex justify-between items-center mt-2">
                            <span class="text-xs text-gray-500">${escapeHtml(a.source || 'Legal News')}</span>
                            <a href="${a.link}" target="_blank" class="text-xs text-blue-600 hover:underline">Read more</a>
                        </div>
                    </div>
                `;
            });
        } else {
            container.innerHTML = '<p class="text-gray-500 text-center col-span-4">No news available</p>';
        }
    } catch (e) {
        console.log("News error:", e);
        document.getElementById("newsPreview").innerHTML = `
            <div class="text-center py-8 col-span-4">
                <i class="fas fa-newspaper text-gray-400 text-4xl mb-3"></i>
                <p class="text-gray-500">Unable to load news</p>
            </div>
        `;
    }
}

function formatMessage(text) {
    if (!text) return "";

    // Section headings
    text = text.replace(/📌 Section:/g, `<div class="mt-2 font-semibold text-blue-700">📌 Section:</div>`);
    text = text.replace(/📖 Explanation:/g, `<div class="mt-3 font-semibold text-purple-700">📖 Explanation:</div>`);
    text = text.replace(/⚖️ Key Points:/g, `<div class="mt-3 font-semibold text-green-700">⚖️ Key Points:</div>`);
    text = text.replace(/🛠 Practical Steps:/g, `<div class="mt-3 font-semibold text-orange-700">🛠 Practical Steps:</div>`);

    // Bullet points
    text = text.replace(/- (.*)/g, `<div class="ml-4">• $1</div>`);

    // Numbered steps
    text = text.replace(/(\d+\.\s.*)/g, `<div class="ml-4">$1</div>`);

    // Line breaks
    text = text.replace(/\n/g, "<br>");

    return text;
}

// Add missing functions to global scope for onclick handlers
window.closeHistory = closeHistory;
window.loadConversation = loadConversation;
window.clearAllHistory = clearAllHistory;