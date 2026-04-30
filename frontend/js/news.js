// API Configuration
const API_BASE = "http://localhost:8003"; // Make sure this matches your backend port

// State management
let newsState = {
    articles: [],
    currentPage: 1,
    pageSize: 12,
    viewMode: 'grid', // 'grid' or 'list'
    isLoading: false,
    categories: new Set(),
    selectedCategory: 'all'
};

// DOM Elements
const loadingNews = document.getElementById('loadingNews');
const newsGrid = document.getElementById('newsGrid');
const noResults = document.getElementById('noResults');
const loadMoreBtn = document.getElementById('loadMore');
const refreshNewsBtn = document.getElementById('refreshNews');
const articleCount = document.getElementById('articleCount');
const articleCountDisplay = document.getElementById('articleCountDisplay');
const lastUpdated = document.getElementById('lastUpdated');
const gridViewBtn = document.getElementById('gridView');
const listViewBtn = document.getElementById('listView');
const trendingBtn = document.getElementById('trendingBtn');
const trendingSection = document.getElementById('trendingSection');
const trendingTopics = document.getElementById('trendingTopics');
const newsModal = document.getElementById('newsModal');
const closeModal = document.getElementById('closeModal');
const modalContent = document.getElementById('modalContent');
const readFullArticleBtn = document.getElementById('readFullArticle');
const shareArticleBtn = document.getElementById('shareArticle');

// Current article for modal
let currentArticle = null;

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    await initializeNewsPage();
    setupEventListeners();
});

async function initializeNewsPage() {
    showLoading(true);

    try {
        // Load news data
        await loadNews();
        updateUI();

    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to load news. Please refresh the page.');
    } finally {
        showLoading(false);
    }
}

async function loadNews() {
    try {
        const response = await fetch(`${API_BASE}/news`);
        if (response.ok) {
            const data = await response.json();
            // Add unique IDs to articles
            newsState.articles = (data.articles || []).map((article, index) => ({
                ...article,
                id: `article_${index}_${Date.now()}`,
                category: detectCategory(article.title),
                read_time: estimateReadTime(article.description || ''),
                published: new Date().toISOString() // Use current time as fallback
            }));

            // Update counters
            articleCount.textContent = newsState.articles.length;
            if (articleCountDisplay) {
                articleCountDisplay.textContent = `${newsState.articles.length} articles`;
            }
            lastUpdated.textContent = formatTimeAgo(new Date().toISOString());

            renderNewsArticles();
        }
    } catch (error) {
        console.error('Error loading news:', error);
        throw error;
    }
}

function detectCategory(title) {
    const title_lower = title.toLowerCase();
    if (title_lower.includes('supreme court') || title_lower.includes('sc ')) return 'Supreme Court';
    if (title_lower.includes('high court')) return 'High Court';
    if (title_lower.includes('criminal') || title_lower.includes('ipc') || title_lower.includes('bns')) return 'Criminal Law';
    if (title_lower.includes('consumer')) return 'Consumer Law';
    if (title_lower.includes('cyber') || title_lower.includes('it act')) return 'Cyber Law';
    if (title_lower.includes('corporate') || title_lower.includes('company')) return 'Corporate Law';
    if (title_lower.includes('tax')) return 'Tax Law';
    if (title_lower.includes('family') || title_lower.includes('divorce') || title_lower.includes('domestic')) return 'Family Law';
    return 'Legal News';
}

function estimateReadTime(text) {
    if (!text) return 2;
    const wordsPerMinute = 200;
    const wordCount = text.split(/\s+/).length;
    return Math.max(2, Math.ceil(wordCount / wordsPerMinute));
}

