// Welcome Experience for Garden AI Agents
class AgenticWelcome {
    constructor() {
        this.hasSeenWelcome = localStorage.getItem('agentic_welcome_seen') === 'true';
        this.currentStep = 0;
        this.totalSteps = 4;
    }

    initialize() {
        if (!this.hasSeenWelcome) {
            // Show welcome after a short delay
            setTimeout(() => this.showWelcome(), 2000);
        }
        
        this.addWelcomeStyles();
    }

    addWelcomeStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .agentic-welcome-overlay {
                background: linear-gradient(135deg, rgba(79, 70, 229, 0.95), rgba(139, 92, 246, 0.95));
                backdrop-filter: blur(10px);
                animation: fadeIn 0.5s ease-out;
            }
            
            .agentic-welcome-card {
                animation: slideInUp 0.6s ease-out;
                transform-origin: center bottom;
            }
            
            .agentic-step-indicator {
                transition: all 0.3s ease;
            }
            
            .agentic-step-indicator.active {
                background: linear-gradient(45deg, #10b981, #06d6a0);
                transform: scale(1.2);
            }
            
            .agentic-feature-highlight {
                animation: pulse 2s infinite;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes slideInUp {
                from { 
                    opacity: 0;
                    transform: translateY(50px) scale(0.9);
                }
                to { 
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
            
            .agentic-gradient-text {
                background: linear-gradient(45deg, #10b981, #06d6a0, #3b82f6);
                background-size: 200% 200%;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                animation: gradientShift 3s ease-in-out infinite;
            }
            
            @keyframes gradientShift {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
            }
        `;
        document.head.appendChild(style);
    }

    showWelcome() {
        const welcomeOverlay = document.createElement('div');
        welcomeOverlay.id = 'agentic-welcome-overlay';
        welcomeOverlay.className = 'agentic-welcome-overlay fixed inset-0 z-50 flex items-center justify-center p-4';
        
        welcomeOverlay.innerHTML = this.getWelcomeContent();
        document.body.appendChild(welcomeOverlay);
        
        // Initialize lucide icons
        setTimeout(() => lucide.createIcons(), 100);
        
        this.setupWelcomeEventListeners();
    }

    getWelcomeContent() {
        const steps = [
            {
                icon: 'brain-circuit',
                title: 'Welcome to Garden AI',
                subtitle: 'Your Intelligent Garden Assistant',
                description: 'Meet your new AI-powered garden management system that learns, adapts, and helps your plants thrive!',
                features: [
                    'Proactive care recommendations',
                    'Intelligent health monitoring',
                    'Weather-responsive scheduling',
                    'Harvest optimization'
                ]
            },
            {
                icon: 'zap',
                title: 'Smart Automation',
                subtitle: 'AI That Works for You',
                description: 'Your garden AI agents work continuously in the background, analyzing conditions and providing personalized recommendations.',
                features: [
                    'Real-time weather monitoring',
                    'Predictive plant health analysis',
                    'Automated care scheduling',
                    'Smart notification system'
                ]
            },
            {
                icon: 'shield-check',
                title: 'Safe & Secure',
                subtitle: 'You\'re Always in Control',
                description: 'Every AI recommendation requires your approval. You decide what actions to take and when.',
                features: [
                    'Permission-based actions',
                    'Risk assessment for all changes',
                    'Manual override always available',
                    'Privacy-focused design'
                ]
            },
            {
                icon: 'rocket',
                title: 'Ready to Begin?',
                subtitle: 'Let\'s Set Up Your Garden AI',
                description: 'Configure your OpenAI API key to unlock the full potential of your intelligent garden assistant.',
                features: [
                    'Click the floating AI button',
                    'Configure your API key in settings',
                    'Run your first agent',
                    'Watch your garden thrive!'
                ]
            }
        ];

        const currentStep = steps[this.currentStep];
        
        return `
            <div class="agentic-welcome-card bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
                <!-- Header -->
                <div class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-8 text-center relative">
                    <div class="absolute top-4 right-4">
                        <button id="skip-welcome" class="text-white/70 hover:text-white transition-colors">
                            <i data-lucide="x" class="h-5 w-5"></i>
                        </button>
                    </div>
                    
                    <div class="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="${currentStep.icon}" class="h-10 w-10"></i>
                    </div>
                    
                    <h2 class="text-3xl font-bold mb-2 agentic-gradient-text">${currentStep.title}</h2>
                    <p class="text-xl text-indigo-100">${currentStep.subtitle}</p>
                </div>
                
                <!-- Content -->
                <div class="p-8">
                    <p class="text-lg text-gray-700 mb-6 leading-relaxed">${currentStep.description}</p>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        ${currentStep.features.map((feature, index) => `
                            <div class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                                <div class="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                                    <i data-lucide="check" class="h-4 w-4 text-white"></i>
                                </div>
                                <span class="text-gray-700 font-medium">${feature}</span>
                            </div>
                        `).join('')}
                    </div>
                    
                    <!-- Step Indicators -->
                    <div class="flex justify-center space-x-2 mb-6">
                        ${Array.from({length: this.totalSteps}, (_, i) => `
                            <div class="agentic-step-indicator w-3 h-3 rounded-full ${
                                i === this.currentStep ? 'active' : 'bg-gray-300'
                            }"></div>
                        `).join('')}
                    </div>
                    
                    <!-- Navigation -->
                    <div class="flex justify-between items-center">
                        <button id="prev-step" class="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors ${
                            this.currentStep === 0 ? 'invisible' : ''
                        }">
                            <i data-lucide="arrow-left" class="h-4 w-4 mr-2 inline"></i>Previous
                        </button>
                        
                        <div class="text-sm text-gray-500">
                            ${this.currentStep + 1} of ${this.totalSteps}
                        </div>
                        
                        <button id="next-step" class="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl font-medium">
                            ${this.currentStep === this.totalSteps - 1 ? 
                                '<i data-lucide="check" class="h-4 w-4 mr-2 inline"></i>Get Started' : 
                                'Next<i data-lucide="arrow-right" class="h-4 w-4 ml-2 inline"></i>'
                            }
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    setupWelcomeEventListeners() {
        const overlay = document.getElementById('agentic-welcome-overlay');
        
        // Next step
        overlay.querySelector('#next-step').addEventListener('click', () => {
            if (this.currentStep < this.totalSteps - 1) {
                this.currentStep++;
                this.updateWelcomeContent();
            } else {
                this.completeWelcome();
            }
        });
        
        // Previous step
        const prevBtn = overlay.querySelector('#prev-step');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentStep > 0) {
                    this.currentStep--;
                    this.updateWelcomeContent();
                }
            });
        }
        
        // Skip welcome
        overlay.querySelector('#skip-welcome').addEventListener('click', () => {
            this.completeWelcome();
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', this.handleKeyboardNavigation.bind(this));
    }

    updateWelcomeContent() {
        const overlay = document.getElementById('agentic-welcome-overlay');
        const card = overlay.querySelector('.agentic-welcome-card');
        
        // Add transition effect
        card.style.opacity = '0';
        card.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            overlay.innerHTML = this.getWelcomeContent();
            lucide.createIcons();
            this.setupWelcomeEventListeners();
            
            // Fade back in
            const newCard = overlay.querySelector('.agentic-welcome-card');
            newCard.style.opacity = '1';
            newCard.style.transform = 'scale(1)';
        }, 200);
    }

