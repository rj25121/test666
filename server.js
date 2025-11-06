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

// --- HELPER FUNCTION: Get AI Query (Single Call) ---
function getAiQuery(scanData, isDeepAnalysis, cuspWarning = "") {
    const {
        currentRoomTag,
        roomLocationInHouse,
        floorNumber,
        holisticIssues,
        holisticSurroundings
    } = scanData;
    
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

    // --- Core Template ---
    const sharedContext = `
        ${cuspWarning} 
        
        CONTEXT FOR THIS REPORT:
        - Area Scanned: ${currentRoomTag}
        - Location (C-Point): The ${currentRoomTag} is in the ${roomLocationInHouse || 'UNKNOWN'} zone of the house.
        - Floor: ${floorNumber || 'N/A'}
        - User's Concerns: ${holisticIssues}
        - Property Surroundings: ${holisticSurroundings}
        
        USE THIS CONTEXT FOR VISUAL ANALYSIS:
        ${VASTU_CONTEXT}
    `;
    
    if (isDeepAnalysis) {
        // --- Expert Analysis Prompt (Similar structure, single call) ---
        return `
            CRITICAL INSTRUCTION: You are a Master Vastu Shastra Analyst AI. Your task is to provide an ADVANCED, STRUCTURAL Analysis.
            
            ${sharedContext}
            
            CRITICAL TASK:
            Analyze the area based on the visual data and context. Do NOT generate the visual analysis section.
            
            Start with this exact title (using bold markdown):
            **Expert Analysis (Structural Recommendations)**
            
            Then, add this disclaimer on a new line:
            "The following are advanced, structural-level observations. These are major changes and should be considered carefully."
            
            Then, create two subsections, both using bullet points (using a dash "-"):
            
            **Minor Structural Recommendations**
            (List minor structural changes that address the core defects.)
            
            **Major Structural Recommendations**
            (List major structural changes that address the core defects.)
            
            Formatting: Use bullet points (using -). You MUST use **bold markdown** for the main title and two sub-section titles.
        `;
    } else {
        // --- Formal Report Prompt (INTERLEAVING FIX) ---
        return `
            CRITICAL INSTRUCTION: You are a Master Vastu Shastra Analyst AI, specializing in non-structural, actionable remedies.
            Your response must be a single, comprehensive Vastu Report. Use the elemental context and visual data provided.
            
            ${sharedContext}

            The report must be structured into FOUR consecutive sections. Use **bold markdown** for all section titles:

            **I. Executive Summary (Layman's Terms)**: Simple summary. Cover the 2-3 most critical findings and non-structural remedies.

            **II. Visual Segment Analysis and Findings**: CRITICAL: This section MUST analyze each of the 8 visual segments provided. Directly after the visual analysis for each segment, you MUST include the exact, non-removable placeholder tag and a 1-2 sentence description of the visual defects found.
            
            * **Visual Analysis:** This space is for general analysis of the scan.
            * [IMAGE_1_ANALYSIS] Analysis for the North segment goes here.
            * [IMAGE_2_ANALYSIS] Analysis for the North-East segment goes here.
            * [IMAGE_3_ANALYSIS] Analysis for the East segment goes here.
            * [IMAGE_4_ANALYSIS] Analysis for the South-East segment goes here.
            * [IMAGE_5_ANALYSIS] Analysis for the South segment goes here.
            * [IMAGE_6_ANALYSIS] Analysis for the South-West segment goes here.
            * [IMAGE_7_ANALYSIS] Analysis for the West segment goes here.
            * [IMAGE_8_ANALYSIS] Analysis for the North-West segment goes here.

            **III. Remedial Recommendations (Advanced)**: CRITICAL: This section MUST use bullet points (using a dash "-"). Structure this section into two sub-sections using **bold markdown**. All remedies must be NON-STRUCTURAL.
            **Minor Defects & Remedies**
            (List non-structural remedies here.)
            **Major Defects & Remedies**
            (List more significant NON-STRUCTURAL remedies here.)
            
            **IV. Vastu Tips & Remedies (Actionable Advice)**: A short, separate section offering quick, general Vastu tips related to this specific room type.
            
            If the CUSP WARNING was provided in the context, you MUST also add a brief section titled:
            **"V. Cusp Analysis (Alternate Zone)"**
            
            Formatting requirements: Use paragraph breaks for readability. You MUST use bullet points (using -). You MUST use **bold markdown** for all section and sub-section titles.
        `;
    }
}

