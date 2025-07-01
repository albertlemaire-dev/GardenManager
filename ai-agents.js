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
            let errorMessage = `OpenAI API error: ${response.status}`;
            
            if (response.status === 429) {
                errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
            } else if (response.status === 401) {
                errorMessage = 'Invalid API key. Please check your OpenAI API key in settings.';
            } else if (response.status === 402) {
                errorMessage = 'Insufficient credits. Please check your OpenAI account billing.';
            } else if (response.status === 400) {
                errorMessage = 'Bad request. Please check your input data.';
            } else if (response.status >= 500) {
                errorMessage = 'OpenAI server error. Please try again later.';
            }
            
            throw new Error(`${errorMessage} - ${errorText}`);
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
    const systemPrompt = `
You are "AgriSense," a veteran horticultural strategist with 25+ years of experience.

- Always return JSON with "tasks" array, each task having: { "title", "dueDate", "priority":0‒1, "durationMinutes", "details" }.
- Group tasks by urgency: HIGH, MEDIUM, LOW.
- Include a "resourceSummary" with water/fertilizer estimates.
- Use local timezone for dueDate.
- IMPORTANT: Always consider the user's notes, activity history, and observations when making recommendations.
- Reference specific plants by name and acknowledge any issues or successes the user has documented.
- Provide personalized care based on documented plant history and user observations.
`;

    const userPrompt = `
Context:
  - Current Weather: ${JSON.stringify(weatherData)}
  - Garden Plants (includes user notes and observations): ${JSON.stringify(plantData)}
  - User Preferences: ${JSON.stringify(userPreferences)}

Please pay special attention to any user notes, observations, or issues mentioned in the plant data. Incorporate this personal knowledge into your recommendations.

Produce:
{
  "tasks": [
    {
      "title": "Water tomatoes based on recent drought stress notes",
      "dueDate": "2025-01-02T08:00:00-08:00",
      "priority": 0.9,
      "durationMinutes": 15,
      "details": "Apply 1 gallon to each plant at soil level. User noted wilting yesterday."
    }
  ],
  "resourceSummary": {
    "waterGallons": 5,
    "fertilizerOz": 2
  },
  "personalizedNotes": "Specific observations based on user's documented plant history",
  "urgencyGroups": {
    "HIGH": [],
    "MEDIUM": [],
    "LOW": []
  }
}`;

    try {
        const response = await callOpenAI(systemPrompt, userPrompt);
        return { analysis: response };
    } catch (error) {
        console.error('Proactive Care Agent error:', error);
        return { analysis: JSON.stringify({
            tasks: [],
            resourceSummary: { waterGallons: 0, fertilizerOz: 0 },
            personalizedNotes: "Unable to analyze garden conditions at this time. Please perform a manual garden inspection and check back later.",
            urgencyGroups: { HIGH: [], MEDIUM: [], LOW: [] }
        }) };
    }
}

// 2. PLANT HEALTH MONITOR AGENT
async function analyzeePlantHealth(plantData, healthHistory = []) {
    const systemPrompt = `
You are "PathoDetect," a certified plant pathologist and health monitoring specialist.

- Return JSON: {
    "assessmentScore": 0‒1,
    "issues": [{"type", "severity": 0‒1, "description", "plantName"}],
    "treatments": [{"issueType", "options": [{"name", "timelineDays"}]}],
    "prevention": [],
    "monitoringSchedule": [{"task", "intervalDays"}],
    "personalizedInsights": "Specific observations based on user notes"
  }
- Use clear, concise keys.
- IMPORTANT: Always consider the user's notes, observations, and documented symptoms.
- Reference specific plants by name and acknowledge any concerns or successes the user has noted.
- Address specific concerns mentioned in user notes.
`;

    const userPrompt = `
Plant Data (includes user notes and observations): ${JSON.stringify(plantData)}
Health History: ${JSON.stringify(healthHistory)}

Please carefully review any user notes, observations, or concerns documented for each plant. Address these specifically in your health analysis and recommendations.

Expected JSON format:
{
  "assessmentScore": 0.85,
  "issues": [
    {
      "type": "pest",
      "severity": 0.6,
      "description": "Aphids detected on tomato plant based on user's yellowing leaf notes",
      "plantName": "Cherry Tomato #1"
    }
  ],
  "treatments": [
    {
      "issueType": "pest",
      "options": [
        {"name": "Neem oil spray", "timelineDays": 7},
        {"name": "Beneficial insects", "timelineDays": 14}
      ]
    }
  ],
  "prevention": ["Regular inspection", "Companion planting"],
  "monitoringSchedule": [
    {"task": "Check for aphids", "intervalDays": 3}
  ],
  "personalizedInsights": "Based on your notes about yellowing leaves, this appears to be early aphid damage..."
}`;

    try {
        const response = await callOpenAI(systemPrompt, userPrompt);
        return { analysis: response };
    } catch (error) {
        console.error('Health Monitor Agent error:', error);
        return { analysis: JSON.stringify({
            assessmentScore: 0.5,
            issues: [],
            treatments: [],
            prevention: [],
            monitoringSchedule: [],
            personalizedInsights: "Unable to analyze plant health at this time. Please perform a visual inspection of your plants and check for any signs of disease, pests, or nutrient deficiencies."
        }) };
    }
}

