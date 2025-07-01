const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const multer = require('multer');
const FormData = require('form-data');
const { Readable } = require('stream');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces

const plantDbPath = path.join(__dirname, 'plant_database.json');
const pestDbPath = path.join(__dirname, 'pest_disease_database.json');
const userDataPath = path.join(__dirname, 'user_data.json');

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Configure multer for file uploads
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// API routes
app.get('/api/plants', async (req, res) => {
    try {
        const data = await fs.readFile(plantDbPath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).send('Error reading plant database');
    }
});

app.get('/api/pests', async (req, res) => {
    try {
        const data = await fs.readFile(pestDbPath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).send('Error reading pest/disease database');
    }
});

app.get('/api/user-data', async (req, res) => {
    try {
        const data = await fs.readFile(userDataPath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, return default empty state
            res.json({ myGarden: [], gardenLayout: { plants: {} }, careLog: {}, activityLog: [], harvestLog: [], userPlants: [] });
        } else {
            res.status(500).send('Error reading user data');
        }
    }
});

app.post('/api/user-data', async (req, res) => {
    try {
        const newUserData = req.body;
        await fs.writeFile(userDataPath, JSON.stringify(newUserData, null, 2));
        res.status(200).send('User data updated successfully');
    } catch (error) {
        res.status(500).send('Error writing user data');
    }
});

app.post('/api/plants', async (req, res) => {
    try {
        const newPlantData = req.body;
        await fs.writeFile(plantDbPath, JSON.stringify(newPlantData, null, 2));
        res.status(200).send('Plant database updated successfully');
    } catch (error) {
        res.status(500).send('Error writing to plant database');
    }
});

// Voice recording endpoints
app.post('/api/transcribe-audio', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        // Get API key from request headers or environment
        const apiKey = req.headers['x-api-key'] || process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return res.status(400).json({ error: 'OpenAI API key not provided' });
        }

        console.log('Received audio file:', {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        });

        // Determine appropriate filename and content type
        let filename = req.file.originalname || 'recording.wav';
        let contentType = req.file.mimetype || 'audio/wav';
        
        // Map common types
        if (filename.endsWith('.webm')) {
            contentType = 'audio/webm';
        } else if (filename.endsWith('.m4a')) {
            contentType = 'audio/m4a';
        } else if (filename.endsWith('.mp3')) {
            contentType = 'audio/mp3';
        } else if (filename.endsWith('.ogg')) {
            contentType = 'audio/ogg';
        }

        // Create form data for OpenAI API using form-data library
        const formData = new FormData();
        formData.append('file', req.file.buffer, filename);
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'json');

        // Build headers with proper multipart boundary and authorization
        const openaiHeaders = {
            'Authorization': `Bearer ${apiKey}`,
            ...formData.getHeaders()
        };

        // Call OpenAI Whisper API using fetch with Buffer body
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: openaiHeaders,
            body: formData.getBuffer()
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI API error:', response.status, errorText);
            
            let errorMessage = 'OpenAI API error';
            if (response.status === 429) {
                errorMessage = 'Rate limit exceeded. Please wait and try again.';
            } else if (response.status === 401) {
                errorMessage = 'Invalid API key provided.';
            } else if (response.status === 413) {
                errorMessage = 'Audio file too large. Maximum size is 25MB.';
            }
            
            return res.status(response.status).json({ 
                error: errorMessage, 
                details: errorText 
            });
        }

        const result = await response.json();
        
        if (!result.text || result.text.trim().length === 0) {
            return res.status(400).json({ 
                error: 'No speech detected in audio file',
                transcript: ''
            });
        }
        
        console.log('Transcription successful:', result.text.substring(0, 100) + '...');
        res.json({ transcript: result.text });

    } catch (error) {
        console.error('Error transcribing audio:', error);
        res.status(500).json({ error: 'Error transcribing audio', details: error.message });
    }
});

