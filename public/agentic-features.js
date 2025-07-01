// Enhanced Agentic Garden Features - Client Side
// Integrates with comprehensive backend agentic system
class AgenticGardenFeatures {
    constructor() {
        this.pendingActions = new Map();
        this.monitoringActive = false;
        this.lastCheck = null;
        this.notifications = [];
        this.apiKey = null;
        this.location = null;
        this.checkInterval = 3600000; // 1 hour
        this.weatherCache = null;
        this.plantHealthHistory = new Map();
        this.harvestPredictions = new Map();
        this.agentStatus = {
            proactiveCare: 'idle',
            healthMonitor: 'idle',
            harvestOptimizer: 'idle',
            gardenPlanner: 'idle',
            environmentalIntelligence: 'idle'
        };
        this.permissionQueue = [];
        this.autoApprovalSettings = {
            dataCollection: true,
            lowRiskActions: false,
            notifications: true
        };
    }

    async initialize(config = {}) {
        this.apiKey = config.apiKey || localStorage.getItem('openai_api_key');
        this.location = config.location;
        this.checkInterval = config.checkInterval || 3600000;
        
        if (!this.apiKey || this.apiKey === "PASTE_YOUR_OPENAI_API_KEY_HERE") {
            console.warn('Agentic features require OpenAI API key');
            this.showAgentSetupModal();
            return false;
        }

        // Get user location if not provided
        if (!this.location) {
            await this.getUserLocation();
        }

        // Initialize agent dashboard
        this.initializeAgentDashboard();
        
        // Restore session AI content if available
        this.restoreSessionAIContent();
        
        // Start monitoring (disabled for manual testing)
        // this.startMonitoring();
        console.log('Enhanced Agentic Garden Features initialized');
        return true;
    }

    // =================================================================================
    // AGENT DASHBOARD AND UI
    // =================================================================================

    initializeAgentDashboard() {
        // Create agent status dashboard
        const dashboard = document.createElement('div');
        dashboard.id = 'agentic-dashboard';
        dashboard.className = 'fixed top-4 right-4 w-80 bg-surface rounded-xl shadow-lg p-4 z-50 hidden';
        dashboard.innerHTML = `
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-bold text-text-base">Garden AI Agents</h3>
                <div class="flex gap-2">
                    <button id="agent-settings-btn" class="p-1 hover:bg-accent rounded">
                        <i data-lucide="settings" class="h-4 w-4"></i>
                    </button>
                    <button id="close-dashboard-btn" class="p-1 hover:bg-accent rounded">
                        <i data-lucide="x" class="h-4 w-4"></i>
                    </button>
                </div>
            </div>
            
            <div class="space-y-3">
                <div class="agent-status-card" data-agent="proactiveCare">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded-full bg-green-500" id="status-proactiveCare"></div>
                            <span class="font-medium">Proactive Care</span>
                        </div>
                        <button class="text-sm bg-primary text-white px-2 py-1 rounded hover:bg-primary/90" 
                                onclick="agenticFeatures.runAgent('proactiveCare')">
                            Run
                        </button>
                    </div>
                    <div class="text-sm text-text-muted mt-1" id="desc-proactiveCare">
                        Weather monitoring & care scheduling
                    </div>
                </div>

                <div class="agent-status-card" data-agent="healthMonitor">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded-full bg-green-500" id="status-healthMonitor"></div>
                            <span class="font-medium">Health Monitor</span>
                        </div>
                        <button class="text-sm bg-primary text-white px-2 py-1 rounded hover:bg-primary/90" 
                                onclick="agenticFeatures.runAgent('healthMonitor')">
                            Run
                        </button>
                    </div>
                    <div class="text-sm text-text-muted mt-1" id="desc-healthMonitor">
                        Plant health analysis & diagnostics
                    </div>
                </div>

                <div class="agent-status-card" data-agent="harvestOptimizer">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded-full bg-green-500" id="status-harvestOptimizer"></div>
                            <span class="font-medium">Harvest Optimizer</span>
                        </div>
                        <button class="text-sm bg-primary text-white px-2 py-1 rounded hover:bg-primary/90" 
                                onclick="agenticFeatures.runAgent('harvestOptimizer')">
                            Run
                        </button>
                    </div>
                    <div class="text-sm text-text-muted mt-1" id="desc-harvestOptimizer">
                        Harvest timing & storage optimization
                    </div>
                </div>

                <div class="agent-status-card" data-agent="gardenPlanner">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded-full bg-green-500" id="status-gardenPlanner"></div>
                            <span class="font-medium">Garden Planner</span>
                        </div>
                        <button class="text-sm bg-primary text-white px-2 py-1 rounded hover:bg-primary/90" 
                                onclick="agenticFeatures.runAgent('gardenPlanner')">
                            Run
                        </button>
                    </div>
                    <div class="text-sm text-text-muted mt-1" id="desc-gardenPlanner">
                        Companion planting & layout optimization
                    </div>
                </div>

                <div class="agent-status-card" data-agent="environmentalIntelligence">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded-full bg-green-500" id="status-environmentalIntelligence"></div>
                            <span class="font-medium">Environmental AI</span>
                        </div>
                        <button class="text-sm bg-primary text-white px-2 py-1 rounded hover:bg-primary/90" 
                                onclick="agenticFeatures.runAgent('environmentalIntelligence')">
                            Run
                        </button>
                    </div>
                    <div class="text-sm text-text-muted mt-1" id="desc-environmentalIntelligence">
                        Weather patterns & microclimate analysis
                    </div>
                </div>
            </div>

            <div class="mt-4 pt-4 border-t border-accent">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-medium">Pending Actions</span>
                    <span class="text-sm bg-orange-500 text-white px-2 py-1 rounded" id="pending-count">0</span>
                </div>
                <div id="pending-actions-list" class="space-y-2 max-h-32 overflow-y-auto">
                    <!-- Pending actions will be populated here -->
                </div>
            </div>
        `;

        document.body.appendChild(dashboard);

        // Add event listeners
        document.getElementById('close-dashboard-btn').addEventListener('click', () => {
            this.toggleDashboard(false);
        });

        document.getElementById('agent-settings-btn').addEventListener('click', () => {
            this.showAgentSettingsModal();
        });

        // Add toggle button to main UI
        this.addDashboardToggle();
    }

