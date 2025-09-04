import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';

// --- Firebase Initialization (Simulated in a single-file environment) ---
// In a real Next.js app, this would be a separate, server-side module
// and Firebase would be initialized in a more standard way.

const firebaseConfig = {
  // Your Firebase config would go here.
};
let app = {};
let db = {};

// Use a mock initialization to prevent runtime errors in the single-file setup.
try {
  if (typeof __firebase_config !== 'undefined') {
    const parsedConfig = JSON.parse(__firebase_config);
    app = initializeApp(parsedConfig);
    db = getFirestore(app);
  } else {
    console.warn("Firebase config not found. Running in mock mode.");
  }
} catch (e) {
  console.error("Error initializing Firebase:", e);
  console.warn("Running in mock mode due to initialization error.");
}

// --- Main App Component ---

const App = () => {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [tweetCount, setTweetCount] = useState(5);
  const [tweets, setTweets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [generateImage, setGenerateImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState('');
  const [loadingImage, setLoadingImage] = useState(false);

  const handleCopy = (contentToCopy) => {
    // Use document.execCommand('copy') as it is more reliable in this environment
    const textarea = document.createElement('textarea');
    textarea.value = contentToCopy;
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    let copySuccessful = false;
    try {
      document.execCommand('copy');
      copySuccessful = true;
    } catch (err) {
      console.error('Failed to copy text with execCommand:', err);
      // Fallback to Clipboard API if execCommand fails
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(contentToCopy)
          .then(() => {
            setCopyMessage('Tweets copied to clipboard!');
          })
          .catch(() => {
            setCopyMessage('Failed to copy tweets. Please copy manually.');
          });
        copySuccessful = true;
      }
    }
    document.body.removeChild(textarea);

    if (copySuccessful) {
      setCopyMessage('Copied to clipboard!');
    } else {
      setCopyMessage('Failed to copy tweets. Please copy manually.');
    }
    
    setTimeout(() => setCopyMessage(''), 3000); // Clear message after 3 seconds
  };
  
  const handleCopyAll = () => {
    const textToCopy = tweets.map(t => t.content).join('\n\n');
    handleCopy(textToCopy);
  };
  
  const handleCopySingle = (content) => {
    handleCopy(content);
  };

  const fetchUrlContent = async (inputUrl) => {
    // This is a placeholder for a real server-side fetch.
    // In a real application, you would use a backend API route
    // to fetch and parse the content to avoid CORS issues.
    console.log(`Simulating fetch for URL: ${inputUrl}`);
    // Return mock content for demonstration
    return `The digital landscape is constantly evolving, with new technologies and frameworks emerging at a rapid pace. A key trend in modern web development is the shift towards single-page applications (SPAs) and component-based architectures. Frameworks like React, Vue, and Angular have become industry standards, enabling developers to build complex, interactive user interfaces with ease. These frameworks promote reusability and maintainability, which are crucial for large-scale projects.

Another significant development is the rise of serverless computing. Services like AWS Lambda and Google Cloud Functions allow developers to run code without managing servers, simplifying deployment and scaling. This model is particularly well-suited for microservices and event-driven architectures. Serverless functions can be triggered by various events, such as API gateway requests, database changes, or file uploads, making them incredibly versatile.

The move towards a more secure and performant web is also a top priority. Adopting HTTPS is now a non-negotiable standard, and tools for performance optimization, such as lazy loading and code splitting, are widely used. The Core Web Vitals initiative from Google provides a set of metrics to help developers measure and improve user experience, focusing on loading, interactivity, and visual stability. These metrics are becoming increasingly important for search engine rankings.

Finally, the integration of artificial intelligence and machine learning into everyday applications is accelerating. From personalized recommendations to natural language processing, AI is enhancing user experiences in countless ways. AI models can be deployed on the edge, directly on user devices, or in the cloud. The future of web development will likely involve even deeper integration of these technologies, creating smarter, more intuitive applications.
`;
  };
  
  const createImagePrompt = async (contentToSummarize, apiKey) => {
    const prompt = `
      Based on the following blog post content, generate a detailed and descriptive image generation prompt. The prompt should be for a high-quality, professional illustration that captures the essence and key themes of the text. Focus on style, subject matter, mood, and lighting.

      Example output: "High-resolution digital illustration of a futuristic, glowing data network overlaid on a modern city skyline at dusk. The style is clean and geometric, with a focus on vibrant blue and purple neon lights. There is a sense of movement and connection, with lines representing data flow. The mood is innovative and forward-looking. 8K, cinematic lighting."

      Blog Post Content:
      ${contentToSummarize}
    `;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "text/plain",
      },
    };

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      return result?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (e) {
      console.error('API call to create image prompt failed:', e);
      return null;
    }
  };


  const generateThread = async () => {
    setIsLoading(true);
    setError('');
    setTweets([]);
    setGeneratedImageUrl('');
    setLoadingImage(false);

    let contentToSummarize = '';
    if (url) {
      // In a real app, this would be an API call to a backend
      // that fetches and parses the URL content.
      contentToSummarize = await fetchUrlContent(url);
    } else {
      if (!text) {
        setError('Please paste some text or enter a URL.');
        setIsLoading(false);
        return;
      }
      contentToSummarize = text;
    }

    if (contentToSummarize.split(/\s+/).length > 3000) {
      setError('Blog content exceeds the 3000-word limit.');
      setIsLoading(false);
      return;
    }
    
    // Fallback in case the environment doesn't have the API key
    const apiKey = typeof __api_key !== 'undefined' ? __api_key : '';

    const payload = {
        contents: [{ parts: [{ text: `
          Act as a professional content strategist and social media manager. Your task is to convert the following blog post into a concise and engaging Twitter thread.

          **Instructions:**
          1. Read the entire blog post provided below.
          2. Identify the core message, key insights, and main takeaways.
          3. Distill these points into a sequence of tweets that flow naturally as a thread.
          4. The total number of tweets must be exactly ${tweetCount}.
          5. Each tweet must be 280 characters or less.
          6. Use a catchy, engaging, and clear tone.
          7. Number each tweet in the format "1/${tweetCount}", "2/${tweetCount}", etc.
          8. Output ONLY the tweets as a JSON array of strings.
          9. Use relevant emojis to enhance engagement and tone.

          **Blog Post Content:**
          ${contentToSummarize}
          `}] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: { "type": "STRING" }
          }
        },
    };

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (rawText) {
        const generatedTweets = JSON.parse(rawText);
        setTweets(generatedTweets.map((tweet, index) => ({
            id: index,
            content: tweet,
            isEdited: false
        })));
      } else {
        setError('Could not generate tweets. Please try again.');
      }
    } catch (e) {
      console.error('API call failed:', e);
      setError('Failed to connect to the Gemini API. Please try again later.');
    } finally {
      setIsLoading(false);
    }
    
    // Image generation
    if (generateImage && contentToSummarize) {
      setLoadingImage(true);
      try {
        const detailedImagePrompt = await createImagePrompt(contentToSummarize, apiKey);
        if (!detailedImagePrompt) {
          throw new Error('Failed to generate a detailed image prompt.');
        }
        
        const imagePayload = { instances: { prompt: detailedImagePrompt }, parameters: { "sampleCount": 1 } };
        const imageApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
        const imageResponse = await fetch(imageApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(imagePayload)
        });
        const imageResult = await imageResponse.json();
        const base64Data = imageResult?.predictions?.[0]?.bytesBase64Encoded;
        if (base64Data) {
          setGeneratedImageUrl(`data:image/png;base64,${base64Data}`);
        } else {
          console.error("Image generation failed.");
        }
      } catch (e) {
        console.error("Image generation API call failed:", e);
        setError("Failed to generate image. Please try again.");
      } finally {
        setLoadingImage(false);
      }
    }
  };

  const handleTweetChange = (index, newContent) => {
    setTweets(prevTweets => prevTweets.map((tweet, i) =>
      i === index ? { ...tweet, content: newContent, isEdited: true } : tweet
    ));
  };

  const downloadImage = () => {
    const a = document.createElement('a');
    a.href = generatedImageUrl;
    a.download = 'thread_image.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="bg-gray-100 min-h-screen font-sans antialiased text-gray-800 p-4 sm:p-8 flex flex-col items-center">
      <div className="max-w-xl w-full bg-white rounded-xl shadow-md overflow-hidden p-6 sm:p-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Blog → Thread Converter
          </h1>
          <p className="mt-2 text-gray-600">
            Transform your blog posts into engaging Twitter threads
          </p>
        </div>
        
        <div className="space-y-6">
          <div>
            <label htmlFor="url-input" className="block text-sm font-medium text-gray-700">
              Blog URL <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <p className="text-xs text-gray-400 mb-2">Leave empty if pasting text below</p>
            <input
              id="url-input"
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (e.target.value) setText('');
              }}
              placeholder="Enter blog URL (Medium, LinkedIn, etc.)"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
            />
          </div>

          <div>
            <label htmlFor="text-input" className="block text-sm font-medium text-gray-700">
              Blog Content
            </label>
            <textarea
              id="text-input"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value) setUrl('');
              }}
              placeholder="Paste your blog content here (up to 5000 words)"
              rows="8"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 resize-y"
            ></textarea>
            <p className="text-right text-xs text-gray-500 mt-1">
              {text.split(/\s+/).filter(Boolean).length} / 5000 words
            </p>
          </div>

          <div>
            <label htmlFor="tweet-count" className="block text-sm font-medium text-gray-700 mb-2">
              Number of tweets in thread: <span className="font-bold">{tweetCount}</span>
            </label>
            <input
              id="tweet-count"
              type="range"
              min="3"
              max="15"
              value={tweetCount}
              onChange={(e) => setTweetCount(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((tweetCount - 3) / 12) * 100}%, #e5e7eb ${((tweetCount - 3) / 12) * 100}%, #e5e7eb 100%)`
              }}
            />
          </div>
          
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Generate Image?</label>
            <div className="flex space-x-2">
              <button
                onClick={() => setGenerateImage(true)}
                className={`py-1 px-4 rounded-full text-xs font-bold transition-colors duration-200 ${generateImage ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                Yes
              </button>
              <button
                onClick={() => setGenerateImage(false)}
                className={`py-1 px-4 rounded-full text-xs font-bold transition-colors duration-200 ${!generateImage ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                No
              </button>
            </div>
          </div>

          <button
            onClick={generateThread}
            disabled={isLoading}
            className={`w-full py-3 rounded-lg font-bold text-white transition-all duration-300 ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700'}`}
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5 mx-auto text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : 'Convert to Thread'}
          </button>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mt-6" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {tweets.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4 sm:p-6 shadow-inner mt-6">
            <h2 className="text-2xl font-bold mb-4 text-center text-gray-700">
              Your Twitter Thread Preview
            </h2>
            <div className="space-y-4">
              {loadingImage && (
                <div className="flex justify-center items-center h-48 bg-gray-200 rounded-lg">
                  <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
              {generatedImageUrl && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col items-center gap-2">
                  <img src={generatedImageUrl} alt="Generated for your thread" className="w-full h-auto rounded-lg object-cover" />
                  <button onClick={downloadImage} className="mt-2 px-4 py-2 text-sm rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors duration-200">
                    Download Image
                  </button>
                </div>
              )}
              {tweets.map((tweet, index) => (
                <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col gap-2">
                  <div
                    contentEditable
                    onInput={(e) => handleTweetChange(index, e.target.innerText)}
                    className="prose max-w-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-lg p-2 transition-all duration-200 text-gray-800"
                    dangerouslySetInnerHTML={{ __html: tweet.content.replace(/\n/g, '<br>') }}
                  ></div>
                  <div className="flex justify-between items-center text-sm text-gray-500 mt-2">
                    <span>{tweet.content.length} / 280 characters</span>
                    <button
                      onClick={() => handleCopySingle(tweet.content)}
                      className="flex items-center gap-1 px-3 py-1 text-xs rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors duration-200"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                      Copy Tweet
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-6">
              <button
                onClick={handleCopyAll}
                className="px-8 py-3 rounded-lg font-bold text-white bg-green-500 hover:bg-green-600 transition-all duration-300"
              >
                Copy All Tweets
              </button>
            </div>
          </div>
        )}
        
        {copyMessage && (
          <div className="mt-4 text-center text-sm font-medium text-green-600 animate-pulse">
            {copyMessage}
          </div>
        )}
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; }
        
        input[type=range] {
          -webkit-appearance: none;
          width: 100%;
          background: transparent;
        }

        input[type=range]::-webkit-slider-runnable-track {
          width: 100%;
          height: 8px;
          cursor: pointer;
          border-radius: 4px;
        }

        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          border: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          margin-top: -4px;
        }

        input[type=range]::-moz-range-track {
          width: 100%;
          height: 8px;
          cursor: pointer;
          border-radius: 4px;
          background: #e5e7eb;
        }

        input[type=range]::-moz-range-thumb {
          border: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
        }
      `}</style>
      <script src="https://cdn.tailwindcss.com"></script>
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);