// 3. HARVEST OPTIMIZER AGENT
async function optimizeHarvests(plantData, weatherData, storageCapacity = {}) {
    const systemPrompt = `
You are "HarvestPro," a global post-harvest expert and harvest coordinator.

- Return JSON:
  {
    "harvestWindows": [{"plant", "startDate", "endDate", "quantityEstimate"}],
    "storage": [{"method", "temperatureF", "humidityPct", "durationDays"}],
    "yieldPrediction": [{"plant", "pounds"}],
    "personalizedTiming": "Specific recommendations based on user's plant notes and observations"
  }
- Provide dates in ISO with timezone.
- IMPORTANT: Consider user notes about plant maturity, previous harvest experiences, and documented growth patterns.
- Reference specific plants by name and acknowledge user's harvest history.
`;

    const userPrompt = `
Plant Data (includes user notes and observations): ${JSON.stringify(plantData)}
Weather Forecast: ${JSON.stringify(weatherData)}
Storage Capacity: ${JSON.stringify(storageCapacity)}

Please consider any user notes about plant maturity, harvest timing preferences, and storage experiences.

Expected JSON format:
{
  "harvestWindows": [
    {
      "plant": "Cherry Tomatoes #1",
      "startDate": "2025-01-10T00:00:00-08:00",
      "endDate": "2025-01-20T00:00:00-08:00",
      "quantityEstimate": "5 lbs"
    }
  ],
  "storage": [
    {
      "method": "Counter ripening",
      "temperatureF": 65,
      "humidityPct": 85,
      "durationDays": 7
    }
  ],
  "yieldPrediction": [
    {"plant": "Cherry Tomatoes #1", "pounds": 8}
  ],
  "personalizedTiming": "Based on your notes about slow ripening last season, recommend waiting an extra 3-5 days..."
}`;

    try {
        const response = await callOpenAI(systemPrompt, userPrompt);
        return { optimization: response };
    } catch (error) {
        console.error('Harvest Optimizer Agent error:', error);
        return { optimization: JSON.stringify({
            harvestWindows: [],
            storage: [],
            yieldPrediction: [],
            personalizedTiming: "Unable to optimize harvest timing at this time. Please check your plants for signs of maturity and harvest readiness manually."
        }) };
    }
}

