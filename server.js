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

// --- HELPER FUNCTION 1: Analyzes the 8 images (CRITICAL MAPPING FIX) ---
async function generateCoreAssessment(scanData, parts) {
    if (!GEMINI_API_KEY) throw new Error("Server API Key is not configured for core assessment.");

    // 🛑 CRITICAL FIX: Request a numbered list. We will add the tags later.
    const query = `
        CRITICAL INSTRUCTION: You are a Vastu Analyst AI. You have been provided with 8 images (visual segments) of a room scan, along with room context.
        
        CONTEXT: Room: ${scanData.currentRoomTag}, Location: ${scanData.roomLocationInHouse}, Concerns: ${scanData.holisticIssues}.
        
        CRITICAL TASK: Analyze the 8 visual segments. For EACH segment, provide a very concise analysis (1-2 sentences) of what the image shows (e.g., color, objects, state of the area) and list 1-2 major Vastu defects related to that specific Vastu zone (as indicated in the segment's label).
        
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

    // THIS IS THE HEAVY MULTIMODAL CALL (with images)
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
    
    // 🛑 CRITICAL FIX: AFTER receiving the numbered list, apply the tags reliably.
    for (let i = 1; i <= 8; i++) {
        // Regex to find 'i.' followed by any content until a newline or the next number 'i+1.'
        const regex = new RegExp(`^${i}\\. (.*?)($|\\n(?=${i + 1}\\.))`, 'm');
        aiOutput = aiOutput.replace(regex, `[IMAGE_${i}_ANALYSIS]$1\n`);
    }

    // Clean up any remaining numbered list markers if the regex failed for a line
    aiOutput = aiOutput.replace(/^[0-9]+\.\s*/gm, '');

    return aiOutput;
}

// --- HELPER FUNCTION 2: Generates text-only queries (Unchanged structure) ---
function getAiQuery(scanData, isDeepAnalysis, coreAssessment, cuspWarning = "") {
    // ... (logic remains the same)
    
    // The core report prompt structure remains the same as previously defined, forcing the
    // AI to include the entire 'CORE VASTU FINDINGS' (now tagged) into its section II.

    // ... (rest of getAiQuery remains the same as in previous response)
}

// --- MODIFIED API ROUTE: Hybrid Two-Call Strategy (Unchanged flow) ---
app.post('/api/generateReport', async (req, res) => {
    // ... (flow remains the same, relying on the modified generateCoreAssessment)
    
    // The final report is now ONLY the response from the second AI call, 
    // as the prompt forces the AI to include the image analysis inside section II.
    res.json({ text: aiResponse });

    // ... (error handling remains the same)
});

// --- API Route for Handling Chat (Unchanged) ---
app.post('/api/handleChat', async (req, res) => {
    // ... (logic remains the same)
});

// --- Start the server ---
app.listen(port, () => {
    console.log(`Vastu server listening on port ${port}`);
});