// --- MODIFIED API ROUTE: generateReport (Single Call) ---
app.post('/api/generateReport', async (req, res) => {
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "Server API Key is not configured." });
    }

    try {
        const { isDeepAnalysis, scanData } = req.body;
        
        let cuspWarning = "";
        const userAngle = scanData.roomLocationInHouse;
        // ... (CUSP WARNING logic remains the same)
        if (typeof userAngle === 'number' && userAngle !== 0) {
            const zone1 = getVastuZone(userAngle);
            const zone2 = getVastuZone((userAngle + 10.0) % 360);
            const zone3 = getVastuZone((userAngle - 10.0 + 360) % 360);

            if (zone1 !== zone2 || zone1 !== zone3) {
                const otherZone = (zone1 !== zone2) ? zone2 : zone3;
                
                cuspWarning = `
                    **CRITICAL WARNING: CUSP DETECTION**
                    The user's locked angle of **${userAngle.toFixed(1)}°** is on the border of two Vastu zones.
                    Your analysis **MUST** address this. Start your report with this warning:
                    
                    "**Warning: Potential Inaccuracy Detected**
                    Your room's locked direction is on the border of the **${zone1}** and **${otherZone}** zones."
                    
                    Then, in your main analysis (for the standard report), you MUST also add a *brief* section titled:
                    **"V. Cusp Analysis (${otherZone} Zone)"**
                    Briefly list 2-3 key Vastu defects that would apply if the room were in the **${otherZone}** zone instead.
                `;
            }
        }
        
        // --- Create array for image parts ---
        let imageParts = [];
        if (scanData.capturedFrames && scanData.capturedFrames.length > 0) {
            // Include image data with mime type for multimodal input
            scanData.capturedFrames.forEach((frame, index) => {
                imageParts.push({ inlineData: { mimeType: "image/jpeg", data: frame.image } });
            });
        } else {
            imageParts.push({text: "No visual data provided."});
        }

        // --- STEP 1: Build Query ---
        const userQuery = getAiQuery(scanData, isDeepAnalysis, cuspWarning);
        
        // --- STEP 2: Generate Final Report (Single Multimodal Call) ---
        const payload = {
            // Send ALL image parts + the final text query
            contents: [{ role: "user", parts: [...imageParts, { text: userQuery }] }], 
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
            timeout: 600000 // 10 minutes timeout for multimodal call
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
        res.status(500).json({ error: error.message });
    }
});

// --- API Route for Handling Chat (Stability Fix) ---
app.post('/api/handleChat', async (req, res) => {
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "Server API Key is not configured." });
    }

    try {
        const { chatHistory, chatContextSummary } = req.body;

        // --- NEW: Sanitize the chat history before sending it to Gemini ---
        const sanitizedHistory = chatHistory.map(message => {
            if (message.role === 'user') {
                const originalText = message.parts[0].text;
                const cleanText = stripEmojis(originalText);
                
                return {
                    role: 'user',
                    parts: [{ text: cleanText }]
                };
            }
            return message; 
        });

        // 🛑 NEW: Reverting to a simple, stable system prompt.
        const chatSystemPrompt = `You are a helpful and friendly Vastu Shastra AI assistant.
        Your goal is to answer the user's questions. 
        
        **REPORT CONTEXT:**
        If the user asks about their Vastu analysis report, you MUST use this context: --- REPORT CONTEXT START --- ${chatContextSummary} --- REPORT CONTEXT END ---
        
        **GENERAL RULES:**
        Answer general Vastu questions concisely.
        Keep your answers simple and friendly. You may use **bold markdown** for emphasis. For bulleted lists, you MUST use a dash (-) and NOT an asterisk (*).`;

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
            timeout: 60000 // 60 seconds max for chat
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
        // CRITICAL FIX: Ensure a clean 500 status is returned if the server fails internally.
        res.status(500).json({ error: error.message });
    }
});

// --- Start the server ---
app.listen(port, () => {
    console.log(`Vastu server listening on port ${port}`);
});