// 4. GARDEN PLANNER AGENT
async function generateGardenPlan(currentPlants, availableSpace, seasonData, planningGoals = {}) {
    const systemPrompt = `
You are "GardenMaestro," an award-winning permaculture designer and garden planning specialist.

- Return JSON:
  {
    "layouts": [
      {"bedId", "plantPositions": [{"plant", "xPercent", "yPercent"}]}
    ],
    "companionPairs": [{"plantA", "plantB", "benefit"}],
    "cropRotation": [{"year", "bedId", "crop"}],
    "seasonalTasks": [{"task", "month"}],
    "personalizedPlan": "Specific recommendations based on user's garden history and preferences"
  }
- IMPORTANT: Consider user notes about plant performance, space constraints, and previous garden experiences.
- Reference specific successful plant combinations the user has documented.
`;

    const userPrompt = `
Current Plants (includes user notes and observations): ${JSON.stringify(currentPlants)}
Available Space: ${JSON.stringify(availableSpace)}
Season Data: ${JSON.stringify(seasonData)}
Planning Goals: ${JSON.stringify(planningGoals)}

Please consider any user notes about plant performance, companion planting successes/failures, and space utilization preferences.

Expected JSON format:
{
  "layouts": [
    {
      "bedId": "bed1",
      "plantPositions": [
        {"plant": "Tomatoes", "xPercent": 25, "yPercent": 50},
        {"plant": "Basil", "xPercent": 75, "yPercent": 50}
      ]
    }
  ],
  "companionPairs": [
    {"plantA": "Tomatoes", "plantB": "Basil", "benefit": "Pest deterrent"}
  ],
  "cropRotation": [
    {"year": 2025, "bedId": "bed1", "crop": "Nightshades"},
    {"year": 2026, "bedId": "bed1", "crop": "Legumes"}
  ],
  "seasonalTasks": [
    {"task": "Plant summer tomatoes", "month": "March"}
  ],
  "personalizedPlan": "Based on your notes about tomato success in bed #2 last year, recommend similar placement..."
}`;

    try {
        const response = await callOpenAI(systemPrompt, userPrompt);
        return { plan: response };
    } catch (error) {
        console.error('Garden Planner Agent error:', error);
        return { plan: JSON.stringify({
            layouts: [],
            companionPairs: [],
            cropRotation: [],
            seasonalTasks: [],
            personalizedPlan: "Unable to generate garden plan at this time. Please review your current garden layout manually and consider companion planting opportunities."
        }) };
    }
}

// 5. ENVIRONMENTAL INTELLIGENCE AGENT
async function analyzeEnvironmentalConditions(gardenLayout, weatherHistory, plantPerformance) {
    const systemPrompt = `
You are "EcoScope," a climatologist focused on garden microclimates and environmental analysis.

- Return JSON:
  {
    "microclimateZones": [{"zoneId", "description", "coordinates"}],
    "weatherPatterns": [{"patternName", "impact", "recommendation"}],
    "climateRisks": [{"risk", "severity": 0‒1}],
    "adaptations": [{"action", "idealTiming", "notes"}],
    "personalizedInsights": "Specific observations based on user's environmental notes and plant performance data"
  }
- IMPORTANT: Consider user notes about microclimates, plant performance in different areas, and weather observations.
- Reference specific garden zones and documented environmental challenges.
`;

    const userPrompt = `
Garden Layout (includes user notes and observations): ${JSON.stringify(gardenLayout)}
Weather History: ${JSON.stringify(weatherHistory)}
Plant Performance (includes user observations): ${JSON.stringify(plantPerformance)}

Please consider any user notes about microclimates, wind patterns, sun/shade observations, and plant performance in different garden areas.

Expected JSON format:
{
  "microclimateZones": [
    {
      "zoneId": "southFence",
      "description": "Hot afternoon sun with wind protection",
      "coordinates": {"x": 25, "y": 75}
    }
  ],
  "weatherPatterns": [
    {
      "patternName": "Afternoon wind tunnel",
      "impact": "Dries out plants quickly",
      "recommendation": "Install windbreak or move sensitive plants"
    }
  ],
  "climateRisks": [
    {"risk": "Heat stress in southwest corner", "severity": 0.7}
  ],
  "adaptations": [
    {
      "action": "Install shade cloth",
      "idealTiming": "Before summer heat arrives",
      "notes": "Focus on tomato area per user's heat damage notes"
    }
  ],
  "personalizedInsights": "Based on your notes about wind damage to tomatoes last summer, recommend relocating to protected area..."
}`;

    try {
        const response = await callOpenAI(systemPrompt, userPrompt);
        return { analysis: response };
    } catch (error) {
        console.error('Environmental Intelligence Agent error:', error);
        return { analysis: JSON.stringify({
            microclimateZones: [],
            weatherPatterns: [],
            climateRisks: [],
            adaptations: [],
            personalizedInsights: "Unable to analyze environmental conditions at this time. Please observe your garden's microclimates manually and note any weather patterns affecting your plants."
        }) };
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