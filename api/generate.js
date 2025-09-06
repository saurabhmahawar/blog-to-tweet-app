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
            let extractedContent = '';
            
            // First attempt: use a very specific prompt to get clean content
            const specificPrompt = `Find the full, main body text of the given URL. Return only the main content as a single block of text. If you cannot find the content, return a single phrase: 'Content not found'. URL: ${url}`;
            const specificResponse = await callGeminiAPI(specificPrompt, "", GEMINI_API_KEY, true);
            
            if (specificResponse.text.trim() === 'Content not found' || specificResponse.text.trim().length < 100) {
                // Second attempt: broaden the search if the first attempt fails
                const broadPrompt = `Analyze the URL and summarize the core content. Return a concise, but comprehensive summary of the article. URL: ${url}`;
                const broadResponse = await callGeminiAPI(broadPrompt, "", GEMINI_API_KEY, true);
                
                if (broadResponse.text.trim().length < 100) {
                    return res.status(404).json({ error: "Could not find content from the provided URL. Please try pasting the content manually." });
                }
                extractedContent = broadResponse.text;
            } else {
                extractedContent = specificResponse.text;
            }
            
            responseData = { text: extractedContent };

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
            // Using the Gemini Flash Image Preview model for image generation
            const imageUserQuery = `Create a visually compelling digital art image based on the following text: "${content}"`;
            
            const imageUrl = await callGeminiImageAPI(imageUserQuery, GEMINI_API_KEY);
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
    
    // Attempt to read the response body as JSON
    let result;
    try {
        result = await response.json();
    } catch (e) {
        // If it fails, log the raw text and throw
        const textResult = await response.text();
        console.error("API response was not valid JSON. Raw text:", textResult);
        throw new Error("Gemini API call failed. Received a non-JSON response.");
    }
    
    // Check for general API errors
    if (!response.ok) {
        console.error("API call failed with status", response.status, ". Response:", result);
        const errorMessage = result.error?.message || `API request failed with status: ${response.status}`;
        throw new Error(errorMessage);
    }
    
    // Check for missing content
    if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.error("API response missing expected content. Response:", result);
        throw new Error("Gemini API call failed: No content returned.");
    }
    
    return { text: result.candidates[0].content.parts[0].text };
}

async function callGeminiImageAPI(prompt, apiKey) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            responseModalities: ['TEXT', 'IMAGE']
        },
    };
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const result = await response.json();
    const base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    if (!base64Data) {
        console.error("Gemini Image API raw error response:", result);
        throw new Error("Gemini Image API call failed. Check server logs for details.");
    }
    return `data:image/png;base64,${base64Data}`;
}