app.post('/api/analyze-transcript', async (req, res) => {
    try {
        const { transcript, prompt, plants } = req.body;
        
        if (!transcript || !prompt) {
            return res.status(400).json({ error: 'Transcript and prompt are required' });
        }

        // Get API key from request headers or environment
        const apiKey = req.headers['x-api-key'] || process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return res.status(400).json({ error: 'OpenAI API key not provided' });
        }

        // Call OpenAI GPT API
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4.1-nano',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert garden data analyst with advanced natural language processing skills. You excel at extracting structured, actionable information from conversational speech about plants and gardening. Always respond with valid, well-formatted JSON that precisely matches the requested schema.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI API error:', errorText);
            return res.status(response.status).json({ error: 'OpenAI API error', details: errorText });
        }

        const result = await response.json();
        
        try {
            const analysis = JSON.parse(result.choices[0].message.content);
            res.json(analysis);
        } catch (parseError) {
            console.error('Error parsing GPT response:', parseError);
            res.status(500).json({ 
                error: 'Error parsing AI response', 
                rawResponse: result.choices[0].message.content 
            });
        }

    } catch (error) {
        console.error('Error analyzing transcript:', error);
        res.status(500).json({ error: 'Error analyzing transcript', details: error.message });
    }
});

// =================================================================================
// AGENTIC AI ENDPOINTS - COMPREHENSIVE GARDEN MANAGEMENT SYSTEM
// =================================================================================

// Import the agentic system functions
const aiAgents = require('./ai-agents');

