// Enhanced Agentic UI - Beautiful User Interface for Garden AI Agents
class AgenticUI {
    constructor() {
        this.isVisible = false;
        this.currentView = 'dashboard';
        this.animations = {
            slideIn: 'transform translate-x-0 opacity-100',
            slideOut: 'transform translate-x-full opacity-0'
        };
        this.agentColors = {
            proactiveCare: 'from-blue-500 to-cyan-500',
            healthMonitor: 'from-green-500 to-emerald-500',
            harvestOptimizer: 'from-orange-500 to-amber-500',
            gardenPlanner: 'from-purple-500 to-violet-500',
            environmentalIntelligence: 'from-teal-500 to-green-500'
        };
    }

    initialize() {
        this.createMainInterface();
        this.setupEventListeners();
        this.createFloatingActionButton();
        
        // Load stored agent results from previous sessions
        setTimeout(() => {
            this.updateAgentResultsDisplay();
        }, 500);
        
        // Auto-show interface on first load if API key is configured
        setTimeout(() => {
            const apiKey = localStorage.getItem('openai_api_key');
            if (apiKey && apiKey !== 'PASTE_YOUR_OPENAI_API_KEY_HERE' && !apiKey.includes('test-key')) {
                this.toggleInterface();
            }
        }, 1000);
        
        console.log('Enhanced Agentic UI initialized');
    }

    createFloatingActionButton() {
        // Create a beautiful floating action button for easy access
        const fab = document.createElement('div');
        fab.id = 'agentic-fab';
        fab.className = `
            fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 
            rounded-full shadow-2xl cursor-pointer z-50 flex items-center justify-center
            hover:shadow-3xl hover:scale-110 transition-all duration-300 ease-out
            ring-4 ring-purple-200 hover:ring-purple-300 animate-pulse
        `;
        fab.innerHTML = `
            <div class="relative">
                <i data-lucide="brain-circuit" class="h-8 w-8 text-white"></i>
                <div class="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-ping"></div>
                <div class="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full"></div>
            </div>
        `;
        
        fab.addEventListener('click', () => this.toggleInterface());
        
        // Add tooltip
        const tooltip = document.createElement('div');
        tooltip.className = `
            absolute right-20 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white 
            px-3 py-2 rounded-lg text-sm font-medium opacity-0 pointer-events-none
            transition-opacity duration-200 whitespace-nowrap
        `;
        tooltip.textContent = 'Garden AI Agents';
        fab.appendChild(tooltip);
        
        fab.addEventListener('mouseenter', () => {
            tooltip.classList.remove('opacity-0');
            tooltip.classList.add('opacity-100');
        });
        
        fab.addEventListener('mouseleave', () => {
            tooltip.classList.add('opacity-0');
            tooltip.classList.remove('opacity-100');
        });
        
        document.body.appendChild(fab);
        lucide.createIcons();
    }

