// generate.js - Server-side API route for Vercel

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        const PPLX_API_KEY = process.env.PPLX_API_KEY;

        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: "Gemini API key is not configured." });
        }

        if (!PPLX_API_KEY) {
            return res.status(500).json({ error: "Perplexity API key is not configured." });
        }

        const { task, url, content, tweetCount, imagePrompt } = req.body;
        let responseData = {};

        if (task === 'content') {
            let extractedContent = '';
            const specificPrompt = `Find the full, main body text of the given URL. Return only the main content as a single block of text. If you cannot find the content, return a single phrase: 'Content not found'. URL: ${url}`;
            const specificResponse = await callGeminiAPI(specificPrompt, "", GEMINI_API_KEY, true);

            if (specificResponse.text.trim() === 'Content not found' || specificResponse.text.trim().length < 100) {
                const broadPrompt = `Analyze the URL and summarize the core content. Return a concise, but comprehensive summary of the article. URL: ${url}`;
                const broadResponse = await callGeminiAPI(broadPrompt, "", GEMINI_API_KEY, true);
                if (broadResponse.text.trim().length < 100) {
                    throw new Error("Could not extract enough content from the URL.");
                }
                extractedContent = broadResponse.text;
            } else {
                extractedContent = specificResponse.text;
            }
            responseData = { text: extractedContent };
            
        } else if (task === 'thread') {
            const prompt = `Convert the following blog post content into a cohesive and engaging Twitter thread of exactly ${tweetCount} tweets. The thread should be numbered and each tweet should be formatted as a JSON object with a 'text' property. Do not include any other text or explanation. Blog post content: ${content}`;
            const threadResponse = await callGeminiAPI(prompt, "application/json", GEMINI_API_KEY);
            responseData = threadResponse;

        } else if (task === 'image') {
            const imageResponse = await callPerplexityImageAPI(imagePrompt, PPLX_API_KEY);
            responseData = { imageUrl: imageResponse };

        } else {
            return res.status(400).json({ error: "Invalid task specified." });
        }

        res.status(200).json(responseData);
    } catch (error) {
        console.error("Server-side error:", error);
        res.status(500).json({ error: error.message });
    }
}

// ---------- Gemini API Helper ----------
async function callGeminiAPI(prompt, responseMimeType, apiKey, isContentExtraction = false) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    const body = {
        contents: [{
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            responseMimeType: responseMimeType
        }
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
    });

    let result;
    try {
        result = await response.json();
    } catch (e) {
        if (isContentExtraction) {
            return { text: 'Content not found' };
        }
        console.error("Failed to parse JSON response. Received a non-JSON response.");
        throw new Error("Failed to parse JSON response. Received a non-JSON response.");
    }

    if (!response.ok) {
        console.error("API call failed with status", response.status, ". Response:", result);
        const errorMessage = result.error?.message || `API request failed with status: ${response.status}`;
        throw new Error(errorMessage);
    }

    if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.error("API response missing expected content. Response:", result);
        throw new Error("Gemini API call failed: No content returned.");
    }

    return { text: result.candidates[0].content.parts[0].text };
}

// ---------- Perplexity Image API Helper ----------
async function callPerplexityImageAPI(prompt, pplxApiKey) {
    const apiUrl = "https://api.perplexity.ai/images/v1";

    const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${pplxApiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "stable-diffusion-xl",
            prompt: prompt
        })
    });

    if (!response.ok) {
        let error;
        try {
            error = await response.json();
        } catch (e) {
            error = { message: await response.text() };
        }
        console.error("Perplexity API error:", error);
        throw new Error(error.message || "Perplexity image API failed");
    }

    const result = await response.json();
    if (!result.url) {
        throw new Error("Perplexity API response missing image URL.");
    }
    return result.url;
}