// Proactive Care Agent Endpoint
app.post('/api/agentic/proactive-care', async (req, res) => {
    try {
        const { weatherData, plantData, userPreferences } = req.body;
        const apiKey = req.headers['x-api-key'] || process.env.OPENAI_API_KEY;
        
        if (!apiKey) {
            return res.status(400).json({ error: 'OpenAI API key not provided' });
        }

        console.log('Running Proactive Care Agent...');
        
        // Prepare context for the agent
        const context = {
            currentWeather: weatherData,
            plants: plantData,
            preferences: userPreferences,
            season: getCurrentSeason(),
            timestamp: new Date().toISOString()
        };

        // Set the API key for the agents
        process.env.OPENAI_API_KEY = apiKey;
        
        const analysis = await aiAgents.generateProactiveCareRecommendations(
            weatherData, 
            plantData, 
            userPreferences
        );

        res.json({
            success: true,
            recommendations: analysis.recommendations || analysis.analysis,
            urgentTasks: analysis.urgentTasks || [],
            scheduleAdjustments: analysis.scheduleAdjustments || [],
            weatherAlerts: analysis.weatherAlerts || [],
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Proactive Care Agent error:', error);
        res.status(500).json({ 
            error: 'Proactive Care Agent failed', 
            details: error.message 
        });
    }
});

// Plant Health Monitor Agent Endpoint
app.post('/api/agentic/health-monitor', async (req, res) => {
    try {
        const { plantData, healthHistory } = req.body;
        const apiKey = req.headers['x-api-key'] || process.env.OPENAI_API_KEY;
        
        if (!apiKey) {
            return res.status(400).json({ error: 'OpenAI API key not provided' });
        }

        console.log('Running Plant Health Monitor Agent...');
        
        const context = {
            plants: plantData,
            history: healthHistory,
            timestamp: new Date().toISOString()
        };

        // Set the API key for the agents
        process.env.OPENAI_API_KEY = apiKey;
        
        const analysis = await aiAgents.analyzeePlantHealth(plantData, healthHistory);

        res.json({
            success: true,
            healthAssessment: analysis.healthAssessment || analysis.analysis,
            issues: analysis.issues || [],
            recommendations: analysis.recommendations || [],
            growthAnalysis: analysis.growthAnalysis || {},
            preventiveMeasures: analysis.preventiveMeasures || [],
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Health Monitor Agent error:', error);
        res.status(500).json({ 
            error: 'Health Monitor Agent failed', 
            details: error.message 
        });
    }
});

// Harvest Optimizer Agent Endpoint
app.post('/api/agentic/harvest-optimizer', async (req, res) => {
    try {
        const { plantData, weatherData, storageCapacity } = req.body;
        const apiKey = req.headers['x-api-key'] || process.env.OPENAI_API_KEY;
        
        if (!apiKey) {
            return res.status(400).json({ error: 'OpenAI API key not provided' });
        }

        console.log('Running Harvest Optimizer Agent...');
        
        const context = {
            plants: plantData,
            weather: weatherData,
            storage: storageCapacity,
            timestamp: new Date().toISOString()
        };

        // Set the API key for the agents
        process.env.OPENAI_API_KEY = apiKey;
        
        const analysis = await aiAgents.optimizeHarvests(plantData, weatherData, storageCapacity);

        res.json({
            success: true,
            harvestSchedule: analysis.harvestSchedule || analysis.optimization,
            optimalTimes: analysis.optimalTimes || [],
            storageRecommendations: analysis.storageRecommendations || [],
            preservationMethods: analysis.preservationMethods || [],
            yieldPredictions: analysis.yieldPredictions || [],
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Harvest Optimizer Agent error:', error);
        res.status(500).json({ 
            error: 'Harvest Optimizer Agent failed', 
            details: error.message 
        });
    }
});

// Garden Planner Agent Endpoint
app.post('/api/agentic/garden-planner', async (req, res) => {
    try {
        const { currentPlants, availableSpace, seasonData, planningGoals } = req.body;
        const apiKey = req.headers['x-api-key'] || process.env.OPENAI_API_KEY;
        
        if (!apiKey) {
            return res.status(400).json({ error: 'OpenAI API key not provided' });
        }

        console.log('Running Garden Planner Agent...');
        
        const context = {
            currentGarden: currentPlants,
            space: availableSpace,
            season: seasonData,
            goals: planningGoals,
            timestamp: new Date().toISOString()
        };

        // Set the API key for the agents
        process.env.OPENAI_API_KEY = apiKey;
        
        const analysis = await aiAgents.generateGardenPlan(currentPlants, availableSpace, seasonData, planningGoals);

        res.json({
            success: true,
            plan: analysis.plan,
            companionSuggestions: analysis.companionSuggestions || [],
            layoutOptimization: analysis.layoutOptimization || {},
            rotationPlan: analysis.rotationPlan || [],
            seasonalTasks: analysis.seasonalTasks || [],
            spaceUtilization: analysis.spaceUtilization || {},
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Garden Planner Agent error:', error);
        res.status(500).json({ 
            error: 'Garden Planner Agent failed', 
            details: error.message 
        });
    }
});

// Environmental Intelligence Agent Endpoint
app.post('/api/agentic/environmental-intelligence', async (req, res) => {
    try {
        const { gardenLayout, weatherHistory, plantPerformance } = req.body;
        const apiKey = req.headers['x-api-key'] || process.env.OPENAI_API_KEY;
        
        if (!apiKey) {
            return res.status(400).json({ error: 'OpenAI API key not provided' });
        }

        console.log('Running Environmental Intelligence Agent...');
        
        const context = {
            layout: gardenLayout,
            weatherData: weatherHistory,
            performance: plantPerformance,
            timestamp: new Date().toISOString()
        };

        // Set the API key for the agents
        process.env.OPENAI_API_KEY = apiKey;
        
        const analysis = await aiAgents.analyzeEnvironmentalConditions(gardenLayout, weatherHistory, plantPerformance);

        res.json({
            success: true,
            analysis: analysis.analysis,
            microclimates: analysis.microclimates || [],
            weatherPatterns: analysis.weatherPatterns || {},
            environmentalRecommendations: analysis.environmentalRecommendations || [],
            seasonalInsights: analysis.seasonalInsights || {},
            optimizationSuggestions: analysis.optimizationSuggestions || [],
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Environmental Intelligence Agent error:', error);
        res.status(500).json({ 
            error: 'Environmental Intelligence Agent failed', 
            details: error.message 
        });
    }
});

// Agent Status Endpoint
app.get('/api/agentic/status', (req, res) => {
    res.json({
        success: true,
        agents: {
            proactiveCare: { status: 'ready', name: 'Proactive Care Specialist' },
            healthMonitor: { status: 'ready', name: 'Plant Health Monitor' },
            harvestOptimizer: { status: 'ready', name: 'Harvest Optimizer' },
            gardenPlanner: { status: 'ready', name: 'Garden Planner' },
            environmentalIntelligence: { status: 'ready', name: 'Environmental Intelligence' }
        },
        systemStatus: 'operational',
        timestamp: new Date().toISOString()
    });
});

// Multi-Agent Coordination Endpoint
app.post('/api/agentic/coordinate', async (req, res) => {
    try {
        const { agents, gardenData, priorities } = req.body;
        const apiKey = req.headers['x-api-key'] || process.env.OPENAI_API_KEY;
        
        if (!apiKey) {
            return res.status(400).json({ error: 'OpenAI API key not provided' });
        }

        console.log('Running Multi-Agent Coordination...');
        
        const results = {};
        const context = {
            garden: gardenData,
            coordination: true,
            priorities: priorities || [],
            timestamp: new Date().toISOString()
        };

        // Set the API key for the agents
        process.env.OPENAI_API_KEY = apiKey;
        
        // Run specified agents in sequence with shared context
        for (const agentType of agents) {
            try {
                let result;
                
                switch (agentType) {
                    case 'proactiveCare':
                        result = await aiAgents.generateProactiveCareRecommendations({}, gardenData, priorities);
                        break;
                    case 'healthMonitor':
                        result = await aiAgents.analyzeePlantHealth(gardenData, []);
                        break;
                    case 'harvestOptimizer':
                        result = await aiAgents.optimizeHarvests(gardenData, {}, {});
                        break;
                    case 'gardenPlanner':
                        result = await aiAgents.generateGardenPlan(gardenData, {}, {}, priorities);
                        break;
                    case 'environmentalIntelligence':
                        result = await aiAgents.analyzeEnvironmentalConditions({}, [], []);
                        break;
                    default:
                        continue;
                }
                
                results[agentType] = result;
                
                // Update context with previous results for coordination
                context[`${agentType}Result`] = result;
                
            } catch (error) {
                console.error(`Agent ${agentType} failed in coordination:`, error);
                results[agentType] = { error: error.message };
            }
        }

        res.json({
            success: true,
            coordination: results,
            summary: generateCoordinationSummary(results),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Multi-Agent Coordination error:', error);
        res.status(500).json({ 
            error: 'Multi-Agent Coordination failed', 
            details: error.message 
        });
    }
});

// Helper function to generate coordination summary
function generateCoordinationSummary(results) {
    const successful = Object.keys(results).filter(key => !results[key].error);
    const failed = Object.keys(results).filter(key => results[key].error);
    
    return {
        totalAgents: Object.keys(results).length,
        successful: successful.length,
        failed: failed.length,
        successfulAgents: successful,
        failedAgents: failed,
        overallStatus: failed.length === 0 ? 'success' : 'partial'
    };
}

// =================================================================================
// AGENT RESULTS STORAGE ENDPOINTS
// =================================================================================

// Store agent results permanently
app.post('/api/agent-results', (req, res) => {
    try {
        const agentResult = req.body;
        
        // Validate required fields
        if (!agentResult.agentType || !agentResult.result || !agentResult.timestamp) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Load existing results
        let agentResults = [];
        try {
            const data = fs.readFileSync('agent_results.json', 'utf8');
            agentResults = JSON.parse(data);
        } catch (error) {
            // File doesn't exist yet, start with empty array
            agentResults = [];
        }
        
        // Add new result
        agentResults.push(agentResult);
        
        // Keep only last 1000 results to prevent file from growing too large
        if (agentResults.length > 1000) {
            agentResults = agentResults.slice(-1000);
        }
        
        // Save back to file
        fs.writeFileSync('agent_results.json', JSON.stringify(agentResults, null, 2));
        
        res.json({ success: true, message: 'Agent result saved successfully' });
        
    } catch (error) {
        console.error('Error saving agent result:', error);
        res.status(500).json({ error: 'Failed to save agent result' });
    }
});

// Get all agent results
app.get('/api/agent-results', (req, res) => {
    try {
        const { date } = req.query;
        
        // Load results from file
        let agentResults = [];
        try {
            const data = fs.readFileSync('agent_results.json', 'utf8');
            agentResults = JSON.parse(data);
        } catch (error) {
            // File doesn't exist, return empty array
            return res.json([]);
        }
        
        // Filter by date if provided
        if (date) {
            const targetDate = new Date(date).toDateString();
            agentResults = agentResults.filter(result => result.date === targetDate);
        }
        
        // Sort by timestamp (newest first)
        agentResults.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        res.json(agentResults);
        
    } catch (error) {
        console.error('Error fetching agent results:', error);
        res.status(500).json({ error: 'Failed to fetch agent results' });
    }
});

// Helper function to get current season
function getCurrentSeason() {
    const now = new Date();
    const month = now.getMonth() + 1; // getMonth() returns 0-11
    
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'fall';
    return 'winter';
}

app.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
    
    // Display network interfaces for easy access
    const interfaces = os.networkInterfaces();
    console.log('\nAccess your Garden Tracker from:');
    console.log(`- Local: http://localhost:${PORT}`);
    
    Object.keys(interfaces).forEach(name => {
        interfaces[name].forEach(iface => {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`- Network: http://${iface.address}:${PORT}`);
            }
        });
    });
    console.log('');
}); 