    createMainInterface() {
        const container = document.createElement('div');
        container.id = 'agentic-interface';
        container.className = `
            fixed inset-y-0 right-0 w-96 bg-white shadow-2xl transform translate-x-full 
            transition-transform duration-300 ease-in-out z-40 overflow-hidden
            border-l border-gray-200 flex flex-col
        `;
        
        container.innerHTML = `
            <!-- Header -->
            <div class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                            <i data-lucide="brain-circuit" class="h-6 w-6"></i>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold">Garden AI</h2>
                            <p class="text-indigo-100 text-sm">Intelligent Garden Management</p>
                        </div>
                    </div>
                    <button id="close-agentic-interface" class="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
                        <i data-lucide="x" class="h-5 w-5"></i>
                    </button>
                </div>
                
                <!-- Navigation -->
                <div class="flex mt-6 bg-white/10 rounded-lg p-1">
                    <button class="nav-btn active flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors" data-view="dashboard">
                        <i data-lucide="layout-dashboard" class="h-4 w-4 mr-2 inline"></i>Dashboard
                    </button>
                    <button class="nav-btn flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors" data-view="agents">
                        <i data-lucide="users" class="h-4 w-4 mr-2 inline"></i>Agents
                    </button>
                    <button class="nav-btn flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors" data-view="settings">
                        <i data-lucide="settings" class="h-4 w-4 mr-2 inline"></i>Settings
                    </button>
                </div>
            </div>
            
            <!-- Content Area -->
            <div class="flex-1 h-0 flex flex-col">
                <!-- Dashboard View -->
                <div id="dashboard-view" class="view-content flex-1 overflow-y-auto p-6">
                    <div class="space-y-6">
                        <!-- Quick Actions -->
                        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                            <h3 class="font-semibold text-gray-900 mb-3 flex items-center">
                                <i data-lucide="zap" class="h-5 w-5 mr-2 text-blue-600"></i>
                                Quick Actions
                            </h3>
                            <div class="grid grid-cols-2 gap-3">
                                <button class="quick-action-btn bg-white hover:bg-blue-50 border border-blue-200 rounded-lg p-3 text-center transition-colors" data-action="run-all">
                                    <i data-lucide="play-circle" class="h-6 w-6 mx-auto mb-1 text-blue-600"></i>
                                    <div class="text-xs font-medium text-gray-700">Run All</div>
                                </button>
                                <button class="quick-action-btn bg-white hover:bg-green-50 border border-green-200 rounded-lg p-3 text-center transition-colors" data-action="health-check">
                                    <i data-lucide="heart-pulse" class="h-6 w-6 mx-auto mb-1 text-green-600"></i>
                                    <div class="text-xs font-medium text-gray-700">Health Check</div>
                                </button>
                                <button class="quick-action-btn bg-white hover:bg-orange-50 border border-orange-200 rounded-lg p-3 text-center transition-colors" data-action="weather-update">
                                    <i data-lucide="cloud-sun" class="h-6 w-6 mx-auto mb-1 text-orange-600"></i>
                                    <div class="text-xs font-medium text-gray-700">Weather</div>
                                </button>
                                <button class="quick-action-btn bg-white hover:bg-purple-50 border border-purple-200 rounded-lg p-3 text-center transition-colors" data-action="harvest-check">
                                    <i data-lucide="apple" class="h-6 w-6 mx-auto mb-1 text-purple-600"></i>
                                    <div class="text-xs font-medium text-gray-700">Harvest</div>
                                </button>
                            </div>
                        </div>
                        
                        <!-- System Status -->
                        <div class="bg-white rounded-xl border border-gray-200 p-4">
                            <h3 class="font-semibold text-gray-900 mb-3 flex items-center">
                                <i data-lucide="activity" class="h-5 w-5 mr-2 text-green-600"></i>
                                System Status
                            </h3>
                            <div class="space-y-3" id="system-status">
                                <!-- Status items will be populated here -->
                            </div>
                        </div>
                        
                        <!-- Agent Results -->
                        <div class="bg-white rounded-xl border border-gray-200 p-4">
                            <h3 class="font-semibold text-gray-900 mb-3 flex items-center">
                                <i data-lucide="brain-circuit" class="h-5 w-5 mr-2 text-gray-600"></i>
                                Agent Results
                            </h3>
                            <div class="space-y-3" id="agent-results">
                                <div class="text-sm text-gray-500 text-center py-4">Run an agent to see results here</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Agents View -->
                <div id="agents-view" class="view-content hidden flex-1 overflow-y-auto p-6">
                    <div class="space-y-4" id="agents-list">
                        <!-- Agent cards will be populated here -->
                    </div>
                </div>
                
                <!-- Settings View -->
                <div id="settings-view" class="view-content hidden flex-1 overflow-y-auto p-6">
                    <div class="space-y-6">
                        <!-- API Configuration -->
                        <div class="bg-white rounded-xl border border-gray-200 p-4">
                            <h3 class="font-semibold text-gray-900 mb-3 flex items-center">
                                <i data-lucide="key" class="h-5 w-5 mr-2 text-blue-600"></i>
                                API Configuration
                            </h3>
                            
                            <!-- API Key Status Indicator -->
                            <div id="api-key-status" class="p-4 rounded-lg border-2 border-red-200 bg-red-50 mb-4">
                                <div class="flex items-center gap-2 mb-2">
                                    <i data-lucide="alert-circle" class="h-5 w-5 text-red-500"></i>
                                    <span class="font-medium text-red-700">API Key Required</span>
                                </div>
                                <p class="text-sm text-red-600">
                                    You need to configure your OpenAI API key to use the agentic features.
                                </p>
                            </div>

                            <div class="space-y-4">
                                <!-- Setup Instructions -->
                                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <h4 class="font-medium text-blue-800 mb-2 flex items-center gap-2">
                                        <i data-lucide="info" class="h-4 w-4"></i>
                                        How to get your API key:
                                    </h4>
                                    <ol class="text-sm text-blue-700 space-y-1 ml-4">
                                        <li>1. Go to <a href="https://platform.openai.com/account/api-keys" target="_blank" class="underline hover:no-underline">OpenAI API Keys</a></li>
                                        <li>2. Sign in to your OpenAI account</li>
                                        <li>3. Click "Create new secret key"</li>
                                        <li>4. Copy the key (starts with "sk-")</li>
                                        <li>5. Paste it below and click "Save API Key"</li>
                                    </ol>
                                </div>

                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">OpenAI API Key</label>
                                    <div class="relative">
                                        <input type="password" id="api-key-input" 
                                               class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                               placeholder="sk-...">
                                        <button type="button" id="toggle-api-key" 
                                                class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                            <i data-lucide="eye" class="h-4 w-4"></i>
                                        </button>
                                    </div>
                                    <p class="text-xs text-gray-500 mt-1">
                                        Your API key is stored locally and never sent to our servers.
                                    </p>
                                </div>
                                
                                <button id="save-api-key" 
                                        class="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium">
                                    Save API Key
                                </button>
                            </div>
                        </div>
                        
                        <!-- Agent Preferences -->
                        <div class="bg-white rounded-xl border border-gray-200 p-4">
                            <h3 class="font-semibold text-gray-900 mb-3 flex items-center">
                                <i data-lucide="sliders" class="h-5 w-5 mr-2 text-purple-600"></i>
                                Agent Preferences
                            </h3>
                            <div class="space-y-4">
                                <div class="flex items-center justify-between">
                                    <span class="text-sm font-medium text-gray-700">Auto-run agents</span>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" class="sr-only peer" id="auto-run-toggle">
                                        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-sm font-medium text-gray-700">Notifications</span>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" class="sr-only peer" id="notifications-toggle" checked>
                                        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Check Interval</label>
                                    <select id="check-interval" class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                        <option value="1800000">30 minutes</option>
                                        <option value="3600000" selected>1 hour</option>
                                        <option value="7200000">2 hours</option>
                                        <option value="21600000">6 hours</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(container);
        this.populateAgentCards();
        this.loadSystemStatus();
        lucide.createIcons();
    }

    populateAgentCards() {
        const agentsList = document.getElementById('agents-list');
        const agents = [
            {
                id: 'proactiveCare',
                name: 'Proactive Care',
                description: 'Weather-responsive care scheduling and automated notifications',
                icon: 'cloud-sun',
                status: 'ready',
                lastRun: null,
                features: ['Weather monitoring', 'Care scheduling', 'Smart notifications']
            },
            {
                id: 'healthMonitor',
                name: 'Health Monitor',
                description: 'Plant health analysis, diagnostics, and treatment recommendations',
                icon: 'heart-pulse',
                status: 'ready',
                lastRun: null,
                features: ['Health analysis', 'Disease detection', 'Treatment plans']
            },
            {
                id: 'harvestOptimizer',
                name: 'Harvest Optimizer',
                description: 'Harvest timing prediction and storage optimization',
                icon: 'apple',
                status: 'ready',
                lastRun: null,
                features: ['Harvest timing', 'Yield prediction', 'Storage planning']
            },
            {
                id: 'gardenPlanner',
                name: 'Garden Planner',
                description: 'Companion planting and layout optimization strategies',
                icon: 'layout-grid',
                status: 'ready',
                lastRun: null,
                features: ['Companion planting', 'Layout optimization', 'Crop rotation']
            },
            {
                id: 'environmentalIntelligence',
                name: 'Environmental AI',
                description: 'Weather patterns and microclimate analysis',
                icon: 'thermometer',
                status: 'ready',
                lastRun: null,
                features: ['Weather patterns', 'Microclimate zones', 'Environmental insights']
            }
        ];

        agentsList.innerHTML = agents.map(agent => `
            <div class="agent-card bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-200">
                <div class="bg-gradient-to-r ${this.agentColors[agent.id]} p-4 text-white">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                <i data-lucide="${agent.icon}" class="h-6 w-6"></i>
                            </div>
                            <div>
                                <h3 class="font-semibold">${agent.name}</h3>
                                <div class="flex items-center space-x-2 text-xs opacity-90">
                                    <div class="w-2 h-2 bg-green-400 rounded-full"></div>
                                    <span>${agent.status}</span>
                                </div>
                            </div>
                        </div>
                        <button class="run-agent-btn w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors" 
                                data-agent="${agent.id}">
                            <i data-lucide="play" class="h-4 w-4"></i>
                        </button>
                    </div>
                </div>
                
                <div class="p-4">
                    <p class="text-sm text-gray-600 mb-3">${agent.description}</p>
                    
                    <div class="space-y-2 mb-4">
                        <div class="text-xs font-medium text-gray-500 uppercase tracking-wider">Features</div>
                        <div class="flex flex-wrap gap-1">
                            ${agent.features.map(feature => `
                                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                                    ${feature}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="flex items-center justify-between text-xs text-gray-500">
                        <span>Last run: ${agent.lastRun || 'Never'}</span>
                        <button class="agent-details-btn text-blue-600 hover:text-blue-800 font-medium" data-agent="${agent.id}">
                            View Details
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        lucide.createIcons();
    }

    setupEventListeners() {
        // Close button
        document.getElementById('close-agentic-interface').addEventListener('click', () => {
            this.toggleInterface();
        });

        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.switchView(view);
            });
        });

        // Quick actions
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleQuickAction(action);
            });
        });

        // Agent run buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('.run-agent-btn')) {
                const agent = e.target.closest('.run-agent-btn').dataset.agent;
                this.runAgent(agent);
            }
        });

        // API key management
        document.getElementById('toggle-api-key').addEventListener('click', () => {
            const input = document.getElementById('api-key-input');
            const icon = document.querySelector('#toggle-api-key i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.setAttribute('data-lucide', 'eye-off');
            } else {
                input.type = 'password';
                icon.setAttribute('data-lucide', 'eye');
            }
            lucide.createIcons();
        });

        document.getElementById('save-api-key').addEventListener('click', () => {
            const apiKey = document.getElementById('api-key-input').value;
            if (apiKey.trim()) {
                localStorage.setItem('openai_api_key', apiKey);
                this.showNotification('success', 'API key saved successfully!');
                this.updateApiKeyStatus();
            } else {
                this.showNotification('error', 'Please enter a valid API key');
            }
        });

        // Load existing API key
        const existingKey = localStorage.getItem('openai_api_key');
        if (existingKey && existingKey !== 'PASTE_YOUR_OPENAI_API_KEY_HERE') {
            document.getElementById('api-key-input').value = existingKey;
        }
        
        // Update API key status
        this.updateApiKeyStatus();
    }

    toggleInterface() {
        const container = document.getElementById('agentic-interface');
        
        if (this.isVisible) {
            container.classList.add('translate-x-full');
            container.classList.remove('translate-x-0');
            this.isVisible = false;
        } else {
            container.classList.remove('translate-x-full');
            container.classList.add('translate-x-0');
            this.isVisible = true;
            this.refreshData();
        }
    }

    switchView(view) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active', 'bg-white/20', 'text-white');
            btn.classList.add('text-white/70');
        });
        
        document.querySelector(`[data-view="${view}"]`).classList.add('active', 'bg-white/20', 'text-white');
        document.querySelector(`[data-view="${view}"]`).classList.remove('text-white/70');

        // Update content
        document.querySelectorAll('.view-content').forEach(content => {
            content.classList.add('hidden');
        });
        
        document.getElementById(`${view}-view`).classList.remove('hidden');
        this.currentView = view;
    }

    async handleQuickAction(action) {
        this.showNotification('info', 'Running quick action...');
        
        try {
            switch (action) {
                case 'run-all':
                    await this.runAllAgents();
                    break;
                case 'health-check':
                    await this.runAgent('healthMonitor');
                    break;
                case 'weather-update':
                    await this.runAgent('proactiveCare');
                    break;
                case 'harvest-check':
                    await this.runAgent('harvestOptimizer');
                    break;
            }
        } catch (error) {
            this.showNotification('error', `Quick action failed: ${error.message}`);
        }
    }

    async runAgent(agentId) {
        // Check if API key is configured
        const apiKey = localStorage.getItem('openai_api_key');
        if (!apiKey || apiKey === 'PASTE_YOUR_OPENAI_API_KEY_HERE' || apiKey.includes('test-key')) {
            this.showNotification('error', 'Please configure a valid OpenAI API key first! Click the API Key tab to add your key.');
            // Auto-switch to settings view if not already there
            if (this.currentView !== 'settings') {
                this.switchView('settings');
            }
            return;
        }

        if (!window.agenticFeatures) {
            this.showNotification('error', 'Agentic system not initialized');
            return;
        }

        try {
            this.showNotification('info', `Running ${agentId} agent...`);
            
            // Update UI to show running state
            const agentCard = document.querySelector(`[data-agent="${agentId}"]`).closest('.agent-card');
            if (agentCard) {
                const runButton = agentCard.querySelector('.run-agent-btn');
                if (runButton) {
                    runButton.innerHTML = '<i data-lucide="loader-2" class="h-4 w-4 animate-spin"></i>';
                    lucide.createIcons();
                }
            }
            
            const result = await window.agenticFeatures.runAgent(agentId);
            
            // Update button to show success
            if (agentCard) {
                const runButton = agentCard.querySelector('.run-agent-btn');
                if (runButton) {
                    runButton.innerHTML = '<i data-lucide="check" class="h-4 w-4 text-green-600"></i>';
                    lucide.createIcons();
                    
                    // Reset button after delay
                    setTimeout(() => {
                        runButton.innerHTML = '<i data-lucide="play" class="h-4 w-4"></i>';
                        lucide.createIcons();
                    }, 2000);
                }
            }
            
            // Display results in a user-friendly format
            this.displayAgentResults(agentId, result);
            this.showNotification('success', `${agentId} agent completed successfully`);
            this.refreshData();
            
        } catch (error) {
            console.error('Agent error:', error);
            
            // Provide specific error messages for common issues
            let errorMessage = error.message;
            if (error.message.includes('401') || error.message.includes('API key') || error.message.includes('Incorrect API key')) {
                errorMessage = 'Invalid API key! Please check your OpenAI API key in the settings tab.';
                // Auto-switch to settings view
                this.switchView('settings');
            } else if (error.message.includes('429')) {
                errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
            } else if (error.message.includes('500')) {
                errorMessage = 'Server error. Please try again in a moment.';
            }
            
            this.showNotification('error', `${agentId} failed: ${errorMessage}`);
            
            // Reset button on error
            const agentCard = document.querySelector(`[data-agent="${agentId}"]`).closest('.agent-card');
            if (agentCard) {
                const runButton = agentCard.querySelector('.run-agent-btn');
                if (runButton) {
                    runButton.innerHTML = '<i data-lucide="alert-circle" class="h-4 w-4 text-red-500"></i>';
                    lucide.createIcons();
                    
                    // Reset button after delay
                    setTimeout(() => {
                        runButton.innerHTML = '<i data-lucide="play" class="h-4 w-4"></i>';
                        lucide.createIcons();
                    }, 3000);
                }
            }
        }
    }

    async runAllAgents() {
        const agents = ['proactiveCare', 'healthMonitor', 'harvestOptimizer', 'gardenPlanner', 'environmentalIntelligence'];
        
        for (const agent of agents) {
            try {
                await this.runAgent(agent);
                // Add delay between agents
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                console.error(`Failed to run agent ${agent}:`, error);
            }
        }
    }

    async loadSystemStatus() {
        try {
            const response = await fetch('/api/agentic/status');
            const data = await response.json();
            
            const statusContainer = document.getElementById('system-status');
            if (data.success) {
                statusContainer.innerHTML = Object.entries(data.agents).map(([key, agent]) => `
                    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div class="flex items-center space-x-3">
                            <div class="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span class="font-medium text-sm">${agent.name}</span>
                        </div>
                        <span class="text-xs text-gray-500 capitalize">${agent.status}</span>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Failed to load system status:', error);
        }
    }

    refreshData() {
        this.loadSystemStatus();
        this.updateApiKeyStatus();
        
        // Ensure current view is still visible after refresh
        if (this.currentView) {
            this.switchView(this.currentView);
        }
        
        // Update agent results display
        this.updateAgentResultsDisplay();
        
        // Re-initialize any missing event handlers
        this.reinitializeEventHandlers();
    }
    
    updateAgentResultsDisplay() {
        // Check if there are stored agent results that need to be re-displayed
        const storedResults = this.getStoredAgentResults();
        if (storedResults && storedResults.length > 0) {
            const resultsContainer = document.getElementById('agent-results');
            if (resultsContainer && resultsContainer.children.length === 0) {
                // Re-display the most recent results if container is empty
                storedResults.slice(0, 3).forEach(result => {
                    this.displayAgentResults(result.agentId, result.data);
                });
            }
        }
    }
    
    getStoredAgentResults() {
        try {
            const stored = localStorage.getItem('recent_agent_results');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading stored agent results:', error);
            return [];
        }
    }
    
    storeAgentResult(agentId, result) {
        try {
            const stored = this.getStoredAgentResults();
            const newResult = {
                agentId,
                data: result,
                timestamp: new Date().toISOString()
            };
            
            // Add to beginning and keep only last 20 results for better history
            stored.unshift(newResult);
            const trimmed = stored.slice(0, 20);
            
            localStorage.setItem('recent_agent_results', JSON.stringify(trimmed));
            
            // Also store in the individual agent format for backward compatibility
            const agentStorageKey = `agentResults_${agentId}`;
            const agentResults = JSON.parse(localStorage.getItem(agentStorageKey) || '[]');
            agentResults.unshift({
                timestamp: newResult.timestamp,
                result: result
            });
            
            // Keep only last 10 results per agent
            const trimmedAgentResults = agentResults.slice(0, 10);
            localStorage.setItem(agentStorageKey, JSON.stringify(trimmedAgentResults));
            
        } catch (error) {
            console.error('Error storing agent result:', error);
        }
    }
    
    reinitializeEventHandlers() {
        // Re-attach event listeners that might have been lost
        const viewButtons = document.querySelectorAll('.view-full-results-btn');
        viewButtons.forEach(button => {
            if (!button.hasAttribute('data-listener-attached')) {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    const agentId = e.target.getAttribute('data-agent-id');
                    const resultData = JSON.parse(e.target.getAttribute('data-result'));
                    this.showFullResults(agentId, resultData);
                });
                button.setAttribute('data-listener-attached', 'true');
            }
        });
    }

    updateApiKeyStatus() {
        const apiKey = localStorage.getItem('openai_api_key');
        const statusDiv = document.getElementById('api-key-status');
        
        if (apiKey && apiKey !== 'PASTE_YOUR_OPENAI_API_KEY_HERE' && !apiKey.includes('test-key')) {
            // API key is configured
            statusDiv.className = 'p-4 rounded-lg border-2 border-green-200 bg-green-50 mb-4';
            statusDiv.innerHTML = `
                <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="check-circle" class="h-5 w-5 text-green-500"></i>
                    <span class="font-medium text-green-700">API Key Configured</span>
                </div>
                <p class="text-sm text-green-600">
                    Your OpenAI API key is configured and the agentic features are ready to use!
                </p>
            `;
        } else {
            // API key not configured
            statusDiv.className = 'p-4 rounded-lg border-2 border-red-200 bg-red-50 mb-4';
            statusDiv.innerHTML = `
                <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="alert-circle" class="h-5 w-5 text-red-500"></i>
                    <span class="font-medium text-red-700">API Key Required</span>
                </div>
                <p class="text-sm text-red-600">
                    You need to configure your OpenAI API key to use the agentic features.
                </p>
            `;
        }
        
        lucide.createIcons();
    }

    showNotification(type, message) {
        const notification = document.createElement('div');
        notification.className = `
            fixed top-4 right-4 max-w-sm p-4 rounded-lg shadow-lg z-50
            ${type === 'success' ? 'bg-green-500 text-white' :
              type === 'error' ? 'bg-red-500 text-white' :
              'bg-blue-500 text-white'}
        `;
        
        notification.innerHTML = `
            <div class="flex items-center space-x-3">
                <i data-lucide="check-circle" class="h-5 w-5"></i>
                <p class="font-medium">${message}</p>
                <button onclick="this.parentElement.parentElement.remove()">
                    <i data-lucide="x" class="h-4 w-4"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        lucide.createIcons();
        setTimeout(() => notification.remove(), 5000);
    }

    displayAgentResults(agentId, result) {
        const resultsContainer = document.getElementById('agent-results');
        if (!resultsContainer || !result) return;

        const agentNames = {
            'proactiveCare': 'Proactive Care',
            'healthMonitor': 'Health Monitor', 
            'harvestOptimizer': 'Harvest Optimizer',
            'gardenPlanner': 'Garden Planner',
            'environmentalIntelligence': 'Environmental Intelligence'
        };

        const agentIcons = {
            'proactiveCare': 'cloud-sun',
            'healthMonitor': 'heart-pulse',
            'harvestOptimizer': 'apple',
            'gardenPlanner': 'layout-grid',
            'environmentalIntelligence': 'thermometer'
        };

        // Create result card
        const resultCard = document.createElement('div');
        resultCard.className = 'bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500';
        
        let resultHtml = `
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                    <i data-lucide="${agentIcons[agentId] || 'brain'}" class="h-5 w-5 text-blue-600"></i>
                    <h4 class="font-semibold text-gray-900">${agentNames[agentId] || agentId}</h4>
                </div>
                <span class="text-xs text-gray-500">${new Date().toLocaleTimeString()}</span>
            </div>
        `;

        // Format different types of results
        if (result.recommendations && result.recommendations.length > 0) {
            resultHtml += `
                <div class="mb-3">
                    <h5 class="text-sm font-medium text-gray-700 mb-2">Recommendations:</h5>
                    <ul class="space-y-1">
                        ${result.recommendations.slice(0, 3).map(rec => `
                            <li class="text-sm text-gray-600 flex items-start gap-2">
                                <span class="inline-block w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                                <span>${rec.description || rec.action || rec.treatment || rec}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        if (result.urgentTasks && result.urgentTasks.length > 0) {
            resultHtml += `
                <div class="mb-3">
                    <h5 class="text-sm font-medium text-red-700 mb-2">Urgent Tasks:</h5>
                    <ul class="space-y-1">
                        ${result.urgentTasks.slice(0, 2).map(task => `
                            <li class="text-sm text-red-600 flex items-start gap-2">
                                <i data-lucide="alert-triangle" class="h-3 w-3 mt-0.5 flex-shrink-0"></i>
                                <span>${task.task || task.description || task}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        if (result.weatherAlerts && result.weatherAlerts.length > 0) {
            resultHtml += `
                <div class="mb-3">
                    <h5 class="text-sm font-medium text-orange-700 mb-2">Weather Alerts:</h5>
                    <ul class="space-y-1">
                        ${result.weatherAlerts.slice(0, 2).map(alert => `
                            <li class="text-sm text-orange-600 flex items-start gap-2">
                                <i data-lucide="cloud-rain" class="h-3 w-3 mt-0.5 flex-shrink-0"></i>
                                <span>${alert.message || alert}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        if (result.harvestSchedule && result.harvestSchedule.length > 0) {
            resultHtml += `
                <div class="mb-3">
                    <h5 class="text-sm font-medium text-green-700 mb-2">Harvest Schedule:</h5>
                    <ul class="space-y-1">
                        ${result.harvestSchedule.slice(0, 3).map(harvest => `
                            <li class="text-sm text-green-600 flex items-start gap-2">
                                <i data-lucide="calendar" class="h-3 w-3 mt-0.5 flex-shrink-0"></i>
                                <span>${harvest.plantName || 'Plant'}: ${harvest.harvestDate || 'Soon'} (${harvest.readiness || 'Ready'})</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        if (result.healthAssessment) {
            const assessment = result.healthAssessment;
            resultHtml += `
                <div class="mb-3">
                    <h5 class="text-sm font-medium text-gray-700 mb-2">Health Assessment:</h5>
                    <div class="flex items-center gap-2 mb-1">
                        <div class="w-16 bg-gray-200 rounded-full h-2">
                            <div class="bg-green-500 h-2 rounded-full" style="width: ${assessment.overallScore || 75}%"></div>
                        </div>
                        <span class="text-sm text-gray-600">${assessment.overallScore || 75}% Health</span>
                    </div>
                    <p class="text-sm text-gray-600">${assessment.summary}</p>
                </div>
            `;
        }

        // Handle Environmental Intelligence results
        if (result.analysis) {
            const analysis = result.analysis;
            if (analysis.summary) {
                resultHtml += `
                    <div class="mb-3">
                        <h5 class="text-sm font-medium text-gray-700 mb-2">📊 Analysis Summary:</h5>
                        <p class="text-sm text-gray-600 bg-blue-50 p-2 rounded">${analysis.summary}</p>
                    </div>
                `;
            }
            
            if (analysis.keyInsights && analysis.keyInsights.length > 0) {
                resultHtml += `
                    <div class="mb-3">
                        <h5 class="text-sm font-medium text-blue-700 mb-2">💡 Key Insights:</h5>
                        <ul class="space-y-1">
                            ${analysis.keyInsights.slice(0, 2).map(insight => `
                                <li class="text-sm text-blue-600 flex items-start gap-2">
                                    <i data-lucide="lightbulb" class="h-3 w-3 mt-0.5 flex-shrink-0"></i>
                                    <span>${insight}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `;
            }
            
            if (analysis.riskFactors && analysis.riskFactors.length > 0) {
                resultHtml += `
                    <div class="mb-3">
                        <h5 class="text-sm font-medium text-yellow-700 mb-2">⚠️ Risk Factors:</h5>
                        <ul class="space-y-1">
                            ${analysis.riskFactors.slice(0, 2).map(risk => `
                                <li class="text-sm text-yellow-600 flex items-start gap-2">
                                    <i data-lucide="alert-triangle" class="h-3 w-3 mt-0.5 flex-shrink-0"></i>
                                    <span>${risk}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `;
            }
        }

        // Handle Environmental Recommendations
        if (result.environmentalRecommendations && result.environmentalRecommendations.length > 0) {
            resultHtml += `
                <div class="mb-3">
                    <h5 class="text-sm font-medium text-green-700 mb-2">🌿 Environmental Recommendations:</h5>
                    <ul class="space-y-1">
                        ${result.environmentalRecommendations.slice(0, 3).map(rec => `
                            <li class="text-sm text-green-600 flex items-start gap-2">
                                <span class="inline-block w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
                                <span>${rec.recommendation || rec}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        // Handle Microclimates
        if (result.microclimates && result.microclimates.length > 0) {
            resultHtml += `
                <div class="mb-3">
                    <h5 class="text-sm font-medium text-purple-700 mb-2">🏡 Microclimate Zones:</h5>
                    <ul class="space-y-1">
                        ${result.microclimates.slice(0, 2).map(zone => `
                            <li class="text-sm text-purple-600 flex items-start gap-2">
                                <i data-lucide="home" class="h-3 w-3 mt-0.5 flex-shrink-0"></i>
                                <span><strong>${zone.zone}:</strong> ${zone.characteristics}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        // Handle Garden Planning Results
        if (result.plan && result.plan.summary) {
            resultHtml += `
                <div class="mb-3">
                    <h5 class="text-sm font-medium text-gray-700 mb-2">📋 Garden Plan:</h5>
                    <p class="text-sm text-gray-600 bg-green-50 p-2 rounded">${result.plan.summary}</p>
                </div>
            `;
        }

        // Handle Companion Suggestions
        if (result.companionSuggestions && result.companionSuggestions.length > 0) {
            resultHtml += `
                <div class="mb-3">
                    <h5 class="text-sm font-medium text-green-700 mb-2">🤝 Companion Planting:</h5>
                    <ul class="space-y-1">
                        ${result.companionSuggestions.slice(0, 2).map(comp => `
                            <li class="text-sm text-green-600 flex items-start gap-2">
                                <i data-lucide="users" class="h-3 w-3 mt-0.5 flex-shrink-0"></i>
                                <span><strong>${comp.plant}:</strong> ${comp.companions ? comp.companions.join(', ') : 'Available'}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        // Fallback for any unformatted results
        const hasFormattedContent = resultHtml.includes('<h5');
        if (!hasFormattedContent) {
            // Show a simple summary if no specific formatting was applied
            resultHtml += `
                <div class="mb-3">
                    <h5 class="text-sm font-medium text-gray-700 mb-2">📄 Result Summary:</h5>
                    <div class="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                        <p class="mb-2">Agent completed successfully with data insights.</p>
                        <p class="text-xs text-gray-500">Click "View Full Results" below for detailed information.</p>
                    </div>
                </div>
            `;
        }

        // Add a "View Details" button for full results
        resultHtml += `
            <button class="view-full-results-btn text-xs text-blue-600 hover:text-blue-800 font-medium mt-2" 
                    data-agent-id="${agentId}" data-result='${JSON.stringify(result).replace(/'/g, '&apos;')}'>
                View Full Results →
            </button>
        `;

        resultCard.innerHTML = resultHtml;

        // Add event listener for the view full results button
        const viewButton = resultCard.querySelector('.view-full-results-btn');
        if (viewButton) {
            viewButton.addEventListener('click', (e) => {
                e.preventDefault();
                const agentId = e.target.getAttribute('data-agent-id');
                const resultData = JSON.parse(e.target.getAttribute('data-result'));
                this.showFullResults(agentId, resultData);
            });
            viewButton.setAttribute('data-listener-attached', 'true');
        }
        
        // Add to results container (keep only last 3 results)
        if (resultsContainer.children.length >= 3) {
            resultsContainer.removeChild(resultsContainer.lastChild);
        }
        
        // Remove "no results" message if present
        const noResultsMsg = resultsContainer.querySelector('.text-center');
        if (noResultsMsg) {
            noResultsMsg.remove();
        }
        
        resultsContainer.insertBefore(resultCard, resultsContainer.firstChild);
        
        // Store the result for persistence
        this.storeAgentResult(agentId, result);
        
        lucide.createIcons();
    }

    showFullResults(agentId, result) {
        const agentNames = {
            'proactiveCare': 'Proactive Care',
            'healthMonitor': 'Health Monitor', 
            'harvestOptimizer': 'Harvest Optimizer',
            'gardenPlanner': 'Garden Planner',
            'environmentalIntelligence': 'Environmental Intelligence'
        };

        // Create human-readable content instead of JSON
        let formattedContent = '';

        // Format recommendations
        if (result.recommendations && result.recommendations.length > 0) {
            formattedContent += `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-gray-800 mb-3">🌱 Recommendations</h3>
                    <div class="space-y-2">
                        ${result.recommendations.map((rec, index) => `
                            <div class="bg-green-50 border-l-4 border-green-500 p-3 rounded-r">
                                <p class="text-sm text-green-800">${rec.description || rec.action || rec.treatment || rec}</p>
                                ${rec.priority ? `<span class="text-xs font-medium text-green-600 mt-1 inline-block">Priority: ${rec.priority}</span>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Format urgent tasks
        if (result.urgentTasks && result.urgentTasks.length > 0) {
            formattedContent += `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-red-800 mb-3">⚠️ Urgent Tasks</h3>
                    <div class="space-y-2">
                        ${result.urgentTasks.map(task => `
                            <div class="bg-red-50 border-l-4 border-red-500 p-3 rounded-r">
                                <p class="text-sm text-red-800 font-medium">${task.task || task.description || task}</p>
                                ${task.deadline ? `<span class="text-xs text-red-600 mt-1 inline-block">Deadline: ${task.deadline}</span>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Format weather alerts
        if (result.weatherAlerts && result.weatherAlerts.length > 0) {
            formattedContent += `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-orange-800 mb-3">🌤️ Weather Alerts</h3>
                    <div class="space-y-2">
                        ${result.weatherAlerts.map(alert => `
                            <div class="bg-orange-50 border-l-4 border-orange-500 p-3 rounded-r">
                                <p class="text-sm text-orange-800">${alert.message || alert}</p>
                                ${alert.severity ? `<span class="text-xs font-medium text-orange-600 mt-1 inline-block">Severity: ${alert.severity}</span>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Format harvest schedule
        if (result.harvestSchedule && result.harvestSchedule.length > 0) {
            formattedContent += `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-green-800 mb-3">🍅 Harvest Schedule</h3>
                    <div class="space-y-2">
                        ${result.harvestSchedule.map(harvest => `
                            <div class="bg-green-50 border-l-4 border-green-500 p-3 rounded-r">
                                <p class="text-sm text-green-800 font-medium">${harvest.plantName || 'Plant'}</p>
                                <p class="text-sm text-green-700">Harvest Date: ${harvest.harvestDate || 'Soon'}</p>
                                <p class="text-sm text-green-600">Readiness: ${harvest.readiness || 'Ready'}</p>
                                ${harvest.notes ? `<p class="text-xs text-green-600 mt-1">${harvest.notes}</p>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Format health assessment
        if (result.healthAssessment) {
            const assessment = result.healthAssessment;
            formattedContent += `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-blue-800 mb-3">💚 Health Assessment</h3>
                    <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="w-24 bg-gray-200 rounded-full h-3">
                                <div class="bg-blue-500 h-3 rounded-full" style="width: ${assessment.overallScore || 75}%"></div>
                            </div>
                            <span class="text-sm font-medium text-blue-800">${assessment.overallScore || 75}% Overall Health</span>
                        </div>
                        <p class="text-sm text-blue-700">${assessment.summary || 'Health assessment completed'}</p>
                        ${assessment.details ? `<p class="text-xs text-blue-600 mt-2">${assessment.details}</p>` : ''}
                    </div>
                </div>
            `;
        }

        // Format analysis
        if (result.analysis) {
            const analysis = result.analysis;
            formattedContent += `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-purple-800 mb-3">📊 Analysis</h3>
                    ${analysis.summary ? `
                        <div class="bg-purple-50 border-l-4 border-purple-500 p-3 rounded-r mb-3">
                            <p class="text-sm text-purple-800">${analysis.summary}</p>
                        </div>
                    ` : ''}
                    
                    ${analysis.keyInsights && analysis.keyInsights.length > 0 ? `
                        <div class="mb-4">
                            <h4 class="text-md font-medium text-purple-700 mb-2">💡 Key Insights</h4>
                            <ul class="space-y-1">
                                ${analysis.keyInsights.map(insight => `
                                    <li class="text-sm text-purple-600 flex items-start gap-2">
                                        <span class="inline-block w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></span>
                                        <span>${insight}</span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    ${analysis.riskFactors && analysis.riskFactors.length > 0 ? `
                        <div class="mb-4">
                            <h4 class="text-md font-medium text-yellow-700 mb-2">⚠️ Risk Factors</h4>
                            <ul class="space-y-1">
                                ${analysis.riskFactors.map(risk => `
                                    <li class="text-sm text-yellow-600 flex items-start gap-2">
                                        <span class="inline-block w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></span>
                                        <span>${risk}</span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // Format environmental recommendations
        if (result.environmentalRecommendations && result.environmentalRecommendations.length > 0) {
            formattedContent += `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-green-800 mb-3">🌿 Environmental Recommendations</h3>
                    <div class="space-y-2">
                        ${result.environmentalRecommendations.map(rec => `
                            <div class="bg-green-50 border-l-4 border-green-500 p-3 rounded-r">
                                <p class="text-sm text-green-800">${rec.recommendation || rec}</p>
                                ${rec.impact ? `<span class="text-xs text-green-600 mt-1 inline-block">Impact: ${rec.impact}</span>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Format microclimates
        if (result.microclimates && result.microclimates.length > 0) {
            formattedContent += `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-indigo-800 mb-3">🏡 Microclimate Zones</h3>
                    <div class="space-y-2">
                        ${result.microclimates.map(zone => `
                            <div class="bg-indigo-50 border-l-4 border-indigo-500 p-3 rounded-r">
                                <p class="text-sm font-medium text-indigo-800">${zone.zone}</p>
                                <p class="text-sm text-indigo-700">${zone.characteristics}</p>
                                ${zone.suitablePlants && zone.suitablePlants.length > 0 ? `
                                    <p class="text-xs text-indigo-600 mt-1">Suitable plants: ${zone.suitablePlants.join(', ')}</p>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Format garden plan
        if (result.plan) {
            formattedContent += `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-teal-800 mb-3">📋 Garden Plan</h3>
                    <div class="bg-teal-50 border-l-4 border-teal-500 p-4 rounded-r">
                        ${result.plan.summary ? `<p class="text-sm text-teal-800 mb-2">${result.plan.summary}</p>` : ''}
                        ${result.plan.timeline ? `<p class="text-xs text-teal-600">Timeline: ${result.plan.timeline}</p>` : ''}
                        ${result.plan.budget ? `<p class="text-xs text-teal-600">Estimated budget: ${result.plan.budget}</p>` : ''}
                    </div>
                </div>
            `;
        }

        // Format companion suggestions
        if (result.companionSuggestions && result.companionSuggestions.length > 0) {
            formattedContent += `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-emerald-800 mb-3">🤝 Companion Planting Suggestions</h3>
                    <div class="space-y-2">
                        ${result.companionSuggestions.map(comp => `
                            <div class="bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded-r">
                                <p class="text-sm font-medium text-emerald-800">${comp.plant}</p>
                                ${comp.companions ? `<p class="text-sm text-emerald-700">Good companions: ${comp.companions.join(', ')}</p>` : ''}
                                ${comp.benefits ? `<p class="text-xs text-emerald-600 mt-1">Benefits: ${comp.benefits}</p>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // If no formatted content, show a friendly message instead of JSON
        if (!formattedContent) {
            formattedContent = `
                <div class="text-center py-8">
                    <div class="text-gray-400 mb-4">
                        <i data-lucide="check-circle" class="h-16 w-16 mx-auto mb-4"></i>
                    </div>
                    <h3 class="text-lg font-medium text-gray-700 mb-2">Agent Completed Successfully</h3>
                    <p class="text-sm text-gray-600 mb-4">The ${agentNames[agentId]} agent has finished processing your garden data.</p>
                    <p class="text-xs text-gray-500">Results have been processed and applied to your garden management system.</p>
                </div>
            `;
        }

        const modalContent = `
            <div class="p-6">
                <h2 class="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <i data-lucide="brain" class="h-6 w-6 text-blue-600"></i>
                    ${agentNames[agentId]} - Detailed Results
                </h2>
                <div class="max-h-96 overflow-y-auto">
                    ${formattedContent}
                </div>
                <div class="flex justify-end mt-4">
                    <button onclick="document.getElementById('modal-backdrop').classList.add('hidden')" 
                            class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2">
                        <i data-lucide="x" class="h-4 w-4"></i>
                        Close
                    </button>
                </div>
            </div>
        `;
        
        const modalBackdrop = document.getElementById('modal-backdrop');
        const modalPanel = document.getElementById('modal-panel');
        
        if (modalBackdrop && modalPanel) {
            modalPanel.innerHTML = modalContent;
            modalBackdrop.classList.remove('hidden');
            // Initialize icons after setting innerHTML
            setTimeout(() => lucide.createIcons(), 100);
        }
    }
}

// Initialize the enhanced UI
let agenticUI;
document.addEventListener('DOMContentLoaded', () => {
    agenticUI = new AgenticUI();
    agenticUI.initialize();
    
    // Make globally accessible for debugging and external access
    window.agenticUI = agenticUI;
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgenticUI;
} 