// Temporary workaround: Use direct OpenAI API calls instead of the agents package
// const { Agent, tool, run } = require('@openai/agents');

// Enhanced Agentic Garden Management System using direct OpenAI API calls
// Replacing the agents package that was causing CommonJS/ES module conflicts

// Using Node.js native fetch (available in Node 18+)

// =================================================================================
// AGENT FUNCTIONS - DIRECT OPENAI API CALLS
// =================================================================================

// Helper function to make OpenAI API calls
async function callOpenAI(systemPrompt, userPrompt, model = 'gpt-4.1-nano') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OpenAI API key not configured');
    }

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.3,
                max_tokens: 1500
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        return result.choices[0].message.content;
    } catch (error) {
        console.error('Failed to call OpenAI API:', error);
        throw error;
    }
}

// 1. PROACTIVE CARE AGENT
async function generateProactiveCareRecommendations(weatherData, plantData, userPreferences = {}) {
    const systemPrompt = `You are an expert gardening care coordinator with 25+ years of experience. You excel at:
    
    1. WEATHER-RESPONSIVE CARE: Monitoring weather patterns and adjusting care schedules
    2. INTELLIGENT SCHEDULING: Creating care schedules based on plant needs and conditions
    3. PRIORITY NOTIFICATIONS: Sending timely, actionable notifications with urgency levels
    4. RESOURCE OPTIMIZATION: Balancing water usage, fertilizer application, and energy consumption
    
    Provide responses that are time-sensitive, actionable, prioritized by urgency, weather-aware, and specific to individual plant needs.
    
    Return your response as clear, human-readable text with specific recommendations, organized by priority level. Use bullet points and clear headings. Be conversational but professional.`;

    const userPrompt = `Analyze current garden conditions and provide care recommendations:
    
    Weather Data: ${JSON.stringify(weatherData, null, 2)}
    Plant Data: ${JSON.stringify(plantData, null, 2)}
    User Preferences: ${JSON.stringify(userPreferences, null, 2)}`;

    try {
        const response = await callOpenAI(systemPrompt, userPrompt);
        return { analysis: response };
    } catch (error) {
        console.error('Proactive Care Agent error:', error);
        return { analysis: "Unable to analyze garden conditions at this time. Please perform a manual garden inspection and check back later." };
    }
}

// 2. PLANT HEALTH MONITOR AGENT
async function analyzeePlantHealth(plantData, healthHistory = []) {
    const systemPrompt = `You are a certified plant pathologist and health monitoring specialist. Your expertise includes:
    
    1. VISUAL HEALTH ANALYSIS: Expert identification of diseases, pests, and nutrient deficiencies
    2. GROWTH TRACKING: Monitoring plant development and identifying anomalies
    3. PREDICTIVE DIAGNOSTICS: Early detection of potential issues before they become critical
    4. TREATMENT RECOMMENDATIONS: Specific, actionable treatment plans with timelines
    
    Provide systematic analysis with confidence levels, multiple treatment options, prevention strategies, and monitoring schedules.
    
    Return your response as clear, human-readable text. Include an overall health assessment, any issues found, specific treatment recommendations, and preventive measures. Use clear headings and bullet points.`;

    const userPrompt = `Analyze plant health status:
    
    Plant Data: ${JSON.stringify(plantData, null, 2)}
    Health History: ${JSON.stringify(healthHistory, null, 2)}`;

    try {
        const response = await callOpenAI(systemPrompt, userPrompt);
        return { analysis: response };
    } catch (error) {
        console.error('Health Monitor Agent error:', error);
        return { analysis: "Unable to analyze plant health at this time. Please perform a visual inspection of your plants and check for any signs of disease, pests, or nutrient deficiencies. Try running the health monitor again later." };
    }
}