function renderNewsArticles() {
    newsGrid.innerHTML = '';

    // Calculate pagination
    const startIndex = (newsState.currentPage - 1) * newsState.pageSize;
    const endIndex = startIndex + newsState.pageSize;
    const articlesToShow = newsState.articles.slice(startIndex, endIndex);

    if (articlesToShow.length === 0) {
        noResults.classList.remove('hidden');
        newsGrid.classList.add('hidden');
        return;
    }

    // Clear no results
    noResults.classList.add('hidden');
    newsGrid.classList.remove('hidden');

    // Set grid classes based on view mode
    newsGrid.className = newsState.viewMode === 'grid'
        ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
        : 'grid grid-cols-1 gap-6';

    // Render articles
    articlesToShow.forEach(article => {
        const card = createNewsCard(article);
        newsGrid.appendChild(card);
    });

    // Show/hide load more button
    const hasMoreArticles = newsState.articles.length > newsState.currentPage * newsState.pageSize;
    loadMoreBtn.classList.toggle('hidden', !hasMoreArticles);
}

function createNewsCard(article) {
    const card = document.createElement('div');
    card.className = newsState.viewMode === 'grid'
        ? 'news-card bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300'
        : 'news-card bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 flex flex-col md:flex-row';

    const timeAgo = formatTimeAgo(article.published);

    card.innerHTML = newsState.viewMode === 'grid'
        ? `
        <!-- Grid View -->
        <div class="relative h-48 overflow-hidden">
            <div class="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <i class="fas fa-newspaper text-white text-4xl"></i>
            </div>
            <div class="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent">
                <span class="bg-blue-600 text-white text-xs px-2 py-1 rounded">${article.category || 'Legal News'}</span>
            </div>
            <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent text-white">
                <span class="text-sm"><i class="fas fa-clock mr-1"></i>${timeAgo}</span>
            </div>
        </div>
        <div class="p-6">
            <h3 class="text-xl font-bold text-gray-800 mb-3 line-clamp-2">${escapeHtml(article.title)}</h3>
            <p class="text-gray-600 mb-4 line-clamp-3">${escapeHtml(article.description || article.title)}</p>
            <div class="flex justify-between items-center">
                <span class="text-sm text-gray-500"><i class="fas fa-newspaper mr-1"></i>${escapeHtml(article.source || 'Legal News')}</span>
                <span class="text-sm text-gray-500"><i class="fas fa-book-reader mr-1"></i>${article.read_time || 2} min read</span>
            </div>
            <div class="mt-4 flex gap-2">
                <button class="read-more-btn flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition" data-id="${article.id}">
                    <i class="fas fa-eye mr-2"></i>Read More
                </button>
                <a href="${article.link}" target="_blank" class="source-link p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition" title="View Original">
                    <i class="fas fa-external-link-alt"></i>
                </a>
            </div>
        </div>
    `
        : `
        <!-- List View -->
        <div class="md:w-1/3">
            <div class="relative h-48 md:h-full overflow-hidden">
                <div class="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                    <i class="fas fa-newspaper text-white text-4xl"></i>
                </div>
                <div class="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent">
                    <span class="bg-blue-600 text-white text-xs px-2 py-1 rounded">${article.category || 'Legal News'}</span>
                </div>
            </div>
        </div>
        <div class="md:w-2/3 p-6">
            <h3 class="text-2xl font-bold text-gray-800 mb-3">${escapeHtml(article.title)}</h3>
            <p class="text-gray-600 mb-4">${escapeHtml(article.description || article.title)}</p>
            <div class="flex flex-wrap gap-4 mb-4">
                <span class="text-sm text-gray-500"><i class="fas fa-newspaper mr-1"></i>${escapeHtml(article.source || 'Legal News')}</span>
                <span class="text-sm text-gray-500"><i class="fas fa-clock mr-1"></i>${timeAgo}</span>
                <span class="text-sm text-gray-500"><i class="fas fa-book-reader mr-1"></i>${article.read_time || 2} min read</span>
                <span class="text-sm bg-gray-100 text-gray-800 px-2 py-1 rounded">${article.category || 'Legal News'}</span>
            </div>
            <div class="flex gap-2">
                <button class="read-more-btn bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition" data-id="${article.id}">
                    <i class="fas fa-eye mr-2"></i>Read Full Article
                </button>
                <a href="${article.link}" target="_blank" class="source-link px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                    <i class="fas fa-external-link-alt mr-2"></i>Original Source
                </a>
                <button class="share-btn px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                    <i class="fas fa-share-alt"></i>
                </button>
            </div>
        </div>
    `;

    // Add event listeners
    card.querySelector('.read-more-btn').addEventListener('click', function() {
        openArticleModal(article.id);
    });

    const shareBtn = card.querySelector('.share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', function() {
            shareArticle(article);
        });
    }

    return card;
}

