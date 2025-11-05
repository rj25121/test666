import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch'; // Render may need this explicitly

// --- Express App Setup ---
const app = express();
const port = process.env.PORT || 3000;

// Get the Gemini API key from environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-2.5-flash"; // Or your preferred model

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
app.use(cors()); // Allow cross-origin requests
app.use(express.json({ limit: '50mb' })); // Increase payload limit for 8 images

// --- HELPER FUNCTION 1: Analyzes the 8 images ---
async function generateCoreAssessment(scanData, parts) {
    if (!GEMINI_API_KEY) throw new Error("Server API Key is not configured for core assessment.");

    const query = `
        CRITICAL INSTRUCTION: You are a Vastu Analyst AI. Analyze the provided ${parts.length - 1} visual segments 
        and the following room context: Room: ${scanData.currentRoomTag}, Location: ${scanData.roomLocationInHouse}, 
        Concerns: ${scanData.holisticIssues}.
        
        CRITICAL TASK: Your SOLE output must be a concise, bulleted list of the top 5 to 7 most severe Vastu defects found in this area.
        Focus ONLY on factual defects (directional, elemental, positional) and use simple language.
        
        Start with the exact bold markdown title: 
        **Core Vastu Assessment (Defects Found)**
        
        Followed by a list using dashes (-). Do NOT include remedies.
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
        timeout: 600000 // 10 minutes timeout for multimodal call
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google API Error (Core Assessment): ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || "**Core Vastu Assessment (Defects Found)**\n- Assessment failed to generate. Please rescan.";
}

// --- HELPER FUNCTION 2: Generates text-only queries (WITH SOFTER PROMPT) ---
function getAiQuery(scanData, isDeepAnalysis, coreAssessment, cuspWarning = "") {
    const {
        currentRoomTag,
        roomLocationInHouse,
        floorNumber,
        holisticIssues,
        holisticSurroundings
    } = scanData;
    
    // --- Template for all reports to ensure shared context ---
    const sharedContext = `
        ${cuspWarning} 

        CORE VASTU FINDINGS (MUST BE USED AS THE BASIS FOR ALL REMEDIES):
        ${coreAssessment}
        
        CONTEXT FOR THIS REPORT:
        - Area Scanned: ${currentRoomTag}
        - Location (C-Point): The ${currentRoomTag} is in the ${roomLocationInHouse || 'UNKNOWN'} zone of the house.
        - Floor: ${floorNumber || 'N/A'}
        - User's Concerns: ${holisticIssues}
        - Property Surroundings: ${holisticSurroundings}
    `;
    
    if (isDeepAnalysis) {
        // --- THIS IS THE FIX: Softened the language ---
        return `
            CRITICAL INSTRUCTION: You are a Master Vastu Shastra Analyst AI, specializing in structural solutions.
            Your task is to provide an ADVANCED, STRUCTURAL Analysis based **EXCLUSIVELY** on the Core Vastu Findings provided below.
            
            ${sharedContext}
            
            CRITICAL TASK:
            Do NOT write a full report. Provide a structural analysis focusing on the defects in the CORE VASTU FINDINGS.
            
            Start with this exact title (using bold markdown):
            **Expert Analysis (Structural Recommendations)**
            
            Then, add this disclaimer on a new line:
            "The following are advanced, structural-level observations. These are major changes and should be considered carefully."
            
            Then, create two subsections, both using bullet points (using a dash "-"):
            
            **Minor Structural Recommendations**
            (List minor structural changes that address the core defects. e.g., "- Relocating the stove from the North to the South-East corner of the kitchen.")
            
            **Major Structural Recommendations**
            (List major structural changes that address the core defects. e.g., "- The kitchen's location is a severe defect. The ideal solution is to move this kitchen to the South-East zone.")
            
            Formatting: Use bullet points (using -). You MUST use **bold markdown** for the main title and two sub-section titles.
        `;
    } else {
        // This is the (working) Formal Report prompt
        return `
            CRITICAL INSTRUCTION: You are a Master Vastu Shastra Analyst AI, specializing in non-structural, actionable remedies.
            Your response must be a single, structured Vastu Report, following all instructions below exactly. Use the Core Vastu Findings to guide your report.
            
            ${sharedContext}

            Based on ALL this data, provide a comprehensive report. Tailor your analysis and remedies in Section I and IV to address the user's primary concerns and the CORE VASTU FINDINGS.
            
            The report must be structured into FIVE consecutive sections. Use **bold markdown** for all section titles:

            **I. Executive Summary (Layman's Terms)**: Simple summary. Cover the 2-3 most critical findings (from CORE ASSESSMENT) and non-structural remedies.
            Ensure you mention the Vastu Zone compliance of the scanned area (${currentRoomTag}) based on its location (${roomLocationInHouse}).

            **II. Directional Data and Environmental Assessment**: Technical analysis of the observed headings and Vastu zones.

            **III. Analysis of Vastu Compliance**: Technical findings, issues, and defects found, explicitly referencing the points in the CORE ASSESSMENT.

            **IV. Remedial Recommendations (Advanced)**: CRITICAL: This section MUST use bullet points (using a dash "-"). Structure this section into two sub-sections using **bold markdown**. All remedies must be NON-STRUCTURAL.
            **Minor Defects & Remedies**
            (List non-structural remedies here.)
            **Major Defects & Remedies**
            (List more significant NON-STRUCTURAL remedies here.)
            
            **V. Vastu Tips & Remedies (Actionable Advice)**: A short, separate section offering quick, general Vastu tips related to this specific room type.
            
            If the CUSP WARNING was provided in the context, you MUST also add a brief section titled:
            **"VI. Cusp Analysis (Alternate Zone)"**
            Briefly list 2-3 key Vastu defects that would apply if the room were in the alternate zone mentioned in the warning.

            Formatting requirements: Use paragraph breaks for readability. You MUST use bullet points (using -). You MUST use **bold markdown** for all section and sub-section titles.
        `;
    }
}

// --- MODIFIED API ROUTE: Hybrid Two-Call Strategy ---
app.post('/api/generateReport', async (req, res) => {
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "Server API Key is not configured." });
    }

    try {
        const { isDeepAnalysis, scanData } = req.body;

        // --- CUSP WARNING LOGIC ---
        let cuspWarning = "";
        const userAngle = scanData.roomLocationInHouse;
        // ... (rest of CUSP WARNING LOGIC remains the same) ...
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
                    **"VI. Cusp Analysis (${otherZone} Zone)"**
                    Briefly list 2-3 key Vastu defects that would apply if the room were in the **${otherZone}** zone instead.
                `;
            }
        }
        
        // --- Create array for image parts ---
        let imageParts = [];
        if (scanData.capturedFrames && scanData.capturedFrames.length > 0) {
            scanData.capturedFrames.forEach((frame, index) => {
                imageParts.push({ inlineData: { mimeType: "image/jpeg", data: frame.image } });
                imageParts.push({ text: `--- Visual Data Segment ${index + 1} Captured at Heading ${frame.heading.toFixed(1)} degrees (Vastu Zone: ${frame.zone}) ---` });
            });
        } else {
            imageParts.push({text: "No visual data provided."});
        }
        
        // --- STEP 1: (RE-ENABLED) Generate Core Assessment (AI Call 1 - HEAVY, SLOW, MULTIMODAL) ---
        const coreAssessment = await generateCoreAssessment(scanData, imageParts);
        
        // --- STEP 2: Build Final Query (TEXT-ONLY) ---
        const userQuery = getAiQuery(scanData, isDeepAnalysis, coreAssessment, cuspWarning);
        
        // --- STEP 3: Generate Final Report (AI Call 2 - LIGHT, FAST, TEXT-ONLY) ---
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
            timeout: 600000 // 10 minutes timeout for report generation
        });

        if (!response.ok) {
            const errorText = await response.text();
            // This is where the 500 error from the "Expert" prompt was likely thrown
            throw new Error(`Google API Error (Final Report): ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        // Prepend the (now successful) Core Assessment to the final report text
        const finalReport = `${coreAssessment}\n\n---\n\n${aiResponse}`;
        
        res.json({ text: finalReport });

    } catch (error) {
        console.error('Error in /api/generateReport:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- API Route for Handling Chat (Unchanged) ---
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

        // 🛑 FIX: Drastically cut video knowledge base to speed up AI context load
        const vastuVideoKnowledgeBase = `
          VIDEO_LINKS_KNOWLEDGE_BASE:
          - Topic: 'Vastu for Kitchen'
            Embed_URL: 'https://www.youtube.com/embed/6LsU7e31Up0' 
          - Topic: 'Vastu for Main Entrance'
            Embed_URL: 'https://www.youtube.com/embed/9LtowbvhYnw' 
          - Topic: 'Vastu for 16 Zones'
            Embed_URL: 'https://www.youtube.com/embed/qgAvsQOqf-g' 
          - Topic: 'Vastu Tips for Home'
            Embed_URL: 'https://www.youtube.com/embed/YKLuoA35FH0' 
        `;

        // --- System Prompt (with SyntaxError fixed) ---
        const chatSystemPrompt = `You are a helpful and friendly Vastu Shastra AI assistant.
        Your goal is to answer the user's questions. 
        
        **REPORT CONTEXT:**
        If the user asks about their Vastu analysis report, you MUST use this context: --- REPORT CONTEXT START --- ${chatContextSummary} --- REPORT CONTEXT END ---
        
        **VIDEO CONTEXT:**
        If the user asks for a video about a *specific topic* (e.g., "video for kitchen", "main entrance video"), you MUST check your VIDEO_LINKS_KNOWLEDGE_BASE. 
        If you find a matching topic (like 'Kitchen', 'Bedroom', 'Main Entrance', or 'Brahmasthan'), you MUST include the full 'Embed_URL' for that video.
        If you do not have a video for that topic, you must state: "I don't have a specific video for that topic, but I can give you a text explanation."
        Do NOT search for videos or make up links. Only use the links provided in the knowledge base.
        
        ${vastuVideoKnowledgeBase} 
        
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
            // 🛑 CRITICAL FIX: Reduce chat timeout for low-latency text response
            timeout: 30000 // 30 seconds max for chat
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
        res.status(500).json({ error: error.message });
    }
});

// --- Start the server ---
app.listen(port, () => {
    console.log(`Vastu server listening on port ${port}`);
});
