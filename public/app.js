document.addEventListener('DOMContentLoaded', () => {
    console.log('Garden Tracker app.js loaded and DOMContentLoaded fired');
    // --- CONFIGURATION ---
    // IMPORTANT: Paste your OpenAI API key here or use the Settings panel.
    // For personal use only. Do not expose this key in a public-facing application.
    let OPENAI_API_KEY = "PASTE_YOUR_OPENAI_API_KEY_HERE";
    
    // Check for API key in localStorage first
    const storedKey = localStorage.getItem('openai_api_key');
    if (storedKey && storedKey.trim() !== '') {
        OPENAI_API_KEY = storedKey;
    }

    // --- DATA ---
    let basePlantDatabase = []; // Will be loaded from JSON
    let userPlants = [];
    let combinedPlantDatabase = [];
    let pestDiseaseDatabase = [];
    let myGarden = [];
    let gardenLayout = { plants: {}, beds: [] };
    let careLog = {};
    let activityLog = [];
    let harvestLog = [];
    let lastWeatherData = null; // store latest weather response

    // --- STATE MANAGEMENT ---
    let appState = {
        currentView: 'dashboard',
        draggedPlant: null,
        selectedLayoutPlant: null,
        calendarDate: new Date(),
        selectedBed: null,
    };

    // Chart instances for proper cleanup
    let dashboardCharts = {
        composition: null,
        harvest: null
    };

    // Voice recording state
    let voiceRecording = {
        mediaRecorder: null,
        audioChunks: [],
        isRecording: false,
        recordings: [], // Array to store multiple recordings
        currentTranscript: null,
        currentAnalysis: null
    };

    // --- DOM ELEMENTS ---
    const mainElements = {
        appContainer: document.getElementById('app-container'),
        modalBackdrop: document.getElementById('modal-backdrop'),
        modalPanel: document.getElementById('modal-panel'),
    };
    // Initialize new navigation system
    document.querySelectorAll('.garden-nav-tab').forEach(btn => {
        const viewName = btn.getAttribute('data-view');
        const action = btn.getAttribute('data-action');
        
        if (viewName) {
            // Store view elements for easy access
            mainElements[`${viewName}View`] = document.getElementById(`${viewName.replace(/([A-Z])/g, '-$1').toLowerCase()}-view`);
            mainElements[`${viewName}Btn`] = btn;
            
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                appState.currentView = viewName;
                updateNavigation();
                renderAll();
                // Close mobile menu if open
                closeMobileMenu();
            });
        } else if (action) {
            // Handle special actions like settings
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                // Handle the action (this will be processed by existing handleAppClick)
                // Close mobile menu if open
                closeMobileMenu();
            });
        }
    });

    // Initialize mobile menu toggle functionality
    document.querySelectorAll('.mobile-menu-toggle').forEach(toggleBtn => {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            toggleMobileMenu();
        });
    });

    // --- HELPER FUNCTIONS ---
    const getPlantById = id => {
        const plant = combinedPlantDatabase.find(p => p && p.id == id);
        if (!plant) {
            console.warn(`Plant with ID ${id} not found in database`);
        }
        return plant;
    };
    const getInstanceById = id => myGarden.find(i => i.instanceId == id);
    const getCategoryIcon = category => ({'Vegetable': '🥕', 'Flower': '🌸', 'Herb': '🌿', 'Pollinator': '🦋', 'Fruit Tree': '🍋'}[category] || '🌱');
    const dateToYMD = date => date.toISOString().split('T')[0];
    const addDays = (date, days) => { const res = new Date(date); res.setDate(res.getDate() + days); return res; };
    const formatDate = (dateString) => {
        if (!dateString) return null;
        const date = new Date(dateString);
        return new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    };

    const compressImage = (file, maxWidth = 800, quality = 0.8) => {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // Calculate new dimensions
                let { width, height } = img;
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedDataUrl);
            };
            
            img.src = URL.createObjectURL(file);
        });
    };
    const logActivity = (instanceId, message) => {
        const timestamp = new Date().toISOString();
        activityLog.push({ instanceId, message, date: timestamp });
        saveData();
    };

    // --- LOCAL STORAGE ---
    const saveData = async () => {
        try {
            const dataToSave = { myGarden, gardenLayout, careLog, activityLog, harvestLog, userPlants };
            const response = await fetch('/api/user-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToSave),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            console.log('Data saved to server successfully');
        } catch (e) {
            console.error("Could not save to server:", e);
            alert('Could not save your data to the server. Please check your connection and try again.');
        }
        renderAll();
    };

    const loadData = async () => {
        try {
            const response = await fetch('/api/user-data');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const parsed = await response.json();
            myGarden = parsed.myGarden || [];
            gardenLayout = parsed.gardenLayout || { plants: {}, beds: [] };
            // Ensure beds array exists for backward compatibility
            if (!gardenLayout.beds) gardenLayout.beds = [];
            careLog = parsed.careLog || {};
            activityLog = parsed.activityLog || [];
            harvestLog = parsed.harvestLog || [];
            userPlants = parsed.userPlants || [];
        } catch (error) {
            console.error('Could not load user data from server:', error);
        }
    };
    
    // --- NAVIGATION FUNCTIONS ---
    const updateNavigation = () => {
        // Reset all navigation buttons
        document.querySelectorAll('.garden-nav-tab').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Activate current view button
        const currentBtn = document.querySelector(`.garden-nav-tab[data-view="${appState.currentView}"]`);
        if (currentBtn) {
            currentBtn.classList.add('active');
        }
    };

    // Mobile menu functions
    const toggleMobileMenu = () => {
        const mobileMenu = document.querySelector('.mobile-menu');
        const toggleBtn = document.querySelector('.mobile-menu-toggle');
        
        if (mobileMenu && toggleBtn) {
            const isOpen = mobileMenu.classList.contains('show');
            
            if (isOpen) {
                closeMobileMenu();
            } else {
                openMobileMenu();
            }
        }
    };

    const openMobileMenu = () => {
        const mobileMenu = document.querySelector('.mobile-menu');
        const toggleBtn = document.querySelector('.mobile-menu-toggle');
        
        if (mobileMenu && toggleBtn) {
            mobileMenu.classList.remove('hidden');
            mobileMenu.classList.add('show');
            toggleBtn.classList.add('active');
        }
    };

    const closeMobileMenu = () => {
        const mobileMenu = document.querySelector('.mobile-menu');
        const toggleBtn = document.querySelector('.mobile-menu-toggle');
        
        if (mobileMenu && toggleBtn) {
            mobileMenu.classList.remove('show');
            toggleBtn.classList.remove('active');
            // Hide after animation completes
            setTimeout(() => {
                if (!mobileMenu.classList.contains('show')) {
                    mobileMenu.classList.add('hidden');
                }
            }, 300);
        }
    };

    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        const mobileMenu = document.querySelector('.mobile-menu');
        const nav = e.target.closest('nav');
        
        if (mobileMenu && !mobileMenu.classList.contains('hidden') && !nav) {
            closeMobileMenu();
        }
    });

    // --- RENDER VIEWS ---
    const renderAll = () => {
        console.log(`Rendering view: ${appState.currentView}`);
        
        // Preserve agentic interface visibility state during view changes
        const agenticInterface = document.getElementById('agentic-interface');
        const wasAgenticVisible = agenticInterface && !agenticInterface.classList.contains('translate-x-full');
        
        // Update navigation highlighting
        updateNavigation();
        
        // Hide all views
        Object.keys(mainElements).forEach(key => {
            if (key.endsWith('View') && mainElements[key]) {
                mainElements[key].classList.add('hidden');
            }
        });
        
        // Show the current view
        const viewEl = mainElements[`${appState.currentView}View`];
        
        if (viewEl) {
            viewEl.classList.remove('hidden');
            console.log(`Showing view: ${appState.currentView}`);
        } else {
            console.warn(`View element not found for: ${appState.currentView}`);
        }
        
        // Render the specific view content
        const renderFunction = {
            'dashboard': renderDashboardView,
            'database': renderDatabaseView,
            'myGarden': renderMyGardenView,
            'layout': renderLayoutView,
            'calendar': renderCalendarView,
            'companions': renderCompanionsView,
            'careSchedule': renderCareScheduleView,
            'activityLog': renderActivityLogView,
            'pestDiseaseGuide': renderPestDiseaseGuideView,
            'harvestLog': renderHarvestLogView,
            'ideas': renderIdeasView,
        }[appState.currentView];

        if (renderFunction) {
            renderFunction();
            console.log(`Rendered content for: ${appState.currentView}`);
        } else {
            console.warn(`No render function found for: ${appState.currentView}`);
        }
        
        // Refresh pollinator chart data if we're on dashboard and chart exists
        if (appState.currentView === 'dashboard' && pollinatorChart) {
            setTimeout(() => {
                refreshPollinatorData();
            }, 100);
        }
        
        // RESTORE agentic interface visibility state after rendering
        if (agenticInterface && wasAgenticVisible) {
            // Ensure the interface remains visible if it was visible before
            agenticInterface.classList.remove('translate-x-full');
            agenticInterface.classList.add('translate-x-0');
            
            // Update the AgenticUI instance state if it exists
            if (window.agenticUI) {
                window.agenticUI.isVisible = true;
            }
            
            console.log('Restored agentic interface visibility');
        }
        
        // Reinitialize icons
        lucide.createIcons();
    };
    
    const renderDashboardView = () => {
        // Destroy existing charts to prevent memory leaks and Canvas conflicts
        if (dashboardCharts.composition) {
            dashboardCharts.composition.destroy();
            dashboardCharts.composition = null;
        }
        if (dashboardCharts.harvest) {
            dashboardCharts.harvest.destroy();
            dashboardCharts.harvest = null;
        }
        if (pollinatorChart) {
            pollinatorChart.destroy();
            pollinatorChart = null;
        }

        const view = mainElements.dashboardView;
        view.innerHTML = `
            <div id="weather-widget" class="mb-8 relative overflow-hidden">
                <div class="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-cyan-500/10 to-blue-600/10 rounded-2xl"></div>
                <div class="relative bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                    <h3 class="text-xl font-bold text-text-base mb-4 flex items-center gap-3">
                        <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                            <i data-lucide="sun-cloud" class="text-white h-5 w-5"></i>
                        </div>
                        Local Weather
                    </h3>
                    <div id="weather-content">Loading weather data...</div>
                </div>
            </div>
            
            <div id="pollinator-summary-widget" class="mb-8 relative overflow-hidden">
                <div class="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-purple-600/10 rounded-2xl"></div>
                <div class="relative bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                    <h3 class="text-xl font-bold text-text-base mb-4 flex items-center gap-3">
                        <div class="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                            <i data-lucide="flower-2" class="text-white h-5 w-5"></i>
                        </div>
                        This Week's Pollinator Activity
                    </h3>
                    <div id="pollinator-summary-content">Loading pollinator data...</div>
                </div>
            </div>
            
             <div id="ai-recommendations-widget" class="mb-8 relative overflow-hidden">
                <div class="absolute inset-0 bg-gradient-to-br from-primary/10 via-garden-green/10 to-garden-sage/10 rounded-2xl"></div>
                <div class="relative bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-xl font-bold text-text-base flex items-center gap-3">
                            <div class="w-10 h-10 bg-gradient-to-br from-primary to-garden-green rounded-xl flex items-center justify-center">
                                <i data-lucide="wand-sparkles" class="text-white h-5 w-5"></i>
                            </div>
                            AI Assistant
                        </h3>
                        <div class="flex gap-2">
                            <button data-action="open-voice-recording" class="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-semibold rounded-xl hover:shadow-lg transition-all duration-300 flex items-center gap-2 group">
                                <i data-lucide="mic" class="h-4 w-4 group-hover:scale-110 transition-transform"></i> Voice Notes
                            </button>
                            <button data-action="generate-ai-recommendations" class="px-4 py-2 bg-gradient-to-r from-primary to-garden-green text-white text-sm font-semibold rounded-xl hover:shadow-lg transition-all duration-300 flex items-center gap-2 group">
                                <i data-lucide="sparkles" class="h-4 w-4 group-hover:scale-110 transition-transform"></i> Get Recommendations
                            </button>
                        </div>
                    </div>
                    <div id="ai-content" class="text-text-muted text-sm bg-white/50 rounded-xl p-4">Click "Get Recommendations" to generate tips or "Voice Notes" to record garden observations.</div>
                </div>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="relative overflow-hidden">
                    <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-green-500/10 to-teal-500/10 rounded-2xl"></div>
                    <div class="relative bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                        <h3 class="text-xl font-bold text-text-base mb-4 flex items-center gap-3">
                            <div class="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                                <i data-lucide="pie-chart" class="text-white h-4 w-4"></i>
                            </div>
                            Garden Composition
                        </h3>
                        <div class="h-80"><canvas id="composition-chart"></canvas></div>
                    </div>
                </div>
                <div class="relative overflow-hidden">
                    <div class="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-amber-500/10 to-yellow-500/10 rounded-2xl"></div>
                    <div class="relative bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                        <h3 class="text-xl font-bold text-text-base mb-4 flex items-center gap-3">
                            <div class="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center">
                                <i data-lucide="bar-chart" class="text-white h-4 w-4"></i>
                            </div>
                            Harvest Totals
                        </h3>
                        <div class="h-80"><canvas id="harvest-chart"></canvas></div>
                    </div>
                </div>
            </div>
        `;

        // Fetch fresh weather data when dashboard loads
        fetchAndRenderWeather();

        // Use setTimeout to ensure DOM elements are ready for Chart.js
        setTimeout(() => {
            // Render pollinator summary after DOM is ready
            renderPollinatorSummary();
            // Chart 1: Garden Composition
            const compositionCtx = view.querySelector('#composition-chart');
            if (compositionCtx) {
                const compositionData = myGarden.reduce((acc, instance) => {
                    const plant = getPlantById(instance.plantId);
                    if (plant) {
                        acc[plant.category] = (acc[plant.category] || 0) + 1;
                    }
                    return acc;
                }, {});

                dashboardCharts.composition = new Chart(compositionCtx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(compositionData),
                        datasets: [{
                            data: Object.values(compositionData),
                            backgroundColor: ['#4a7c59', '#d4a373', '#6e7368', '#a3b18a', '#588157'],
                            borderColor: '#f8f7f4',
                            borderWidth: 4,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom' } }
                    }
                });
            }

            // Chart 2: Harvest Totals
            const harvestCtx = view.querySelector('#harvest-chart');
            if (harvestCtx) {
                const harvestData = harvestLog.reduce((acc, log) => {
                    const instance = getInstanceById(log.instanceId);
                    if (instance) {
                        const plant = getPlantById(instance.plantId);
                        if (plant) {
                            acc[plant.commonName] = (acc[plant.commonName] || 0) + parseInt(log.quantity, 10);
                        }
                    }
                    return acc;
                }, {});

                dashboardCharts.harvest = new Chart(harvestCtx.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: Object.keys(harvestData),
                        datasets: [{
                            label: 'Total Quantity Harvested',
                            data: Object.values(harvestData),
                            backgroundColor: '#4a7c59',
                            borderColor: '#3d6e4f',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { beginAtZero: true }
                        }
                    }
                });
            }
        }, 100);

        // Initialize pollinator visits chart based on activity log
        initPollinatorChart();
    };

    // Simple pollinator summary for dashboard
    const renderPollinatorSummary = () => {
        const container = document.getElementById('pollinator-summary-content');
        if (!container) return;

        // Get current week start (Sunday)
        const now = new Date();
        const currentWeekStart = new Date(now);
        currentWeekStart.setUTCDate(now.getUTCDate() - now.getUTCDay());
        currentWeekStart.setUTCHours(0, 0, 0, 0);

        // Get week end (Saturday)
        const currentWeekEnd = new Date(currentWeekStart);
        currentWeekEnd.setUTCDate(currentWeekStart.getUTCDate() + 6);
        currentWeekEnd.setUTCHours(23, 59, 59, 999);

        // Process activity log for current week
        const weeklyData = {
            bee: 0,
            butterfly: 0,
            hummingbird: 0,
            total: 0,
            plantCounts: {}
        };

        activityLog.forEach(log => {
            if (log.type !== 'pollinator') return;

            const logDate = new Date(log.date);
            if (logDate >= currentWeekStart && logDate <= currentWeekEnd) {
                let pollinatorType = 'bee'; // default
                let count = 1;

                // Parse pollinator type and count
                if (log.description) {
                    pollinatorType = log.description.toLowerCase();
                }
                if (log.count) {
                    count = parseInt(log.count) || 1;
                }

                // Update counts
                if (weeklyData.hasOwnProperty(pollinatorType)) {
                    weeklyData[pollinatorType] += count;
                }
                weeklyData.total += count;

                // Track plant visits
                const instance = getInstanceById(log.instanceId);
                if (instance) {
                    const plant = getPlantById(instance.plantId);
                    if (plant) {
                        const plantName = plant.commonName;
                        weeklyData.plantCounts[plantName] = (weeklyData.plantCounts[plantName] || 0) + count;
                    }
                }
            }
        });

        // Format date range
        const formatDate = (date) => {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        };

        const weekRange = `${formatDate(currentWeekStart)} - ${formatDate(currentWeekEnd)}`;

        // Render summary
        if (weeklyData.total === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-2">🌸</div>
                    <p class="text-text-muted mb-2">No pollinator activity recorded this week</p>
                    <p class="text-sm text-text-muted">${weekRange}</p>
                    <p class="text-xs text-text-muted mt-2">Log observations in the Activity tab to see data here</p>
                </div>
            `;
        } else {
            const plantEntries = Object.entries(weeklyData.plantCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3); // Top 3 plants

            container.innerHTML = `
                <div class="space-y-4">
                    <div class="text-center">
                        <div class="text-3xl font-bold text-primary">${weeklyData.total}</div>
                        <p class="text-sm text-text-muted">Total visits this week</p>
                        <p class="text-xs text-text-muted">${weekRange}</p>
                    </div>
                    
                    <div class="grid grid-cols-3 gap-4 text-center">
                        <div class="bg-yellow-50 rounded-lg p-3">
                            <div class="text-xl font-semibold text-yellow-700">🐝 ${weeklyData.bee}</div>
                            <div class="text-xs text-yellow-600">Bees</div>
                        </div>
                        <div class="bg-purple-50 rounded-lg p-3">
                            <div class="text-xl font-semibold text-purple-700">🦋 ${weeklyData.butterfly}</div>
                            <div class="text-xs text-purple-600">Butterflies</div>
                        </div>
                        <div class="bg-red-50 rounded-lg p-3">
                            <div class="text-xl font-semibold text-red-700">🐦 ${weeklyData.hummingbird}</div>
                            <div class="text-xs text-red-600">Hummingbirds</div>
                        </div>
                    </div>
                    
                    ${plantEntries.length > 0 ? `
                        <div>
                            <h4 class="text-sm font-medium text-text-base mb-2">Most Active Plants</h4>
                            <div class="space-y-1">
                                ${plantEntries.map(([plant, count]) => `
                                    <div class="flex justify-between items-center text-sm">
                                        <span class="text-text-base">${plant}</span>
                                        <span class="text-primary font-medium">${count} visits</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }
    };

    // Pollinator Activity Tracking System (Activity Log Based)
    let pollinatorData = {
        visitStats: {}, // Track visits per plant per pollinator type from activity log
        totalVisits: 0,
        selectedPlant: null,
        currentWeekStart: null, // Track current week being viewed
        weeklyData: {} // Store data organized by week
    };

    // Chart tracking
    let pollinatorChart = null;
    let chartViewMode = 'stacked';

    const getPollinatorAttractiveness = (category, plant) => {
        const baseAttractiveness = {
            'Flowers': 0.9,
            'Herbs': 0.7,
            'Vegetables': 0.5,
            'Fruits': 0.8
        };
        
        // Boost attractiveness for plants with known pollinator-friendly traits
        let attractiveness = baseAttractiveness[category] || 0.6;
        
        if (plant) {
            // Check plant name for pollinator-friendly indicators
            const name = plant.commonName.toLowerCase();
            if (name.includes('lavender') || name.includes('sunflower') || 
                name.includes('bee') || name.includes('butterfly')) {
                attractiveness += 0.2;
            }
        }
        
        return Math.min(1, attractiveness);
    };

    const getPlantSize = (category) => {
        const sizes = {
            'Flowers': 10 + Math.random() * 8,
            'Herbs': 8 + Math.random() * 6,
            'Vegetables': 12 + Math.random() * 6,
            'Fruits': 14 + Math.random() * 8
        };
        return sizes[category] || 10 + Math.random() * 6;
    };

    const getPollinatorPreferences = (plant) => {
        if (!plant) return { bee: 0.7, butterfly: 0.6, hummingbird: 0.4 };
        
        const name = plant.commonName.toLowerCase();
        const category = plant.category;
        
        // Default preferences
        let preferences = { bee: 0.7, butterfly: 0.6, hummingbird: 0.4 };
        
        // Adjust based on plant characteristics
        if (category === 'Flowers') {
            preferences.butterfly += 0.2;
            if (name.includes('red') || name.includes('trumpet')) {
                preferences.hummingbird += 0.3;
            }
        }
        
        if (category === 'Herbs') {
            preferences.bee += 0.2;
            if (name.includes('lavender') || name.includes('mint')) {
                preferences.bee += 0.1;
            }
        }
        
        if (name.includes('sunflower') || name.includes('dahlia')) {
            preferences.bee += 0.3;
            preferences.butterfly += 0.2;
        }
        
        return preferences;
    };

    const setupPollinatorControls = () => {
        const playPauseBtn = document.getElementById('pollinator-play-pause');
        const seasonSelect = document.getElementById('pollinator-season');

        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                pollinatorAnimation.isPlaying = !pollinatorAnimation.isPlaying;
                const icon = playPauseBtn.querySelector('i');
                const text = playPauseBtn.querySelector('span');
                
                if (pollinatorAnimation.isPlaying) {
                    icon.setAttribute('data-lucide', 'pause');
                    text.textContent = 'Pause';
                    startPollinatorAnimation();
                } else {
                    icon.setAttribute('data-lucide', 'play');
                    text.textContent = 'Play';
                    stopPollinatorAnimation();
                }
                
                // Re-initialize lucide icons
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            });
        }

        if (seasonSelect) {
            seasonSelect.addEventListener('change', (e) => {
                pollinatorAnimation.season = e.target.value;
                updateSeasonalEffects();
            });
        }
    };

    const startPollinatorAnimation = () => {
        const animate = () => {
            if (!pollinatorAnimation.isPlaying) return;
            
            updatePollinatorTime();
            updatePollinators();
            renderPollinatorScene();
            
            pollinatorAnimation.animationId = requestAnimationFrame(animate);
        };
        animate();
    };

    const stopPollinatorAnimation = () => {
        if (pollinatorAnimation.animationId) {
            cancelAnimationFrame(pollinatorAnimation.animationId);
            pollinatorAnimation.animationId = null;
        }
    };

    const updatePollinatorTime = () => {
        pollinatorAnimation.currentTime += 0.02; // Speed up time
        if (pollinatorAnimation.currentTime >= 24) {
            pollinatorAnimation.currentTime = 0;
        }
        
        // Update time display
        const timeDisplay = document.getElementById('pollinator-time-display');
        if (timeDisplay) {
            const hours = Math.floor(pollinatorAnimation.currentTime);
            const minutes = Math.floor((pollinatorAnimation.currentTime % 1) * 60);
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
            timeDisplay.textContent = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
        }
    };

    const updatePollinators = () => {
        const currentTime = pollinatorAnimation.currentTime;
        let totalActivity = 0;

        pollinatorAnimation.pollinators.forEach(pollinator => {
            // Check if pollinator is active during current time
            const [startHour, endHour] = pollinator.activeHours;
            const isActive = currentTime >= startHour && currentTime <= endHour;
            
            if (isActive) {
                totalActivity++;
                
                // Find nearest attractive flower
                if (!pollinator.targetFlower || Math.random() < 0.01) {
                    pollinator.targetFlower = findNearestFlower(pollinator);
                }
                
                // Move towards target flower
                if (pollinator.targetFlower) {
                    const dx = pollinator.targetFlower.x - pollinator.x;
                    const dy = pollinator.targetFlower.y - pollinator.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < 15) {
                        // Visit flower - Record the visit!
                        const flower = pollinator.targetFlower;
                        const visitTime = Date.now();
                        
                        // Update pollinator state
                        pollinator.lastVisit = visitTime;
                        pollinator.visitedFlower = flower;
                        pollinator.energy = Math.min(1, pollinator.energy + 0.1);
                        
                        // Record visit in statistics
                        if (pollinatorAnimation.visitStats[flower.id]) {
                            pollinatorAnimation.visitStats[flower.id][pollinator.type]++;
                            pollinatorAnimation.visitStats[flower.id].total++;
                            pollinatorAnimation.visitStats[flower.id].lastVisit = visitTime;
                            pollinatorAnimation.totalVisits++;
                        }
                        
                        // Clear target to find new flower
                        pollinator.targetFlower = null;
                        
                        // Update stats display and chart
                        renderVisitStats();
                        updatePollinatorChart();
                    } else {
                        // Move towards flower
                        pollinator.vx += (dx / distance) * 0.1;
                        pollinator.vy += (dy / distance) * 0.1;
                    }
                }
                
                // Add some randomness to movement
                pollinator.vx += (Math.random() - 0.5) * 0.2;
                pollinator.vy += (Math.random() - 0.5) * 0.2;
                
                // Limit velocity
                const maxSpeed = pollinator.type === 'hummingbird' ? 3 : pollinator.type === 'butterfly' ? 1.5 : 2;
                const speed = Math.sqrt(pollinator.vx * pollinator.vx + pollinator.vy * pollinator.vy);
                if (speed > maxSpeed) {
                    pollinator.vx = (pollinator.vx / speed) * maxSpeed;
                    pollinator.vy = (pollinator.vy / speed) * maxSpeed;
                }
                
                // Update position
                pollinator.x += pollinator.vx;
                pollinator.y += pollinator.vy;
                
                // Boundary checking
                const canvas = pollinatorAnimation.canvas;
                if (canvas) {
                    if (pollinator.x < 0 || pollinator.x > canvas.width) pollinator.vx *= -1;
                    if (pollinator.y < 0 || pollinator.y > canvas.height) pollinator.vy *= -1;
                    pollinator.x = Math.max(0, Math.min(canvas.width, pollinator.x));
                    pollinator.y = Math.max(0, Math.min(canvas.height, pollinator.y));
                }
            }
        });
        
        // Update activity level display
        const activityDisplay = document.getElementById('pollinator-activity-level');
        if (activityDisplay) {
            const level = totalActivity < 3 ? 'Low' : totalActivity < 8 ? 'Medium' : 'High';
            activityDisplay.textContent = `Activity: ${level}`;
        }
    };

    const findNearestFlower = (pollinator) => {
        const currentTime = pollinatorAnimation.currentTime;
        const availableFlowers = pollinatorAnimation.flowers.filter(flower => {
            const [bloomStart, bloomEnd] = flower.bloomTime;
            return currentTime >= bloomStart && currentTime <= bloomEnd;
        });
        
        if (availableFlowers.length === 0) return null;
        
        let bestFlower = availableFlowers[0];
        let bestScore = -Infinity;
        
        availableFlowers.forEach(flower => {
            const dx = flower.x - pollinator.x;
            const dy = flower.y - pollinator.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Calculate attractiveness score based on plant preferences
            const pollinatorPreference = flower.pollinatorPreferences[pollinator.type] || 0.5;
            const baseAttractiveness = flower.attractiveness;
            
            // Combine distance, plant attractiveness, and pollinator preference
            // Lower distance = higher score, higher attractiveness = higher score
            const score = (pollinatorPreference * baseAttractiveness * 100) - (distance * 0.5);
            
            // Bonus for selected plant to make it more visually interesting
            if (flower.isSelected) {
                score += 20;
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestFlower = flower;
            }
        });
        
        return bestFlower;
    };

    const renderPollinatorScene = () => {
        const ctx = pollinatorAnimation.ctx;
        const canvas = pollinatorAnimation.canvas;
        if (!ctx || !canvas) return;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw sky gradient based on time
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        const timeOfDay = pollinatorAnimation.currentTime;
        
        if (timeOfDay < 6 || timeOfDay > 20) {
            // Night
            gradient.addColorStop(0, '#1a1a2e');
            gradient.addColorStop(1, '#16213e');
        } else if (timeOfDay < 8 || timeOfDay > 18) {
            // Dawn/Dusk
            gradient.addColorStop(0, '#ff7675');
            gradient.addColorStop(1, '#fdcb6e');
        } else {
            // Day
            gradient.addColorStop(0, '#74b9ff');
            gradient.addColorStop(1, '#00b894');
        }
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw flowers
        pollinatorAnimation.flowers.forEach(flower => {
            const [bloomStart, bloomEnd] = flower.bloomTime;
            const isBlooming = timeOfDay >= bloomStart && timeOfDay <= bloomEnd;
            
            if (isBlooming) {
                // Handle pulse animation for selected plants
                let sizeMultiplier = 1;
                if (flower.pulseAnimation > 0) {
                    const pulseIntensity = Math.sin((60 - flower.pulseAnimation) * 0.3) * 0.3 + 1;
                    sizeMultiplier = pulseIntensity;
                    flower.pulseAnimation--;
                }
                
                const drawSize = flower.size * sizeMultiplier;
                
                // Draw selection ring for selected plant
                if (flower.isSelected) {
                    ctx.strokeStyle = '#4a7c59';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(flower.x, flower.y, drawSize + 8, 0, Math.PI * 2);
                    ctx.stroke();
                }
                
                // Draw flower center
                ctx.fillStyle = flower.color;
                ctx.beginPath();
                ctx.arc(flower.x, flower.y, drawSize, 0, Math.PI * 2);
                ctx.fill();
                
                // Draw petals
                ctx.fillStyle = flower.color + '80';
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2;
                    const petalX = flower.x + Math.cos(angle) * drawSize * 0.8;
                    const petalY = flower.y + Math.sin(angle) * drawSize * 0.8;
                    ctx.beginPath();
                    ctx.arc(petalX, petalY, drawSize * 0.4, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                // Draw visit count indicator
                const stats = pollinatorAnimation.visitStats[flower.id];
                if (stats && stats.total > 0) {
                    ctx.fillStyle = 'rgba(74, 124, 89, 0.9)';
                    ctx.beginPath();
                    ctx.arc(flower.x + drawSize * 0.7, flower.y - drawSize * 0.7, 8, 0, Math.PI * 2);
                    ctx.fill();
                    
                    ctx.fillStyle = 'white';
                    ctx.font = '10px Inter, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(stats.total.toString(), flower.x + drawSize * 0.7, flower.y - drawSize * 0.7 + 3);
                }
            }
        });
        
        // Draw pollinators
        pollinatorAnimation.pollinators.forEach(pollinator => {
            const [startHour, endHour] = pollinator.activeHours;
            const isActive = timeOfDay >= startHour && timeOfDay <= endHour;
            
            if (isActive) {
                ctx.fillStyle = pollinator.color;
                ctx.beginPath();
                
                if (pollinator.type === 'bee') {
                    // Draw bee body
                    ctx.arc(pollinator.x, pollinator.y, pollinator.size, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Draw stripes
                    ctx.fillStyle = '#000';
                    ctx.fillRect(pollinator.x - 2, pollinator.y - 1, 4, 1);
                    ctx.fillRect(pollinator.x - 2, pollinator.y + 1, 4, 1);
                    
                } else if (pollinator.type === 'butterfly') {
                    // Draw butterfly wings
                    ctx.ellipse(pollinator.x - 3, pollinator.y - 2, 4, 2, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.ellipse(pollinator.x + 3, pollinator.y - 2, 4, 2, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.ellipse(pollinator.x - 2, pollinator.y + 2, 3, 1.5, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.ellipse(pollinator.x + 2, pollinator.y + 2, 3, 1.5, 0, 0, Math.PI * 2);
                    ctx.fill();
                    
                } else if (pollinator.type === 'hummingbird') {
                    // Draw hummingbird body
                    ctx.ellipse(pollinator.x, pollinator.y, pollinator.size, pollinator.size * 0.6, 0, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Draw wings
                    ctx.fillStyle = pollinator.color + '60';
                    ctx.ellipse(pollinator.x - 4, pollinator.y, 6, 2, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.ellipse(pollinator.x + 4, pollinator.y, 6, 2, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                // Draw trail for recent flower visits
                if (Date.now() - pollinator.lastVisit < 1000) {
                    ctx.strokeStyle = pollinator.color + '40';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(pollinator.x, pollinator.y, pollinator.size * 2, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
        });
    };

    const updateSeasonalEffects = () => {
        const season = pollinatorAnimation.season;
        
        // Adjust pollinator activity based on season
        pollinatorAnimation.pollinators.forEach(pollinator => {
            switch (season) {
                case 'spring':
                    pollinator.activeHours = [7, 17];
                    break;
                case 'summer':
                    pollinator.activeHours = pollinator.type === 'bee' ? [6, 19] : 
                                           pollinator.type === 'butterfly' ? [9, 18] : [6, 20];
                    break;
                case 'fall':
                    pollinator.activeHours = [8, 16];
                    break;
            }
        });
        
        // Adjust flower bloom times
        pollinatorAnimation.flowers.forEach(flower => {
            switch (season) {
                case 'spring':
                    flower.bloomTime = [7, 18];
                    break;
                case 'summer':
                    flower.bloomTime = [6, 20];
                    break;
                case 'fall':
                    flower.bloomTime = [8, 17];
                    break;
            }
        });
    };

    const renderDatabaseView = () => {
        const view = mainElements.databaseView;

        const categoryOptions = [...new Set(combinedPlantDatabase.map(p => p.category))].filter(Boolean).sort();
        const typeOptions = [...new Set(combinedPlantDatabase.map(p => p.type))].filter(Boolean).sort();
        const lightOptions = [...new Set(combinedPlantDatabase.map(p => p.light))].filter(Boolean).sort();
        const zoneOptions = [...new Set(combinedPlantDatabase.map(p => p.hardinessZone))].filter(Boolean).sort((a, b) => parseInt(a.split('-')[0]) - parseInt(b.split('-')[0]));

        view.innerHTML = `
            <div class="mb-8 relative overflow-hidden">
                <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-green-500/10 to-teal-500/10 rounded-2xl"></div>
                <div class="relative bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                            <i data-lucide="search" class="text-white h-5 w-5"></i>
                        </div>
                        <h2 class="text-2xl font-bold text-text-base">Plant Database</h2>
                    </div>
                    <div class="flex flex-col sm:flex-row gap-4">
                        <input type="text" id="search-input" placeholder="Search by name..." class="flex-grow px-4 py-3 bg-white/60 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 backdrop-blur-sm transition-all duration-300">
                        <button data-action="identify-plant" class="px-4 py-2 font-semibold rounded-xl transition-all duration-300 flex items-center gap-2 group bg-white/60 backdrop-blur-sm text-text-base border border-white/20 hover:bg-white/80 hover:shadow-md shrink-0"><i data-lucide="camera" class="group-hover:scale-110 transition-transform duration-300"></i> Identify Plant</button>
                        <button data-action="create-new-plant" class="px-4 py-2 font-semibold rounded-xl transition-all duration-300 flex items-center gap-2 group bg-gradient-to-r from-primary to-garden-green text-white hover:shadow-lg shrink-0"><i data-lucide="plus" class="group-hover:scale-110 transition-transform duration-300"></i> Create New Plant</button>
                    </div>
                </div>
            </div>
            <div class="mb-8 relative overflow-hidden">
                <div class="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-purple-500/10 rounded-2xl"></div>
                <div class="relative bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                    <h3 class="text-lg font-semibold text-text-base mb-4 flex items-center gap-2">
                        <i data-lucide="filter" class="h-5 w-5 text-primary"></i>
                        Filters
                    </h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label for="category-filter" class="block text-sm font-medium text-text-muted mb-2">Category</label>
                            <select id="category-filter" class="filter-select w-full py-3 px-4 bg-white/60 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 backdrop-blur-sm transition-all duration-300">
                                <option value="">All</option>
                                ${categoryOptions.map(c => `<option value="${c}">${c}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label for="type-filter" class="block text-sm font-medium text-text-muted mb-2">Type</label>
                            <select id="type-filter" class="filter-select w-full py-3 px-4 bg-white/60 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 backdrop-blur-sm transition-all duration-300">
                                <option value="">All</option>
                                ${typeOptions.map(t => `<option value="${t}">${t}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label for="light-filter" class="block text-sm font-medium text-text-muted mb-2">Light</label>
                            <select id="light-filter" class="filter-select w-full py-3 px-4 bg-white/60 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 backdrop-blur-sm transition-all duration-300">
                                <option value="">All</option>
                                ${lightOptions.map(l => `<option value="${l}">${l}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label for="zone-filter" class="block text-sm font-medium text-text-muted mb-2">Hardiness Zone</label>
                            <select id="zone-filter" class="filter-select w-full py-3 px-4 bg-white/60 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 backdrop-blur-sm transition-all duration-300">
                                <option value="">All</option>
                                ${zoneOptions.map(z => `<option value="${z}">${z}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            <main id="database-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"></main>`;
        
        view.querySelector('#search-input').addEventListener('input', applyDatabaseFilters);
        view.querySelectorAll('.filter-select').forEach(sel => sel.addEventListener('change', applyDatabaseFilters));
        
        applyDatabaseFilters();
    };

    const applyDatabaseFilters = () => {
        const view = mainElements.databaseView;
        if (!view || !view.querySelector('#database-container')) return;

        const container = view.querySelector('#database-container');
        const searchTerm = view.querySelector('#search-input').value.toLowerCase();
        const category = view.querySelector('#category-filter').value;
        const type = view.querySelector('#type-filter').value;
        const light = view.querySelector('#light-filter').value;
        const zone = view.querySelector('#zone-filter').value;

        const filtered = combinedPlantDatabase.filter(p => {
            if (!p) return false;

            const nameMatch = searchTerm === '' ||
                (p.commonName && p.commonName.toLowerCase().includes(searchTerm)) ||
                (p.botanicalName && p.botanicalName.toLowerCase().includes(searchTerm));

            return nameMatch &&
                   (category === '' || p.category === category) &&
                   (type === '' || p.type === type) &&
                   (light === '' || p.light === light) &&
                   (zone === '' || p.hardinessZone === zone);
        });
        
        if (filtered.length === 0) {
            container.innerHTML = `<div class="col-span-full text-center py-12 bg-surface rounded-xl shadow-md"><h3 class="text-xl font-semibold">No plants match your criteria.</h3><p class="text-text-muted">Try adjusting your search or filters.</p></div>`;
        } else {
            container.innerHTML = filtered.map(plant => {
                const isAdded = myGarden.some(p => p.plantId == plant.id);
                const categoryColor = plant.category === 'Vegetable' ? 'green' : plant.category === 'Herb' ? 'emerald' : 'purple';
                const categoryIcon = plant.category === 'Vegetable' ? 'carrot' : plant.category === 'Herb' ? 'leaf' : 'flower';
                return `
                    <div data-action="view-plant-details" data-id="${plant.id}" class="relative overflow-hidden group cursor-pointer animate-fade-in-up">
                        <div class="absolute inset-0 bg-gradient-to-br from-${categoryColor}-500/10 via-${categoryColor}-400/10 to-${categoryColor}-600/10 rounded-2xl"></div>
                        <div class="relative bg-white/60 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 hover:shadow-xl hover:bg-white/70 transition-all duration-300 group-hover:scale-105 flex flex-col h-full">
                            <div class="flex items-start gap-3 mb-4">
                                <div class="w-10 h-10 bg-gradient-to-br from-${categoryColor}-500 to-${categoryColor}-600 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <i data-lucide="${categoryIcon}" class="text-white h-5 w-5"></i>
                                </div>
                                <div class="flex-1">
                                    <h3 class="text-lg font-bold text-text-base mb-1">${plant.commonName}</h3>
                                    <p class="text-sm italic text-text-muted">${plant.botanicalName}</p>
                                </div>
                            </div>
                            <div class="flex-grow">
                                <p class="text-sm text-text-muted leading-relaxed">${plant.facts}</p>
                            </div>
                            <div class="mt-4 pt-4 border-t border-white/30">
                                <button data-action="add-to-garden" data-id="${plant.id}" class="w-full px-4 py-2 font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 group bg-gradient-to-r from-primary to-garden-green text-white hover:shadow-lg ${isAdded ? 'hidden' : ''}">
                                    <i data-lucide="plus" class="group-hover:scale-110 transition-transform duration-300"></i> Add to My Garden
                                </button>
                                <div class="font-semibold text-green-600 flex items-center justify-center gap-2 py-2 ${isAdded ? '' : 'hidden'}">
                                    <i data-lucide="check" class="text-green-500"></i> In Your Garden
                                </div>
                            </div>
                        </div>
                    </div>`;
            }).join('');
        }
        lucide.createIcons();
    };

    const renderMyGardenView = () => {
        const view = mainElements.myGardenView;
        view.innerHTML = `
            <div class="mb-8 relative overflow-hidden">
                <div class="absolute inset-0 bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-teal-500/10 rounded-2xl"></div>
                <div class="relative bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                    <h2 class="text-2xl font-bold text-text-base flex items-center gap-3">
                        <div class="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                            <i data-lucide="home" class="text-white h-5 w-5"></i>
                        </div>
                        My Garden
                    </h2>
                    <p class="text-text-muted mt-2">Track and manage your growing plants</p>
                </div>
            </div>
            <main id="my-garden-container" class="grid grid-cols-1 md:grid-cols-3 gap-6"></main>`;
        const container = view.querySelector('#my-garden-container');
        if (myGarden.length === 0) {
            container.innerHTML = `<div class="col-span-full text-center py-12 bg-surface rounded-xl shadow-md"><h3 class="text-xl font-semibold">Your garden is empty.</h3><p class="text-text-muted">Add plants from the Database.</p></div>`;
            return;
        }
        container.innerHTML = myGarden.map(instance => {
            const plant = getPlantById(instance.plantId);
            if (!plant) {
                console.warn('Plant not found for instance:', instance);
                return ''; // Skip if plant not found
            }
            return `
                <div class="bg-surface rounded-xl shadow-md overflow-hidden flex flex-col cursor-pointer hover:shadow-lg transition-shadow" data-action="view-plant-details" data-id="${instance.instanceId}">
                    ${instance.photo ? `
                        <div class="h-48 overflow-hidden">
                            <img src="${instance.photo}" alt="${plant.commonName}" class="w-full h-full object-cover">
                        </div>
                    ` : ''}
                    <div class="p-5 flex flex-col flex-grow">
                         <div class="flex justify-between items-start">
                             <div>
                                <h3 class="text-xl font-bold text-text-base">${plant.commonName}</h3>
                                <p class="text-sm italic text-text-muted mb-4">Planted: ${new Date(instance.plantingDate).toLocaleDateString()}</p>
                            </div>
                            <button data-action="view-plant-details" data-id="${instance.instanceId}" class="p-2 text-text-muted hover:bg-stone-100 rounded-full" onclick="event.stopPropagation();"><i data-lucide="more-horizontal"></i></button>
                         </div>
                        <div class="flex-grow">${createTimelineHTML(instance, plant)}</div>
                        <button data-action="remove-from-garden" data-id="${instance.instanceId}" class="text-sm text-red-500 hover:underline mt-4 self-start" onclick="event.stopPropagation();">Remove</button>
                    </div>
                </div>`;
        }).join('');
    };
    
    const renderLayoutView = () => {
        const view = mainElements.layoutView;
        view.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div class="bg-surface rounded-xl shadow-md p-4">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-xl font-bold text-text-base">Garden Beds</h2>
                        <button data-action="create-bed" class="px-3 py-1.5 bg-primary text-white rounded-md hover:bg-primary/90 text-sm">
                            <i data-lucide="plus" class="h-4 w-4 mr-1"></i>New Bed
                        </button>
                    </div>
                    <div id="beds-list" class="space-y-3 mb-6"></div>
                    
                    <div id="plant-list-section" class="hidden">
                        <h3 class="text-lg font-semibold text-text-base mb-3">Your Plants</h3>
                        <div id="layout-plant-list" class="space-y-2 h-[40vh] overflow-y-auto pr-2"></div>
                    </div>
                </div>
                
                <div class="lg:col-span-3 bg-surface rounded-xl shadow-md p-4">
                    <div id="bed-editor-header" class="flex items-center justify-between mb-4 hidden">
                        <h2 id="bed-title" class="text-2xl font-bold text-text-base">Garden Bed</h2>
                        <div class="flex gap-2">
                            <button data-action="edit-bed" class="px-3 py-1.5 bg-accent text-white rounded-md hover:bg-accent/90 text-sm">
                                <i data-lucide="edit-2" class="h-4 w-4 mr-1"></i>Edit
                            </button>
                            <button data-action="delete-bed" class="px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm">
                                <i data-lucide="trash-2" class="h-4 w-4 mr-1"></i>Delete
                            </button>
                        </div>
                    </div>
                    
                    <div id="bed-canvas-container" class="hidden">
                        <div id="garden-layout-grid" class="w-full bg-amber-50/20 border border-stone-300 rounded-lg relative"></div>
                    </div>
                    
                    <div id="no-bed-selected" class="flex flex-col items-center justify-center h-[60vh] text-center">
                        <i data-lucide="layout-grid" class="h-16 w-16 text-stone-300 mb-4"></i>
                        <h3 class="text-xl font-semibold text-stone-500 mb-2">No bed selected</h3>
                        <p class="text-stone-400 mb-4">Select a bed from the list or create a new one to start planning your layout</p>
                        <button data-action="create-bed" class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90">
                            <i data-lucide="plus" class="h-4 w-4 mr-2"></i>Create Your First Bed
                        </button>
                    </div>
                </div>
            </div>`;

        renderBedsList();
        renderPlantList();
        
        // Show plant list if we have a selected bed
        if (appState.selectedBed) {
            selectBed(appState.selectedBed);
        }
    };

    const renderBedsList = () => {
        const bedsList = document.getElementById('beds-list');
        if (!bedsList) return;

        if (!gardenLayout.beds || gardenLayout.beds.length === 0) {
            bedsList.innerHTML = `
                <div class="text-center py-6 text-stone-500">
                    <i data-lucide="layout-grid" class="h-8 w-8 mx-auto mb-2 text-stone-300"></i>
                    <p class="text-sm">No beds created yet</p>
                </div>`;
            return;
        }

        bedsList.innerHTML = gardenLayout.beds.map(bed => `
            <div data-action="select-bed" data-bed-id="${bed.id}" 
                 class="p-3 rounded-lg border cursor-pointer transition-colors ${
                     appState.selectedBed === bed.id 
                         ? 'bg-primary/10 border-primary' 
                         : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
                 }">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="font-semibold text-text-base">${bed.name}</h3>
                        <p class="text-sm text-text-muted">${bed.width}' × ${bed.height}'</p>
                        <p class="text-xs text-text-muted mt-1">${getPlantCountForBed(bed.id)} plants</p>
                    </div>
                    <div class="flex flex-col items-end">
                        <div class="w-8 h-6 bg-amber-100 border border-amber-200 rounded mb-1"></div>
                        <span class="text-xs text-text-muted">${bed.type}</span>
                    </div>
                </div>
            </div>
        `).join('');
    };

    const renderPlantList = () => {
        const plantList = document.getElementById('layout-plant-list');
        if (!plantList) return;

        plantList.innerHTML = myGarden.map(instance => {
            const plant = getPlantById(instance.plantId);
            if (!plant) return '';
            
            let classes = "p-2 rounded-md flex items-center gap-2 cursor-grab bg-surface shadow-sm border border-stone-200";
            if (appState.selectedLayoutPlant) {
                const selectedPlantInstance = getInstanceById(appState.selectedLayoutPlant);
                if (selectedPlantInstance) {
                    const selectedPlantData = getPlantById(selectedPlantInstance.plantId);
                    if (selectedPlantData && selectedPlantData.companions) {
                        if (selectedPlantData.companions.friends.includes(plant.id)) classes += ' highlight-friend';
                        if (selectedPlantData.companions.foes.includes(plant.id)) classes += ' highlight-foe';
                    }
                }
            }
            
            return `<div draggable="true" data-action="drag-plant" data-instance-id="${instance.instanceId}" class="${classes}">
                <span class="text-2xl">${getCategoryIcon(plant.category)}</span>
                <span>${plant.commonName}</span>
            </div>`;
        }).join('');
    };

    const selectBed = (bedId) => {
        appState.selectedBed = bedId;
        const bed = gardenLayout.beds?.find(b => b.id === bedId);
        
        if (!bed) return;

        // Update UI
        document.getElementById('no-bed-selected').classList.add('hidden');
        document.getElementById('bed-editor-header').classList.remove('hidden');
        document.getElementById('bed-canvas-container').classList.remove('hidden');
        document.getElementById('plant-list-section').classList.remove('hidden');
        
        // Update bed title
        document.getElementById('bed-title').textContent = bed.name;
        
        // Render the bed layout
        renderBedLayout(bed);
        
        // Re-render beds list to update selection
        renderBedsList();
    };

    const renderBedLayout = (bed) => {
        const grid = document.getElementById('garden-layout-grid');
        if (!grid) return;

        // Set grid dimensions based on bed size
        const aspectRatio = bed.height / bed.width;
        grid.style.height = `${Math.min(60, Math.max(30, aspectRatio * 80))}vh`;
        
        // Clear existing plants
        grid.innerHTML = '';
        
        // Render plants for this bed
        if (bed.plants) {
            Object.keys(bed.plants).forEach(instanceId => {
                const pos = bed.plants[instanceId];
                const instance = getInstanceById(instanceId);
                if (!instance) return;
                
                const plant = getPlantById(instance.plantId);
                if (!plant) return;
                
                const plantElement = document.createElement('div');
                plantElement.setAttribute('data-action', 'select-layout-plant');
                plantElement.setAttribute('data-instance-id', instanceId);
                plantElement.className = `plant-icon absolute flex items-center justify-center w-[5%] h-[10%] bg-primary/70 rounded-full cursor-pointer text-2xl border-2 ${
                    appState.selectedLayoutPlant == instanceId ? 'border-accent' : 'border-primary'
                }`;
                plantElement.style.left = `${pos.x}%`;
                plantElement.style.top = `${pos.y}%`;
                plantElement.title = plant.commonName;
                plantElement.innerHTML = getCategoryIcon(plant.category);
                
                grid.appendChild(plantElement);
            });
        }
    };

    const getPlantCountForBed = (bedId) => {
        const bed = gardenLayout.beds?.find(b => b.id === bedId);
        return bed?.plants ? Object.keys(bed.plants).length : 0;
    };

    const openCreateBedModal = () => {
        const content = `
            <div class="p-6">
                <h2 class="text-2xl font-bold text-text-base mb-6">Create New Garden Bed</h2>
                <form id="create-bed-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-semibold text-text-base mb-2">Bed Name</label>
                        <input type="text" id="bed-name" class="w-full p-3 border border-stone-300 rounded-lg" 
                               placeholder="e.g., Front Yard Vegetable Bed" required>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-text-base mb-2">Width (feet)</label>
                            <input type="number" id="bed-width" class="w-full p-3 border border-stone-300 rounded-lg" 
                                   placeholder="8" min="1" max="50" value="8" required>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-text-base mb-2">Height (feet)</label>
                            <input type="number" id="bed-height" class="w-full p-3 border border-stone-300 rounded-lg" 
                                   placeholder="4" min="1" max="50" value="4" required>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-text-base mb-2">Bed Type</label>
                        <select id="bed-type" class="w-full p-3 border border-stone-300 rounded-lg">
                            <option value="raised">Raised Bed</option>
                            <option value="ground">Ground Level</option>
                            <option value="container">Container Garden</option>
                            <option value="greenhouse">Greenhouse</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-text-base mb-2">Notes (Optional)</label>
                        <textarea id="bed-notes" class="w-full p-3 border border-stone-300 rounded-lg h-20" 
                                  placeholder="Add any notes about this bed..."></textarea>
                    </div>
                    
                    <div class="flex gap-3 pt-4">
                        <button type="submit" class="flex-1 bg-primary text-white py-3 rounded-lg hover:bg-primary/90 font-semibold">
                            Create Bed
                        </button>
                        <button type="button" data-action="close-modal" class="px-6 py-3 border border-stone-300 rounded-lg hover:bg-stone-50">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>`;
        
        openModal(content);
    };

    const openEditBedModal = (bedId) => {
        const bed = gardenLayout.beds?.find(b => b.id === bedId);
        if (!bed) return;

        const content = `
            <div class="p-6">
                <h2 class="text-2xl font-bold text-text-base mb-6">Edit Garden Bed</h2>
                <form id="edit-bed-form" class="space-y-4">
                    <input type="hidden" id="edit-bed-id" value="${bed.id}">
                    
                    <div>
                        <label class="block text-sm font-semibold text-text-base mb-2">Bed Name</label>
                        <input type="text" id="edit-bed-name" class="w-full p-3 border border-stone-300 rounded-lg" 
                               value="${bed.name}" required>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-text-base mb-2">Width (feet)</label>
                            <input type="number" id="edit-bed-width" class="w-full p-3 border border-stone-300 rounded-lg" 
                                   value="${bed.width}" min="1" max="50" required>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-text-base mb-2">Height (feet)</label>
                            <input type="number" id="edit-bed-height" class="w-full p-3 border border-stone-300 rounded-lg" 
                                   value="${bed.height}" min="1" max="50" required>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-text-base mb-2">Bed Type</label>
                        <select id="edit-bed-type" class="w-full p-3 border border-stone-300 rounded-lg">
                            <option value="raised" ${bed.type === 'raised' ? 'selected' : ''}>Raised Bed</option>
                            <option value="ground" ${bed.type === 'ground' ? 'selected' : ''}>Ground Level</option>
                            <option value="container" ${bed.type === 'container' ? 'selected' : ''}>Container Garden</option>
                            <option value="greenhouse" ${bed.type === 'greenhouse' ? 'selected' : ''}>Greenhouse</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-text-base mb-2">Notes (Optional)</label>
                        <textarea id="edit-bed-notes" class="w-full p-3 border border-stone-300 rounded-lg h-20">${bed.notes || ''}</textarea>
                    </div>
                    
                    <div class="flex gap-3 pt-4">
                        <button type="submit" class="flex-1 bg-primary text-white py-3 rounded-lg hover:bg-primary/90 font-semibold">
                            Save Changes
                        </button>
                        <button type="button" data-action="close-modal" class="px-6 py-3 border border-stone-300 rounded-lg hover:bg-stone-50">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>`;
        
        openModal(content);
    };

    const renderCalendarView = () => {
        const view = mainElements.calendarView;
        view.innerHTML = `<div class="bg-surface rounded-xl shadow-md">
            <div class="p-4 flex items-center justify-between border-b border-stone-200">
                <h2 id="calendar-month-year" class="text-xl font-bold text-text-base"></h2>
                <div class="flex items-center gap-2">
                    <button data-action="calendar-prev" class="p-2 rounded-md hover:bg-stone-100"><i data-lucide="chevron-left" class="h-5 w-5"></i></button>
                    <button data-action="calendar-today" class="px-3 py-1.5 text-sm font-semibold bg-stone-100 hover:bg-stone-200 rounded-md">Today</button>
                    <button data-action="calendar-next" class="p-2 rounded-md hover:bg-stone-100"><i data-lucide="chevron-right" class="h-5 w-5"></i></button>
                </div>
            </div>
            <div>
                <div class="calendar-grid border-b border-l border-stone-200 text-center font-bold bg-stone-50 text-text-muted">
                    ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="p-2 border-r border-stone-200">${d}</div>`).join('')}
                </div>
                <div id="calendar-body" class="calendar-grid border-l border-stone-200"></div>
            </div>
        </div>`;

        const monthYearEl = view.querySelector('#calendar-month-year');
        const calendarBody = view.querySelector('#calendar-body');
        const date = appState.calendarDate;
        const month = date.getMonth();
        const year = date.getFullYear();

        monthYearEl.textContent = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        calendarBody.innerHTML = '';
        
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const events = {};
        myGarden.forEach(instance => {
            if (!instance.plantingDate) return;
            const plant = getPlantById(instance.plantId);
            if (!plant) return; // Safety check if plant is not found

            const pDate = formatDate(instance.plantingDate);
            
            // Safely access properties with default values
            const germinationEndDay = Array.isArray(plant.germinationDays) ? (plant.germinationDays[1] ?? 0) : 0;
            const maturityDay = plant.daysToMaturity ?? 0;

            [
                { date: pDate, text: plant.commonName, icon: 'chevrons-down', colorClass: 'bg-sky-500' },
                { date: addDays(pDate, germinationEndDay), text: plant.commonName, icon: 'sprout', colorClass: 'bg-yellow-500' },
                { date: addDays(pDate, maturityDay), text: plant.commonName, icon: 'award', colorClass: 'bg-emerald-500' },
            ].forEach(event => {
                if (event.date.getFullYear() === year && event.date.getMonth() === month) {
                    const dateStr = dateToYMD(event.date);
                    if (!events[dateStr]) events[dateStr] = [];
                    events[dateStr].push({ ...event, instanceId: instance.instanceId });
                }
            });
        });

        for (let i = 0; i < firstDayOfMonth; i++) {
            calendarBody.innerHTML += `<div class="calendar-day calendar-day-other-month border-r border-b border-stone-200"></div>`;
        }
        for (let i = 1; i <= daysInMonth; i++) {
            const today = new Date();
            const isToday = i === today.getDate() && year === today.getFullYear() && month === today.getMonth();
            const dateStr = dateToYMD(new Date(year, month, i));
            const dayEvents = events[dateStr] || [];
            calendarBody.innerHTML += `
                <div class="calendar-day p-2 border-r border-b border-stone-200 relative flex flex-col ${isToday ? 'bg-primary/10' : ''}">
                    <div class="text-sm font-semibold ${isToday ? 'text-primary' : ''}">${i}</div>
                    <div class="flex-grow mt-1 space-y-1 overflow-y-auto">
                        ${dayEvents.map(e => `<div data-action="view-plant-details" data-id="${e.instanceId}" class="calendar-event text-xs p-1 rounded-md text-white ${e.colorClass}"><i data-lucide="${e.icon}" class="inline-block h-3 w-3 mr-1"></i>${e.text}</div>`).join('')}
                    </div>
                </div>`;
        }
         const totalCells = firstDayOfMonth + daysInMonth;
         for (let i = 0; i < (7 - (totalCells % 7)) % 7; i++) {
             calendarBody.innerHTML += `<div class="calendar-day calendar-day-other-month border-r border-b border-stone-200"></div>`;
         }
    };

    const renderCompanionsView = () => {
        const view = mainElements.companionsView;
         view.innerHTML = `<div class="bg-surface rounded-xl shadow-md p-4">
            <h2 class="text-2xl font-bold text-text-base mb-1">Companion Planting Matrix</h2>
            <p class="text-sm text-text-muted mb-4">Click a cell to see details.</p>
            <div id="companion-matrix-container" class="overflow-x-auto"></div></div>`;

        const container = view.querySelector('#companion-matrix-container');
        let table = `<div class="flex"><div class="flex-shrink-0 w-32"></div><div class="flex">${combinedPlantDatabase.map(p => `<div class="matrix-cell flex items-center justify-center font-bold p-1 border-b border-r border-stone-200" title="${p.commonName}">${getCategoryIcon(p.category)}</div>`).join('')}</div></div>`;
        combinedPlantDatabase.forEach(p1 => {
            table += `<div class="flex items-stretch"><div class="matrix-header-y flex-shrink-0 w-32 p-2 font-bold text-right border-r border-stone-200">${p1.commonName}</div><div class="flex">`;
            combinedPlantDatabase.forEach(p2 => {
                let color = 'bg-stone-100';
                if (p1.id === p2.id) color = 'bg-stone-400';
                else if (p1.companions.friends.includes(p2.id)) color = 'bg-green-300 hover:bg-green-400';
                else if (p1.companions.foes.includes(p2.id)) color = 'bg-red-300 hover:bg-red-400';
                table += `<div data-action="show-companion-details" data-p1="${p1.id}" data-p2="${p2.id}" class="matrix-cell border-r border-b border-stone-200 cursor-pointer ${color}"></div>`;
            });
            table += `</div></div>`;
        });
        container.innerHTML = table;
    };
    
    const renderCareScheduleView = () => {
        const view = mainElements.careScheduleView;
        view.innerHTML = `<div class="bg-surface rounded-xl shadow-md p-4"><h2 class="text-2xl font-bold text-text-base mb-4">This Week's Care Schedule</h2><div id="care-schedule-container" class="grid grid-cols-1 md:grid-cols-7 gap-4"></div></div>`;
        const container = view.querySelector('#care-schedule-container');
        const today = new Date();
        for (let i = 0; i < 7; i++) {
            const day = addDays(today, i);
            const dayStr = day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const ymd = dateToYMD(day);
            
            const tasksHTML = myGarden.map(instance => {
                const plant = getPlantById(instance.plantId);
                if (!plant || !plant.care) return ''; // Safety check if plant is not found or has no care data
                const plantedDate = new Date(instance.plantingDate);
                const daysSincePlanted = Math.round((day - plantedDate) / (1000 * 60 * 60 * 24));
                let tasks = '';

                // Safely access care properties with defaults
                const waterInterval = plant.care.water || 0;
                const fertilizeInterval = plant.care.fertilize || 0;

                if (daysSincePlanted >= 0) {
                    if (waterInterval > 0 && daysSincePlanted % waterInterval === 0) {
                        const taskId = `water-${instance.instanceId}-${ymd}`;
                        const isCompleted = careLog[ymd]?.includes(taskId);
                        tasks += `<div data-action="toggle-care-task" data-task-id="${taskId}" data-ymd="${ymd}" class="care-task flex items-center gap-2 p-2 rounded-md bg-sky-100/70 cursor-pointer ${isCompleted ? 'completed' : ''}"><i data-lucide="droplet" class="h-4 w-4 text-sky-600"></i> ${plant.commonName}</div>`;
                    }
                    if (fertilizeInterval > 0 && daysSincePlanted > 7 && daysSincePlanted % fertilizeInterval === 0) {
                         const taskId = `fert-${instance.instanceId}-${ymd}`;
                         const isCompleted = careLog[ymd]?.includes(taskId);
                         tasks += `<div data-action="toggle-care-task" data-task-id="${taskId}" data-ymd="${ymd}" class="care-task flex items-center gap-2 p-2 rounded-md bg-amber-100/70 cursor-pointer ${isCompleted ? 'completed' : ''}"><i data-lucide="shovel" class="h-4 w-4 text-amber-600"></i> ${plant.commonName}</div>`;
                    }
                }
                return tasks;
            }).join('');

            container.innerHTML += `<div class="bg-bg-base/60 rounded-lg p-3"><h4 class="font-bold text-center border-b border-stone-300 pb-2 mb-2">${dayStr}</h4><div class="space-y-2">${tasksHTML || '<p class="text-xs text-text-muted text-center py-4">No tasks.</p>'}</div></div>`;
        }
    };

    const renderActivityLogView = () => {
        const view = mainElements.activityLogView;
        view.innerHTML = `<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2 space-y-6">
                <div class="bg-surface rounded-xl shadow-md p-6">
                    <h2 class="text-2xl font-bold text-text-base mb-4">Activity Heatmap</h2>
                    <div id="heatmap-container" class="overflow-x-auto"></div>
                </div>
                <div class="bg-surface rounded-xl shadow-md p-6">
                    <h2 class="text-2xl font-bold text-text-base mb-4">Activity Entries</h2>
                    <div id="activity-entries-container" class="space-y-3 max-h-96 overflow-y-auto"></div>
                </div>
            </div>
            <div class="bg-surface rounded-xl shadow-md p-6">
                <h2 class="text-2xl font-bold text-text-base mb-4">Log New Sighting</h2>
                <form id="activity-log-form" class="space-y-4"></form>
            </div></div>`;

        const form = view.querySelector('#activity-log-form');
        form.innerHTML = `
            <div><label for="activity-plant" class="block text-sm font-medium">Plant</label><select id="activity-plant" name="plant" class="mt-1 block w-full rounded-md border-stone-300 shadow-sm bg-surface">${myGarden.map(i => `<option value="${i.instanceId}">${getPlantById(i.plantId).commonName}</option>`).join('')}</select></div>
            <div>
                <label for="activity-type" class="block text-sm font-medium">Type</label>
                <select id="activity-type" name="type" class="mt-1 block w-full rounded-md border-stone-300 shadow-sm bg-surface">
                    <option value="pollinator">Pollinator</option>
                    <option value="pest">Pest/Disease</option>
                    <option value="other">Other Observation</option>
                </select>
            </div>
            <div id="pollinator-fields" class="space-y-4">
                <div>
                    <label for="pollinator-type" class="block text-sm font-medium">Pollinator Type</label>
                    <select id="pollinator-type" name="pollinatorType" class="mt-1 block w-full rounded-md border-stone-300 shadow-sm bg-surface">
                        <option value="bee">Bee</option>
                        <option value="butterfly">Butterfly</option>
                        <option value="hummingbird">Hummingbird</option>
                    </select>
                </div>
                <div>
                    <label for="pollinator-count" class="block text-sm font-medium">Quantity Observed</label>
                    <input type="number" id="pollinator-count" name="count" min="1" value="1" class="mt-1 block w-full rounded-md border-stone-300 shadow-sm bg-surface" required>
                </div>
            </div>
            <div id="other-fields" class="hidden">
                <label for="activity-description" class="block text-sm font-medium">Description</label>
                <input type="text" id="activity-description" name="description" placeholder="e.g., Aphids on leaves" class="mt-1 block w-full rounded-md border-stone-300 shadow-sm bg-surface">
            </div>
            <div><label for="activity-date" class="block text-sm font-medium">Date</label><input type="date" id="activity-date" name="date" class="mt-1 block w-full rounded-md border-stone-300 shadow-sm bg-surface" required></div>
            <div><label for="activity-time" class="block text-sm font-medium">Time (optional)</label><input type="time" id="activity-time" name="time" class="mt-1 block w-full rounded-md border-stone-300 shadow-sm bg-surface"></div>
            <button type="submit" class="w-full bg-primary text-white font-semibold py-2 px-4 rounded-md hover:bg-primary/90">Log Activity</button>`;
        form.querySelector('#activity-date').value = dateToYMD(new Date());
        
        // Toggle fields based on activity type
        const activityTypeSelect = form.querySelector('#activity-type');
        const pollinatorFields = form.querySelector('#pollinator-fields');
        const otherFields = form.querySelector('#other-fields');
        
        activityTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'pollinator') {
                pollinatorFields.classList.remove('hidden');
                otherFields.classList.add('hidden');
            } else {
                pollinatorFields.classList.add('hidden');
                otherFields.classList.remove('hidden');
            }
        });

        // Render activity entries list
        const entriesContainer = view.querySelector('#activity-entries-container');
        if (activityLog.length === 0) {
            entriesContainer.innerHTML = `<p class="text-center py-8 text-text-muted">No activity logged yet.</p>`;
        } else {
            // Sort by date (newest first)
            const sortedActivities = [...activityLog].sort((a, b) => new Date(b.date) - new Date(a.date));
            
            entriesContainer.innerHTML = sortedActivities.map((activity, index) => {
                const instance = getInstanceById(activity.instanceId);
                const plant = instance ? getPlantById(instance.plantId) : null;
                const plantName = plant ? plant.commonName : 'Unknown Plant';
                
                let displayText = '';
                let typeIcon = '📝';
                
                if (activity.type === 'pollinator' && activity.description) {
                    typeIcon = activity.description === 'bee' ? '🐝' : activity.description === 'butterfly' ? '🦋' : '🐦';
                    displayText = `${activity.count || 1} ${activity.description}${(activity.count || 1) > 1 ? 's' : ''}`;
                } else if (activity.type === 'pest') {
                    typeIcon = '🐛';
                    displayText = activity.description || activity.message || 'Pest observation';
                } else if (activity.message) {
                    // Legacy format
                    const pollinatorMatch = activity.message.match(/(\d+)\s+(bee|butterfly|hummingbird)s?/i);
                    if (pollinatorMatch) {
                        typeIcon = pollinatorMatch[2].toLowerCase() === 'bee' ? '🐝' : pollinatorMatch[2].toLowerCase() === 'butterfly' ? '🦋' : '🐦';
                        displayText = activity.message;
                    } else {
                        displayText = activity.message;
                    }
                } else {
                    displayText = activity.description || 'Activity logged';
                }
                
                const activityDate = new Date(activity.date);
                const dateStr = activityDate.toLocaleDateString();
                const timeStr = activityDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                return `
                    <div class="bg-white border border-stone-200 rounded-lg p-4 flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <span class="text-2xl">${typeIcon}</span>
                            <div>
                                <div class="font-medium text-text-base">${plantName}</div>
                                <div class="text-sm text-text-muted">${displayText}</div>
                                <div class="text-xs text-text-muted">${dateStr} ${timeStr}</div>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button data-action="edit-activity" data-index="${activityLog.indexOf(activity)}" class="text-blue-600 hover:text-blue-800 p-1" title="Edit">
                                <i data-lucide="edit-2" class="w-4 h-4"></i>
                            </button>
                            <button data-action="delete-activity" data-index="${activityLog.indexOf(activity)}" class="text-red-600 hover:text-red-800 p-1" title="Delete">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        const heatmapContainer = view.querySelector('#heatmap-container');
        const activitySummary = {};
        const uniquePests = new Set();
        const uniquePollinators = new Set();
        
        activityLog.forEach(log => {
            let key, displayName;
            
            if (log.type === 'pollinator' && log.description) {
                // New format
                displayName = log.description.toLowerCase();
                key = `${log.instanceId}-${displayName}`;
                uniquePollinators.add(displayName);
            } else if (log.type && log.description) {
                // Other types (pest, other)
                displayName = log.description.toLowerCase();
                key = `${log.instanceId}-${displayName}`;
                if (log.type === 'pest') {
                    uniquePests.add(displayName);
                }
            } else if (log.message) {
                // Old format - try to parse
                const pollinatorMatch = log.message.match(/(?:saw|observed|spotted)\s+\d*\s*(bee|butterfly|hummingbird)s?/i);
                if (pollinatorMatch) {
                    displayName = pollinatorMatch[1].toLowerCase();
                    key = `${log.instanceId}-${displayName}`;
                    uniquePollinators.add(displayName);
                }
            }
            
            if (key) {
                if (!activitySummary[key]) activitySummary[key] = 0;
                activitySummary[key] += (log.count || 1);
            }
        });
        
        const activityTypes = [...[...uniquePollinators].sort(), ...[...uniquePests].sort()];
        if (activityTypes.length === 0) {
            heatmapContainer.innerHTML = `<p class="text-center py-8 text-text-muted">No activity logged yet.</p>`;
            return;
        }
        
        let tableHTML = `<table class="w-full text-sm text-left border-collapse"><thead class="bg-bg-base"><tr class="bg-slate-50"><th class="p-2 border border-stone-200">Plant</th>${activityTypes.map(type => `<th class="p-2 border border-stone-200 text-center capitalize">${type}</th>`).join('')}</tr></thead><tbody>`;
        myGarden.forEach(instance => {
            const plant = getPlantById(instance.plantId);
            tableHTML += `<tr class="border-t border-stone-200"><td class="p-2 border border-stone-200 font-semibold">${plant.commonName}</td>`;
            activityTypes.forEach(type => {
                const count = activitySummary[`${instance.instanceId}-${type}`] || 0;
                const isPollinator = uniquePollinators.has(type);
                const colorClass = count === 0 ? 'bg-stone-100' : (isPollinator ? `bg-emerald-${Math.min(9, count + 2)}00` : `bg-rose-${Math.min(9, count + 2)}00`);
                const textColor = count > 2 ? 'text-white' : 'text-text-base';
                tableHTML += `<td class="p-2 border border-stone-200 text-center heatmap-cell ${colorClass} ${textColor}" title="${count} sighting(s)">${count}</td>`;
            });
            tableHTML += `</tr>`;
        });
        tableHTML += `</tbody></table>`;
        heatmapContainer.innerHTML = tableHTML;
    };

    const renderHarvestLogView = () => {
        const view = mainElements.harvestLogView;
        view.innerHTML = `
            <div class="bg-surface rounded-xl shadow-md">
                <div class="p-4 border-b border-stone-200">
                    <h2 class="text-2xl font-bold text-text-base mb-4">Total Harvest Yield</h2>
                    <div id="harvest-chart-container" class="space-y-4"></div>
                </div>
                <div class="p-6">
                    <h2 class="text-2xl font-bold text-text-base mb-4">Log Harvest</h2>
                    <form id="harvest-log-form" class="space-y-4"></form>
                </div></div>`;
        
        const form = view.querySelector('#harvest-log-form');
        form.innerHTML = `
            <div><label for="harvest-plant" class="block text-sm font-medium">Plant</label><select id="harvest-plant" name="plant" class="mt-1 block w-full rounded-md border-stone-300 shadow-sm bg-surface">${myGarden.map(i => `<option value="${i.instanceId}">${getPlantById(i.plantId).commonName}</option>`).join('')}</select></div>
            <div><label for="harvest-quantity" class="block text-sm font-medium">Quantity</label><input type="text" id="harvest-quantity" name="quantity" placeholder="e.g., 5, 1.2kg" class="mt-1 block w-full rounded-md border-stone-300 shadow-sm bg-surface" required></div>
            <div><label for="harvest-notes" class="block text-sm font-medium">Notes</label><textarea id="harvest-notes" name="notes" rows="3" class="mt-1 block w-full rounded-md border-stone-300 shadow-sm bg-surface"></textarea></div>
            <div><label for="harvest-date" class="block text-sm font-medium">Date</label><input type="date" id="harvest-date" name="date" class="mt-1 block w-full rounded-md border-stone-300 shadow-sm bg-surface" required></div>
            <button type="submit" class="w-full bg-primary text-white font-semibold py-2 px-4 rounded-md hover:bg-primary/90">Save Harvest</button>`;
        form.querySelector('#harvest-date').value = dateToYMD(new Date());

        const chartContainer = view.querySelector('#harvest-chart-container');
        const harvestSummary = {};
        myGarden.forEach(instance => { harvestSummary[instance.instanceId] = { total: 0, plantName: getPlantById(instance.plantId).commonName }; });
        harvestLog.forEach(log => {
            const numericPart = parseFloat(log.quantity);
            if (harvestSummary[log.instanceId] && !isNaN(numericPart)) {
                harvestSummary[log.instanceId].total += numericPart;
            }
        });
        const chartData = Object.values(harvestSummary).filter(d => d.total > 0);
        if (chartData.length === 0) {
            chartContainer.innerHTML = `<p class="text-text-muted text-center py-8">No harvest data logged yet.</p>`;
            return;
        }
        const maxHarvest = Math.max(...chartData.map(d => d.total));
        const colors = ['bg-sky-500', 'bg-lime-500', 'bg-amber-500', 'bg-violet-500', 'bg-teal-500'];
        chartContainer.innerHTML = chartData.map((data, index) => {
            const barWidth = maxHarvest > 0 ? (data.total / maxHarvest) * 100 : 0;
            return `<div class="flex items-center gap-4"><div class="w-32 text-sm font-semibold truncate text-right">${data.plantName}</div><div class="flex-grow bg-stone-200 rounded-full h-6"><div class="chart-bar h-6 rounded-full ${colors[index % colors.length]} flex items-center justify-end pr-2 text-white font-bold" style="width: ${barWidth}%">${data.total}</div></div></div>`;
        }).join('');
    };

    const renderPestDiseaseGuideView = () => {
        const view = mainElements.pestDiseaseGuideView;
        view.innerHTML = `
            <div class="mb-4">
                <input type="text" id="pest-search-input" placeholder="Search by name..." class="w-full pl-4 pr-4 py-2 border border-stone-300 rounded-lg bg-surface focus:ring-2 focus:ring-primary/50 focus:border-primary">
            </div>
            <div class="flex items-center gap-4 mb-6">
                <label class="font-medium">Filter by type:</label>
                <div class="flex bg-stone-200 p-1 rounded-lg gap-1">
                    <button data-action="filter-pest-disease" data-type="" class="pest-filter-btn active-filter px-3 py-1 text-sm font-semibold rounded-md">All</button>
                    <button data-action="filter-pest-disease" data-type="pest" class="pest-filter-btn px-3 py-1 text-sm font-semibold rounded-md">Pests</button>
                    <button data-action="filter-pest-disease" data-type="disease" class="pest-filter-btn px-3 py-1 text-sm font-semibold rounded-md">Diseases</button>
                </div>
            </div>
            <main id="pest-disease-container" class="space-y-4"></main>
        `;

        view.querySelector('#pest-search-input').addEventListener('input', applyPestFilters);
        applyPestFilters();
    };

    const applyPestFilters = () => {
        const view = mainElements.pestDiseaseGuideView;
        if (!view || !view.querySelector('#pest-disease-container')) return;

        const container = view.querySelector('#pest-disease-container');
        const searchTerm = view.querySelector('#pest-search-input').value.toLowerCase();
        const activeFilterBtn = view.querySelector('.pest-filter-btn.active-filter');
        const type = activeFilterBtn ? activeFilterBtn.dataset.type : '';

        const filtered = pestDiseaseDatabase.filter(item => {
            return (searchTerm === '' || item.name.toLowerCase().includes(searchTerm)) &&
                   (type === '' || item.type === type);
        });

        if (filtered.length === 0) {
            container.innerHTML = `<div class="text-center py-12 bg-surface rounded-xl shadow-md"><h3 class="text-xl font-semibold">No results found.</h3></div>`;
        } else {
            container.innerHTML = filtered.map(item => `
                <div data-action="view-pest-disease" data-id="${item.id}" class="bg-surface rounded-xl shadow-md p-5 transition-all hover:shadow-lg hover:bg-stone-50 cursor-pointer flex items-center gap-4">
                    <div class="w-12 h-12 rounded-lg flex items-center justify-center ${item.type === 'pest' ? 'bg-red-100' : 'bg-green-100'}">
                         <i data-lucide="${item.type === 'pest' ? 'bug' : 'syringe'}" class="w-8 h-8 ${item.type === 'pest' ? 'text-red-600' : 'text-green-600'}"></i>
                    </div>
                    <div>
                        <h3 class="text-xl font-bold text-text-base">${item.name}</h3>
                        <p class="text-sm text-text-muted">${item.description.substring(0, 100)}...</p>
                    </div>
                </div>
            `).join('');
        }
        lucide.createIcons();
    };

    const renderIdeasView = () => {
         mainElements.ideasView.innerHTML = `<div class="bg-surface p-8 rounded-xl shadow-md space-y-4">
            <h2 class="text-3xl font-bold">All Features Implemented!</h2>
            <p>Future ideas could include weather integration, a more detailed harvest log with photos, or a public gallery to share garden progress.</p>
        </div>`;
    };
    
    const createTimelineHTML = (instance, plant) => {
        const plantedDate = formatDate(instance.plantingDate);
        if (!plantedDate || !plant) return ''; // Safety checks

        // Handle plants with missing timeline data
        const germinationEndDay = Array.isArray(plant.germinationDays) ? (plant.germinationDays[1] ?? 0) : 0;
        const maturityDay = plant.daysToMaturity ?? 0;
        
        if (germinationEndDay === 0 && maturityDay === 0) {
            return `<div class="text-sm text-text-muted italic">Timeline data not available for this plant.</div>`;
        }

        const today = new Date();
        const germEnd = addDays(plantedDate, germinationEndDay);
        const maturityEnd = addDays(plantedDate, maturityDay);
        const totalEnd = addDays(maturityEnd, 30); // Add 30 days for harvest window
        const totalDuration = (totalEnd - plantedDate) / (1000 * 60 * 60 * 24);
        
        if(totalDuration <= 0) return `<div class="text-sm text-text-muted italic">Timeline data not available for this plant.</div>`;
        
        const germWidth = (germinationEndDay / totalDuration) * 100;
        const growingWidth = ((maturityDay - germinationEndDay) / totalDuration) * 100;
        const harvestWidth = 100 - germWidth - growingWidth;
        const posToday = Math.max(0, Math.min(100, ((today - plantedDate) / (1000 * 60 * 60 * 24) / totalDuration) * 100));

        return `<div class="timeline-container"><div class="timeline-bar">
                    <div class="timeline-phase bg-yellow-500" style="left: 0%; width: ${germWidth}%" title="Germination"></div>
                    <div class="timeline-phase bg-lime-500" style="left: ${germWidth}%; width: ${growingWidth}%" title="Growing"></div>
                    <div class="timeline-phase bg-emerald-500" style="left: ${germWidth + growingWidth}%; width: ${harvestWidth}%" title="Harvest"></div>
                    ${posToday <= 100 ? `<div class="timeline-today" style="left: ${posToday}%;"></div>` : ''}
                </div></div>`;
    };

    const openModal = (content) => {
        mainElements.modalPanel.innerHTML = content;
        mainElements.modalBackdrop.classList.remove('hidden');
        lucide.createIcons();
    };

    const openPlantDetailModal = (plantOrInstance) => {
        const isInstance = 'instanceId' in plantOrInstance;
        const plant = isInstance ? getPlantById(plantOrInstance.plantId) : plantOrInstance;
        if (!plant) return;

        const content = `
            <div class="p-6 sm:p-8 flex-grow overflow-y-auto">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h2 class="text-3xl font-bold text-text-base">${plant.commonName}</h2>
                        <p class="text-lg italic text-text-muted">${plant.botanicalName}</p>
                    </div>
                    <button data-action="close-modal" class="p-2 rounded-full hover:bg-stone-100"><i data-lucide="x"></i></button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="md:col-span-2 space-y-6">
                        <div>
                            <h4 class="font-bold text-lg mb-2 text-primary">Quick Facts</h4>
                            <div class="grid grid-cols-2 gap-4 text-sm">
                                <div class="flex items-center gap-2"><i data-lucide="align-horizontal-distribute-center" class="text-accent"></i><strong>Genus:</strong> ${plant.genus || 'N/A'}</div>
                                <div class="flex items-center gap-2"><i data-lucide="book-open" class="text-accent"></i><strong>Family:</strong> ${plant.family || 'N/A'}</div>
                                <div class="flex items-center gap-2"><i data-lucide="globe-2" class="text-accent"></i><strong>Origin:</strong> ${plant.origin || 'N/A'}</div>
                                <div class="flex items-center gap-2"><i data-lucide="thermometer-sun" class="text-accent"></i><strong>Hardiness:</strong> Zone ${plant.hardinessZone || 'N/A'}</div>
                                <div class="flex items-center gap-2"><i data-lucide="ruler" class="text-accent"></i><strong>Type:</strong> ${plant.type || 'N/A'}</div>
                                <div class="flex items-center gap-2"><i data-lucide="sun" class="text-accent"></i><strong>Light:</strong> ${plant.light || 'N/A'}</div>
                            </div>
                        </div>

                        ${plant.facts ? `
                        <div>
                            <h4 class="font-bold text-lg mb-2 text-primary">Description</h4>
                            <p class="text-text-muted">${plant.facts}</p>
                        </div>
                        ` : ''}
                        
                        <div>
                            <h4 class="font-bold text-lg mb-2 text-primary">Growing Information</h4>
                             <div class="grid grid-cols-2 gap-4 text-sm">
                                <div class="flex items-center gap-2"><i data-lucide="sprout" class="text-accent"></i><strong>Germination:</strong> ${plant.germinationDays ? plant.germinationDays.join(' - ') + ' days' : 'N/A'}</div>
                                <div class="flex items-center gap-2"><i data-lucide="calendar-check" class="text-accent"></i><strong>Maturity:</strong> ${plant.daysToMaturity ? plant.daysToMaturity + ' days' : 'N/A'}</div>
                                <div class="flex items-center gap-2"><i data-lucide="droplets" class="text-accent"></i><strong>Water every:</strong> ${plant.care?.water || 'N/A'} days</div>
                                <div class="flex items-center gap-2"><i data-lucide="nutrient" class="text-accent"></i><strong>Fertilize every:</strong> ${plant.care?.fertilize || 'N/A'} days</div>
                                <div class="flex items-center gap-2"><i data-lucide="flask-conical" class="text-accent"></i><strong>Soil pH:</strong> ${plant.soilPH || 'N/A'}</div>
                                <div class="flex items-center gap-2"><i data-lucide="layers" class="text-accent"></i><strong>Soil Type:</strong> ${plant.soilType || 'N/A'}</div>
                            </div>
                        </div>

                        ${(plant.pestsDiseases || plant.growingTip) ? `
                        <div>
                            <h4 class="font-bold text-lg mb-2 text-primary">Care & Tips</h4>
                            ${plant.pestsDiseases ? `<p class="text-text-muted mb-2"><strong>Pests & Diseases:</strong> ${plant.pestsDiseases}</p>` : ''}
                            ${plant.growingTip ? `<p class="text-text-muted"><strong>Tip:</strong> ${plant.growingTip}</p>` : ''}
                        </div>
                        ` : ''}

                        <div>
                            <h4 class="font-bold text-lg mb-2 text-primary">Companions</h4>
                            <div class="text-sm">
                                <p class="text-green-600"><strong>Friends:</strong> ${plant.companions?.friends?.map(id => getPlantById(id)?.commonName || 'Unknown').join(', ') || 'None listed'}</p>
                                <p class="text-red-600"><strong>Foes:</strong> ${plant.companions?.foes?.map(id => getPlantById(id)?.commonName || 'Unknown').join(', ') || 'None listed'}</p>
                            </div>
                        </div>
                    </div>
                    <div class="md:col-span-1 bg-bg-base p-4 rounded-lg">
                        ${isInstance ? createInstanceDetailsHTML(plantOrInstance, plant) : '<h4 class="font-bold text-lg text-primary">In Your Garden</h4><p class="text-text-muted text-sm">Add this plant to your garden to start tracking.</p>'}
                    </div>
                </div>
            </div>
            ${!isInstance ? `
            <div class="p-6 bg-bg-base/50 border-t border-stone-200">
                <button data-action="add-to-garden" data-id="${plant.id}" class="w-full font-semibold text-white bg-primary hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 py-3 rounded-lg text-base"><i data-lucide="plus"></i> Add to My Garden</button>
            </div>` : ''}
        `;
        openModal(content);
    };

    const createInstanceDetailsHTML = (instance, plant) => {
        return `
            <h4 class="font-bold text-lg mb-4 text-primary">Tracking Details</h4>
            <div class="space-y-3 text-sm">
                <div><strong>Planted:</strong> ${new Date(instance.plantingDate).toLocaleDateString()}</div>
                <div><strong>Source:</strong> ${instance.source}</div>
                <div><strong>Notes:</strong></div>
                <p class="text-text-muted bg-white p-2 rounded-md">${instance.notes || 'No notes yet.'}</p>
                <div class="pt-4">
                    <h4 class="font-bold text-base mb-2 text-primary">Growth Timeline</h4>
                    ${createTimelineHTML(instance, plant)}
                </div>
                 ${instance.photo ? `
                    <div class="mt-4">
                        <h5 class="font-bold text-sm mb-2 text-primary">Photo</h5>
                        <div class="relative group">
                            <img src="${instance.photo}" alt="${plant.commonName}" class="rounded-lg shadow-md w-full h-48 object-cover cursor-pointer transition-transform hover:scale-105" onclick="this.classList.toggle('object-cover'); this.classList.toggle('object-contain'); this.classList.toggle('h-48'); this.classList.toggle('h-auto');">
                            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                                <span class="text-white opacity-0 group-hover:opacity-100 text-sm font-medium">Click to toggle view</span>
                            </div>
                        </div>
                    </div>
                 ` : ''}
            </div>
            <div class="mt-4 space-y-4">
                <div>
                    <h4 class="font-bold text-base mb-2 text-primary">Recent Activity</h4>
                    <ul class="text-sm space-y-2">
                        ${activityLog.filter(l => l.instanceId == instance.instanceId).slice(-3).reverse().map(log => {
                            let icon = 'activity';
                            let iconColor = 'text-amber-500';
                            let displayText = '';
                            
                            if (log.type === 'pollinator') {
                                icon = log.description === 'bee' ? 'bug' : 
                                      log.description === 'butterfly' ? 'flower' : 'bird';
                                iconColor = 'text-amber-500';
                                displayText = log.message || `Saw ${log.count || 1} ${log.description}${(log.count || 1) > 1 ? 's' : ''}`;
                            } else if (log.type === 'pest') {
                                icon = 'bug';
                                iconColor = 'text-red-500';
                                displayText = log.description || log.message || 'Pest observed';
                            } else {
                                displayText = log.description || log.message || 'Activity logged';
                            }
                            
                            return `
                            <li class="flex items-start gap-3 p-2 bg-white rounded-md">
                                <i data-lucide="${icon}" class="w-4 h-4 mt-1 ${iconColor}"></i>
                                <div class="flex-grow">
                                    <p>${displayText}</p>
                                    <p class="text-xs text-text-muted">${new Date(log.date).toLocaleDateString()}</p>
                                </div>
                            </li>
                            `;
                        }).join('') || '<li class="text-text-muted text-xs italic">No activity logged yet.</li>'}
                    </ul>
                </div>
                 <div>
                    <h4 class="font-bold text-base mb-2 text-primary">Harvest Log</h4>
                      <ul class="text-sm space-y-2">
                         ${harvestLog.filter(l => l.instanceId == instance.instanceId).slice(-3).reverse().map(log => `
                             <li class="flex items-center gap-3 p-2 bg-white rounded-md">
                                 <i data-lucide="shopping-basket" class="w-4 h-4 text-green-600"></i>
                                 <span class="font-semibold">${log.quantity}</span>
                                 <span class="flex-grow text-text-muted italic">${log.notes || ''}</span>
                                 <span class="text-text-muted text-xs">${new Date(log.date).toLocaleDateString()}</span>
                             </li>
                         `).join('') || '<li class="text-text-muted text-xs italic">No harvests logged yet.</li>'}
                     </ul>
                </div>
            </div>
            <div class="mt-6 flex flex-col gap-2">
                 <button data-action="log-activity" data-id="${instance.instanceId}" class="w-full text-sm font-semibold text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-2 py-2 rounded-md border border-primary"><i data-lucide="bug-play"></i> Log Activity</button>
                 <button data-action="log-harvest" data-id="${instance.instanceId}" class="w-full text-sm font-semibold text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-2 py-2 rounded-md border border-primary"><i data-lucide="line-chart"></i> Log Harvest</button>
                 <button data-action="edit-instance" data-id="${instance.instanceId}" class="w-full text-sm font-semibold text-text-muted hover:bg-stone-200 transition-colors flex items-center justify-center gap-2 py-2 rounded-md mt-2"><i data-lucide="pencil"></i> Edit Details</button>
            </div>
        `;
    }

    const openAddToGardenModal = (plantId) => {
        const plant = getPlantById(plantId);
        if (!plant) {
            console.error('Plant not found:', plantId);
            return;
        }
        const content = `
            <div class="p-6">
                <h2 class="text-2xl font-bold mb-4">Add ${plant.commonName} to Garden</h2>
                <form data-id="${plantId}" class="space-y-4">
                    <div>
                        <label for="planting-date" class="block text-sm font-medium text-text-muted">Planting Date</label>
                        <input type="date" id="planting-date" class="mt-1 block w-full input-field" required>
                    </div>
                    <div>
                        <label for="source" class="block text-sm font-medium text-text-muted">Source</label>
                        <input type="text" id="source" placeholder="e.g., Home Depot, Seeds from friend, etc." class="mt-1 block w-full input-field">
                    </div>
                    <div>
                        <label for="notes" class="block text-sm font-medium text-text-muted">Notes</label>
                        <textarea id="notes" rows="3" placeholder="Any special notes about this plant..." class="mt-1 block w-full input-field"></textarea>
                    </div>
                    <div>
                        <label for="photo-upload" class="block text-sm font-medium text-text-muted">Photo</label>
                        <input type="file" id="photo-upload" accept="image/*" class="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20">
                    </div>
                </form>
            </div>
            <div class="p-4 bg-bg-base/50 flex justify-end gap-3 border-t border-stone-200">
                <button type="button" data-action="close-modal" class="px-4 py-2 rounded-lg text-text-muted hover:bg-stone-200">Cancel</button>
                <button type="submit" data-action="confirm-add-to-garden" class="px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90">Add to Garden</button>
            </div>
        `;
        openModal(content);
        // Set default date after modal is opened
        setTimeout(() => {
            const dateInput = document.getElementById('planting-date');
            if (dateInput) {
                dateInput.value = dateToYMD(new Date());
            }
        }, 0);
    };

    const fetchAndRenderWeather = () => {
        const weatherWidget = document.getElementById('weather-content');
        if (!weatherWidget) return;

        const renderWeather = (data) => {
            const { current, daily } = data;
            const weatherCodeMap = {
                0: { icon: 'sun', text: 'Clear sky' }, 1: { icon: 'cloud-sun', text: 'Mainly clear' }, 2: { icon: 'cloud', text: 'Partly cloudy' }, 3: { icon: 'cloudy', text: 'Overcast' },
                45: { icon: 'cloud-fog', text: 'Fog' }, 48: { icon: 'cloud-fog', text: 'Depositing rime fog' },
                51: { icon: 'cloud-drizzle', text: 'Light drizzle' }, 53: { icon: 'cloud-drizzle', text: 'Drizzle' }, 55: { icon: 'cloud-drizzle', text: 'Dense drizzle' },
                61: { icon: 'cloud-rain', text: 'Slight rain' }, 63: { icon: 'cloud-rain', text: 'Rain' }, 65: { icon: 'cloud-rain', text: 'Heavy rain' },
                71: { icon: 'cloud-snow', text: 'Slight snow' }, 73: { icon: 'cloud-snow', text: 'Snow' }, 75: { icon: 'cloud-snow', text: 'Heavy snow' },
                80: { icon: 'cloud-rain', text: 'Slight rain showers' }, 81: { icon: 'cloud-rain', text: 'Rain showers' }, 82: { icon: 'cloud-rain', text: 'Violent rain showers' },
                95: { icon: 'wind', text: 'Thunderstorm' }, 96: { icon: 'wind', text: 'Thunderstorm, slight hail' }, 99: { icon: 'wind', text: 'Thunderstorm, heavy hail' }
            };
            const todayWeather = weatherCodeMap[current.weather_code] || { icon: 'sun', text: 'Good' };

            weatherWidget.innerHTML = `
                <div class="flex items-center gap-4 mb-6 pb-6 border-b border-stone-200">
                    <i data-lucide="${todayWeather.icon}" class="w-16 h-16 text-accent"></i>
                    <div class="flex-grow">
                        <p class="text-4xl font-bold">${Math.round(current.temperature_2m)}°F</p>
                        <p class="text-text-muted">${todayWeather.text}</p>
                    </div>
                    <div class="text-sm text-right space-y-1">
                        <p><strong>High:</strong> ${Math.round(daily.temperature_2m_max[0])}°F / <strong>Low:</strong> ${Math.round(daily.temperature_2m_min[0])}°F</p>
                        <p><strong>Precipitation:</strong> ${daily.precipitation_sum[0]} in</p>
                        ${daily.temperature_2m_min[0] <= 32 ? `<p class="font-bold text-blue-500 flex items-center justify-end gap-1"><i data-lucide="snowflake"></i> Frost Warning!</p>` : ''}
                    </div>
                </div>
                <div class="grid grid-cols-7 gap-2 text-center">
                    ${daily.time.map((day, i) => `
                        <div class="p-2 rounded-lg bg-bg-base/60">
                            <p class="font-bold text-sm">${new Date(day + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}</p>
                            <i data-lucide="${weatherCodeMap[daily.weather_code[i]]?.icon || 'sun'}" class="w-8 h-8 mx-auto my-2 text-primary"></i>
                            <p class="text-sm"><strong>${Math.round(daily.temperature_2m_max[i])}°</strong></p>
                            <p class="text-xs text-text-muted">${Math.round(daily.temperature_2m_min[i])}°</p>
                        </div>
                    `).join('')}
                </div>
            `;
            lucide.createIcons();
        };

        const locationSuccess = async (position) => {
            const { latitude, longitude } = position.coords;
            const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=auto`;
            try {
                const response = await fetch(apiUrl);
                if (!response.ok) throw new Error('Weather data not available from API.');
                const data = await response.json();
                renderWeather(data);
                lastWeatherData = data; // store for manual generation
            } catch (error) {
                weatherWidget.innerHTML = `<p class="text-text-muted">Could not fetch weather data. ${error.message}</p>`;
            }
        };

        const locationError = () => {
            weatherWidget.innerHTML = '<p class="text-text-muted">Could not get your location. Please enable location services in your browser to see local weather.</p>';
        };

        navigator.geolocation.getCurrentPosition(locationSuccess, locationError);
    };

    const generateAIRecommendations = (weatherData) => {
        console.log('generateAIRecommendations called with:', weatherData);

        // --- GPT-4o powered recommendations ---
        if (OPENAI_API_KEY && OPENAI_API_KEY !== "PASTE_YOUR_OPENAI_API_KEY_HERE" && !generateAIRecommendations.__usingFallback) {
            const container = document.getElementById('ai-content');
            if (container) {
                container.innerHTML = `<div class="flex items-center gap-2 text-text-muted"><div class="loader"></div><span>Generating smart recommendations...</span></div>`;
            }

            (async () => {
                try {
                    const today = new Date();
                    const todayStr = dateToYMD(today);

                    // Build comprehensive context for the LLM including all notes and activity history
                    const plantSummaries = myGarden.map(instance => {
                        const plant = getPlantById(instance.plantId);
                        if (!plant) return null;
                        
                        // Get plant age
                        const plantingDate = new Date(instance.plantingDate);
                        const ageInDays = Math.floor((today - plantingDate) / (1000 * 60 * 60 * 24));
                        
                        // Get all notes for this plant
                        const notes = instance.notes ? `Notes: ${instance.notes}` : '';
                        
                        // Get recent activity log entries for this plant (last 30 days)
                        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                        const recentActivities = activityLog
                            .filter(activity => activity.instanceId === instance.instanceId)
                            .filter(activity => new Date(activity.date) >= thirtyDaysAgo)
                            .map(activity => {
                                const activityDate = new Date(activity.date).toLocaleDateString();
                                if (activity.type === 'pollinator') {
                                    return `${activityDate}: ${activity.count || 1} ${activity.description || 'pollinator'}(s) observed`;
                                } else if (activity.type === 'pest') {
                                    return `${activityDate}: ${activity.description || activity.message}`;
                                } else {
                                    return `${activityDate}: ${activity.message || activity.description}`;
                                }
                            });
                        
                        // Get harvest history for this plant
                        const harvests = harvestLog
                            .filter(harvest => harvest.instanceId === instance.instanceId)
                            .map(harvest => `${harvest.date}: harvested ${harvest.quantity}${harvest.unit ? ' ' + harvest.unit : ''}`);
                        
                        let summary = `${plant.commonName} (${plant.category}, planted ${dateToYMD(plantingDate)}, ${ageInDays} days old)`;
                        if (plant.daysToMaturity) {
                            const daysToMaturity = plant.daysToMaturity - ageInDays;
                            if (daysToMaturity > 0) {
                                summary += `, ${daysToMaturity} days until maturity`;
                            } else {
                                summary += `, ready for harvest (${Math.abs(daysToMaturity)} days overdue)`;
                            }
                        }
                        
                        if (notes) summary += `. ${notes}`;
                        if (recentActivities.length > 0) {
                            summary += `. Recent activity: ${recentActivities.join('; ')}`;
                        }
                        if (harvests.length > 0) {
                            summary += `. Harvest history: ${harvests.slice(-3).join('; ')}`;
                        }
                        
                        return summary;
                    }).filter(Boolean).join('\n');

                    let weatherSummary = 'Weather forecast unavailable.';
                    if (weatherData && weatherData.daily) {
                        const maxTemp = weatherData.daily.temperature_2m_max?.[0] ?? null;
                        const minTemp = weatherData.daily.temperature_2m_min?.[0] ?? null;
                        const precipitation = weatherData.daily.precipitation_sum?.[0] ?? 0;
                        const windSpeed = weatherData.daily.windspeed_10m_max?.[0] ?? 0;
                        weatherSummary = `High ${Math.round(maxTemp)}°F, low ${Math.round(minTemp)}°F, precipitation ${precipitation.toFixed(1)}\", wind ${Math.round(windSpeed)} mph.`;
                    }

                    const prompt = `# Garden Assessment Report - ${todayStr}

## Current Weather Conditions
${weatherSummary}

## Garden Inventory & Plant Status
${plantSummaries}

## Task: Generate Personalized Garden Recommendations

As an expert gardening consultant, analyze the above data and provide 4-6 prioritized, actionable recommendations for the next 2-3 days. 

### Analysis Framework:
1. **Urgency Assessment**: Identify time-sensitive tasks (overdue care, harvest windows, weather threats)
2. **Plant Health**: Address any pest/disease issues or stress indicators mentioned in notes
3. **Growth Stage Optimization**: Recommend stage-appropriate care (seedling vs mature plant needs)
4. **Environmental Factors**: Weather-appropriate actions and seasonal considerations
5. **Efficiency**: Group related tasks and suggest optimal timing

### Output Requirements:
- Start each recommendation with a relevant emoji
- Prioritize by urgency (most critical first)
- Be specific about timing ("today", "within 2 days", etc.)
- Include plant names when relevant
- Limit each recommendation to 25 words maximum
- Focus on actionable tasks, not general advice

### Context Awareness:
- Consider plant maturity stages and days to harvest
- Factor in recent weather patterns and forecast
- Address any specific concerns mentioned in plant notes
- Account for pollinator activity patterns if relevant`;

                    const response = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${OPENAI_API_KEY}`
                        },
                        body: JSON.stringify({
                            model: 'gpt-4.1-nano',
                            messages: [
                                { role: 'system', content: 'You are an expert gardening consultant with 20+ years of experience. You excel at analyzing complex garden data, prioritizing tasks by urgency, and providing precise, actionable recommendations. Your advice is always practical, time-specific, and tailored to each plant\'s unique needs and growth stage.' },
                                { role: 'user', content: prompt }
                            ],
                            max_tokens: 500,
                            temperature: 0.7
                        })
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        console.error('OpenAI API error:', errorData);
                        throw new Error(`OpenAI API error: ${response.status} ${errorData.error?.message || response.statusText}`);
                    }

                    const result = await response.json();
                    const text = result.choices[0].message.content.trim();
                    const lines = text.split('\n').filter(l => l.trim() !== '');

                    if (container) {
                        container.innerHTML = lines.map(line => `
                            <div class="flex items-start gap-3 p-3 rounded-lg border bg-bg-base/60 border-stone-200 mb-2">
                                <p class="text-sm text-text-muted">${line}</p>
                            </div>`).join('');
                        lucide.createIcons();
                    }
                } catch (error) {
                    console.error('GPT-4o recommendations failed:', error);
                    if (container) {
                        container.innerHTML = `<p class="text-red-500 text-sm">AI service error: ${error.message}. Showing local suggestions instead.</p>`;
                    }
                    // Trigger fallback once
                    generateAIRecommendations.__usingFallback = true;
                    generateAIRecommendations(weatherData);
                }
            })();
            return; // prevent execution of local algorithm when GPT generation succeeds/attempts
        }

        // --- LOCAL FALLBACK ALGORITHM ---
        const recommendations = [];
        const today = new Date();
        const todayStr = dateToYMD(today);

        // Helper functions for personalized analysis
        const getPlantAge = (plantingDate) => {
            const planted = new Date(plantingDate);
            return Math.floor((today - planted) / (1000 * 60 * 60 * 24));
        };

        const getNextCareDate = (plantingDate, careInterval) => {
            if (!careInterval || careInterval <= 0) return null;
            let nextDate = new Date(plantingDate);
            while (nextDate <= today) {
                nextDate = addDays(nextDate, careInterval);
            }
            return nextDate;
        };

        const getDaysUntil = (date) => {
            return Math.ceil((date - today) / (1000 * 60 * 60 * 24));
        };

        // 1. IMMEDIATE CARE TASKS - High Priority
        const urgentTasks = [];
        const upcomingTasks = [];
        
        myGarden.forEach(instance => {
            const plant = getPlantById(instance.plantId);
            if (!plant || !plant.care) return;
            
            const age = getPlantAge(instance.plantingDate);
            const plantName = plant.commonName;

            // Water reminders
            if (plant.care.water > 0) {
                const nextWater = getNextCareDate(instance.plantingDate, plant.care.water);
                const daysUntilWater = getDaysUntil(nextWater);
                
                if (daysUntilWater <= 0) {
                    urgentTasks.push({
                        icon: 'droplets',
                        text: `<strong class="text-red-600">Water ${plantName} today!</strong> Last watered ${Math.abs(daysUntilWater)} days ago.`,
                        priority: 'urgent',
                        plantId: instance.instanceId
                    });
                } else if (daysUntilWater <= 2) {
                    upcomingTasks.push({
                        icon: 'droplets',
                        text: `Water ${plantName} in ${daysUntilWater} day${daysUntilWater > 1 ? 's' : ''}.`,
                        priority: 'upcoming'
                    });
                }
            }

            // Fertilizer reminders
            if (plant.care.fertilize > 0) {
                const nextFertilize = getNextCareDate(instance.plantingDate, plant.care.fertilize);
                const daysUntilFertilize = getDaysUntil(nextFertilize);
                
                if (daysUntilFertilize <= 0) {
                    urgentTasks.push({
                        icon: 'leaf',
                        text: `<strong class="text-amber-600">Fertilize ${plantName} today!</strong> Last fertilized ${Math.abs(daysUntilFertilize)} days ago.`,
                        priority: 'urgent',
                        plantId: instance.instanceId
                    });
                } else if (daysUntilFertilize <= 3) {
                    upcomingTasks.push({
                        icon: 'leaf',
                        text: `Fertilize ${plantName} in ${daysUntilFertilize} day${daysUntilFertilize > 1 ? 's' : ''}.`,
                        priority: 'upcoming'
                    });
                }
            }
        });

        // 2. HARVEST OPPORTUNITIES
        const harvestReady = [];
        myGarden.forEach(instance => {
            const plant = getPlantById(instance.plantId);
            if (!plant || !plant.daysToMaturity) return;
            
            const age = getPlantAge(instance.plantingDate);
            const daysToMaturity = plant.daysToMaturity;
            
            if (age >= daysToMaturity) {
                const daysOverdue = age - daysToMaturity;
                harvestReady.push({
                    icon: 'apple',
                    text: `<strong class="text-green-600">${plant.commonName} is ready to harvest!</strong> ${daysOverdue > 7 ? `Planted ${age} days ago - don't wait too long!` : `Perfect timing for harvest.`}`,
                    priority: 'harvest',
                    plantId: instance.instanceId
                });
            } else if (age >= daysToMaturity - 7) {
                const daysLeft = daysToMaturity - age;
                harvestReady.push({
                    icon: 'clock',
                    text: `${plant.commonName} will be ready to harvest in ${daysLeft} day${daysLeft > 1 ? 's' : ''}!`,
                    priority: 'soon'
                });
            }
        });

        // 3. WEATHER-BASED CARE ADVICE
        const weatherAdvice = [];
        if (weatherData && weatherData.daily) {
            const maxTemp = weatherData.daily.temperature_2m_max?.[0] ?? null;
            const minTemp = weatherData.daily.temperature_2m_min?.[0] ?? null;
            const precipitation = weatherData.daily.precipitation_sum?.[0] ?? 0;
            const windSpeed = weatherData.daily.windspeed_10m_max?.[0] ?? 0;

            // Heat stress warnings
            if (maxTemp > 90) {
                const heatSensitive = myGarden.filter(instance => {
                    const plant = getPlantById(instance.plantId);
                    return plant && (plant.specialFeatures?.includes('Cool Weather') || 
                           plant.category === 'Herb' || plant.commonName.toLowerCase().includes('lettuce'));
                });
                
                if (heatSensitive.length > 0) {
                    weatherAdvice.push({
                        icon: 'thermometer-sun',
                        text: `<strong class="text-red-600">Extreme heat warning!</strong> Provide shade for ${heatSensitive.map(i => getPlantById(i.plantId).commonName).join(', ')}. Water early morning or evening.`,
                        priority: 'urgent'
                    });
                }
            } else if (maxTemp > 85) {
                weatherAdvice.push({
                    icon: 'thermometer-sun',
                    text: `Hot day ahead (${Math.round(maxTemp)}°F)! Check soil moisture of container plants and provide extra water if needed.`,
                    priority: 'weather'
                });
            }

            // Frost warnings
            if (minTemp <= 35) {
                const frostSensitive = myGarden.filter(instance => {
                    const plant = getPlantById(instance.plantId);
                    return plant && (plant.type === 'Annual' || plant.category === 'Herb' || 
                           plant.specialFeatures?.includes('Heat Lover'));
                });
                
                if (frostSensitive.length > 0) {
                    weatherAdvice.push({
                        icon: 'snowflake',
                        text: `<strong class="text-blue-600">Frost risk tonight (${Math.round(minTemp)}°F)!</strong> Cover or bring indoors: ${frostSensitive.map(i => getPlantById(i.plantId).commonName).join(', ')}.`,
                        priority: 'urgent'
                    });
                }
            }

            // Rain adjustments
            if (precipitation > 0.5) {
                weatherAdvice.push({
                    icon: 'cloud-rain',
                    text: `${precipitation > 1 ? 'Heavy rain' : 'Rain'} expected (${precipitation.toFixed(1)}")! Skip watering today and check for drainage issues.`,
                    priority: 'weather'
                });
            }

            // Wind warnings
            if (windSpeed > 25) {
                const tallPlants = myGarden.filter(instance => {
                    const plant = getPlantById(instance.plantId);
                    return plant && (plant.specialFeatures?.includes('Tall') || 
                           plant.commonName.toLowerCase().includes('tomato') ||
                           plant.commonName.toLowerCase().includes('dahlia'));
                });
                
                if (tallPlants.length > 0) {
                    weatherAdvice.push({
                        icon: 'wind',
                        text: `Strong winds expected (${Math.round(windSpeed)} mph)! Check stakes and supports for ${tallPlants.map(i => getPlantById(i.plantId).commonName).join(', ')}.`,
                        priority: 'weather'
                    });
                }
            }
        }

        // Combine all recommendations with priority
        const allRecommendations = [
            ...urgentTasks,
            ...harvestReady,
            ...weatherAdvice,
            ...upcomingTasks.slice(0, 2), // Limit upcoming tasks
        ];

        // Render recommendations
        const container = document.getElementById('ai-content');
        if (container) {
            if (allRecommendations.length > 0) {
                // Sort by priority and take top 4
                const priorityOrder = { urgent: 1, harvest: 2, weather: 3, upcoming: 4, soon: 5, suggestion: 6, maintenance: 7 };
                const sortedRecs = allRecommendations
                    .sort((a, b) => (priorityOrder[a.priority] || 10) - (priorityOrder[b.priority] || 10))
                    .slice(0, 4);

                container.innerHTML = sortedRecs.map(rec => {
                    const bgColor = rec.priority === 'urgent' ? 'bg-red-50 border-red-200' :
                                   rec.priority === 'harvest' ? 'bg-green-50 border-green-200' :
                                   rec.priority === 'weather' ? 'bg-blue-50 border-blue-200' :
                                   'bg-bg-base/60 border-stone-200';
                    
                    return `
                        <div class="flex items-start gap-3 p-3 rounded-lg border ${bgColor} mb-2">
                            <i data-lucide="${rec.icon}" class="w-5 h-5 text-primary mt-1 shrink-0"></i>
                            <p class="text-sm text-text-muted">${rec.text}</p>
                        </div>
                    `;
                }).join('');
            } else if (myGarden.length === 0) {
                container.innerHTML = `
                    <div class="flex items-start gap-3 p-3 rounded-lg bg-bg-base/60 mb-2">
                        <i data-lucide="sprout" class="w-5 h-5 text-primary mt-1 shrink-0"></i>
                        <p class="text-sm text-text-muted">Your garden is empty! Explore the <strong class="text-primary">Database</strong> to find your first plant and start your gardening journey.</p>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border-amber-200 mb-2">
                        <i data-lucide="sparkles" class="w-5 h-5 text-amber-600 mt-1 shrink-0"></i>
                        <p class="text-sm text-text-muted">Add your OpenAI API key in <strong class="text-primary">app.js</strong> or the Settings panel to unlock personalized AI recommendations.</p>
                    </div>
                `;
            }
            lucide.createIcons();
        }
    };

    const checkAndSendNotifications = () => {
        if ('Notification' in window && Notification.permission === 'granted') {
            const todayStr = dateToYMD(new Date());
            const dueTasks = [];
            myGarden.forEach(instance => {
                const plant = getPlantById(instance.plantId);
                if (!plant || !plant.care) return; // Safety check
                const pDate = formatDate(instance.plantingDate);

                if (plant.care.water > 0) {
                    let nextWaterDate = new Date(pDate);
                    while (nextWaterDate <= new Date()) {
                        if (dateToYMD(nextWaterDate) === todayStr) {
                            dueTasks.push(`Water ${plant.commonName}`);
                            break;
                        }
                        nextWaterDate = addDays(nextWaterDate, plant.care.water);
                    }
                }
                if (plant.care.fertilize > 0) {
                     let nextFertilizeDate = new Date(pDate);
                     while (nextFertilizeDate <= new Date()) {
                        if (dateToYMD(nextFertilizeDate) === todayStr) {
                            dueTasks.push(`Fertilize ${plant.commonName}`);
                            break;
                        }
                        nextFertilizeDate = addDays(nextFertilizeDate, plant.care.fertilize);
                    }
                }
            });

            if (dueTasks.length > 0) {
                const notificationBody = dueTasks.join('\n');
                new Notification('Garden Tasks for Today', {
                    body: notificationBody,
                    icon: './icon.png' // You would need to add an icon file to your project
                });
            }
        }
    };

    // --- EVENT HANDLERS ---
    const handleAppClick = (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const { action, id } = target.dataset;
        console.log('handleAppClick called with action:', action, 'id:', id);

        
        switch (action) {
            case 'navigate':
                appState.currentView = id;
                renderAll();
                break;
            case 'close-modal':
                mainElements.modalBackdrop.classList.add('hidden');
                break;
            case 'view-plant-details':
                // First try to get as instance (for My Garden cards)
                let plantInstance = getInstanceById(id);
                if (plantInstance) {
                    // This is an instance from My Garden
                    const plantData = getPlantById(plantInstance.plantId);
                    if (plantData) openPlantDetailModal(plantInstance);
                } else {
                    // This is a direct plant ID (from Database)
                    const plantData = getPlantById(id);
                    if (plantData) openPlantDetailModal(plantData);
                }
                break;
            case 'add-to-garden':
                openAddToGardenModal(id);
                break;
            case 'confirm-add-to-garden':
                e.preventDefault();
                (async () => {
                    const form = document.querySelector('form[data-id]');
                    const plantId = form.dataset.id;
                    const plantingDate = form.querySelector('#planting-date').value;
                    const source = form.querySelector('#source').value;
                    const notes = form.querySelector('#notes').value;
                    const photoFile = form.querySelector('#photo-upload').files[0];
                    
                    console.log('Adding plant to garden:', { plantId, plantingDate, source, notes, hasPhoto: !!photoFile });
                    
                    if (!plantingDate) {
                        alert('Please select a planting date.');
                        return;
                    }
                    
                    const newInstance = {
                        instanceId: `instance_${Date.now()}`,
                        plantId: plantId,
                        plantingDate: plantingDate,
                        source: source || '',
                        notes: notes || ''
                    };

                    if (photoFile) {
                        console.log('Processing photo file:', photoFile.name, 'Size:', photoFile.size);
                        try {
                            const compressedPhoto = await compressImage(photoFile);
                            newInstance.photo = compressedPhoto;
                            console.log('Compressed photo data URL length:', compressedPhoto.length);
                            myGarden.push(newInstance);
                            console.log('New instance added with photo:', { ...newInstance, photo: '[Photo Data]' });
                            console.log('My garden now has:', myGarden.length, 'plants');
                            saveData();
                            renderAll();
                            mainElements.modalBackdrop.classList.add('hidden');
                        } catch (error) {
                            console.error('Error processing photo:', error);
                            alert('Error processing photo. Adding plant without photo.');
                            myGarden.push(newInstance);
                            saveData();
                            renderAll();
                            mainElements.modalBackdrop.classList.add('hidden');
                        }
                    } else {
                        myGarden.push(newInstance);
                        console.log('New instance added:', newInstance);
                        console.log('My garden now has:', myGarden.length, 'plants');
                        saveData();
                        renderAll();
                        mainElements.modalBackdrop.classList.add('hidden');
                    }
                })();
                break;
            case 'remove-from-garden':
                if (confirm('Are you sure you want to remove this plant from your garden?')) {
                    const instanceToRemove = getInstanceById(id);
                    if (instanceToRemove) {
                        const plantToRemove = getPlantById(instanceToRemove.plantId);
                        myGarden = myGarden.filter(p => p.instanceId !== id);
                        delete gardenLayout.plants[id];
                        logActivity(id, `Removed ${plantToRemove.commonName} from the garden.`);
                        saveData();
                        renderAll();
                    }
                }
                break;
            case 'edit-instance':
                openEditInstanceModal(id);
                break;
            case 'confirm-edit-instance':
                {
                    const form = target.closest('form');
                    
                    if (!form) {
                        const modalForm = document.querySelector('#modal-panel form[data-id]');
                        if (modalForm) {
                            const instanceId = modalForm.dataset.id;
                            const instanceToUpdate = getInstanceById(instanceId);
                            
                            if (instanceToUpdate) {
                                // Update instance-specific fields
                                instanceToUpdate.plantingDate = modalForm.querySelector('#edit-planting-date').value;
                                instanceToUpdate.notes = modalForm.querySelector('#edit-notes').value;
                                instanceToUpdate.source = modalForm.querySelector('#edit-source').value;
                                
                                // Update plant information
                                const plantToUpdate = getPlantById(instanceToUpdate.plantId);
                                if (plantToUpdate) {
                                    // Basic plant info
                                    plantToUpdate.commonName = modalForm.querySelector('#edit-common-name').value;
                                    plantToUpdate.botanicalName = modalForm.querySelector('#edit-botanical-name').value;
                                    plantToUpdate.genus = modalForm.querySelector('#edit-genus').value;
                                    plantToUpdate.family = modalForm.querySelector('#edit-family').value;
                                    plantToUpdate.origin = modalForm.querySelector('#edit-origin').value;
                                    plantToUpdate.category = modalForm.querySelector('#edit-category').value;
                                    plantToUpdate.type = modalForm.querySelector('#edit-type').value;
                                    plantToUpdate.light = modalForm.querySelector('#edit-light').value;
                                    
                                    // Growing information
                                    const germinationMin = parseInt(modalForm.querySelector('#edit-germination-min').value) || 0;
                                    const germinationMax = parseInt(modalForm.querySelector('#edit-germination-max').value) || 0;
                                    if (germinationMin || germinationMax) {
                                        plantToUpdate.germinationDays = [germinationMin, germinationMax];
                                    }
                                    
                                    plantToUpdate.daysToMaturity = parseInt(modalForm.querySelector('#edit-days-to-maturity').value) || 0;
                                    
                                    // Care information
                                    if (!plantToUpdate.care) plantToUpdate.care = {};
                                    plantToUpdate.care.water = parseInt(modalForm.querySelector('#edit-water-frequency').value) || 0;
                                    plantToUpdate.care.fertilize = parseInt(modalForm.querySelector('#edit-fertilize-frequency').value) || 0;
                                    
                                    // Environmental info
                                    plantToUpdate.hardinessZone = modalForm.querySelector('#edit-hardiness-zone').value;
                                    plantToUpdate.soilType = modalForm.querySelector('#edit-soil-type').value;
                                    plantToUpdate.soilPH = modalForm.querySelector('#edit-soil-ph').value;
                                    plantToUpdate.bloomColor = modalForm.querySelector('#edit-bloom-color').value;
                                    plantToUpdate.bloomSeason = modalForm.querySelector('#edit-bloom-season').value;
                                    plantToUpdate.pollinatorType = modalForm.querySelector('#edit-pollinator-type').value;
                                    
                                    // Descriptive info
                                    plantToUpdate.facts = modalForm.querySelector('#edit-facts').value;
                                    plantToUpdate.pestsDiseases = modalForm.querySelector('#edit-pests-diseases').value;
                                    plantToUpdate.growingTip = modalForm.querySelector('#edit-growing-tip').value;
                                    
                                    // Special features (convert comma-separated string to array)
                                    const specialFeaturesText = modalForm.querySelector('#edit-special-features').value;
                                    if (specialFeaturesText.trim()) {
                                        plantToUpdate.specialFeatures = specialFeaturesText.split(',').map(feature => feature.trim()).filter(feature => feature);
                                    } else {
                                        plantToUpdate.specialFeatures = [];
                                    }
                                }
                                
                                const photoFile = modalForm.querySelector('#edit-photo-upload').files[0];
                                if (photoFile) {
                                    // Use async/await pattern for photo compression
                                    (async () => {
                                        try {
                                            const compressedPhoto = await compressImage(photoFile);
                                            instanceToUpdate.photo = compressedPhoto;
                                            saveData();
                                            renderAll();
                                            mainElements.modalBackdrop.classList.add('hidden');
                                        } catch (error) {
                                            console.error('Error processing photo:', error);
                                            alert('Error processing photo. Changes saved without photo update.');
                                            saveData();
                                            renderAll();
                                            mainElements.modalBackdrop.classList.add('hidden');
                                        }
                                    })();
                                } else {
                                    saveData();
                                    renderAll();
                                    mainElements.modalBackdrop.classList.add('hidden');
                                }
                            }
                        }
                        return;
                    }
                    
                    const instanceId = form.dataset.id;
                    const instanceToUpdate = getInstanceById(instanceId);
                    
                    if (instanceToUpdate) {
                        // Update instance-specific fields
                        instanceToUpdate.plantingDate = form.querySelector('#edit-planting-date').value;
                        instanceToUpdate.notes = form.querySelector('#edit-notes').value;
                        instanceToUpdate.source = form.querySelector('#edit-source').value;
                        
                        // Update plant information
                        const plantToUpdate = getPlantById(instanceToUpdate.plantId);
                        if (plantToUpdate) {
                            // Basic plant info
                            plantToUpdate.commonName = form.querySelector('#edit-common-name').value;
                            plantToUpdate.botanicalName = form.querySelector('#edit-botanical-name').value;
                            plantToUpdate.genus = form.querySelector('#edit-genus').value;
                            plantToUpdate.family = form.querySelector('#edit-family').value;
                            plantToUpdate.origin = form.querySelector('#edit-origin').value;
                            plantToUpdate.category = form.querySelector('#edit-category').value;
                            plantToUpdate.type = form.querySelector('#edit-type').value;
                            plantToUpdate.light = form.querySelector('#edit-light').value;
                            
                            // Growing information
                            const germinationMin = parseInt(form.querySelector('#edit-germination-min').value) || 0;
                            const germinationMax = parseInt(form.querySelector('#edit-germination-max').value) || 0;
                            if (germinationMin || germinationMax) {
                                plantToUpdate.germinationDays = [germinationMin, germinationMax];
                            }
                            
                            plantToUpdate.daysToMaturity = parseInt(form.querySelector('#edit-days-to-maturity').value) || 0;
                            
                            // Care information
                            if (!plantToUpdate.care) plantToUpdate.care = {};
                            plantToUpdate.care.water = parseInt(form.querySelector('#edit-water-frequency').value) || 0;
                            plantToUpdate.care.fertilize = parseInt(form.querySelector('#edit-fertilize-frequency').value) || 0;
                            
                            // Environmental info
                            plantToUpdate.hardinessZone = form.querySelector('#edit-hardiness-zone').value;
                            plantToUpdate.soilType = form.querySelector('#edit-soil-type').value;
                            plantToUpdate.soilPH = form.querySelector('#edit-soil-ph').value;
                            plantToUpdate.bloomColor = form.querySelector('#edit-bloom-color').value;
                            plantToUpdate.bloomSeason = form.querySelector('#edit-bloom-season').value;
                            plantToUpdate.pollinatorType = form.querySelector('#edit-pollinator-type').value;
                            
                            // Descriptive info
                            plantToUpdate.facts = form.querySelector('#edit-facts').value;
                            plantToUpdate.pestsDiseases = form.querySelector('#edit-pests-diseases').value;
                            plantToUpdate.growingTip = form.querySelector('#edit-growing-tip').value;
                            
                            // Special features (convert comma-separated string to array)
                            const specialFeaturesText = form.querySelector('#edit-special-features').value;
                            if (specialFeaturesText.trim()) {
                                plantToUpdate.specialFeatures = specialFeaturesText.split(',').map(feature => feature.trim()).filter(feature => feature);
                            } else {
                                plantToUpdate.specialFeatures = [];
                            }
                        }
                        
                        const photoFile = form.querySelector('#edit-photo-upload').files[0];
                        if (photoFile) {
                            // Use async/await pattern for photo compression
                            (async () => {
                                try {
                                    const compressedPhoto = await compressImage(photoFile);
                                    instanceToUpdate.photo = compressedPhoto;
                                    saveData();
                                    renderAll();
                                    mainElements.modalBackdrop.classList.add('hidden');
                                } catch (error) {
                                    console.error('Error processing photo:', error);
                                    alert('Error processing photo. Changes saved without photo update.');
                                    saveData();
                                    renderAll();
                                    mainElements.modalBackdrop.classList.add('hidden');
                                }
                            })();
                        } else {
                            saveData();
                            renderAll();
                            mainElements.modalBackdrop.classList.add('hidden');
                        }
                    }
                }
                break;
            case 'create-plant':
                openCreatePlantModal();
                break;
            case 'drag-plant':
                appState.draggedPlant = getInstanceById(target.dataset.instanceId);
                break;
            case 'select-layout-plant':
                appState.selectedLayoutPlant = appState.selectedLayoutPlant == target.dataset.instanceId ? null : target.dataset.instanceId;
                renderLayoutView();
                lucide.createIcons();
                break;
            case 'show-companion-details':
                const plant1 = getPlantById(target.dataset.p1);
                const plant2 = getPlantById(target.dataset.p2);
                let detail = `${plant1.commonName} and ${plant2.commonName} are neutral.`;
                if (plant1.companions.friends.includes(parseInt(target.dataset.p2))) detail = `${plant1.commonName} helps ${plant2.commonName}. They are good neighbors!`;
                if (plant1.companions.foes.includes(parseInt(target.dataset.p2))) detail = `${plant1.commonName} and ${plant2.commonName} hinder each other. Plant them apart.`;
                if (target.dataset.p1 === target.dataset.p2) detail = "This is the same plant.";
                openModal(`<div class="p-6 text-center"><h3 class="text-xl font-bold mb-4">${plant1.commonName} + ${plant2.commonName}</h3><p>${detail}</p><button data-action="close-modal" class="mt-6 bg-stone-200 hover:bg-stone-300 px-4 py-2 rounded-md">Close</button></div>`);
                break;
            case 'log-activity':
                // For now, just switch to the Activity Log view
                appState.currentView = 'activityLog';
                renderAll();
                mainElements.modalBackdrop.classList.add('hidden');
                break;
            case 'log-harvest':
                // For now, just switch to the Harvest Log view
                appState.currentView = 'harvestLog';
                renderAll();
                mainElements.modalBackdrop.classList.add('hidden');
                break;
            case 'toggle-care-task':
                const { ymd, taskId } = target.dataset;
                if (!careLog[ymd]) careLog[ymd] = [];
                const taskIndex = careLog[ymd].indexOf(taskId);
                if (taskIndex > -1) careLog[ymd].splice(taskIndex, 1);
                else careLog[ymd].push(taskId);
                saveData();
                break;
            case 'calendar-prev': appState.calendarDate.setMonth(appState.calendarDate.getMonth() - 1); renderCalendarView(); lucide.createIcons(); break;
            case 'calendar-today': appState.calendarDate = new Date(); renderCalendarView(); lucide.createIcons(); break;
            case 'calendar-next': appState.calendarDate.setMonth(appState.calendarDate.getMonth() + 1); renderCalendarView(); lucide.createIcons(); break;
            case 'view-pest-disease':
                {
                    const item = pestDiseaseDatabase.find(i => i.id === id);
                    if (!item) return;
                    const content = `
                        <div class="p-6 sm:p-8 flex-grow overflow-y-auto">
                            <div class="flex justify-between items-start mb-4">
                                <h2 class="text-3xl font-bold text-text-base">${item.name}</h2>
                                <button data-action="close-modal" class="p-2 rounded-full hover:bg-stone-100"><i data-lucide="x"></i></button>
                            </div>
                            <div class="mb-4 text-sm font-semibold uppercase tracking-wider px-3 py-1 rounded-full inline-block ${item.type === 'pest' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}">${item.type}</div>
                            <div class="space-y-6">
                                <div><h4 class="font-bold text-lg text-primary">Description</h4><p class="text-text-muted">${item.description}</p></div>
                                <div><h4 class="font-bold text-lg text-primary">Symptoms</h4><p class="text-text-muted">${item.symptoms}</p></div>
                                <div><h4 class="font-bold text-lg text-primary">Commonly Affects</h4><p class="text-text-muted">${item.plants_affected.join(', ')}</p></div>
                                <div><h4 class="font-bold text-lg text-primary">Organic Treatments</h4><p class="text-text-muted">${item.organic_treatment}</p></div>
                                <div><h4 class="font-bold text-lg text-primary">Chemical Treatments</h4><p class="text-text-muted">${item.chemical_treatment}</p></div>
                            </div>
                        </div>
                    `;
                    openModal(content);
                }
                break;
            case 'filter-pest-disease':
                document.querySelectorAll('.pest-filter-btn').forEach(btn => btn.classList.remove('active-filter'));
                target.classList.add('active-filter');
                applyPestFilters();
                break;
            case 'identify-plant':
                openIdentifyPlantModal();
                break;
            case 'run-ai-identification':
                runAIIdentification();
                break;
            case 'add-identified-plant':
                openAddToGardenModal(id);
                break;
            case 'search-again':
                {
                    const imageUrl = e.target.dataset.imageSrc;
                    const searchCount = parseInt(e.target.dataset.searchCount) || 1;
                    const resultsContainer = document.getElementById('identify-results');
                    const apiKey = localStorage.getItem('openai_api_key') || OPENAI_API_KEY;
                    
                    if (!apiKey || apiKey === "PASTE_YOUR_OPENAI_API_KEY_HERE" || apiKey === "") {
                        resultsContainer.innerHTML = `<p class="text-amber-600">Please set your OpenAI API key in Settings to use this feature.</p>`;
                        return;
                    }
                    
                    if (!imageUrl) {
                        resultsContainer.innerHTML = `<p class="text-red-500">Image data not available for retry.</p>`;
                        return;
                    }
                    
                    if (searchCount >= 2) {
                        resultsContainer.innerHTML = `<p class="text-red-500">Maximum of 2 searches per plant reached.</p>`;
                        return;
                    }
                    
                    // Search again with gpt-4.1-mini
                    (async () => {
                        try {
                            const retryResult = await attemptPlantIdentification(apiKey, imageUrl, 'gpt-4.1-mini', resultsContainer, null, searchCount + 1);
                            displayIdentificationResults(retryResult, resultsContainer);
                            document.getElementById('run-ai-identification-btn').disabled = false;
                            lucide.createIcons();
                        } catch (error) {
                            console.error('Retry identification failed:', error);
                            resultsContainer.innerHTML = `
                                <div class="p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <p class="font-bold text-red-700">Search Failed</p>
                                    <p class="text-xs text-red-600 mt-1">${error.message}</p>
                                </div>`;
                            document.getElementById('run-ai-identification-btn').disabled = false;
                        }
                    })();
                }
                break;
            case 'create-new-plant':
                openCreatePlantModal();
                break;
            case 'open-settings':
                openSettingsModal();
                break;
            case 'save-settings':
                {
                    const apiKey = mainElements.modalPanel.querySelector('#api-key-input').value;
                    if (apiKey.trim()) {
                        localStorage.setItem('openai_api_key', apiKey.trim());
                        console.log('API key saved successfully');
                        alert('API key saved successfully!');
                    } else {
                        alert('Please enter a valid API key.');
                        return;
                    }
                    mainElements.modalBackdrop.classList.add('hidden');
                }
                break;
            case 'confirm-create-plant':
                {
                    const getMultiSelectValues = (id) => Array.from(document.getElementById(id).selectedOptions).map(opt => opt.value);
                    const newPlant = {
                        id: `user-${Date.now()}`,
                        commonName: document.getElementById('new-commonName').value,
                        botanicalName: document.getElementById('new-botanicalName').value,
                        genus: document.getElementById('new-genus').value,
                        family: document.getElementById('new-family').value,
                        origin: document.getElementById('new-origin').value,
                        category: document.getElementById('new-category').value,
                        type: document.getElementById('new-type').value,
                        light: document.getElementById('new-light').value,
                        germinationDays: [
                            parseInt(document.getElementById('new-germinationMin').value) || 0,
                            parseInt(document.getElementById('new-germinationMax').value) || 0
                        ],
                        daysToMaturity: parseInt(document.getElementById('new-daysToMaturity').value) || 0,
                        care: {
                            water: parseInt(document.getElementById('new-careWater').value) || 0,
                            fertilize: parseInt(document.getElementById('new-careFertilize').value) || 0,
                        },
                        hardinessZone: document.getElementById('new-hardinessZone').value,
                        soilType: document.getElementById('new-soilType').value,
                        soilPH: document.getElementById('new-soilPH').value,
                        facts: document.getElementById('new-facts').value,
                        pestsDiseases: document.getElementById('new-pestsDiseases').value,
                        growingTip: document.getElementById('new-growingTip').value,
                        companions: {
                            friends: getMultiSelectValues('new-friends'),
                            foes: getMultiSelectValues('new-foes')
                        },
                        isUserDefined: true,
                    };

                    if (!newPlant.commonName) {
                        alert('Common Name is required.');
                        return;
                    }

                    userPlants.push(newPlant);
                    combinedPlantDatabase.push(newPlant);
                    mainElements.modalBackdrop.classList.add('hidden');
                    saveData();
                }
                break;
            case 'generate-ai-recommendations':
                console.log('Generate AI recommendations button clicked');
                console.log('lastWeatherData:', lastWeatherData);
                // Call generateAIRecommendations with weather data if available, or null if not
                generateAIRecommendations(lastWeatherData);
                break;
            case 'edit-activity':
                openEditActivityModal(parseInt(id));
                break;
            case 'delete-activity':
                if (confirm('Are you sure you want to delete this activity entry?')) {
                    activityLog.splice(parseInt(id), 1);
                    saveData();
                    renderAll();
                    refreshPollinatorData();
                }
                break;
            case 'confirm-edit-activity':
                {
                    const form = target.closest('form');
                    const formData = new FormData(form);
                    const activityIndex = parseInt(form.dataset.index);
                    const type = formData.get('type');
                    const plantId = formData.get('plant');
                    const date = formData.get('date');
                    const time = formData.get('time');
                    
                    // Create timestamp with optional time
                    let timestamp = date;
                    if (time) {
                        timestamp = `${date}T${time}:00`;
                    }
                    
                    // Update the activity entry
                    if (type === 'pollinator') {
                        const pollinatorType = formData.get('pollinatorType');
                        const count = formData.get('count') || 1;
                        const message = `Saw ${count} ${pollinatorType}${count > 1 ? 's' : ''} on plant`;
                        activityLog[activityIndex] = { 
                            instanceId: plantId, 
                            type: 'pollinator', 
                            description: pollinatorType,
                            message: message,
                            count: parseInt(count),
                            date: timestamp 
                        };
                    } else {
                        const description = formData.get('description') || '';
                        activityLog[activityIndex] = { 
                            instanceId: plantId, 
                            type: type, 
                            description: description,
                            message: description,
                            date: timestamp 
                        };
                    }
                    
                    saveData();
                    renderAll();
                    refreshPollinatorData();
                    mainElements.modalBackdrop.classList.add('hidden');
                }
                break;
            case 'create-bed':
                openCreateBedModal();
                break;
            case 'select-bed':
                const bedId = target.dataset.bedId;
                selectBed(bedId);
                break;
            case 'edit-bed':
                openEditBedModal(appState.selectedBed);
                break;
            case 'delete-bed':
                if (confirm('Are you sure you want to delete this bed? All plants placed in this bed will be removed from the layout.')) {
                    const bedToDelete = gardenLayout.beds?.find(b => b.id === appState.selectedBed);
                    if (bedToDelete && bedToDelete.plants) {
                        // Remove plants from gardenLayout.plants that were in this bed
                        Object.keys(bedToDelete.plants).forEach(instanceId => {
                            delete gardenLayout.plants[instanceId];
                        });
                    }
                    
                    // Remove the bed from the beds array
                    gardenLayout.beds = gardenLayout.beds?.filter(b => b.id !== appState.selectedBed) || [];
                    appState.selectedBed = null;
                    
                    saveData();
                    renderLayoutView();
                }
                break;
            case 'select-layout-plant':
                const instanceId = target.dataset.instanceId;
                if (appState.selectedLayoutPlant === instanceId) {
                    appState.selectedLayoutPlant = null;
                } else {
                    appState.selectedLayoutPlant = instanceId;
                }
                renderPlantList();
                if (appState.selectedBed) {
                    const bed = gardenLayout.beds?.find(b => b.id === appState.selectedBed);
                    if (bed) renderBedLayout(bed);
                }
                break;
            case 'open-voice-recording':
                openVoiceRecordingModal();
                break;
            case 'start-voice-recording':
                startVoiceRecording();
                break;
            case 'stop-voice-recording':
                stopVoiceRecording();
                break;
            case 'apply-voice-notes':
                applyVoiceNotesToPlants();
                break;
            case 'record-again':
                resetVoiceRecordingUI();
                break;
            case 'record-more':
                // Reset to ready state but keep existing recordings
                document.getElementById('transcript-section').classList.add('hidden');
                document.getElementById('apply-notes-section').classList.add('hidden');
                resetToReadyState();
                showProcessButton();
                break;
            case 'process-all-recordings':
                processAllRecordings();
                break;
            case 'delete-recording':
                const recordingId = parseInt(e.target.closest('[data-id]').dataset.id);
                voiceRecording.recordings = voiceRecording.recordings.filter(r => r.id !== recordingId);
                updateRecordingsList();
                if (voiceRecording.recordings.length === 0) {
                    document.getElementById('process-all-recordings-btn').classList.add('hidden');
                }
                break;
            case 'create-custom-plant':
                const plantName = e.target.dataset.name;
                const botanicalName = e.target.dataset.botanical || '';
                const facts = e.target.dataset.facts || '';
                if (plantName) {
                    mainElements.modalBackdrop.classList.add('hidden');
                    setTimeout(() => {
                        openCreatePlantModal();
                        // Pre-fill the plant data
                        const nameField = document.getElementById('plant-name');
                        const factsField = document.getElementById('plant-facts');
                        if (nameField) {
                            nameField.value = plantName;
                        }
                        if (factsField && facts) {
                            factsField.value = facts;
                        }
                        // Add botanical name to facts if available
                        if (botanicalName && factsField) {
                            const existingFacts = factsField.value;
                            const botanicalInfo = `Scientific name: ${botanicalName}`;
                            factsField.value = existingFacts ? `${botanicalInfo}. ${existingFacts}` : botanicalInfo;
                        }
                    }, 100);
                }
                break;
        }
    };
    
    // --- DRAG & DROP & FORM HANDLERS ---
    document.addEventListener('dragstart', e => {
        const target = e.target.closest('[data-action="drag-plant"]');
        if (target) {
            e.dataTransfer.effectAllowed = 'move';
            appState.draggedPlant = { instanceId: target.dataset.instanceId };
            target.classList.add('dragging');
        }
    });
    document.addEventListener('dragend', e => { 
        e.target.classList?.remove('dragging'); 
        appState.draggedPlant = null; 
    });
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => {
        const grid = e.target.closest('#garden-layout-grid');
        if (!grid || !appState.draggedPlant || !appState.selectedBed) return;
        e.preventDefault();
        const rect = grid.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        // Find the selected bed and add plant to it
        const bed = gardenLayout.beds?.find(b => b.id === appState.selectedBed);
        if (bed) {
            if (!bed.plants) bed.plants = {};
            bed.plants[appState.draggedPlant.instanceId] = { x, y };
            
            // Also maintain the old format for compatibility
            gardenLayout.plants[appState.draggedPlant.instanceId] = { x, y };
            
            saveData();
            renderBedLayout(bed);
        }
    });
    document.addEventListener('submit', e => {
        e.preventDefault();
        if (e.target.id === 'activity-log-form') {
            const formData = new FormData(e.target);
            const type = formData.get('type');
            const plantId = formData.get('plant');
            const date = formData.get('date');
            const time = formData.get('time');
            
            // Create timestamp with optional time
            let timestamp = date;
            if (time) {
                timestamp = `${date}T${time}:00`;
            }
            
            if (type === 'pollinator') {
                const pollinatorType = formData.get('pollinatorType');
                const count = formData.get('count') || 1;
                const message = `Saw ${count} ${pollinatorType}${count > 1 ? 's' : ''} on plant`;
                activityLog.push({ 
                    instanceId: plantId, 
                    type: 'pollinator', 
                    description: pollinatorType,
                    message: message,
                    count: parseInt(count),
                    date: timestamp 
                });
            } else {
                const description = formData.get('description') || '';
                activityLog.push({ 
                    instanceId: plantId, 
                    type: type, 
                    description: description,
                    message: description,
                    date: timestamp 
                });
            }
            saveData();
            renderAll();
            refreshPollinatorData();
            // Update pollinator summary on dashboard
            if (appState.currentView === 'dashboard') {
                renderPollinatorSummary();
            }
        }
        if (e.target.id === 'harvest-log-form') {
            const formData = new FormData(e.target);
            harvestLog.push({ instanceId: formData.get('plant'), quantity: formData.get('quantity'), notes: formData.get('notes'), date: formData.get('date') });
            saveData();
        }
        if (e.target.id === 'create-bed-form') {
            const formData = new FormData(e.target);
            const newBed = {
                id: `bed_${Date.now()}`,
                name: formData.get('name') || document.getElementById('bed-name').value,
                width: parseInt(formData.get('width') || document.getElementById('bed-width').value),
                height: parseInt(formData.get('height') || document.getElementById('bed-height').value),
                type: formData.get('type') || document.getElementById('bed-type').value,
                notes: formData.get('notes') || document.getElementById('bed-notes').value,
                plants: {}
            };
            
            if (!gardenLayout.beds) gardenLayout.beds = [];
            gardenLayout.beds.push(newBed);
            
            // Select the new bed
            appState.selectedBed = newBed.id;
            
            saveData();
            renderLayoutView();
            mainElements.modalBackdrop.classList.add('hidden');
        }
        if (e.target.id === 'edit-bed-form') {
            const formData = new FormData(e.target);
            const bedId = formData.get('bedId') || document.getElementById('edit-bed-id').value;
            const bed = gardenLayout.beds?.find(b => b.id === bedId);
            
            if (bed) {
                bed.name = formData.get('name') || document.getElementById('edit-bed-name').value;
                bed.width = parseInt(formData.get('width') || document.getElementById('edit-bed-width').value);
                bed.height = parseInt(formData.get('height') || document.getElementById('edit-bed-height').value);
                bed.type = formData.get('type') || document.getElementById('edit-bed-type').value;
                bed.notes = formData.get('notes') || document.getElementById('edit-bed-notes').value;
                
                saveData();
                renderLayoutView();
                mainElements.modalBackdrop.classList.add('hidden');
            }
        }
    });

    // --- INITIALIZATION ---
    const init = async () => {
        console.log('Initializing application...');
        try {
            const [plantsRes, pestsRes] = await Promise.all([
                fetch('/api/plants'),
                fetch('/api/pests')
            ]);

            if (!plantsRes.ok || !pestsRes.ok) {
                throw new Error(`HTTP error! Status: ${plantsRes.status} / ${pestsRes.status}`);
            }
            
            basePlantDatabase = await plantsRes.json();
            pestDiseaseDatabase = await pestsRes.json();
            
            console.log(`Loaded ${basePlantDatabase.length} plants from database`);
            console.log(`Loaded ${pestDiseaseDatabase.length} pest/disease entries`);

            loadData();
            combinedPlantDatabase = [...basePlantDatabase, ...userPlants]; // Combine databases
            console.log(`Combined database has ${combinedPlantDatabase.length} total plants`);
            
            // Validate that all plants have required properties
            const invalidPlants = combinedPlantDatabase.filter(p => !p || !p.id || !p.commonName);
            if (invalidPlants.length > 0) {
                console.warn(`Found ${invalidPlants.length} invalid plants in database`, invalidPlants);
            }
            
            // Navigation is already set up in the DOM initialization above

            document.addEventListener('click', handleAppClick);

            renderAll();

            if ('Notification' in window) {
                if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            console.log('Notification permission granted.');
                            checkAndSendNotifications();
                        }
                    });
                } else if (Notification.permission === 'granted') {
                    checkAndSendNotifications();
                }
            }
            
            console.log('Application initialization completed successfully');
        } catch (error) {
            console.error('Initialization failed:', error);
            document.getElementById('app-container').innerHTML = `<div class="text-center p-8 bg-red-100 text-red-800 rounded-lg"><h2>Error Loading Application</h2><p>Could not load all necessary database files. Please ensure both plant_database.json and pest_disease_database.json are accessible.</p><p><strong>Error details:</strong> ${error.message}</p></div>`;
        }
    };

    init();
    
    // Ensure the application renders the initial view
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM fully loaded, ensuring initial view is rendered');
        // Small delay to ensure all elements are ready
        setTimeout(() => {
            if (appState.currentView === 'dashboard') {
                renderAll();
            }
        }, 100);
    });

    const openEditInstanceModal = (instanceId) => {
        const instance = getInstanceById(instanceId);
        if (!instance) return;
        const plant = getPlantById(instance.plantId);

        const content = `
            <div class="p-6 flex-grow overflow-y-auto">
                <h2 class="text-2xl font-bold mb-4">Edit Details for ${plant.commonName}</h2>
                <form data-id="${instance.instanceId}" class="space-y-6">
                    <!-- Instance-specific fields -->
                    <div class="bg-blue-50 p-4 rounded-lg">
                        <h3 class="font-bold text-lg mb-3 text-blue-800">Garden Tracking Details</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label for="edit-planting-date" class="block text-sm font-medium text-text-muted">Planting Date</label>
                                <input type="date" id="edit-planting-date" value="${dateToYMD(new Date(instance.plantingDate))}" class="mt-1 block w-full input-field">
                            </div>
                            <div>
                                <label for="edit-source" class="block text-sm font-medium text-text-muted">Source</label>
                                <input type="text" id="edit-source" value="${instance.source || ''}" placeholder="e.g., Home Depot, Seeds from friend" class="mt-1 block w-full input-field">
                            </div>
                        </div>
                        <div class="mt-4">
                            <label for="edit-notes" class="block text-sm font-medium text-text-muted">Personal Notes</label>
                            <textarea id="edit-notes" rows="3" placeholder="Any special notes about this specific plant..." class="mt-1 block w-full input-field">${instance.notes || ''}</textarea>
                        </div>
                        <div class="mt-4">
                            <label for="edit-photo-upload" class="block text-sm font-medium text-text-muted">Photo</label>
                            ${instance.photo ? `<img src="${instance.photo}" class="my-2 rounded-lg w-32 h-32 object-cover">` : ''}
                            <input type="file" id="edit-photo-upload" accept="image/*" class="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20">
                        </div>
                    </div>

                    <!-- Plant information fields -->
                    <div class="bg-green-50 p-4 rounded-lg">
                        <h3 class="font-bold text-lg mb-3 text-green-800">Plant Information</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label for="edit-common-name" class="block text-sm font-medium text-text-muted">Common Name</label>
                                <input type="text" id="edit-common-name" value="${plant.commonName || ''}" class="mt-1 block w-full input-field">
                            </div>
                            <div>
                                <label for="edit-botanical-name" class="block text-sm font-medium text-text-muted">Botanical Name</label>
                                <input type="text" id="edit-botanical-name" value="${plant.botanicalName || ''}" class="mt-1 block w-full input-field">
                            </div>
                            <div>
                                <label for="edit-genus" class="block text-sm font-medium text-text-muted">Genus</label>
                                <input type="text" id="edit-genus" value="${plant.genus || ''}" class="mt-1 block w-full input-field">
                            </div>
                            <div>
                                <label for="edit-family" class="block text-sm font-medium text-text-muted">Family</label>
                                <input type="text" id="edit-family" value="${plant.family || ''}" class="mt-1 block w-full input-field">
                            </div>
                            <div>
                                <label for="edit-origin" class="block text-sm font-medium text-text-muted">Origin</label>
                                <input type="text" id="edit-origin" value="${plant.origin || ''}" class="mt-1 block w-full input-field">
                            </div>
                            <div>
                                <label for="edit-category" class="block text-sm font-medium text-text-muted">Category</label>
                                <input type="text" id="edit-category" value="${plant.category || ''}" placeholder="e.g., Vegetable, Herb, Flower" class="mt-1 block w-full input-field">
                            </div>
                            <div>
                                <label for="edit-type" class="block text-sm font-medium text-text-muted">Type</label>
                                <input type="text" id="edit-type" value="${plant.type || ''}" placeholder="e.g., Annual, Perennial" class="mt-1 block w-full input-field">
                            </div>
                            <div>
                                <label for="edit-light" class="block text-sm font-medium text-text-muted">Light Requirements</label>
                                <input type="text" id="edit-light" value="${plant.light || ''}" placeholder="e.g., Full Sun, Part Shade" class="mt-1 block w-full input-field">
                            </div>
                        </div>
                    </div>

                    <!-- Growing information -->
                    <div class="bg-yellow-50 p-4 rounded-lg">
                        <h3 class="font-bold text-lg mb-3 text-yellow-800">Growing Information</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-text-muted">Germination Days (Min-Max)</label>
                                <div class="flex items-center gap-2">
                                    <input type="number" id="edit-germination-min" value="${plant.germinationDays?.[0] || ''}" placeholder="Min" class="mt-1 block w-full input-field">
                                    <span class="text-text-muted">-</span>
                                    <input type="number" id="edit-germination-max" value="${plant.germinationDays?.[1] || ''}" placeholder="Max" class="mt-1 block w-full input-field">
                                </div>
                            </div>
                            <div>
                                <label for="edit-days-to-maturity" class="block text-sm font-medium text-text-muted">Days to Maturity</label>
                                <input type="number" id="edit-days-to-maturity" value="${plant.daysToMaturity || ''}" class="mt-1 block w-full input-field">
                            </div>
                            <div>
                                <label for="edit-water-frequency" class="block text-sm font-medium text-text-muted">Water Every (days)</label>
                                <input type="number" id="edit-water-frequency" value="${plant.care?.water || ''}" class="mt-1 block w-full input-field">
                            </div>
                            <div>
                                <label for="edit-fertilize-frequency" class="block text-sm font-medium text-text-muted">Fertilize Every (days)</label>
                                <input type="number" id="edit-fertilize-frequency" value="${plant.care?.fertilize || ''}" class="mt-1 block w-full input-field">
                            </div>
                            <div>
                                <label for="edit-hardiness-zone" class="block text-sm font-medium text-text-muted">Hardiness Zone</label>
                                <input type="text" id="edit-hardiness-zone" value="${plant.hardinessZone || ''}" placeholder="e.g., 8-10" class="mt-1 block w-full input-field">
                            </div>
                            <div>
                                <label for="edit-soil-type" class="block text-sm font-medium text-text-muted">Soil Type</label>
                                <input type="text" id="edit-soil-type" value="${plant.soilType || ''}" placeholder="e.g., Well-drained" class="mt-1 block w-full input-field">
                            </div>
                            <div>
                                <label for="edit-soil-ph" class="block text-sm font-medium text-text-muted">Soil pH</label>
                                <input type="text" id="edit-soil-ph" value="${plant.soilPH || ''}" placeholder="e.g., Neutral" class="mt-1 block w-full input-field">
                            </div>
                            <div>
                                <label for="edit-bloom-color" class="block text-sm font-medium text-text-muted">Bloom Color</label>
                                <input type="text" id="edit-bloom-color" value="${plant.bloomColor || ''}" placeholder="e.g., Purple" class="mt-1 block w-full input-field">
                            </div>
                            <div>
                                <label for="edit-bloom-season" class="block text-sm font-medium text-text-muted">Bloom Season</label>
                                <input type="text" id="edit-bloom-season" value="${plant.bloomSeason || ''}" placeholder="e.g., Summer to Fall" class="mt-1 block w-full input-field">
                            </div>
                            <div>
                                <label for="edit-pollinator-type" class="block text-sm font-medium text-text-muted">Pollinator Type</label>
                                <input type="text" id="edit-pollinator-type" value="${plant.pollinatorType || ''}" placeholder="e.g., Butterfly, Bee" class="mt-1 block w-full input-field">
                            </div>
                        </div>
                    </div>

                    <!-- Descriptive information -->
                    <div class="bg-purple-50 p-4 rounded-lg">
                        <h3 class="font-bold text-lg mb-3 text-purple-800">Descriptive Information</h3>
                        <div class="space-y-4">
                            <div>
                                <label for="edit-facts" class="block text-sm font-medium text-text-muted">Interesting Facts</label>
                                <textarea id="edit-facts" rows="3" placeholder="Interesting facts about this plant..." class="mt-1 block w-full input-field">${plant.facts || ''}</textarea>
                            </div>
                            <div>
                                <label for="edit-pests-diseases" class="block text-sm font-medium text-text-muted">Pests & Diseases</label>
                                <textarea id="edit-pests-diseases" rows="3" placeholder="Common pests and diseases..." class="mt-1 block w-full input-field">${plant.pestsDiseases || ''}</textarea>
                            </div>
                            <div>
                                <label for="edit-growing-tip" class="block text-sm font-medium text-text-muted">Growing Tips</label>
                                <textarea id="edit-growing-tip" rows="3" placeholder="Helpful growing tips..." class="mt-1 block w-full input-field">${plant.growingTip || ''}</textarea>
                            </div>
                            <div>
                                <label for="edit-special-features" class="block text-sm font-medium text-text-muted">Special Features</label>
                                <input type="text" id="edit-special-features" value="${plant.specialFeatures?.join(', ') || ''}" placeholder="e.g., Drought Tolerant, Heat Lover (comma-separated)" class="mt-1 block w-full input-field">
                            </div>
                        </div>
                    </div>
                </form>
            </div>
            <div class="p-4 bg-bg-base/50 flex justify-end gap-3 border-t border-stone-200">
                <button data-action="close-modal" class="px-4 py-2 rounded-lg text-text-muted hover:bg-stone-200">Cancel</button>
                <button data-action="confirm-edit-instance" data-id="${instance.instanceId}" class="px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90">Save Changes</button>
            </div>
        `;
        openModal(content);
    };

    const openCreatePlantModal = () => {
        const allPlantsOptions = combinedPlantDatabase
            .filter(p => p && p.id && p.commonName)
            .map(p => `<option value="${p.id}">${p.commonName}</option>`).join('');

        const content = `
            <div class="p-6 flex-grow overflow-y-auto">
                <div class="flex justify-between items-start mb-4">
                    <h2 class="text-3xl font-bold text-text-base">Create a New Plant</h2>
                    <button data-action="close-modal" class="p-2 rounded-full hover:bg-stone-100"><i data-lucide="x"></i></button>
                </div>
                <form id="create-plant-form" class="space-y-6 text-sm">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label class="block font-medium">Common Name*</label><input type="text" id="new-commonName" class="input-field w-full" required></div>
                        <div><label class="block font-medium">Botanical Name</label><input type="text" id="new-botanicalName" class="input-field w-full"></div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label class="block font-medium">Genus</label><input type="text" id="new-genus" class="input-field w-full"></div>
                        <div><label class="block font-medium">Family</label><input type="text" id="new-family" class="input-field w-full"></div>
                        <div><label class="block font-medium">Origin</label><input type="text" id="new-origin" class="input-field w-full"></div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label class="block font-medium">Category</label><input type="text" id="new-category" class="input-field w-full" placeholder="e.g., Vegetable"></div>
                        <div><label class="block font-medium">Type</label><input type="text" id="new-type" class="input-field w-full" placeholder="e.g., Annual"></div>
                        <div><label class="block font-medium">Light</label><input type="text" id="new-light" class="input-field w-full" placeholder="e.g., Full Sun"></div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block font-medium">Germination Days</label>
                            <div class="flex items-center gap-2">
                                <input type="number" id="new-germinationMin" class="input-field w-full" placeholder="Min">
                                <span class="text-text-muted">-</span>
                                <input type="number" id="new-germinationMax" class="input-field w-full" placeholder="Max">
                            </div>
                        </div>
                        <div><label class="block font-medium">Days to Maturity</label><input type="number" id="new-daysToMaturity" class="input-field w-full"></div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block font-medium">Care (days between)</label>
                            <div class="flex items-center gap-2">
                                <input type="number" id="new-careWater" class="input-field w-full" placeholder="Water">
                                <input type="number" id="new-careFertilize" class="input-field w-full" placeholder="Fertilize">
                            </div>
                        </div>
                        <div><label class="block font-medium">Hardiness Zone</label><input type="text" id="new-hardinessZone" class="input-field w-full" placeholder="e.g., 8-10"></div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label class="block font-medium">Soil Type</label><input type="text" id="new-soilType" class="input-field w-full"></div>
                        <div><label class="block font-medium">Soil pH</label><input type="text" id="new-soilPH" class="input-field w-full"></div>
                    </div>
                    <div><label class="block font-medium">Interesting Fact</label><textarea id="new-facts" class="input-field w-full" rows="2"></textarea></div>
                    <div><label class="block font-medium">Pests & Diseases</label><textarea id="new-pestsDiseases" class="input-field w-full" rows="2"></textarea></div>
                    <div><label class="block font-medium">Growing Tip</label><textarea id="new-growingTip" class="input-field w-full" rows="2"></textarea></div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label class="block font-medium">Companion Friends</label><select id="new-friends" multiple class="input-field w-full h-32">${allPlantsOptions}</select></div>
                        <div><label class="block font-medium">Companion Foes</label><select id="new-foes" multiple class="input-field w-full h-32">${allPlantsOptions}</select></div>
                    </div>
                </form>
            </div>
            <div class="p-4 bg-bg-base/50 flex justify-end gap-3 border-t border-stone-200">
                <button data-action="close-modal" class="px-4 py-2 rounded-lg text-text-muted hover:bg-stone-200">Cancel</button>
                <button data-action="confirm-create-plant" class="px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90">Save Plant</button>
            </div>
        `;
        openModal(content);
    };

    const openIdentifyPlantModal = () => {
        const content = `
             <div class="p-6">
                <h2 class="text-2xl font-bold mb-4">AI Plant Identification</h2>
                <p class="text-text-muted mb-4">Upload a photo of a plant, and the AI will try to identify it for you.</p>
                <input type="file" id="identify-photo-upload" accept="image/*" class="mb-4 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20">
                <div id="identify-preview" class="mb-4 min-h-[200px] bg-bg-base/50 rounded-lg flex items-center justify-center">
                    <span class="text-text-muted">Image preview</span>
                </div>
                <div id="identify-results"></div>
            </div>
            <div class="p-4 bg-bg-base/50 flex justify-end gap-3 border-t border-stone-200">
                <button data-action="close-modal" class="px-4 py-2 rounded-lg text-text-muted hover:bg-stone-200">Cancel</button>
                <button data-action="run-ai-identification" id="run-ai-identification-btn" disabled class="px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 disabled:bg-stone-300">Get AI Identification</button>
            </div>
        `;
        openModal(content);

        const fileInput = document.getElementById('identify-photo-upload');
        const preview = document.getElementById('identify-preview');
        const runBtn = document.getElementById('run-ai-identification-btn');

        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    preview.innerHTML = `<img src="${e.target.result}" class="max-h-64 w-auto object-contain rounded-lg">`;
                    runBtn.disabled = false;
                }
                reader.readAsDataURL(file);
            }
        });
    }

    const runAIIdentification = async () => {
        const resultsContainer = document.getElementById('identify-results');
        const previewImg = document.getElementById('identify-preview').querySelector('img');

        // Check for API key from localStorage first
        const apiKey = localStorage.getItem('openai_api_key') || OPENAI_API_KEY;
        if (!apiKey || apiKey === "PASTE_YOUR_OPENAI_API_KEY_HERE" || apiKey === "") {
            resultsContainer.innerHTML = `<p class="text-amber-600">Please set your OpenAI API key in Settings to use this feature. Click the gear icon to configure your API key.</p>`;
            return;
        }

        if (!previewImg) {
            resultsContainer.innerHTML = `<p class="text-red-500">Please select an image first.</p>`;
            return;
        }

        document.getElementById('run-ai-identification-btn').disabled = true;
        
        // First attempt with gpt-4.1-nano
        let identificationResult = await attemptPlantIdentification(apiKey, previewImg.src, 'gpt-4.1-nano', resultsContainer);
        
        // Display results with option for second search if not found in database
        displayIdentificationResults(identificationResult, resultsContainer);
        
        document.getElementById('run-ai-identification-btn').disabled = false;
        lucide.createIcons();
    };

    const attemptPlantIdentification = async (apiKey, imageUrl, model, resultsContainer, previousAttempt = null, searchCount = 1) => {
        const isSecondAttempt = searchCount > 1;
        
        try {
            // Update UI to show current attempt
            const modelDisplay = model === 'gpt-4.1-nano' ? 'GPT-4.1-nano' : model === 'gpt-4.1-mini' ? 'GPT-4.1-mini' : model;
            const attemptText = isSecondAttempt ? `Searching again with ${modelDisplay} for better accuracy...` : `Analyzing plant with ${modelDisplay}...`;
            resultsContainer.innerHTML = `<div class="flex items-center gap-2 text-text-muted"><div class="loader"></div><span>${attemptText}</span></div>`;

            let promptText = `
Task: Identify the plant in the image URL provided.

Image URL: ${imageUrl}

Output JSON schema (no extra fields):
{
  "commonName": "exact common name",
  "botanicalName": "scientific name or null",
  "confidence": 0.00-1.00,
  "confidenceReason": "brief justification",
  "keyFeatures": ["feature1","feature2"],
  "distribution": ["native range","common habitats"],
  "interestingFacts": ["fact1","fact2"]
}`;

            if (isSecondAttempt) {
                promptText = `The first identification attempt suggested "${previousAttempt}". Please provide a more detailed analysis and identify this plant. ${promptText}`;
            }

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: 'system',
                            content: `
You are Dr. Greenleaf, a world-renowned botanist and plant ID expert with deep expertise in morphological analysis.

- Use precise, technical botanical terminology.
- Rigorously validate JSON output against the schema.
- For confidence, include a numeric score (0-1) and a justification sentence.
- If uncertain, explain which visual cues are missing.
`
                        },
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: promptText
                                },
                                {
                                    type: 'image_url',
                                    image_url: { url: imageUrl }
                                }
                            ]
                        }
                    ],
                    max_completion_tokens: 300,
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API error (${response.status}): ${response.statusText}`);
            }

            const result = await response.json();
            let plantData;
            
            try {
                // Try to parse JSON response
                const content = result.choices[0].message.content.trim();
                const parsedData = JSON.parse(content);
                
                // Handle new optimized JSON structure
                plantData = {
                    commonName: parsedData.commonName || '',
                    botanicalName: parsedData.botanicalName || '',
                    confidence: parsedData.confidence || 0.5,
                    confidenceReason: parsedData.confidenceReason || '',
                    keyFeatures: Array.isArray(parsedData.keyFeatures) ? parsedData.keyFeatures.join(', ') : (parsedData.keyFeatures || ''),
                    distribution: Array.isArray(parsedData.distribution) ? parsedData.distribution.join(', ') : (parsedData.distribution || ''),
                    facts: Array.isArray(parsedData.interestingFacts) ? parsedData.interestingFacts.join(', ') : (parsedData.facts || parsedData.interestingFacts || '')
                };
            } catch (parseError) {
                // Fallback to simple text parsing
                const content = result.choices[0].message.content.trim();
                plantData = {
                    commonName: content,
                    botanicalName: '',
                    confidence: 0.5,
                    confidenceReason: 'Fallback parsing used',
                    keyFeatures: '',
                    distribution: '',
                    facts: ''
                };
            }

            // Try to find match in database
            let identifiedPlant = combinedPlantDatabase.find(p => 
                p.commonName.toLowerCase() === plantData.commonName.toLowerCase()
            );
            
            // If no exact match, try partial matching
            if (!identifiedPlant) {
                identifiedPlant = combinedPlantDatabase.find(p => 
                    p.commonName.toLowerCase().includes(plantData.commonName.toLowerCase()) ||
                    plantData.commonName.toLowerCase().includes(p.commonName.toLowerCase())
                );
            }

            return {
                plantName: plantData.commonName,
                botanicalName: plantData.botanicalName || '',
                confidence: plantData.confidence || 'medium',
                keyFeatures: plantData.keyFeatures || '',
                facts: plantData.facts || '',
                foundInDatabase: !!identifiedPlant,
                databasePlant: identifiedPlant,
                model: model,
                isSecondAttempt: isSecondAttempt,
                searchCount: searchCount,
                imageUrl: imageUrl
            };

        } catch (error) {
            console.error(`${model} identification error:`, error);
            return {
                error: error.message,
                model: model,
                isSecondAttempt: isSecondAttempt,
                searchCount: searchCount
            };
        }
    };

    const displayIdentificationResults = (result, resultsContainer) => {
        if (result.error) {
            resultsContainer.innerHTML = `
                <div class="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p class="font-bold text-red-700">Plant Identification Failed</p>
                    <p class="text-xs text-red-600 mt-1">${result.error}</p>
                </div>`;
            return;
        }

        const modelDisplay = result.model === 'gpt-4.1-nano' ? 'GPT-4.1-nano' : result.model === 'gpt-4.1-mini' ? 'GPT-4.1-mini' : result.model;
        const attemptNote = result.isSecondAttempt ? ` (Search ${result.searchCount})` : '';

        if (result.foundInDatabase) {
            // Plant found in database
            resultsContainer.innerHTML = `
                <h3 class="font-bold text-lg mb-3">🌱 Plant Identified!</h3>
                <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div class="space-y-3">
                        <div>
                            <p class="text-xl font-bold text-green-800">${result.databasePlant.commonName}</p>
                            ${result.botanicalName ? `<p class="text-sm italic text-green-600">${result.botanicalName}</p>` : ''}
                            <p class="text-xs text-gray-500">Identified by ${modelDisplay}${attemptNote} • Confidence: ${result.confidence}</p>
                        </div>
                        
                        ${result.keyFeatures ? `
                        <div class="bg-white p-3 rounded border-l-4 border-green-400">
                            <p class="text-sm font-semibold text-gray-700">Key Features:</p>
                            <p class="text-sm text-gray-600">${result.keyFeatures}</p>
                        </div>` : ''}
                        
                        <div class="bg-white p-3 rounded border-l-4 border-blue-400">
                            <p class="text-sm font-semibold text-gray-700">Plant Facts:</p>
                            <p class="text-sm text-gray-600">${result.databasePlant.facts}</p>
                        </div>
                        
                        ${result.facts && result.facts !== result.databasePlant.facts ? `
                        <div class="bg-white p-3 rounded border-l-4 border-purple-400">
                            <p class="text-sm font-semibold text-gray-700">Additional AI Insights:</p>
                            <p class="text-sm text-gray-600">${result.facts}</p>
                        </div>` : ''}
                        
                        <button data-action="add-identified-plant" data-id="${result.databasePlant.id}" 
                                class="w-full mt-4 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold flex items-center justify-center gap-2 transition-colors">
                            <i data-lucide="plus" class="h-4 w-4"></i>
                            Add ${result.databasePlant.commonName} to My Garden
                        </button>
                    </div>
                </div>
            `;
        } else {
            // Plant not found in database
            resultsContainer.innerHTML = `
                <h3 class="font-bold text-lg mb-3">🔍 Plant Identified</h3>
                <div class="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div class="space-y-3">
                        <div>
                            <p class="text-xl font-bold text-amber-800">${result.plantName}</p>
                            ${result.botanicalName ? `<p class="text-sm italic text-amber-600">${result.botanicalName}</p>` : ''}
                            <p class="text-xs text-gray-500">Identified by ${modelDisplay}${attemptNote} • Confidence: ${result.confidence}</p>
                        </div>
                        
                        ${result.keyFeatures ? `
                        <div class="bg-white p-3 rounded border-l-4 border-amber-400">
                            <p class="text-sm font-semibold text-gray-700">Key Features:</p>
                            <p class="text-sm text-gray-600">${result.keyFeatures}</p>
                        </div>` : ''}
                        
                        ${result.facts ? `
                        <div class="bg-white p-3 rounded border-l-4 border-blue-400">
                            <p class="text-sm font-semibold text-gray-700">Plant Facts:</p>
                            <p class="text-sm text-gray-600">${result.facts}</p>
                        </div>` : ''}
                        
                                                 <div class="bg-amber-100 p-3 rounded">
                             <p class="text-sm text-amber-700">This plant was not found in your database. You can try a more detailed search or add it as a custom plant.</p>
                         </div>
                         
                         <div class="flex gap-3 mt-4">
                             ${(result.searchCount || 1) < 2 ? `
                             <button data-action="search-again" data-image-src="${result.imageUrl || ''}" data-search-count="${result.searchCount || 1}"
                                     class="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center justify-center gap-2 transition-colors">
                                 <i data-lucide="search" class="h-4 w-4"></i>
                                 Search Again
                             </button>` : ''}
                             <button data-action="create-custom-plant" data-name="${result.plantName}" data-botanical="${result.botanicalName || ''}" data-facts="${result.facts || ''}"
                                     class="${(result.searchCount || 1) < 2 ? 'flex-1' : 'w-full'} px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-semibold flex items-center justify-center gap-2 transition-colors">
                                 <i data-lucide="plus" class="h-4 w-4"></i>
                                 Add as Custom
                             </button>
                         </div>
                    </div>
                </div>
            `;
        }
    };

    const openEditActivityModal = (activityIndex) => {
        const activity = activityLog[activityIndex];
        if (!activity) return;
        
        const instance = getInstanceById(activity.instanceId);
        const plant = instance ? getPlantById(instance.plantId) : null;
        
        // Extract date and time from activity date
        const activityDate = new Date(activity.date);
        const dateStr = activityDate.toISOString().split('T')[0];
        const timeStr = activityDate.toTimeString().split(' ')[0].substring(0, 5);
        
        // Determine activity type and values
        let activityType = 'other';
        let pollinatorType = 'bee';
        let count = 1;
        let description = '';
        
        if (activity.type === 'pollinator' && activity.description) {
            activityType = 'pollinator';
            pollinatorType = activity.description;
            count = activity.count || 1;
        } else if (activity.type === 'pest') {
            activityType = 'pest';
            description = activity.description || activity.message || '';
        } else if (activity.message) {
            // Try to parse legacy format
            const pollinatorMatch = activity.message.match(/(\d+)\s+(bee|butterfly|hummingbird)s?/i);
            if (pollinatorMatch) {
                activityType = 'pollinator';
                pollinatorType = pollinatorMatch[2].toLowerCase();
                count = parseInt(pollinatorMatch[1]) || 1;
            } else {
                description = activity.message;
            }
        } else {
            description = activity.description || '';
        }
        
        const content = `
            <div class="p-6">
                <h2 class="text-2xl font-bold mb-4">Edit Activity Entry</h2>
                <form data-index="${activityIndex}" class="space-y-4">
                    <div>
                        <label for="edit-activity-plant" class="block text-sm font-medium">Plant</label>
                        <select id="edit-activity-plant" name="plant" class="mt-1 block w-full input-field">
                            ${myGarden.map(i => {
                                const p = getPlantById(i.plantId);
                                const selected = i.instanceId === activity.instanceId ? 'selected' : '';
                                return `<option value="${i.instanceId}" ${selected}>${p.commonName}</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <div>
                        <label for="edit-activity-type" class="block text-sm font-medium">Type</label>
                        <select id="edit-activity-type" name="type" class="mt-1 block w-full input-field">
                            <option value="pollinator" ${activityType === 'pollinator' ? 'selected' : ''}>Pollinator</option>
                            <option value="pest" ${activityType === 'pest' ? 'selected' : ''}>Pest/Disease</option>
                            <option value="other" ${activityType === 'other' ? 'selected' : ''}>Other Observation</option>
                        </select>
                    </div>
                    <div id="edit-pollinator-fields" class="space-y-4 ${activityType !== 'pollinator' ? 'hidden' : ''}">
                        <div>
                            <label for="edit-pollinator-type" class="block text-sm font-medium">Pollinator Type</label>
                            <select id="edit-pollinator-type" name="pollinatorType" class="mt-1 block w-full input-field">
                                <option value="bee" ${pollinatorType === 'bee' ? 'selected' : ''}>Bee</option>
                                <option value="butterfly" ${pollinatorType === 'butterfly' ? 'selected' : ''}>Butterfly</option>
                                <option value="hummingbird" ${pollinatorType === 'hummingbird' ? 'selected' : ''}>Hummingbird</option>
                            </select>
                        </div>
                        <div>
                            <label for="edit-pollinator-count" class="block text-sm font-medium">Quantity Observed</label>
                            <input type="number" id="edit-pollinator-count" name="count" min="1" value="${count}" class="mt-1 block w-full input-field" required>
                        </div>
                    </div>
                    <div id="edit-other-fields" class="${activityType === 'pollinator' ? 'hidden' : ''}">
                        <label for="edit-activity-description" class="block text-sm font-medium">Description</label>
                        <input type="text" id="edit-activity-description" name="description" value="${description}" placeholder="e.g., Aphids on leaves" class="mt-1 block w-full input-field">
                    </div>
                    <div>
                        <label for="edit-activity-date" class="block text-sm font-medium">Date</label>
                        <input type="date" id="edit-activity-date" name="date" value="${dateStr}" class="mt-1 block w-full input-field" required>
                    </div>
                    <div>
                        <label for="edit-activity-time" class="block text-sm font-medium">Time (optional)</label>
                        <input type="time" id="edit-activity-time" name="time" value="${timeStr !== '00:00' ? timeStr : ''}" class="mt-1 block w-full input-field">
                    </div>
                </form>
            </div>
            <div class="p-4 bg-bg-base/50 flex justify-end gap-3 border-t border-stone-200">
                <button data-action="close-modal" class="px-4 py-2 rounded-lg text-text-muted hover:bg-stone-200">Cancel</button>
                <button data-action="confirm-edit-activity" class="px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90">Update Activity</button>
            </div>
        `;
        
        openModal(content);
        
        // Set up field toggling for edit form
        const editActivityTypeSelect = document.getElementById('edit-activity-type');
        const editPollinatorFields = document.getElementById('edit-pollinator-fields');
        const editOtherFields = document.getElementById('edit-other-fields');
        
        editActivityTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'pollinator') {
                editPollinatorFields.classList.remove('hidden');
                editOtherFields.classList.add('hidden');
            } else {
                editPollinatorFields.classList.add('hidden');
                editOtherFields.classList.remove('hidden');
            }
        });
    };

    const openSettingsModal = () => {
        const content = `
            <div class="p-6">
                <h2 class="text-2xl font-bold text-text-base mb-6">Settings</h2>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-semibold text-text-base mb-2">OpenAI API Key</label>
                        <input type="password" id="api-key-input" class="w-full p-3 border border-stone-300 rounded-lg" 
                               placeholder="Enter your OpenAI API key for AI features" 
                               value="${localStorage.getItem('openai_api_key') || ''}">
                        <p class="text-xs text-stone-500 mt-1">Required for AI plant identification, recommendations, and voice recording features</p>
                    </div>
                    
                    <div class="flex gap-3 pt-4">
                        <button data-action="save-settings" class="flex-1 bg-primary text-white py-3 rounded-lg hover:bg-primary/90 font-semibold">
                            Save Settings
                        </button>
                        <button data-action="close-modal" class="px-6 py-3 border border-stone-300 rounded-lg hover:bg-stone-50">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>`;
        
        openModal(content);
    };

    const openVoiceRecordingModal = () => {
        // Check if API key is set
        const apiKey = localStorage.getItem('openai_api_key');
        const hasApiKey = apiKey && apiKey.trim().length > 0;
        
        // Reset recordings array when opening modal
        voiceRecording.recordings = [];
        
        const content = `
            <div class="p-6 max-h-[90vh] overflow-y-auto">
                <h2 class="text-2xl font-bold text-text-base mb-6 flex items-center gap-2">
                    <i data-lucide="mic" class="text-primary"></i>
                    Garden Voice Notes
                </h2>
                
                <div class="space-y-6">
                    <div class="bg-blue-50 p-4 rounded-lg">
                        <h3 class="font-semibold text-blue-800 mb-2">How it works:</h3>
                        <ul class="text-sm text-blue-700 space-y-1">
                            <li>• Record multiple voice memos about different plants or areas</li>
                            <li>• Add as many recordings as you want before processing</li>
                            <li>• AI will transcribe all recordings and identify plants mentioned</li>
                            <li>• Notes will be automatically added to the appropriate plants</li>
                        </ul>
                        <div class="mt-3 p-2 ${hasApiKey ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'} border rounded text-xs">
                            ${hasApiKey 
                                ? '<strong>✓ Ready:</strong> API key is configured!' 
                                : '<strong>⚠️ Setup Required:</strong> Please set your OpenAI API key in Settings first!'
                            }
                        </div>
                    </div>
                    
                    <div id="recordings-list" class="hidden">
                        <h3 class="font-semibold text-text-base mb-2">Recorded Memos:</h3>
                        <div id="recordings-container" class="space-y-2 mb-4 max-h-32 overflow-y-auto"></div>
                    </div>
                    
                    <div class="text-center">
                        <div id="recording-status" class="mb-4">
                            <div id="ready-state" class="text-stone-600">
                                <i data-lucide="mic" class="h-12 w-12 mx-auto mb-2 text-stone-400"></i>
                                <p>Ready to record</p>
                                <p class="text-xs text-stone-500 mt-1">Record multiple memos, then process all at once</p>
                            </div>
                            <div id="recording-state" class="hidden text-red-600">
                                <div class="animate-pulse">
                                    <i data-lucide="mic" class="h-12 w-12 mx-auto mb-2 text-red-500"></i>
                                    <p class="font-semibold">Recording...</p>
                                    <p class="text-sm">Speak clearly about your plants</p>
                                </div>
                            </div>
                            <div id="processing-state" class="hidden text-blue-600">
                                <div class="animate-spin">
                                    <i data-lucide="loader" class="h-12 w-12 mx-auto mb-2 text-blue-500"></i>
                                </div>
                                <p class="font-semibold">Processing all recordings with AI...</p>
                            </div>
                        </div>
                        
                        <div class="space-y-3">
                            <button id="start-recording-btn" data-action="${hasApiKey ? 'start-voice-recording' : 'open-settings'}" 
                                    class="px-8 py-3 ${hasApiKey ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-400 hover:bg-gray-500'} text-white rounded-lg font-semibold flex items-center gap-2 mx-auto">
                                <i data-lucide="${hasApiKey ? 'mic' : 'settings'}" class="h-5 w-5"></i>
                                ${hasApiKey ? 'Start Recording' : 'Set API Key First'}
                            </button>
                            <button id="stop-recording-btn" data-action="stop-voice-recording" 
                                    class="hidden px-8 py-3 bg-stone-500 text-white rounded-lg hover:bg-stone-600 font-semibold flex items-center gap-2 mx-auto">
                                <i data-lucide="square" class="h-5 w-5"></i>
                                Stop Recording
                            </button>

                        </div>
                    </div>
                    
                    <div id="transcript-section" class="hidden">
                        <h3 class="font-semibold text-text-base mb-2">Combined Transcript:</h3>
                        <div id="transcript-text" class="p-3 bg-stone-50 rounded-lg text-sm text-stone-700 mb-3 max-h-40 overflow-y-auto"></div>
                        
                        <h3 class="font-semibold text-text-base mb-2">AI Analysis:</h3>
                        <div id="ai-analysis" class="p-3 bg-green-50 rounded-lg text-sm text-green-700 mb-4 max-h-40 overflow-y-auto"></div>
                        

                    </div>
                    
                </div>
                
                <!-- Fixed bottom buttons -->
                <div class="sticky bottom-0 bg-white border-t border-stone-200 p-4 mt-6">
                    <div id="modal-action-buttons" class="space-y-3">
                        <!-- Process All Recordings Button -->
                        <button id="process-all-recordings-btn" data-action="process-all-recordings" 
                                class="hidden w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 font-semibold flex items-center justify-center gap-2">
                            <i data-lucide="brain" class="h-5 w-5"></i>
                            Process All Recordings
                        </button>
                        
                        <!-- Apply Notes Button (shown after processing) -->
                        <div id="apply-notes-section" class="hidden flex gap-3">
                            <button data-action="apply-voice-notes" class="flex-1 bg-primary text-white py-3 rounded-lg hover:bg-primary/90 font-semibold">
                                Apply Notes to Plants
                            </button>
                            <button data-action="record-more" class="px-6 py-3 border border-stone-300 rounded-lg hover:bg-stone-50">
                                Record More
                            </button>
                        </div>
                        
                        <!-- Close Button -->
                        <button data-action="close-modal" class="w-full px-6 py-3 border border-stone-300 rounded-lg hover:bg-stone-50">
                            Close
                        </button>
                    </div>
                </div>
            </div>`;
        
        openModal(content);
        updateRecordingsList();
    };

    // Voice Recording Functions
    const startVoiceRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 44100,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            
            // Use better audio format for better quality and OpenAI compatibility
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
                ? 'audio/webm;codecs=opus' 
                : MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2')
                ? 'audio/mp4;codecs=mp4a.40.2'
                : 'audio/webm';
            
            voiceRecording.mediaRecorder = new MediaRecorder(stream, { mimeType });
            voiceRecording.audioChunks = [];
            
            voiceRecording.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    voiceRecording.audioChunks.push(event.data);
                }
            };
            
            voiceRecording.mediaRecorder.onstop = async () => {
                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());
                
                const audioBlob = new Blob(voiceRecording.audioChunks, { type: mimeType });
                console.log('Audio blob created:', audioBlob.size, 'bytes, type:', audioBlob.type);
                
                // Add recording to the collection
                voiceRecording.recordings.push({
                    id: Date.now(),
                    blob: audioBlob,
                    timestamp: new Date().toLocaleTimeString(),
                    size: audioBlob.size
                });
                
                // Update UI to show the new recording
                updateRecordingsList();
                showProcessButton();
                resetToReadyState();
            };
            
            voiceRecording.mediaRecorder.start(1000); // Collect data every second for better quality
            voiceRecording.isRecording = true;
            
            // Update UI
            document.getElementById('ready-state').classList.add('hidden');
            document.getElementById('recording-state').classList.remove('hidden');
            document.getElementById('start-recording-btn').classList.add('hidden');
            document.getElementById('stop-recording-btn').classList.remove('hidden');
            
        } catch (error) {
            console.error('Error starting recording:', error);
            let errorMessage = 'Could not access microphone. ';
            if (error.name === 'NotAllowedError') {
                errorMessage += 'Please allow microphone access and try again.';
            } else if (error.name === 'NotFoundError') {
                errorMessage += 'No microphone found on this device.';
            } else {
                errorMessage += 'Please check your browser permissions and microphone settings.';
            }
            alert(errorMessage);
            resetVoiceRecordingUI();
        }
    };
    
    const stopVoiceRecording = () => {
        if (voiceRecording.mediaRecorder && voiceRecording.isRecording) {
            voiceRecording.mediaRecorder.stop();
            voiceRecording.isRecording = false;
            
            // Update UI to processing state
            document.getElementById('recording-state').classList.add('hidden');
            document.getElementById('processing-state').classList.remove('hidden');
            document.getElementById('stop-recording-btn').classList.add('hidden');
        }
    };
    

    
    const analyzeTranscriptForPlants = async (transcript) => {
        const apiKey = localStorage.getItem('openai_api_key');
        
        try {
            // Get list of plants in user's garden for context
            const plantNames = myGarden.map(instance => {
                const plant = getPlantById(instance.plantId);
                return plant ? plant.commonName : '';
            }).filter(name => name);
            
            const prompt = `
Task: Convert the following raw transcript into structured plant observations.
Transcript: "${transcript}"
User's Plants: [${plantNames.join(", ")}]

Output JSON (strict):
{
  "plantUpdates": [
    {
      "plantName": "exact name",
      "category": "growth|health|harvest|care|pest|pollinator|general",
      "notes": "actionable observation",
      "confidence": 0.00-1.00
    }
  ],
  "generalNotes": "garden-wide insights",
  "summary": "concise overview",
  "timestamp": "${new Date().toISOString()}"
}`;

            const response = await fetch('/api/analyze-transcript', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey
                },
                body: JSON.stringify({ 
                    transcript: transcript,
                    prompt: prompt,
                    plants: plantNames
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const analysis = await response.json();
            voiceRecording.currentAnalysis = analysis;
            
            // Update UI with results
            displayTranscriptResults(transcript, analysis);
            
        } catch (error) {
            console.error('Error analyzing transcript:', error);
            alert('Error analyzing transcript. Please try again.');
            resetVoiceRecordingUI();
        }
    };
    
    const displayTranscriptResults = (transcript, analysis) => {
        // Hide processing state
        document.getElementById('processing-state').classList.add('hidden');
        
        // Show transcript section
        document.getElementById('transcript-section').classList.remove('hidden');
        
        // Display transcript
        document.getElementById('transcript-text').textContent = transcript;
        
        // Display analysis
        const analysisDiv = document.getElementById('ai-analysis');
        let analysisHTML = `<p class="font-semibold mb-2">${analysis.summary}</p>`;
        
        if (analysis.plantUpdates && analysis.plantUpdates.length > 0) {
            analysisHTML += '<div class="space-y-2">';
            analysis.plantUpdates.forEach(update => {
                analysisHTML += `
                    <div class="p-2 bg-white rounded border-l-4 border-green-400">
                        <span class="font-semibold">${update.plantName}:</span> ${update.notes}
                        <span class="text-xs text-green-600 ml-2">(${update.confidence} confidence)</span>
                    </div>`;
            });
            analysisHTML += '</div>';
        }
        
        if (analysis.generalNotes) {
            analysisHTML += `<div class="mt-3 p-2 bg-blue-50 rounded">
                <span class="font-semibold">General Notes:</span> ${analysis.generalNotes}
            </div>`;
        }
        
        analysisDiv.innerHTML = analysisHTML;
        
        // Show apply notes buttons in sticky bottom area
        document.getElementById('apply-notes-section').classList.remove('hidden');
    };
    
    const applyVoiceNotesToPlants = () => {
        if (!voiceRecording.currentAnalysis || !voiceRecording.currentAnalysis.plantUpdates) {
            alert('No plant updates to apply.');
            return;
        }
        
        let updatedCount = 0;
        const timestamp = new Date().toISOString().split('T')[0];
        
        voiceRecording.currentAnalysis.plantUpdates.forEach(update => {
            // Find matching plant instances
            const matchingInstances = myGarden.filter(instance => {
                const plant = getPlantById(instance.plantId);
                return plant && plant.commonName.toLowerCase().includes(update.plantName.toLowerCase());
            });
            
            matchingInstances.forEach(instance => {
                const existingNotes = instance.notes || '';
                const newNote = `[${timestamp}] Voice Note: ${update.notes}`;
                instance.notes = existingNotes ? `${existingNotes}\n\n${newNote}` : newNote;
                updatedCount++;
            });
        });
        
        if (updatedCount > 0) {
            saveData();
            renderAll();
            alert(`Successfully updated notes for ${updatedCount} plant${updatedCount > 1 ? 's' : ''}!`);
            mainElements.modalBackdrop.classList.add('hidden');
        } else {
            alert('No matching plants found to update.');
        }
    };
    
    const resetVoiceRecordingUI = () => {
        document.getElementById('recording-state').classList.add('hidden');
        document.getElementById('processing-state').classList.add('hidden');
        document.getElementById('transcript-section').classList.add('hidden');
        document.getElementById('apply-notes-section').classList.add('hidden');
        document.getElementById('ready-state').classList.remove('hidden');
        document.getElementById('start-recording-btn').classList.remove('hidden');
        document.getElementById('stop-recording-btn').classList.add('hidden');
        document.getElementById('process-all-recordings-btn').classList.add('hidden');
        
        // Clear recordings
        voiceRecording.recordings = [];
        updateRecordingsList();
    };

    const resetToReadyState = () => {
        document.getElementById('recording-state').classList.add('hidden');
        document.getElementById('processing-state').classList.add('hidden');
        document.getElementById('ready-state').classList.remove('hidden');
        document.getElementById('start-recording-btn').classList.remove('hidden');
        document.getElementById('stop-recording-btn').classList.add('hidden');
    };

    const updateRecordingsList = () => {
        const recordingsList = document.getElementById('recordings-list');
        const recordingsContainer = document.getElementById('recordings-container');
        
        if (!recordingsList || !recordingsContainer) return;
        
        if (voiceRecording.recordings.length === 0) {
            recordingsList.classList.add('hidden');
            return;
        }
        
        recordingsList.classList.remove('hidden');
        recordingsContainer.innerHTML = voiceRecording.recordings.map((recording, index) => `
            <div class="flex items-center justify-between p-3 bg-white rounded-lg border">
                <div class="flex items-center gap-3">
                    <i data-lucide="mic" class="h-4 w-4 text-green-500"></i>
                    <div>
                        <p class="text-sm font-medium">Recording ${index + 1}</p>
                        <p class="text-xs text-stone-500">${recording.timestamp} • ${(recording.size / 1024).toFixed(1)}KB</p>
                    </div>
                </div>
                <button data-action="delete-recording" data-id="${recording.id}" 
                        class="p-1 text-red-500 hover:bg-red-50 rounded">
                    <i data-lucide="trash-2" class="h-4 w-4"></i>
                </button>
            </div>
        `).join('');
        
        lucide.createIcons();
    };

    const showProcessButton = () => {
        if (voiceRecording.recordings.length > 0) {
            document.getElementById('process-all-recordings-btn').classList.remove('hidden');
        }
    };

    const processAllRecordings = async () => {
        if (voiceRecording.recordings.length === 0) {
            alert('No recordings to process. Please record at least one memo first.');
            return;
        }

        // Show processing state
        document.getElementById('ready-state').classList.add('hidden');
        document.getElementById('processing-state').classList.remove('hidden');
        document.getElementById('start-recording-btn').classList.add('hidden');
        document.getElementById('process-all-recordings-btn').classList.add('hidden');

        try {
            const allTranscripts = [];
            
            // Process each recording
            for (let i = 0; i < voiceRecording.recordings.length; i++) {
                const recording = voiceRecording.recordings[i];
                console.log(`Processing recording ${i + 1} of ${voiceRecording.recordings.length}`);
                
                const transcript = await transcribeAudio(recording.blob);
                if (transcript && transcript.trim()) {
                    allTranscripts.push(`[Recording ${i + 1} - ${recording.timestamp}]: ${transcript}`);
                }
            }
            
            if (allTranscripts.length === 0) {
                throw new Error('No speech detected in any recordings. Please try again and speak more clearly.');
            }
            
            // Combine all transcripts
            const combinedTranscript = allTranscripts.join('\n\n');
            voiceRecording.currentTranscript = combinedTranscript;
            
            // Analyze combined transcript
            await analyzeTranscriptForPlants(combinedTranscript);
            
        } catch (error) {
            console.error('Error processing recordings:', error);
            alert(error.message || 'Error processing recordings. Please try again.');
            resetToReadyState();
            showProcessButton();
        }
    };

    const transcribeAudio = async (audioBlob) => {
        const apiKey = localStorage.getItem('openai_api_key');
        
        // Determine file extension based on blob type
        let fileName = 'recording.wav';
        if (audioBlob.type.includes('webm')) {
            fileName = 'recording.webm';
        } else if (audioBlob.type.includes('mp4')) {
            fileName = 'recording.m4a';
        } else if (audioBlob.type.includes('ogg')) {
            fileName = 'recording.ogg';
        }
        
        const formData = new FormData();
        formData.append('audio', audioBlob, fileName);
        
        const response = await fetch('/api/transcribe-audio', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey
            },
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Transcription failed (${response.status})`);
        }
        
        const result = await response.json();
        return result.transcript;
    };

    // Close modal when clicking backdrop
    mainElements.modalBackdrop.addEventListener('click', (evt) => {
        if (evt.target === mainElements.modalBackdrop) {
            mainElements.modalBackdrop.classList.add('hidden');
        }
    });

    const renderPlantLabels = () => {
        const labelsContainer = document.getElementById('plant-labels');
        if (!labelsContainer) return;
        
        labelsContainer.innerHTML = '';
        
        pollinatorAnimation.flowers.forEach(flower => {
            const label = document.createElement('div');
            label.className = `absolute bg-white/90 px-2 py-1 rounded text-xs font-medium shadow-sm border cursor-pointer transition-all hover:bg-white hover:shadow-md ${flower.isSelected ? 'ring-2 ring-primary bg-primary/10' : ''}`;
            label.style.left = `${flower.x - 25}px`;
            label.style.top = `${flower.y + flower.size + 8}px`;
            label.textContent = flower.name;
            label.onclick = () => selectPlant(flower.id);
            labelsContainer.appendChild(label);
        });
    };

    const renderVisitStats = () => {
        const statsContainer = document.getElementById('plant-visit-stats');
        if (!statsContainer) return;
        
        const sortedStats = Object.entries(pollinatorAnimation.visitStats)
            .sort(([,a], [,b]) => b.total - a.total);
        
        statsContainer.innerHTML = sortedStats.map(([plantId, stats]) => {
            const flower = pollinatorAnimation.flowers.find(f => f.id === plantId);
            const isSelected = flower?.isSelected;
            
            return `
                <div class="bg-white/80 rounded-lg p-3 border transition-all cursor-pointer hover:bg-white hover:shadow-sm ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}" onclick="selectPlant('${plantId}')">
                    <div class="flex items-center justify-between mb-2">
                        <div class="font-medium text-sm truncate">${stats.name}</div>
                        <div class="text-xs text-text-muted">${stats.category}</div>
                    </div>
                    <div class="flex items-center justify-between text-xs">
                        <div class="flex items-center gap-2">
                            <span class="flex items-center gap-1">
                                <div class="w-2 h-2 bg-yellow-400 rounded-full"></div>
                                ${stats.bee}
                            </span>
                            <span class="flex items-center gap-1">
                                <div class="w-2 h-2 bg-orange-500 rounded-full"></div>
                                ${stats.butterfly}
                            </span>
                            <span class="flex items-center gap-1">
                                <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                                ${stats.hummingbird}
                            </span>
                        </div>
                        <div class="font-semibold text-primary">Total: ${stats.total}</div>
                    </div>
                    ${stats.lastVisit ? `<div class="text-xs text-text-muted mt-1">Last visit: ${new Date(stats.lastVisit).toLocaleTimeString()}</div>` : ''}
                </div>
            `;
        }).join('');
    };

    window.selectPlant = (plantId) => {
        // Update selection state
        pollinatorAnimation.flowers.forEach(flower => {
            flower.isSelected = flower.id === plantId;
        });
        
        pollinatorAnimation.selectedPlant = plantId;
        
        // Re-render labels and stats to show selection
        renderPlantLabels();
        renderVisitStats();
        
        // Highlight selected plant with pulse animation
        const selectedFlower = pollinatorAnimation.flowers.find(f => f.id === plantId);
        if (selectedFlower) {
            selectedFlower.pulseAnimation = 60; // frames to pulse
        }
    };

    // Pollinator Visits Chart System (Activity Log Based)
    const initPollinatorChart = () => {
        const chartCanvas = document.getElementById('pollinator-visits-chart');
        if (!chartCanvas) {
            return;
        }

        // Initialize pollinator data from activity log
        initPollinatorDataFromActivityLog();
        
        // Set up chart controls
        setupChartControls();
        
        // Create initial chart
        createPollinatorChart();
    };

    const initPollinatorDataFromActivityLog = () => {
        pollinatorData.visitStats = {};
        pollinatorData.totalVisits = 0;
        pollinatorData.weeklyData = {};
        
        // Initialize stats for all garden plants
        myGarden.forEach(instance => {
            const plant = getPlantById(instance.plantId);
            if (plant) {
                pollinatorData.visitStats[instance.instanceId] = {
                    name: plant.commonName,
                    category: plant.category,
                    bee: 0,
                    butterfly: 0,
                    hummingbird: 0,
                    total: 0,
                    lastVisit: null,
                    plantingDate: instance.plantingDate
                };
            }
        });

        // Organize activity log by weeks
        activityLog.forEach(activity => {
            let pollinatorType = null;
            let count = 1;
            
            // Handle new structured format
            if (activity.type === 'pollinator' && activity.description) {
                pollinatorType = activity.description.toLowerCase();
                count = activity.count || 1;
            } 
            // Handle old message format for backward compatibility
            else if (activity.message) {
                const pollinatorMatch = activity.message.match(/(?:saw|observed|spotted)\s+(\d*)\s*(bee|butterfly|hummingbird)s?\s+(?:on|visiting)\s+/i);
                if (pollinatorMatch) {
                    pollinatorType = pollinatorMatch[2].toLowerCase();
                    count = pollinatorMatch[1] ? parseInt(pollinatorMatch[1]) : 1;
                }
            }
            
            if (pollinatorType && ['bee', 'butterfly', 'hummingbird'].includes(pollinatorType)) {
                const instance = getInstanceById(activity.instanceId);
                const activityDate = new Date(activity.date);
                const weekStart = getWeekStart(activityDate);
                const weekKey = formatWeekKey(weekStart);
                
                if (instance) {
                    // Initialize week data if it doesn't exist
                    if (!pollinatorData.weeklyData[weekKey]) {
                        pollinatorData.weeklyData[weekKey] = {};
                        myGarden.forEach(inst => {
                            const plt = getPlantById(inst.plantId);
                            if (plt) {
                                pollinatorData.weeklyData[weekKey][inst.instanceId] = {
                                    name: plt.commonName,
                                    category: plt.category,
                                    bee: 0,
                                    butterfly: 0,
                                    hummingbird: 0,
                                    total: 0,
                                    lastVisit: null,
                                    plantingDate: inst.plantingDate
                                };
                            }
                        });
                    }
                    
                    // Add to weekly data
                    if (pollinatorData.weeklyData[weekKey][activity.instanceId]) {
                        pollinatorData.weeklyData[weekKey][activity.instanceId][pollinatorType] += count;
                        pollinatorData.weeklyData[weekKey][activity.instanceId].total += count;
                        pollinatorData.weeklyData[weekKey][activity.instanceId].lastVisit = activity.date;
                    }
                }
            }
        });
        
        // Set current week to the most recent week with data, or current week if no data
        if (!pollinatorData.currentWeekStart) {
            const weekKeys = Object.keys(pollinatorData.weeklyData);
            if (weekKeys.length > 0) {
                // Find the week that contains the current date or the most recent week with data
                const currentWeekStart = getWeekStart(new Date());
                const currentWeekKey = currentWeekStart.toISOString().split('T')[0];
                
                if (pollinatorData.weeklyData[currentWeekKey]) {
                    // If current week has data, use it
                    pollinatorData.currentWeekStart = currentWeekStart;
                } else {
                    // Otherwise, use the most recent week with data
                    weekKeys.sort((a, b) => new Date(b) - new Date(a));
                    pollinatorData.currentWeekStart = new Date(weekKeys[0]);
                }
            } else {
                pollinatorData.currentWeekStart = getWeekStart(new Date());
            }
        }
        
        // Load current week's data into main visitStats
        loadWeekData(pollinatorData.currentWeekStart);
        updateWeekDisplay();
    };

    // Helper functions for week calculations
    const getWeekStart = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day; // Sunday = 0
        return new Date(d.setDate(diff));
    };

    const formatWeekKey = (weekStart) => {
        return weekStart.toISOString().split('T')[0]; // YYYY-MM-DD format
    };

    const loadWeekData = (weekStart) => {
        const weekKey = formatWeekKey(weekStart);
        const weekData = pollinatorData.weeklyData[weekKey];
        
        // Reset current stats
        Object.keys(pollinatorData.visitStats).forEach(plantId => {
            pollinatorData.visitStats[plantId].bee = 0;
            pollinatorData.visitStats[plantId].butterfly = 0;
            pollinatorData.visitStats[plantId].hummingbird = 0;
            pollinatorData.visitStats[plantId].total = 0;
            pollinatorData.visitStats[plantId].lastVisit = null;
        });
        
        // Load week data if it exists
        if (weekData) {
            Object.keys(weekData).forEach(plantId => {
                if (pollinatorData.visitStats[plantId]) {
                    pollinatorData.visitStats[plantId].bee = weekData[plantId].bee;
                    pollinatorData.visitStats[plantId].butterfly = weekData[plantId].butterfly;
                    pollinatorData.visitStats[plantId].hummingbird = weekData[plantId].hummingbird;
                    pollinatorData.visitStats[plantId].total = weekData[plantId].total;
                    pollinatorData.visitStats[plantId].lastVisit = weekData[plantId].lastVisit;
                }
            });
        }
        
        pollinatorData.totalVisits = Object.values(pollinatorData.visitStats)
            .reduce((sum, stats) => sum + stats.total, 0);
    };

    const updateWeekDisplay = () => {
        const weekDisplayEl = document.getElementById('current-week-display');
        const dateRangeEl = document.getElementById('week-date-range');
        
        if (weekDisplayEl && dateRangeEl) {
            const weekStart = new Date(pollinatorData.currentWeekStart);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            
            const currentWeek = getWeekStart(new Date());
            const isCurrentWeek = weekStart.getTime() === currentWeek.getTime();
            
            weekDisplayEl.textContent = isCurrentWeek ? 'This Week' : 'Week of';
            dateRangeEl.textContent = `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
        }
    };

    const setupChartControls = () => {
        const resetBtn = document.getElementById('chart-reset-btn');
        const viewModeSelect = document.getElementById('chart-view-mode');
        const closeDetailsBtn = document.getElementById('close-plant-details');
        const prevWeekBtn = document.getElementById('prev-week-btn');
        const nextWeekBtn = document.getElementById('next-week-btn');
        const currentWeekBtn = document.getElementById('current-week-btn');

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                resetPollinatorData();
            });
        }

        if (viewModeSelect) {
            viewModeSelect.addEventListener('change', (e) => {
                chartViewMode = e.target.value;
                updatePollinatorChart();
            });
        }

        if (closeDetailsBtn) {
            closeDetailsBtn.addEventListener('click', () => {
                hideChartPlantDetails();
            });
        }

        if (prevWeekBtn) {
            prevWeekBtn.addEventListener('click', () => {
                const currentWeek = new Date(pollinatorData.currentWeekStart);
                currentWeek.setDate(currentWeek.getDate() - 7);
                pollinatorData.currentWeekStart = currentWeek;
                loadWeekData(pollinatorData.currentWeekStart);
                updateWeekDisplay();
                updatePollinatorChart();
            });
        }

        if (nextWeekBtn) {
            nextWeekBtn.addEventListener('click', () => {
                const currentWeek = new Date(pollinatorData.currentWeekStart);
                currentWeek.setDate(currentWeek.getDate() + 7);
                pollinatorData.currentWeekStart = currentWeek;
                loadWeekData(pollinatorData.currentWeekStart);
                updateWeekDisplay();
                updatePollinatorChart();
            });
        }

        if (currentWeekBtn) {
            currentWeekBtn.addEventListener('click', () => {
                pollinatorData.currentWeekStart = getWeekStart(new Date());
                loadWeekData(pollinatorData.currentWeekStart);
                updateWeekDisplay();
                updatePollinatorChart();
            });
        }
    };

    const createPollinatorChart = () => {
        const chartCanvas = document.getElementById('pollinator-visits-chart');
        if (!chartCanvas) return;

        const ctx = chartCanvas.getContext('2d');
        
        // Destroy existing chart
        if (pollinatorChart) {
            pollinatorChart.destroy();
        }

        const chartData = getChartData();
        
        // Check if there's any data to display
        if (chartData.labels.length === 0) {
            // Show a message instead of an empty chart
            const chartContainer = chartCanvas.parentElement;
            chartContainer.innerHTML = `
                <div class="h-full flex items-center justify-center">
                    <div class="text-center">
                        <i data-lucide="bar-chart-3" class="w-16 h-16 text-stone-300 mx-auto mb-4"></i>
                        <p class="text-lg font-semibold text-stone-600 mb-2">No Pollinator Data for This Week</p>
                        <p class="text-sm text-stone-500">Log pollinator observations in the Activity tab to see data here.</p>
                    </div>
                </div>
            `;
            lucide.createIcons();
            return;
        }
        
        pollinatorChart = new Chart(ctx, {
            type: chartViewMode === 'grouped' ? 'bar' : 'bar',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Pollinator Visits by Plant',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return context[0].label;
                            },
                            label: function(context) {
                                const datasetLabel = context.dataset.label;
                                const value = context.parsed.y;
                                if (chartViewMode === 'percentage') {
                                    return `${datasetLabel}: ${value.toFixed(1)}%`;
                                }
                                return `${datasetLabel}: ${value} visits`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Plants'
                        },
                        stacked: chartViewMode === 'stacked'
                    },
                    y: {
                        title: {
                            display: true,
                            text: chartViewMode === 'percentage' ? 'Percentage (%)' : 'Number of Visits'
                        },
                        stacked: chartViewMode === 'stacked',
                        beginAtZero: true,
                        max: chartViewMode === 'percentage' ? 100 : 100
                    }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const elementIndex = elements[0].index;
                        // Get filtered plant data to match the chart display
                        const filteredPlantData = Object.entries(pollinatorData.visitStats)
                            .filter(([id, stats]) => stats.total > 0);
                        if (filteredPlantData[elementIndex]) {
                            const plantId = filteredPlantData[elementIndex][0];
                            showChartPlantDetails(plantId);
                        }
                    }
                }
            }
        });
    };

    const getChartData = () => {
        // Filter to only include plants with pollinator visits
        const plantData = Object.entries(pollinatorData.visitStats)
            .filter(([id, stats]) => stats.total > 0);
        
        // If no plants have visits, return empty data
        if (plantData.length === 0) {
            return {
                labels: [],
                datasets: [
                    {
                        label: 'Bees',
                        data: [],
                        backgroundColor: 'rgba(255, 212, 0, 0.8)',
                        borderColor: 'rgba(255, 212, 0, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Butterflies',
                        data: [],
                        backgroundColor: 'rgba(255, 107, 53, 0.8)',
                        borderColor: 'rgba(255, 107, 53, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Hummingbirds',
                        data: [],
                        backgroundColor: 'rgba(46, 204, 113, 0.8)',
                        borderColor: 'rgba(46, 204, 113, 1)',
                        borderWidth: 1
                    }
                ]
            };
        }
        
        const labels = plantData.map(([id, stats]) => stats.name);
        
        let beeData, butterflyData, hummingbirdData;
        
        if (chartViewMode === 'percentage') {
            // Calculate percentages
            beeData = plantData.map(([id, stats]) => {
                const total = stats.total;
                return total > 0 ? (stats.bee / total) * 100 : 0;
            });
            butterflyData = plantData.map(([id, stats]) => {
                const total = stats.total;
                return total > 0 ? (stats.butterfly / total) * 100 : 0;
            });
            hummingbirdData = plantData.map(([id, stats]) => {
                const total = stats.total;
                return total > 0 ? (stats.hummingbird / total) * 100 : 0;
            });
        } else {
            // Use raw numbers
            beeData = plantData.map(([id, stats]) => stats.bee);
            butterflyData = plantData.map(([id, stats]) => stats.butterfly);
            hummingbirdData = plantData.map(([id, stats]) => stats.hummingbird);
        }

        return {
            labels: labels,
            datasets: [
                {
                    label: 'Bees',
                    data: beeData,
                    backgroundColor: 'rgba(255, 212, 0, 0.8)',
                    borderColor: 'rgba(255, 212, 0, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Butterflies',
                    data: butterflyData,
                    backgroundColor: 'rgba(255, 107, 53, 0.8)',
                    borderColor: 'rgba(255, 107, 53, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Hummingbirds',
                    data: hummingbirdData,
                    backgroundColor: 'rgba(46, 204, 113, 0.8)',
                    borderColor: 'rgba(46, 204, 113, 1)',
                    borderWidth: 1
                }
            ]
        };
    };

    const updatePollinatorChart = () => {
        if (!pollinatorChart) {
            createPollinatorChart();
            return;
        }
        
        const chartData = getChartData();
        
        // If there's no data, recreate the chart to show the message
        if (chartData.labels.length === 0) {
            createPollinatorChart();
            return;
        }
        
        pollinatorChart.data = chartData;
        
        // Update chart options based on view mode
        pollinatorChart.options.scales.x.stacked = chartViewMode === 'stacked';
        pollinatorChart.options.scales.y.stacked = chartViewMode === 'stacked';
        pollinatorChart.options.scales.y.max = chartViewMode === 'percentage' ? 100 : 100;
        pollinatorChart.options.scales.y.title.text = chartViewMode === 'percentage' ? 'Percentage (%)' : 'Number of Visits';
        
        pollinatorChart.update('none'); // Use 'none' animation mode for faster updates
    };

    const showChartPlantDetails = (plantId) => {
        const stats = pollinatorData.visitStats[plantId];
        const instance = getInstanceById(plantId);
        const plant = instance ? getPlantById(instance.plantId) : null;
        
        if (!stats || !plant) return;

        const detailsContainer = document.getElementById('chart-plant-details');
        const plantNameEl = document.getElementById('chart-plant-name');
        const plantInfoEl = document.getElementById('chart-plant-info');

        if (!detailsContainer || !plantNameEl || !plantInfoEl) return;

        plantNameEl.textContent = stats.name;

        const plantAge = instance ? 
            Math.floor((new Date() - new Date(instance.plantingDate)) / (1000 * 60 * 60 * 24)) : 
            'Unknown';

        const totalVisits = stats.total;
        const beePercentage = totalVisits > 0 ? ((stats.bee / totalVisits) * 100).toFixed(1) : '0';
        const butterflyPercentage = totalVisits > 0 ? ((stats.butterfly / totalVisits) * 100).toFixed(1) : '0';
        const hummingbirdPercentage = totalVisits > 0 ? ((stats.hummingbird / totalVisits) * 100).toFixed(1) : '0';

        // Calculate attractiveness based on plant characteristics
        const attractiveness = getPollinatorAttractiveness(plant.category, plant);
        const preferences = getPollinatorPreferences(plant);

        plantInfoEl.innerHTML = `
            <div class="space-y-3">
                <div class="bg-white rounded-lg p-3">
                    <h5 class="font-semibold text-sm text-text-base mb-2">Plant Information</h5>
                    <div class="grid grid-cols-2 gap-2 text-xs">
                        <div><span class="text-text-muted">Category:</span> <span class="font-medium">${stats.category}</span></div>
                        <div><span class="text-text-muted">Age:</span> <span class="font-medium">${plantAge} days</span></div>
                        <div><span class="text-text-muted">Attractiveness:</span> <span class="font-medium">${(attractiveness * 100).toFixed(0)}%</span></div>
                        <div><span class="text-text-muted">Total Visits:</span> <span class="font-medium">${totalVisits}</span></div>
                    </div>
                </div>
                
                <div class="bg-white rounded-lg p-3">
                    <h5 class="font-semibold text-sm text-text-base mb-2">Visit Breakdown</h5>
                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <div class="w-3 h-3 bg-yellow-400 rounded-full"></div>
                                <span class="text-sm">Bees</span>
                            </div>
                            <span class="text-sm font-medium">${stats.bee} visits (${beePercentage}%)</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <div class="w-3 h-3 bg-orange-500 rounded-full"></div>
                                <span class="text-sm">Butterflies</span>
                            </div>
                            <span class="text-sm font-medium">${stats.butterfly} visits (${butterflyPercentage}%)</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <div class="w-3 h-3 bg-green-500 rounded-full"></div>
                                <span class="text-sm">Hummingbirds</span>
                            </div>
                            <span class="text-sm font-medium">${stats.hummingbird} visits (${hummingbirdPercentage}%)</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="space-y-3">
                <div class="bg-white rounded-lg p-3">
                    <h5 class="font-semibold text-sm text-text-base mb-2">Pollinator Preferences</h5>
                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-sm">Bee Preference</span>
                            <div class="flex items-center gap-2">
                                <div class="w-16 h-2 bg-stone-200 rounded-full overflow-hidden">
                                    <div class="h-full bg-yellow-400 rounded-full" style="width: ${preferences.bee * 100}%"></div>
                                </div>
                                <span class="text-xs text-text-muted">${(preferences.bee * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-sm">Butterfly Preference</span>
                            <div class="flex items-center gap-2">
                                <div class="w-16 h-2 bg-stone-200 rounded-full overflow-hidden">
                                    <div class="h-full bg-orange-500 rounded-full" style="width: ${preferences.butterfly * 100}%"></div>
                                </div>
                                <span class="text-xs text-text-muted">${(preferences.butterfly * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-sm">Hummingbird Preference</span>
                            <div class="flex items-center gap-2">
                                <div class="w-16 h-2 bg-stone-200 rounded-full overflow-hidden">
                                    <div class="h-full bg-green-500 rounded-full" style="width: ${preferences.hummingbird * 100}%"></div>
                                </div>
                                <span class="text-xs text-text-muted">${(preferences.hummingbird * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${stats.lastVisit ? `
                <div class="bg-white rounded-lg p-3">
                    <h5 class="font-semibold text-sm text-text-base mb-2">Recent Activity</h5>
                    <p class="text-sm text-text-muted">Last visit: ${new Date(stats.lastVisit).toLocaleString()}</p>
                </div>
                ` : ''}
            </div>
        `;

        detailsContainer.classList.remove('hidden');
        
        // Also select the plant in the visualization
        window.selectPlant(plantId);
    };

    const hideChartPlantDetails = () => {
        const detailsContainer = document.getElementById('chart-plant-details');
        if (detailsContainer) {
            detailsContainer.classList.add('hidden');
        }
    };

    const resetPollinatorData = () => {
        // Reset all visit statistics
        Object.keys(pollinatorData.visitStats).forEach(plantId => {
            pollinatorData.visitStats[plantId].bee = 0;
            pollinatorData.visitStats[plantId].butterfly = 0;
            pollinatorData.visitStats[plantId].hummingbird = 0;
            pollinatorData.visitStats[plantId].total = 0;
            pollinatorData.visitStats[plantId].lastVisit = null;
        });
        
        pollinatorData.totalVisits = 0;
        
        // Update chart
        updatePollinatorChart();
        hideChartPlantDetails();
    };

    // Function to refresh pollinator data when activity log changes
    const refreshPollinatorData = () => {
        // Store current week being viewed
        const currentViewingWeek = pollinatorData.currentWeekStart;
        
        // Reinitialize data
        initPollinatorDataFromActivityLog();
        
        // Restore the week the user was viewing
        if (currentViewingWeek) {
            pollinatorData.currentWeekStart = currentViewingWeek;
            loadWeekData(pollinatorData.currentWeekStart);
            updateWeekDisplay();
        }
        
        updatePollinatorChart();
    };

}); 