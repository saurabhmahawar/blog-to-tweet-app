// generate.js - Server-side API route for Vercel

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        const HF_API_KEY = process.env.HF_API_KEY;

        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: "Gemini API key is not configured." });
        }

        const { task, url, content, tweetCount } = req.body;
        let responseData = {};

        if (task === 'content') {
            // Extract content from URL
            let extractedContent = '';
            const specificPrompt = `Find the full, main body text of the given URL. Return only the main content as a single block of text. If you cannot find the content, return a single phrase: 'Content not found'. URL: ${url}`;
            const specificResponse = await callGeminiAPI(specificPrompt, "", GEMINI_API_KEY, true);

            if (specificResponse.text.trim() === 'Content not found' || specificResponse.text.trim().length < 100) {
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
            // Generate Twitter thread
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
            // Generate image based on content
            if (!HF_API_KEY) {
                return res.status(500).json({ error: "Hugging Face API key is not configured." });
            }

            try {
                const imageUrl = await callHuggingFaceImageAPI(content, HF_API_KEY);
                responseData = { imageUrl };
            } catch (err) {
                console.error("HF API call failed:", err);
                return res.status(500).json({ error: "Hugging Face image generation failed." });
            }

        } else {
            return res.status(400).json({ error: "Invalid task specified." });
        }

        return res.status(200).json(responseData);

    } catch (error) {
        console.error("Serverless Function Error:", error);
        return res.status(500).json({ error: error.message });
    }
}

// ---------- Gemini API Helper ----------
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

    let result;
    try {
        result = await response.json();
    } catch (e) {
        const textResult = await response.text();
        console.error("API response was not valid JSON. Raw text:", textResult);
        throw new Error("Gemini API call failed. Received a non-JSON response.");
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

// ---------- Hugging Face Image API Helper ----------
async function callHuggingFaceImageAPI(prompt, hfApiKey) {
    const apiUrl = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2";

    const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${hfApiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            inputs: prompt,
            options: { wait_for_model: true }
        })
    });

    if (!response.ok) {
        const error = await response.text();
        console.error("HF API error:", error);
        throw new Error("Hugging Face image API failed");
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");

    return `data:image/png;base64,${base64Image}`;
}
