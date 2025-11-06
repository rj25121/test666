import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch'; 

// --- Express App Setup ---
const app = express();
const port = process.env.PORT || 3000;

// Get the Gemini API key from environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-2.5-flash";

// --- EMOJI STRIPPING UTILITY FUNCTION ---
function stripEmojis(str) {
    if (!str) return '';
    return str.replace(/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/gu, '');
}

// --- VASTU UTILITY FUNCTION ---
const VASTU_ZONES_16 = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
];

function getVastuZone(degrees) {
    const offset = 11.25;
    let index = Math.floor(((degrees + offset) % 360) / 22.5);
    return VASTU_ZONES_16[index % 16];
}

// Middleware
app.use(cors()); 
app.use(express.json({ limit: '50mb' })); 

// --- HELPER FUNCTION 1: Analyzes the 8 images (Unchanged logic) ---
async function generateCoreAssessment(scanData, parts) {
    if (!GEMINI_API_KEY) throw new Error("Server API Key is not configured for core assessment.");

    // ... (query and core multimodal call logic unchanged)

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
        
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeout: 600000 
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google API Error (Core Assessment): ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    let aiOutput = result.candidates?.[0]?.content?.parts?.[0]?.text || "**Core Vastu Assessment**\n\n1. Assessment failed to generate. Please rescan.";
    
    // ... (post-processing/tagging logic unchanged)

    return aiOutput;
}

// --- HELPER FUNCTION 2: Generates text-only queries (Unchanged structure) ---
function getAiQuery(scanData, isDeepAnalysis, coreAssessment, cuspWarning = "") {
    // ... (logic unchanged)
}

// --- MODIFIED API ROUTE: generateReport (Unchanged flow) ---
app.post('/api/generateReport', async (req, res) => {
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "Server API Key is not configured." });
    }

    try {
        const { isDeepAnalysis, scanData } = req.body;
        // ... (CUSP WARNING logic unchanged)

        // ... (imageParts setup unchanged)
        
        // --- STEP 1: Generate Core Assessment ---
        const coreAssessment = await generateCoreAssessment(scanData, imageParts);
        
        // --- STEP 2: Build Final Query ---
        const userQuery = getAiQuery(scanData, isDeepAnalysis, coreAssessment, cuspWarning);
        
        // --- STEP 3: Generate Final Report ---
        const payload = {
            contents: [{ role: "user", parts: [{ text: userQuery }] }], 
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            timeout: 600000 
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Google API Error (Final Report): ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        res.json({ text: aiResponse });

    } catch (error) {
        console.error('Error in /api/generateReport:', error.message);
        // Ensure a clean 500 status with an error message is always returned
        res.status(500).json({ error: error.message });
    }
});

// --- API Route for Handling Chat (TIMEOUT FIX) ---
app.post('/api/handleChat', async (req, res) => {
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "Server API Key is not configured." });
    }

    try {
        const { chatHistory, chatContextSummary } = req.body;

        // ... (history and knowledge base setup unchanged)

        // --- System Prompt (unchanged) ---
        const chatSystemPrompt = `You are a helpful and friendly Vastu Shastra AI assistant.
        // ... (rest of prompt unchanged)
        `;

        const payload = {
            contents: sanitizedHistory,
            systemInstruction: {
                parts: [{ text: chatSystemPrompt }]
            }
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            // 🛑 FIX: Increase chat timeout to 60 seconds for stability
            timeout: 60000 
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Google API Error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't process that query.";
        
        res.json({ text: aiResponse });

    } catch (error) {
        console.error('Error in /api/handleChat:', error.message);
        // Ensure a clean 500 status with an error message is always returned
        res.status(500).json({ error: error.message });
    }
});

// --- Start the server ---
app.listen(port, () => {
    console.log(`Vastu server listening on port ${port}`);
});
