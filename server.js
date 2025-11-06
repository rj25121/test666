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

// --- HELPER FUNCTION 1: Analyzes the 8 images (PROMPT ENHANCEMENT) ---
async function generateCoreAssessment(scanData, parts) {
    if (!GEMINI_API_KEY) throw new Error("Server API Key is not configured for core assessment.");

    // 🛑 PROMPT FIX: Added elemental context to improve image interpretation accuracy.
    const VASTU_CONTEXT = `
        Vastu Zones Context:
        1. North (N): Water/New Opportunities
        2. North-East (NE): Water/Consciousness
        3. East (E): Air/Social Association
        4. South-East (SE): Fire/Cash Flow
        5. South (S): Fire/Rest & Relaxation
        6. South-West (SW): Earth/Skills & Relationships
        7. West (W): Space/Gains & Profits
        8. North-West (NW): Air/Support & Banking
    `;

    const query = `
        CRITICAL INSTRUCTION: You are a Vastu Analyst AI. You have been provided with 8 images (visual segments) of a room scan, along with room context. Use the following elemental context to guide your analysis: ${VASTU_CONTEXT}
        
        CONTEXT: Room: ${scanData.currentRoomTag}, Location: ${scanData.roomLocationInHouse}, Concerns: ${scanData.holisticIssues}.
        
        CRITICAL TASK: Analyze the 8 visual segments. For EACH segment, provide a very concise analysis (1-2 sentences) of what the image shows (e.g., color, objects, state of the area) and list 1-2 major Vastu defects related to that specific Vastu zone.
        
        Your SOLE output must be structured as follows:
        
        **Core Vastu Assessment**
        
        Then, list the analysis for each of the 8 segments, using a numbered list (1., 2., 3., etc.). The order MUST be: 1. N, 2. NE, 3. E, 4. SE, 5. S, 6. SW, 7. W, 8. NW.
        
        1. Analysis for the North segment goes here. List the 1-2 defects found visually or directionally.
        2. Analysis for the North-East segment goes here. List the 1-2 defects found visually or directionally.
        3. Analysis for the East segment goes here. List the 1-2 defects found visually or directionally.
        4. Analysis for the South-East segment goes here. List the 1-2 defects found visually or directionally.
        5. Analysis for the South segment goes here. List the 1-2 defects found visually or directionally.
        6. Analysis for the South-West segment goes here. List the 1-2 defects found visually or directionally.
        7. Analysis for the West segment goes here. List the 1-2 defects found visually or directionally.
        8. Analysis for the North-West segment goes here. List the 1-2 defects found visually or directionally.
        
        Do NOT include any other text, remedies, or summaries in this core assessment.
    `;

    const payload = {
        contents: [{ role: "user", parts: [...parts, { text: query }] }],
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
        throw new Error(`Google API Error (Core Assessment): ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    let aiOutput = result.candidates?.[0]?.content?.parts?.[0]?.text || "**Core Vastu Assessment**\n\n1. Assessment failed to generate. Please rescan.";
    
    // CRITICAL FIX: After receiving the numbered list, apply the tags reliably.
    for (let i = 1; i <= 8; i++) {
        const regex = new RegExp(`^${i}\\. (.*?)($|\\n(?=${i + 1}\\.))`, 'm');
        aiOutput = aiOutput.replace(regex, `[IMAGE_${i}_ANALYSIS]$1\n`);
    }

    aiOutput = aiOutput.replace(/^[0-9]+\.\s*/gm, '');

    return aiOutput;
}

// --- HELPER FUNCTION 2: Generates text-only queries (Unchanged structure) ---
function getAiQuery(scanData, isDeepAnalysis, coreAssessment, cuspWarning = "") {
    // ... (logic remains the same)
    // The prompt structure for the second call remains the same, forcing the AI to include the tagged core assessment.
}

// --- MODIFIED API ROUTE: generateReport (Unchanged flow) ---
app.post('/api/generateReport', async (req, res) => {
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "Server API Key is not configured." });
    }

    try {
        // ... (entire generation flow remains the same)

        const result = await response.json();
        const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        res.json({ text: aiResponse });

    } catch (error) {
        console.error('Error in /api/generateReport:', error.message);
        // Ensure a clean 500 status with an error message is always returned
        res.status(500).json({ error: error.message });
    }
});

// --- API Route for Handling Chat (STABILITY FIX) ---
app.post('/api/handleChat', async (req, res) => {
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "Server API Key is not configured." });
    }

    try {
        const { chatHistory, chatContextSummary } = req.body;

        // ... (Sanitization and system prompt setup remains the same)

        const payload = { /* ... */ }; // (Payload construction remains the same)
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
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
        // 🛑 CRITICAL FIX: Ensure a clean 500 status is returned if the server fails internally.
        res.status(500).json({ error: error.message });
    }
});

// --- Start the server ---
app.listen(port, () => {
    console.log(`Vastu server listening on port ${port}`);
});