    addDashboardToggle() {
        // Add agent dashboard toggle button to the main UI
        const aiWidget = document.getElementById('ai-recommendations-widget');
        if (aiWidget) {
            const headerDiv = aiWidget.querySelector('.flex.items-center.justify-between');
            if (headerDiv) {
                const toggleBtn = document.createElement('button');
                toggleBtn.className = 'px-3 py-1.5 bg-purple-500 text-white text-sm font-semibold rounded-md hover:bg-purple-600 flex items-center gap-1';
                toggleBtn.innerHTML = '<i data-lucide="brain-circuit" class="h-4 w-4"></i> Agents';
                toggleBtn.addEventListener('click', () => this.toggleDashboard());
                
                const buttonGroup = headerDiv.querySelector('.flex.gap-2');
                if (buttonGroup) {
                    buttonGroup.appendChild(toggleBtn);
                    lucide.createIcons();
                }
            }
        }
    }

    toggleDashboard(show = null) {
        const dashboard = document.getElementById('agentic-dashboard');
        if (dashboard) {
            if (show === null) {
                dashboard.classList.toggle('hidden');
            } else {
                dashboard.classList.toggle('hidden', !show);
            }
        }
    }

    updateAgentStatus(agent, status, description = null) {
        this.agentStatus[agent] = status;
        
        const statusIndicator = document.getElementById(`status-${agent}`);
        const descElement = document.getElementById(`desc-${agent}`);
        
        if (statusIndicator) {
            statusIndicator.className = `w-3 h-3 rounded-full ${
                status === 'running' ? 'bg-blue-500 animate-pulse' :
                status === 'complete' ? 'bg-green-500' :
                status === 'error' ? 'bg-red-500' :
                'bg-gray-400'
            }`;
        }
        
        if (descElement && description) {
            descElement.textContent = description;
        }
    }

    // =================================================================================
    // ENHANCED AGENT EXECUTION
    // =================================================================================

    async runAgent(agentType, customData = null) {
        this.updateAgentStatus(agentType, 'running', 'Processing...');
        
        try {
            let result;
            const gardenData = this.getGardenData();
            const weatherData = await this.getWeatherData();
            
            switch (agentType) {
                case 'proactiveCare':
                    result = await this.runProactiveCareAgent(weatherData, gardenData);
                    break;
                case 'healthMonitor':
                    result = await this.runHealthMonitorAgent(gardenData);
                    break;
                case 'harvestOptimizer':
                    result = await this.runHarvestOptimizerAgent(gardenData, weatherData);
                    break;
                case 'gardenPlanner':
                    result = await this.runGardenPlannerAgent(gardenData);
                    break;
                case 'environmentalIntelligence':
                    result = await this.runEnvironmentalIntelligenceAgent(gardenData, weatherData);
                    break;
                default:
                    throw new Error(`Unknown agent type: ${agentType}`);
            }
            
            this.updateAgentStatus(agentType, 'complete', 'Task completed');
            this.processAgentResult(agentType, result);
            return result; // Return the result so it can be displayed
            
        } catch (error) {
            console.error(`Agent ${agentType} failed:`, error);
            this.updateAgentStatus(agentType, 'error', 'Task failed');
            this.showNotification('error', `${agentType} agent failed: ${error.message}`);
        }
    }