// 3. HARVEST OPTIMIZER AGENT
async function optimizeHarvests(plantData, weatherData, storageCapacity = {}) {
    const systemPrompt = `You are a master harvest coordinator and post-harvest specialist. Your expertise covers:
    
    1. MATURITY ASSESSMENT: Precise determination of optimal harvest timing for maximum quality
    2. HARVEST PREDICTION: Accurate forecasting of harvest windows with quantity estimates
    3. STORAGE OPTIMIZATION: Expert recommendations for post-harvest handling and preservation
    4. MARKET TIMING: Coordination of harvest timing with consumption needs
    
    Provide exact harvest timing, optimal methods, post-harvest handling, storage conditions, and processing opportunities.
    
    Return your response as clear, human-readable text. Include harvest schedules, optimal harvest times, storage recommendations, and yield predictions. Use clear headings and practical advice.`;

    const userPrompt = `Optimize harvest timing and storage:
    
    Plant Data: ${JSON.stringify(plantData, null, 2)}
    Weather Data: ${JSON.stringify(weatherData, null, 2)}
    Storage Capacity: ${JSON.stringify(storageCapacity, null, 2)}`;

    try {
        const response = await callOpenAI(systemPrompt, userPrompt);
        return { optimization: response };
    } catch (error) {
        console.error('Harvest Optimizer Agent error:', error);
        return { optimization: "Unable to optimize harvest timing at this time. Please check your plants for signs of maturity and harvest readiness manually. Try running the harvest optimizer again later." };
    }
}

// 4. GARDEN PLANNER AGENT
async function generateGardenPlan(currentPlants, availableSpace, seasonData, planningGoals = {}) {
    const systemPrompt = `You are a master garden designer and agricultural systems specialist. Your expertise encompasses:
    
    1. COMPANION PLANTING: Expert knowledge of beneficial plant relationships and pest deterrence
    2. CROP ROTATION: Multi-season planning for soil health and yield optimization
    3. LAYOUT OPTIMIZATION: Spatial design for maximum efficiency and accessibility
    4. SUCCESSION PLANNING: Strategic timing for continuous harvests and season extension
    
    Consider soil health, pest management through diversity, space utilization, seasonal transitions, and labor efficiency.
    
    Return your response as clear, human-readable text. Include garden planning recommendations, companion planting suggestions, layout optimization ideas, and seasonal tasks. Use clear headings and practical advice.`;

    const userPrompt = `Generate comprehensive garden plan:
    
    Current Plants: ${JSON.stringify(currentPlants, null, 2)}
    Available Space: ${JSON.stringify(availableSpace, null, 2)}
    Season Data: ${JSON.stringify(seasonData, null, 2)}
    Planning Goals: ${JSON.stringify(planningGoals, null, 2)}`;

    try {
        const response = await callOpenAI(systemPrompt, userPrompt);
        return { plan: response };
    } catch (error) {
        console.error('Garden Planner Agent error:', error);
        return { plan: "Unable to generate garden plan at this time. Please review your current garden layout manually and consider companion planting opportunities. Try running the garden planner again later." };
    }
}

// 5. ENVIRONMENTAL INTELLIGENCE AGENT
async function analyzeEnvironmentalConditions(gardenLayout, weatherHistory, plantPerformance) {
    const systemPrompt = `You are an expert climatologist and microclimate analyst specializing in garden environments. Your capabilities include:
    
    1. WEATHER PATTERN ANALYSIS: Deep understanding of local weather trends and climate change impacts
    2. MICROCLIMATE MAPPING: Detailed analysis of garden-specific conditions including sun/shade patterns
    3. SEASONAL ADAPTATION: Strategic recommendations for seasonal transitions and climate resilience
    4. PREDICTIVE MODELING: Forecasting environmental impacts on plant health and growth
    
    Integrate historical weather data, real-time monitoring, garden-specific microclimate factors, and climate adaptation strategies.
    
    Return your response as clear, human-readable text. Include environmental analysis, microclimate insights, weather pattern observations, and optimization suggestions. Use clear headings and practical recommendations.`;

    const userPrompt = `Analyze environmental conditions and provide insights:
    
    Garden Layout: ${JSON.stringify(gardenLayout, null, 2)}
    Weather History: ${JSON.stringify(weatherHistory, null, 2)}
    Plant Performance: ${JSON.stringify(plantPerformance, null, 2)}`;

    try {
        const response = await callOpenAI(systemPrompt, userPrompt);
        return { analysis: response };
    } catch (error) {
        console.error('Environmental Intelligence Agent error:', error);
        return { analysis: "Unable to analyze environmental conditions at this time. Please observe your garden's microclimates manually and note any weather patterns affecting your plants. Try running the environmental intelligence agent again later." };
    }
}

// =================================================================================
// EXPORT FUNCTIONS
// =================================================================================

module.exports = {
    generateProactiveCareRecommendations,
    analyzeePlantHealth,
    optimizeHarvests,
    generateGardenPlan,
    analyzeEnvironmentalConditions
}; 