    handleKeyboardNavigation(e) {
        if (!document.getElementById('agentic-welcome-overlay')) return;
        
        if (e.key === 'ArrowRight' || e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('next-step').click();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const prevBtn = document.getElementById('prev-step');
            if (prevBtn && !prevBtn.classList.contains('invisible')) {
                prevBtn.click();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.completeWelcome();
        }
    }

    completeWelcome() {
        const overlay = document.getElementById('agentic-welcome-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
                document.removeEventListener('keydown', this.handleKeyboardNavigation);
            }, 300);
        }
        
        localStorage.setItem('agentic_welcome_seen', 'true');
        
        // Show a subtle notification about the floating button
        setTimeout(() => {
            this.showFloatingButtonHighlight();
        }, 1000);
    }

    showFloatingButtonHighlight() {
        const fab = document.getElementById('agentic-fab');
        if (fab) {
            // Add a pulsing highlight
            fab.classList.add('agentic-feature-highlight');
            
            // Show tooltip automatically
            const tooltip = fab.querySelector('.absolute.right-20');
            if (tooltip) {
                tooltip.classList.remove('opacity-0');
                tooltip.classList.add('opacity-100');
                
                setTimeout(() => {
                    tooltip.classList.add('opacity-0');
                    tooltip.classList.remove('opacity-100');
                    fab.classList.remove('agentic-feature-highlight');
                }, 3000);
            }
        }
    }

    // Allow users to replay the welcome
    static showWelcomeAgain() {
        localStorage.removeItem('agentic_welcome_seen');
        const welcome = new AgenticWelcome();
        welcome.initialize();
        setTimeout(() => welcome.showWelcome(), 100);
    }
}

// Initialize welcome experience
document.addEventListener('DOMContentLoaded', () => {
    const agenticWelcome = new AgenticWelcome();
    agenticWelcome.initialize();
    
    // Make welcome available globally for settings
    window.agenticWelcome = agenticWelcome;
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgenticWelcome;
} 