    async runProactiveCareAgent(weatherData, gardenData) {
        const response = await fetch('/api/agentic/proactive-care', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            },
            body: JSON.stringify({
                weatherData,
                plantData: gardenData,
                userPreferences: this.getUserPreferences()
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    }

    async runHealthMonitorAgent(gardenData) {
        const healthHistory = this.getHealthHistory();
        
        const response = await fetch('/api/agentic/health-monitor', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            },
            body: JSON.stringify({
                plantData: gardenData,
                healthHistory
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    }

    async runHarvestOptimizerAgent(gardenData, weatherData) {
        const response = await fetch('/api/agentic/harvest-optimizer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            },
            body: JSON.stringify({
                plantData: gardenData,
                weatherData,
                storageCapacity: this.getStorageCapacity()
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    }

    async runGardenPlannerAgent(gardenData) {
        const response = await fetch('/api/agentic/garden-planner', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            },
            body: JSON.stringify({
                currentPlants: gardenData,
                availableSpace: this.getAvailableSpace(),
                seasonData: this.getSeasonData(),
                planningGoals: this.getPlanningGoals()
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    }

    async runEnvironmentalIntelligenceAgent(gardenData, weatherData) {
        const response = await fetch('/api/agentic/environmental-intelligence', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            },
            body: JSON.stringify({
                gardenLayout: this.getGardenLayout(),
                weatherHistory: this.getWeatherHistory(),
                plantPerformance: this.getPlantPerformance()
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    }

    // =================================================================================
    // PERMISSION SYSTEM
    // =================================================================================

    async requestActionPermission(action) {
        const permissionId = Date.now().toString();
        const permission = {
            id: permissionId,
            action,
            timestamp: new Date().toISOString(),
            status: 'pending'
        };
        
        this.permissionQueue.push(permission);
        this.updatePendingActionsUI();
        
        // Check if action can be auto-approved
        if (this.canAutoApprove(action)) {
            return await this.approveAction(permissionId);
        }
        
        // Show permission dialog
        this.showPermissionDialog(permission);
        
        return new Promise((resolve) => {
            permission.resolve = resolve;
        });
    }

    canAutoApprove(action) {
        const riskLevel = this.assessActionRisk(action);
        
        switch (riskLevel) {
            case 'low':
                return this.autoApprovalSettings.lowRiskActions;
            case 'data':
                return this.autoApprovalSettings.dataCollection;
            case 'notification':
                return this.autoApprovalSettings.notifications;
            default:
                return false;
        }
    }

    assessActionRisk(action) {
        if (action.type === 'data_collection' || action.type === 'monitoring') {
            return 'data';
        }
        if (action.type === 'notification' || action.type === 'reminder') {
            return 'notification';
        }
        if (action.type === 'schedule_adjustment' && action.severity === 'minor') {
            return 'low';
        }
        return 'high';
    }

    showPermissionDialog(permission) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-surface rounded-xl p-6 max-w-md w-full mx-4">
                <h3 class="text-lg font-bold text-text-base mb-4 flex items-center gap-2">
                    <i data-lucide="shield-check" class="text-primary"></i>
                    Action Approval Required
                </h3>
                
                <div class="space-y-4">
                    <div>
                        <h4 class="font-medium text-text-base">Proposed Action:</h4>
                        <p class="text-text-muted">${permission.action.description || 'Garden management action'}</p>
                    </div>
                    
                    <div>
                        <h4 class="font-medium text-text-base">Risk Level:</h4>
                        <span class="inline-block px-2 py-1 rounded text-sm ${
                            this.assessActionRisk(permission.action) === 'high' ? 'bg-red-500 text-white' :
                            this.assessActionRisk(permission.action) === 'medium' ? 'bg-orange-500 text-white' :
                            'bg-green-500 text-white'
                        }">
                            ${this.assessActionRisk(permission.action).toUpperCase()}
                        </span>
                    </div>
                    
                    <div>
                        <h4 class="font-medium text-text-base">Expected Outcome:</h4>
                        <p class="text-text-muted">${permission.action.expectedOutcome || 'Improved garden management'}</p>
                    </div>
                </div>
                
                <div class="flex gap-3 mt-6">
                    <button onclick="agenticFeatures.approveAction('${permission.id}')" 
                            class="flex-1 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                        Approve
                    </button>
                    <button onclick="agenticFeatures.rejectAction('${permission.id}')" 
                            class="flex-1 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
                        Reject
                    </button>
                    <button onclick="agenticFeatures.delayAction('${permission.id}')" 
                            class="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                        Later
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        lucide.createIcons();
    }

    async approveAction(permissionId) {
        const permission = this.permissionQueue.find(p => p.id === permissionId);
        if (!permission) return false;
        
        permission.status = 'approved';
        this.removePermissionDialog();
        this.updatePendingActionsUI();
        
        // Execute the approved action
        await this.executeApprovedAction(permission.action);
        
        if (permission.resolve) {
            permission.resolve(true);
        }
        
        return true;
    }

    rejectAction(permissionId) {
        const permission = this.permissionQueue.find(p => p.id === permissionId);
        if (!permission) return;
        
        permission.status = 'rejected';
        this.removePermissionDialog();
        this.updatePendingActionsUI();
        
        if (permission.resolve) {
            permission.resolve(false);
        }
    }

    delayAction(permissionId) {
        const permission = this.permissionQueue.find(p => p.id === permissionId);
        if (!permission) return;
        
        permission.status = 'delayed';
        this.removePermissionDialog();
        this.updatePendingActionsUI();
        
        // Re-show in 1 hour
        setTimeout(() => {
            if (permission.status === 'delayed') {
                permission.status = 'pending';
                this.showPermissionDialog(permission);
            }
        }, 3600000);
    }

    removePermissionDialog() {
        const modal = document.querySelector('.fixed.inset-0.bg-black\\/50');
        if (modal) {
            modal.remove();
        }
    }

    updatePendingActionsUI() {
        const pendingCount = document.getElementById('pending-count');
        const pendingList = document.getElementById('pending-actions-list');
        
        if (pendingCount && pendingList) {
            const pending = this.permissionQueue.filter(p => p.status === 'pending');
            pendingCount.textContent = pending.length;
            
            pendingList.innerHTML = pending.map(p => `
                <div class="flex items-center justify-between p-2 bg-accent rounded text-sm">
                    <span class="truncate">${p.action.description || 'Garden action'}</span>
                    <button onclick="agenticFeatures.showPermissionDialog(${JSON.stringify(p).replace(/"/g, '&quot;')})" 
                            class="text-primary hover:underline">
                        Review
                    </button>
                </div>
            `).join('');
        }
    }

    // =================================================================================
    // AGENT SETTINGS AND CONFIGURATION
    // =================================================================================

    showAgentSettingsModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-surface rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
                <h3 class="text-lg font-bold text-text-base mb-4">Agent Settings</h3>
                
                <div class="space-y-6">
                    <div>
                        <h4 class="font-medium text-text-base mb-3">Auto-Approval Settings</h4>
                        <div class="space-y-2">
                            <label class="flex items-center gap-2">
                                <input type="checkbox" ${this.autoApprovalSettings.dataCollection ? 'checked' : ''} 
                                       onchange="agenticFeatures.updateAutoApproval('dataCollection', this.checked)">
                                <span>Data collection and monitoring</span>
                            </label>
                            <label class="flex items-center gap-2">
                                <input type="checkbox" ${this.autoApprovalSettings.lowRiskActions ? 'checked' : ''} 
                                       onchange="agenticFeatures.updateAutoApproval('lowRiskActions', this.checked)">
                                <span>Low-risk schedule adjustments</span>
                            </label>
                            <label class="flex items-center gap-2">
                                <input type="checkbox" ${this.autoApprovalSettings.notifications ? 'checked' : ''} 
                                       onchange="agenticFeatures.updateAutoApproval('notifications', this.checked)">
                                <span>Notifications and reminders</span>
                            </label>
                        </div>
                    </div>
                    
                    <div>
                        <h4 class="font-medium text-text-base mb-3">Monitoring Frequency</h4>
                        <select onchange="agenticFeatures.updateCheckInterval(this.value)" 
                                class="w-full p-2 border border-accent rounded">
                            <option value="1800000" ${this.checkInterval === 1800000 ? 'selected' : ''}>30 minutes</option>
                            <option value="3600000" ${this.checkInterval === 3600000 ? 'selected' : ''}>1 hour</option>
                            <option value="7200000" ${this.checkInterval === 7200000 ? 'selected' : ''}>2 hours</option>
                            <option value="21600000" ${this.checkInterval === 21600000 ? 'selected' : ''}>6 hours</option>
                            <option value="86400000" ${this.checkInterval === 86400000 ? 'selected' : ''}>24 hours</option>
                        </select>
                    </div>
                </div>
                
                <div class="flex gap-3 mt-6">
                    <button onclick="this.closest('.fixed').remove()" 
                            class="flex-1 bg-primary text-white px-4 py-2 rounded hover:bg-primary/90">
                        Save
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    updateAutoApproval(setting, value) {
        this.autoApprovalSettings[setting] = value;
        localStorage.setItem('agenticAutoApproval', JSON.stringify(this.autoApprovalSettings));
    }

    updateCheckInterval(interval) {
        this.checkInterval = parseInt(interval);
        localStorage.setItem('agenticCheckInterval', this.checkInterval);
        
        // Restart monitoring with new interval
        if (this.monitoringActive) {
            this.stopMonitoring();
            this.startMonitoring();
        }
    }

    // =================================================================================
    // UTILITY FUNCTIONS
    // =================================================================================

    getGardenData() {
        const gardenData = window.myGarden || [];
        const activityLog = window.activityLog || [];
        const combinedPlantDatabase = window.combinedPlantDatabase || [];
        
        // Enhance garden data with user notes, observations, and activity history
        const enhancedGardenData = gardenData.map(instance => {
            // Get plant details from database
            const plantDetails = combinedPlantDatabase.find(p => p.id == instance.plantId) || {};
            
            // Get relevant activity log entries for this plant
            const plantActivityLog = activityLog.filter(activity => 
                activity.instanceId === instance.instanceId
            ).slice(-10); // Get last 10 activities for context
            
            // Extract user notes and observations
            const userNotes = instance.notes || '';
            const userObservations = instance.observations || '';
            const careLog = instance.careLog || [];
            
            return {
                ...instance,
                plantName: plantDetails.commonName || 'Unknown Plant',
                scientificName: plantDetails.scientificName || '',
                category: plantDetails.category || '',
                description: plantDetails.description || '',
                userNotes: userNotes,
                userObservations: userObservations,
                careLog: careLog,
                recentActivity: plantActivityLog,
                plantingAge: this.calculatePlantAge(instance.plantingDate),
                fullPlantDetails: plantDetails
            };
        });
        
        return {
            plants: enhancedGardenData,
            totalPlants: enhancedGardenData.length,
            plantCategories: [...new Set(enhancedGardenData.map(p => p.category))],
            recentActivitySummary: this.getRecentActivitySummary(),
            gardenLayout: window.gardenLayout || { plants: {}, beds: [] },
            careSchedule: window.careLog || {},
            harvestLog: window.harvestLog || []
        };
    }
    
    calculatePlantAge(plantingDate) {
        if (!plantingDate) return 0;
        const planting = new Date(plantingDate);
        const now = new Date();
        return Math.floor((now - planting) / (1000 * 60 * 60 * 24)); // days
    }
    
    getRecentActivitySummary() {
        const activityLog = window.activityLog || [];
        const recentActivities = activityLog.slice(-20); // Last 20 activities
        
        return {
            totalActivities: recentActivities.length,
            activities: recentActivities.map(activity => ({
                date: activity.date,
                plantInstance: activity.instanceId,
                description: activity.message || activity.description || '',
                type: activity.type || 'general'
            })),
            summary: this.generateActivitySummary(recentActivities)
        };
    }
    
    generateActivitySummary(activities) {
        const summary = {
            watering: 0,
            fertilizing: 0,
            pruning: 0,
            harvesting: 0,
            observations: 0,
            issues: 0
        };
        
        activities.forEach(activity => {
            const message = (activity.message || activity.description || '').toLowerCase();
            if (message.includes('water')) summary.watering++;
            if (message.includes('fertiliz') || message.includes('feed')) summary.fertilizing++;
            if (message.includes('prun') || message.includes('trim')) summary.pruning++;
            if (message.includes('harvest')) summary.harvesting++;
            if (message.includes('observe') || message.includes('note')) summary.observations++;
            if (message.includes('pest') || message.includes('disease') || message.includes('problem')) summary.issues++;
        });
        
        return summary;
    }

    getHealthHistory() {
        return Array.from(this.plantHealthHistory.values()).flat();
    }

    getUserPreferences() {
        return {
            wateringStyle: 'efficient',
            organicOnly: true,
            riskTolerance: 'medium'
        };
    }

    getStorageCapacity() {
        return {
            refrigerator: 'medium',
            pantry: 'large',
            freezer: 'small'
        };
    }

    getAvailableSpace() {
        return {
            beds: 4,
            totalArea: '200 sq ft',
            exposure: 'full sun'
        };
    }

    getSeasonData() {
        return {
            current: 'summer',
            zone: '9b',
            frostDates: { first: 'December 15', last: 'February 15' }
        };
    }

    getPlanningGoals() {
        return {
            focus: 'productivity',
            preferences: ['organic', 'water-efficient'],
            constraints: ['limited space']
        };
    }

    getGardenLayout() {
        return window.gardenLayout || { plants: {}, beds: [] };
    }

    getWeatherHistory() {
        return []; // Would be populated with historical weather data
    }

    getPlantPerformance() {
        return []; // Would be populated with plant performance metrics
    }

    processAgentResult(agentType, result) {
        console.log(`Agent ${agentType} result:`, result);
        
        // Extract the right content based on agent type and server response structure
        let resultData = null;
        if (result.success) {
            switch (agentType) {
                case 'proactiveCare':
                    resultData = result.recommendations;
                    break;
                case 'healthMonitor':
                    resultData = result.healthAssessment;
                    break;
                case 'harvestOptimizer':
                    resultData = result.harvestSchedule;
                    break;
                case 'gardenPlanner':
                    resultData = result.plan;
                    break;
                case 'environmentalIntelligence':
                    resultData = result.analysis;
                    break;
                default:
                    resultData = result.analysis || result.recommendations || result.plan;
            }
        }
        
        // Update main dashboard AI content area with result
        this.updateMainDashboardAIContent(agentType, resultData);
        
        // Add "View Results" button to the agent dashboard
        this.addViewResultsButton(agentType, resultData);
        
        // Store results for future reference (both session and permanent)
        this.storeAgentResult(agentType, result);
        this.saveAgentResultPermanently(agentType, resultData);
    }

    formatAgentResult(result) {
        if (typeof result === 'string') {
            return result;
        }
        
        if (typeof result === 'object') {
            // Look for the main content field (analysis, optimization, plan)
            if (result.analysis) {
                return result.analysis;
            }
            if (result.optimization) {
                return result.optimization;
            }
            if (result.plan) {
                return result.plan;
            }
            
            // Fallback for other object structures
            const mainContent = Object.values(result).find(value => typeof value === 'string' && value.length > 50);
            if (mainContent) {
                return mainContent;
            }
            
            return 'Results received successfully';
        }
        
        return 'Results received successfully';
    }

    addViewResultsButton(agentType, resultData) {
        const agentCard = document.querySelector(`[data-agent="${agentType}"]`);
        if (agentCard && resultData) {
            // Remove existing view results button if it exists
            const existingButton = agentCard.querySelector('.view-results-btn');
            if (existingButton) {
                existingButton.remove();
            }
            
            // Add view results button next to the run button
            const runButton = agentCard.querySelector('button');
            if (runButton) {
                const viewButton = document.createElement('button');
                viewButton.className = 'view-results-btn text-sm bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 ml-1';
                viewButton.textContent = 'View';
                viewButton.onclick = () => this.showAgentResultModal(agentType, resultData);
                
                runButton.parentNode.appendChild(viewButton);
            }
        }
    }
    
    showAgentResultModal(agentType, resultData) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-surface rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-bold text-text-base">${agentType.replace(/([A-Z])/g, ' $1').trim()} Results</h3>
                    <button onclick="this.closest('.fixed').remove()" class="p-1 hover:bg-accent rounded">
                        <i data-lucide="x" class="h-4 w-4"></i>
                    </button>
                </div>
                <div class="flex-1 overflow-y-auto">
                    <div class="text-sm text-text-base whitespace-pre-wrap leading-relaxed">${this.formatAgentResult(resultData)}</div>
                </div>
                <div class="mt-4 pt-4 border-t border-accent">
                    <button onclick="this.closest('.fixed').remove()" 
                            class="w-full bg-primary text-white px-4 py-2 rounded hover:bg-primary/90">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        lucide.createIcons();
    }

    updateMainDashboardAIContent(agentType, resultData) {
        const aiContent = document.getElementById('ai-content');
        if (aiContent && resultData) {
            const formattedResult = this.formatAgentResult(resultData);
            const timestamp = new Date().toLocaleString();
            
            aiContent.innerHTML = `
                <div class="agent-result bg-white/70 rounded-lg p-4 border border-primary/20">
                    <div class="flex items-center justify-between mb-3">
                        <h4 class="font-semibold text-text-base flex items-center gap-2">
                            <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            ${agentType.replace(/([A-Z])/g, ' $1').trim()} Results
                        </h4>
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-text-muted">${timestamp}</span>
                            <button onclick="agenticFeatures.showAgentResultModal('${agentType}', \`${formattedResult.replace(/`/g, '\\`')}\`)" 
                                    class="text-xs bg-primary text-white px-2 py-1 rounded hover:bg-primary/90">
                                View Full
                            </button>
                            <button onclick="agenticFeatures.showAgentHistoryModal('${agentType}')" 
                                    class="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">
                                History
                            </button>
                        </div>
                    </div>
                    <div class="text-sm text-text-base whitespace-pre-wrap max-h-32 overflow-y-auto">
                        ${formattedResult.length > 300 ? formattedResult.substring(0, 300) + '...' : formattedResult}
                    </div>
                </div>
            `;
            
            // Store in session storage for persistence during session
            sessionStorage.setItem('currentAIResult', JSON.stringify({
                agentType,
                resultData,
                timestamp: new Date().toISOString()
            }));
        }
    }
    
    restoreSessionAIContent() {
        const storedResult = sessionStorage.getItem('currentAIResult');
        if (storedResult) {
            try {
                const { agentType, resultData } = JSON.parse(storedResult);
                this.updateMainDashboardAIContent(agentType, resultData);
            } catch (error) {
                console.error('Error restoring AI content:', error);
            }
        }
    }
    
    async saveAgentResultPermanently(agentType, resultData) {
        if (!resultData) return;
        
        const agentResult = {
            agentType,
            result: resultData,
            timestamp: new Date().toISOString(),
            date: new Date().toDateString()
        };
        
        try {
            const response = await fetch('/api/agent-results', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(agentResult)
            });
            
            if (!response.ok) {
                throw new Error(`Failed to save agent result: ${response.status}`);
            }
            
            console.log(`Agent result saved permanently: ${agentType}`);
        } catch (error) {
            console.error('Error saving agent result permanently:', error);
            // Fallback to localStorage if server fails
            this.saveAgentResultToLocalStorage(agentResult);
        }
    }
    
    saveAgentResultToLocalStorage(agentResult) {
        const storageKey = 'permanentAgentResults';
        const results = JSON.parse(localStorage.getItem(storageKey) || '[]');
        results.push(agentResult);
        
        // Keep only last 100 results to prevent storage overflow
        if (results.length > 100) {
            results.splice(0, results.length - 100);
        }
        
        localStorage.setItem(storageKey, JSON.stringify(results));
    }
    
    async getAgentResultsByDate(date) {
        const dateString = new Date(date).toDateString();
        
        try {
            const response = await fetch(`/api/agent-results?date=${encodeURIComponent(dateString)}`);
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Error fetching agent results by date:', error);
        }
        
        // Fallback to localStorage
        const results = JSON.parse(localStorage.getItem('permanentAgentResults') || '[]');
        return results.filter(result => result.date === dateString);
    }
    
    async getAllAgentResults() {
        try {
            const response = await fetch('/api/agent-results');
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Error fetching all agent results:', error);
        }
        
        // Fallback to localStorage
        return JSON.parse(localStorage.getItem('permanentAgentResults') || '[]');
    }
    
    showAgentHistoryModal(agentType) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-surface rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-bold text-text-base">${agentType.replace(/([A-Z])/g, ' $1').trim()} History</h3>
                    <div class="flex gap-2">
                        <input type="date" id="history-date-picker" class="px-2 py-1 border rounded text-sm">
                        <button onclick="agenticFeatures.filterHistoryByDate()" class="px-3 py-1 bg-primary text-white rounded text-sm hover:bg-primary/90">
                            Filter
                        </button>
                        <button onclick="this.closest('.fixed').remove()" class="p-1 hover:bg-accent rounded">
                            <i data-lucide="x" class="h-4 w-4"></i>
                        </button>
                    </div>
                </div>
                <div class="flex-1 overflow-y-auto" id="history-content">
                    <div class="text-center text-text-muted">Loading history...</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        lucide.createIcons();
        
        // Load and display history
        this.loadAgentHistory(agentType);
    }
    
    async loadAgentHistory(agentType) {
        const historyContent = document.getElementById('history-content');
        if (!historyContent) return;
        
        try {
            const allResults = await this.getAllAgentResults();
            const agentResults = allResults.filter(result => result.agentType === agentType);
            
            if (agentResults.length === 0) {
                historyContent.innerHTML = '<div class="text-center text-text-muted">No history found for this agent.</div>';
                return;
            }
            
            // Group by date
            const groupedResults = agentResults.reduce((acc, result) => {
                const date = result.date;
                if (!acc[date]) acc[date] = [];
                acc[date].push(result);
                return acc;
            }, {});
            
            // Sort dates in descending order
            const sortedDates = Object.keys(groupedResults).sort((a, b) => new Date(b) - new Date(a));
            
            historyContent.innerHTML = sortedDates.map(date => `
                <div class="mb-6">
                    <h4 class="font-semibold text-text-base mb-3 pb-2 border-b border-accent">${date}</h4>
                    <div class="space-y-3">
                        ${groupedResults[date].map(result => `
                            <div class="bg-white/50 rounded-lg p-4 border border-accent/20">
                                <div class="flex justify-between items-start mb-2">
                                    <span class="text-xs text-text-muted">${new Date(result.timestamp).toLocaleTimeString()}</span>
                                    <button onclick="agenticFeatures.showAgentResultModal('${result.agentType}', \`${result.result.replace(/`/g, '\\`')}\`)" 
                                            class="text-xs bg-primary text-white px-2 py-1 rounded hover:bg-primary/90">
                                        View Full
                                    </button>
                                </div>
                                <div class="text-sm text-text-base whitespace-pre-wrap max-h-20 overflow-y-auto">
                                    ${result.result.length > 200 ? result.result.substring(0, 200) + '...' : result.result}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
            
        } catch (error) {
            console.error('Error loading agent history:', error);
            historyContent.innerHTML = '<div class="text-center text-red-500">Error loading history.</div>';
        }
    }
    
    async filterHistoryByDate() {
        const datePicker = document.getElementById('history-date-picker');
        const historyContent = document.getElementById('history-content');
        
        if (!datePicker.value || !historyContent) return;
        
        try {
            const results = await this.getAgentResultsByDate(datePicker.value);
            
            if (results.length === 0) {
                historyContent.innerHTML = '<div class="text-center text-text-muted">No results found for this date.</div>';
                return;
            }
            
            historyContent.innerHTML = `
                <div class="space-y-3">
                    ${results.map(result => `
                        <div class="bg-white/50 rounded-lg p-4 border border-accent/20">
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <span class="font-medium text-text-base">${result.agentType.replace(/([A-Z])/g, ' $1').trim()}</span>
                                    <span class="text-xs text-text-muted ml-2">${new Date(result.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <button onclick="agenticFeatures.showAgentResultModal('${result.agentType}', \`${result.result.replace(/`/g, '\\`')}\`)" 
                                        class="text-xs bg-primary text-white px-2 py-1 rounded hover:bg-primary/90">
                                    View Full
                                </button>
                            </div>
                            <div class="text-sm text-text-base whitespace-pre-wrap max-h-20 overflow-y-auto">
                                ${result.result.length > 200 ? result.result.substring(0, 200) + '...' : result.result}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            
        } catch (error) {
            console.error('Error filtering history by date:', error);
            historyContent.innerHTML = '<div class="text-center text-red-500">Error filtering results.</div>';
        }
    }

    storeAgentResult(agentType, result) {
        const storageKey = `agentResults_${agentType}`;
        const results = JSON.parse(localStorage.getItem(storageKey) || '[]');
        results.push({
            timestamp: new Date().toISOString(),
            result
        });
        
        // Keep only last 10 results
        if (results.length > 10) {
            results.splice(0, results.length - 10);
        }
        
        localStorage.setItem(storageKey, JSON.stringify(results));
    }

    showNotification(type, message) {
        // Create notification
        const notification = document.createElement('div');
        notification.className = `fixed top-4 left-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'error' ? 'bg-red-500 text-white' :
            type === 'warning' ? 'bg-orange-500 text-white' :
            type === 'success' ? 'bg-green-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        notification.innerHTML = `
            <div class="flex items-center gap-2">
                <i data-lucide="${
                    type === 'error' ? 'alert-circle' :
                    type === 'warning' ? 'alert-triangle' :
                    type === 'success' ? 'check-circle' :
                    'info'
                }" class="h-5 w-5"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-2">
                    <i data-lucide="x" class="h-4 w-4"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        lucide.createIcons();
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    showAgentSetupModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-surface rounded-xl p-6 max-w-md w-full mx-4">
                <h3 class="text-lg font-bold text-text-base mb-4">Setup Garden AI Agents</h3>
                <p class="text-text-muted mb-4">
                    To enable advanced agentic features, please configure your OpenAI API key in the Settings panel.
                </p>
                <div class="flex gap-3">
                    <button onclick="openSettingsModal(); this.closest('.fixed').remove()" 
                            class="flex-1 bg-primary text-white px-4 py-2 rounded hover:bg-primary/90">
                        Open Settings
                    </button>
                    <button onclick="this.closest('.fixed').remove()" 
                            class="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    async executeApprovedAction(action) {
        // Implementation for executing approved actions
        console.log('Executing approved action:', action);
        
        try {
            switch (action.type) {
                case 'schedule_adjustment':
                    await this.adjustSchedule(action.details);
                    break;
                case 'notification':
                    this.showNotification('info', action.message);
                    break;
                case 'data_collection':
                    await this.collectData(action.details);
                    break;
                default:
                    console.log('Unknown action type:', action.type);
            }
        } catch (error) {
            console.error('Error executing action:', error);
            this.showNotification('error', `Failed to execute action: ${error.message}`);
        }
    }

    async adjustSchedule(details) {
        // Implementation for schedule adjustments
        console.log('Adjusting schedule:', details);
    }

    async collectData(details) {
        // Implementation for data collection
        console.log('Collecting data:', details);
    }

    // =================================================================================
    // ENHANCED MONITORING WITH MULTI-AGENT COORDINATION
    // =================================================================================

    async startMonitoring() {
        if (this.monitoringActive) return;
        
        this.monitoringActive = true;
        console.log('Starting enhanced agentic monitoring...');
        
        // Run initial agent coordination
        await this.runMonitoringCycle();
        
        // Set up periodic monitoring
        this.monitoringInterval = setInterval(() => {
            this.runMonitoringCycle();
        }, this.checkInterval);
    }

    stopMonitoring() {
        this.monitoringActive = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        console.log('Agentic monitoring stopped');
    }

    async runMonitoringCycle() {
        if (!this.monitoringActive) return;
        
        try {
            console.log('Running agentic monitoring cycle...');
            
            // Get current garden state
            const gardenData = this.getGardenData();
            const weatherData = await this.getWeatherData();
            
            // Run priority agents based on conditions
            const priorityAgents = this.determinePriorityAgents(gardenData, weatherData);
            
            for (const agent of priorityAgents) {
                await this.runAgent(agent);
                
                // Add delay between agents to prevent overwhelming
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            this.lastCheck = new Date();
            
        } catch (error) {
            console.error('Monitoring cycle failed:', error);
        }
    }

    determinePriorityAgents(gardenData, weatherData) {
        const agents = [];
        
        // Always run proactive care for scheduling
        agents.push('proactiveCare');
        
        // Check if any plants need health monitoring
        if (this.needsHealthMonitoring(gardenData)) {
            agents.push('healthMonitor');
        }
        
        // Check for harvest opportunities
        if (this.hasUpcomingHarvests(gardenData)) {
            agents.push('harvestOptimizer');
        }
        
        // Environmental analysis during weather changes
        if (this.hasWeatherChanges(weatherData)) {
            agents.push('environmentalIntelligence');
        }
        
        return agents;
    }

    needsHealthMonitoring(gardenData) {
        // Check if any plants haven't been monitored recently
        return gardenData.some(plant => {
            const lastCheck = this.plantHealthHistory.get(plant.instanceId);
            return !lastCheck || this.daysSince(lastCheck.timestamp) > 7;
        });
    }

    hasUpcomingHarvests(gardenData) {
        return gardenData.some(plant => {
            if (!plant.plantInfo?.daysToMaturity) return false;
            
            const plantingDate = new Date(plant.plantingDate);
            const ageInDays = this.daysSince(plantingDate);
            const daysToMaturity = plant.plantInfo.daysToMaturity - ageInDays;
            
            return daysToMaturity <= 14 && daysToMaturity >= 0;
        });
    }

    hasWeatherChanges(weatherData) {
        if (!this.weatherCache) return true;
        
        // Check for significant weather changes
        const currentTemp = weatherData.current?.temperature || 0;
        const cachedTemp = this.weatherCache.current?.temperature || 0;
        
        return Math.abs(currentTemp - cachedTemp) > 10;
    }

    daysSince(date) {
        const now = new Date();
        const target = new Date(date);
        return Math.floor((now - target) / (1000 * 60 * 60 * 24));
    }

    async getUserLocation() {
        return new Promise((resolve) => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        this.location = {
                            lat: position.coords.latitude,
                            lon: position.coords.longitude
                        };
                        resolve(this.location);
                    },
                    () => {
                        // Default to NYC if location fails
                        this.location = { lat: 40.7128, lon: -74.0060 };
                        resolve(this.location);
                    }
                );
            } else {
                this.location = { lat: 40.7128, lon: -74.0060 };
                resolve(this.location);
            }
        });
    }

    async getWeatherData() {
        if (!this.location) {
            await this.getUserLocation();
        }
        
        try {
            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${this.location.lat}&longitude=${this.location.lon}&current=temperature_2m,humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto`
            );
            
            if (!response.ok) {
                throw new Error('Weather API request failed');
            }
            
            const data = await response.json();
            this.weatherCache = data;
            return data;
            
        } catch (error) {
            console.error('Failed to fetch weather data:', error);
            return this.weatherCache || {};
        }
    }
}

// Global instance
let agenticFeatures;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    agenticFeatures = new AgenticGardenFeatures();
    
    // Make globally available immediately
    window.agenticFeatures = agenticFeatures;
    
    // Initialize after a short delay to ensure other components are loaded
    setTimeout(async () => {
        try {
            await agenticFeatures.initialize();
            console.log('Agentic features fully initialized');
        } catch (error) {
            console.warn('Agentic features initialization failed:', error);
            // Provide minimal fallback
            window.agenticFeatures = {
                runAgent: () => Promise.reject(new Error('Agentic features not properly initialized'))
            };
        }
    }, 1000);
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgenticGardenFeatures;
} 