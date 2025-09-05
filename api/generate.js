// This file runs on the server, so it can securely access environment variables.
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        // The API key is securely accessed from Vercel's environment variables.
        // It is NEVER exposed to the client-side code in index.html.
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: "API key is not configured." });
        }

        const { task, url, content, tweetCount } = req.body;
        let responseData = {};

        if (task === 'content') {
            const contentSystemPrompt = "You are a web content analyzer. Find the full, main body text of the given URL. Return only the main content as a single block of text.";
            const contentUserQuery = `Find and summarize the core content from this URL: ${url}`;
            const apiResponse = await callGeminiAPI(contentUserQuery, contentSystemPrompt, GEMINI_API_KEY, true);
            responseData = { text: apiResponse.text };

        } else if (task === 'thread') {
            const threadSystemPrompt = `
                You are a world-class content strategist and copywriter for Twitter. 
                Your task is to take a block of text and convert it into a well-structured, engaging Twitter thread. 
                Follow these rules carefully:
                1. The output must be exactly ${tweetCount} tweets.
                2. Each tweet must be no more than 280 characters long.
                3. The first tweet should be a hook that grabs attention.
                4. The thread must flow logically from one tweet to the next.
                5. Each tweet must begin with a number in the format 'x/${tweetCount}' (e.g., '1/5', '2/5', etc.).
                6. The output should be only the tweets, separated by blank lines.
            `;
            const threadUserQuery = `
                Convert the following blog post content into a ${tweetCount}-tweet Twitter thread. 
                Ensure each tweet is a maximum of 280 characters and includes a tweet number (e.g., '1/5'):
                
                ${content}
            `;
            const apiResponse = await callGeminiAPI(threadUserQuery, threadSystemPrompt, GEMINI_API_KEY);
            responseData = { text: apiResponse.text };

        } else if (task === 'image') {
            const imageSystemPrompt = `
                You are a professional image generation prompt writer for a powerful AI. 
                Your task is to create a single, highly detailed, and creative prompt for a high-quality, cinematic digital art scene. 
                The prompt must describe a visually captivating conceptual image with vibrant colors, rich textures, and dramatic lighting that represents the core themes and ideas of the provided text.
                The scene should not contain any text, logos, or identifiable human faces.
                Focus on abstract and thematic elements that evoke a feeling or concept.
                The prompt should be concise and focused on a single visual idea.
            `;
            const imageUserQuery = `Create a high-quality cinematic image prompt based on the following content: "${content}"`;
            
            const promptTextResponse = await callGeminiAPI(imageUserQuery, imageSystemPrompt, GEMINI_API_KEY);
            const promptText = promptTextResponse.text;
            
            const imageUrl = await callImagenAPI(promptText, GEMINI_API_KEY);
            responseData = { imageUrl: imageUrl };
        } else {
            return res.status(400).json({ error: "Invalid task specified." });
        }

        return res.status(200).json(responseData);

    } catch (error) {
        console.error("Serverless Function Error:", error);
        return res.status(500).json({ error: error.message });
    }
}

async function callGeminiAPI(userPrompt, systemPrompt, apiKey, useSearch = false) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
    };
    if (useSearch) {
        payload.tools = [{ "google_search": {} }];
    }
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || !result.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error("Gemini API call failed.");
    }
    return { text: result.candidates[0].content.parts[0].text };
}

async function callImagenAPI(imagePrompt, apiKey) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
    const payload = {
        instances: { prompt: imagePrompt },
        parameters: { "sampleCount": 1 }
    };
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    // Log the full response body for better debugging
    const result = await response.json();
    if (!response.ok || !result.predictions || result.predictions.length === 0 || !result.predictions[0].bytesBase64Encoded) {
        console.error("Imagen API raw error response:", result); // Log the raw error here
        throw new Error("Imagen API call failed. Check server logs for details.");
    }
    return `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
}