function openArticleModal(articleId) {
    const article = newsState.articles.find(a => a.id === articleId);
    if (!article) return;

    currentArticle = article;

    modalContent.innerHTML = `
        <div class="mb-6">
            <div class="flex flex-wrap gap-2 mb-4">
                <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">${article.category || 'Legal News'}</span>
                <span class="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm">${escapeHtml(article.source || 'Legal News')}</span>
                <span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm"><i class="fas fa-clock mr-1"></i>${article.read_time || 2} min read</span>
            </div>
            <h2 class="text-3xl font-bold text-gray-800 mb-4">${escapeHtml(article.title)}</h2>
            <div class="flex items-center gap-4 text-gray-600 mb-6">
                <span><i class="fas fa-calendar mr-2"></i>${formatDate(article.published)}</span>
                <span><i class="fas fa-user-edit mr-2"></i>Legal Reporter</span>
            </div>
        </div>
        
        <div class="prose max-w-none">
            <div class="text-gray-700 leading-relaxed">
                <p class="mb-4">${escapeHtml(article.description || article.title)}</p>
                <p class="text-gray-500 italic">Click "Read Full Article" to view the complete article on the source website.</p>
            </div>
        </div>
    `;

    readFullArticleBtn.onclick = () => window.open(article.link, '_blank');
    shareArticleBtn.onclick = () => shareArticle(article);

    newsModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function shareArticle(article) {
    const shareData = {
        title: article.title,
        text: `${article.title} - ${(article.description || article.title).substring(0, 100)}...`,
        url: article.link || window.location.href
    };

    if (navigator.share) {
        navigator.share(shareData)
            .then(() => console.log('Article shared successfully'))
            .catch(err => console.error('Error sharing:', err));
    } else {
        // Fallback: Copy to clipboard
        navigator.clipboard.writeText(`${article.title}\n${article.link}`)
            .then(() => {
                showNotification('Link copied to clipboard!', 'success');
            })
            .catch(err => {
                prompt('Copy this link:', article.link);
            });
    }
}

async function loadTrendingTopics() {
    // Simulate trending topics from articles
    const topics = [];
    const keywordMap = new Map();

    newsState.articles.slice(0, 20).forEach(article => {
        const words = article.title.toLowerCase().split(/\s+/);
        words.forEach(word => {
            if (word.length > 4 && !commonWords.includes(word)) {
                keywordMap.set(word, (keywordMap.get(word) || 0) + 1);
            }
        });
    });

    const sortedTopics = Array.from(keywordMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([topic, count]) => ({
            topic: topic.charAt(0).toUpperCase() + topic.slice(1),
            count: count,
            trend: count > 3 ? 'rising' : 'stable'
        }));

    renderTrendingTopics(sortedTopics);
    trendingSection.classList.remove('hidden');
}

const commonWords = ['the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'will', 'court', 'supreme', 'high', 'legal', 'news', 'update', 'latest'];

function renderTrendingTopics(topics) {
    trendingTopics.innerHTML = '';

    topics.forEach(topic => {
        const topicCard = document.createElement('div');
        topicCard.className = 'bg-gradient-to-br from-blue-50 to-purple-50 p-4 rounded-xl border border-blue-100';
        topicCard.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h4 class="font-bold text-lg text-gray-800">${topic.topic}</h4>
                <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">${topic.count} articles</span>
            </div>
            <div class="flex items-center gap-2 mb-3">
                <span class="text-sm ${topic.trend === 'rising' ? 'text-green-600' : 'text-yellow-600'}">
                    <i class="fas fa-arrow-up mr-1"></i>
                    ${topic.trend}
                </span>
            </div>
            <button class="trending-topic-btn text-sm text-blue-600 hover:text-blue-800 transition" data-topic="${topic.topic}">
                View articles <i class="fas fa-arrow-right ml-1"></i>
            </button>
        `;

        topicCard.querySelector('.trending-topic-btn').addEventListener('click', () => {
            filterByTopic(topic.topic);
        });

        trendingTopics.appendChild(topicCard);
    });
}

function filterByTopic(topic) {
    showNotification(`Showing articles about: ${topic}`, 'info');
    // Scroll to news grid
    document.getElementById('legal-news').scrollIntoView({ behavior: 'smooth' });
}

function formatDate(dateString) {
    if (!dateString) return 'Recent';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function formatTimeAgo(dateString) {
    if (!dateString) return 'Just now';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return formatDate(dateString);
}

function showLoading(show) {
    loadingNews.classList.toggle('hidden', !show);
    if (show) {
        newsGrid.classList.add('hidden');
        noResults.classList.add('hidden');
    }
    newsState.isLoading = show;
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-6 py-3 rounded-lg shadow-lg z-50';
    errorDiv.innerHTML = `
        <div class="flex items-center gap-3">
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
        </div>
    `;

    document.body.appendChild(errorDiv);

    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

function showNotification(message, type = 'success') {
    const colors = {
        success: 'bg-green-100 border-green-400 text-green-700',
        error: 'bg-red-100 border-red-400 text-red-700',
        info: 'bg-blue-100 border-blue-400 text-blue-700'
    };

    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 ${colors[type]} px-6 py-3 rounded-lg shadow-lg z-50 border`;
    notification.innerHTML = `
        <div class="flex items-center gap-3">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function updateUI() {
    renderNewsArticles();
    if (articleCountDisplay) {
        articleCountDisplay.textContent = `${newsState.articles.length} articles`;
    }
    lastUpdated.textContent = 'Just now';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function setupEventListeners() {
    // Refresh news
    refreshNewsBtn.addEventListener('click', async() => {
        try {
            showLoading(true);
            await loadNews();
            updateUI();
            showNotification('News refreshed successfully!', 'success');
        } catch (error) {
            console.error('Error refreshing news:', error);
            showError('Failed to refresh news');
        } finally {
            showLoading(false);
        }
    });

    // Trending topics
    trendingBtn.addEventListener('click', () => {
        loadTrendingTopics();
        trendingBtn.scrollIntoView({ behavior: 'smooth' });
    });

    // View mode
    gridViewBtn.addEventListener('click', () => {
        newsState.viewMode = 'grid';
        gridViewBtn.classList.add('bg-blue-100', 'text-blue-600');
        gridViewBtn.classList.remove('bg-gray-100', 'text-gray-600');
        listViewBtn.classList.remove('bg-blue-100', 'text-blue-600');
        listViewBtn.classList.add('bg-gray-100', 'text-gray-600');
        renderNewsArticles();
    });

    listViewBtn.addEventListener('click', () => {
        newsState.viewMode = 'list';
        listViewBtn.classList.add('bg-blue-100', 'text-blue-600');
        listViewBtn.classList.remove('bg-gray-100', 'text-gray-600');
        gridViewBtn.classList.remove('bg-blue-100', 'text-blue-600');
        gridViewBtn.classList.add('bg-gray-100', 'text-gray-600');
        renderNewsArticles();
    });

    // Load more
    loadMoreBtn.addEventListener('click', () => {
        newsState.currentPage++;
        renderNewsArticles();

        const newArticles = document.querySelectorAll('.news-card');
        if (newArticles.length > 0) {
            newArticles[newArticles.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });

    // Modal
    closeModal.addEventListener('click', () => {
        newsModal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    });

    newsModal.addEventListener('click', (e) => {
        if (e.target === newsModal) {
            newsModal.classList.add('hidden');
            document.body.style.overflow = 'auto';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !newsModal.classList.contains('hidden')) {
            newsModal.classList.add('hidden');
            document.body.style.overflow = 'auto';
        }
    });
}