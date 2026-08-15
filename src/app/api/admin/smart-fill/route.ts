import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { title, city, category, content } = await req.json();
    const keys = [
      process.env.GROQ_API_KEY,
      process.env.GROQ_API_KEY_1,
      process.env.GROQ_API_KEY_2,
      process.env.GROQ_API_KEY_3,
      process.env.GROQ_API_KEY_4,
      process.env.GROQ_API_KEY_5,
      process.env.GROQ_API_KEY_6,
      process.env.GROQ_API_KEY_7,
      process.env.GROQ_API_KEY_8,
      process.env.GROQ_API_KEY_9
    ].filter(Boolean);
    const apiKey = keys.length > 0 ? keys[Math.floor(Math.random() * keys.length)] : undefined;

    // Return an error if API key is not present instead of filling dummy data
    if (!apiKey) {
      console.log('No GROQ_API_KEY found in environment');
      return NextResponse.json({ error: "GROQ_API_KEY is missing from your .env file. Please add it to use Smart Fill." }, { status: 400 });
    }

    const prompt = `Analyze the following travel blog details and generate a smart-fill response.
Categorize the trip into exactly one option from the budget, season, stay, transit, and category lists based on the vibe and details.
Also identify the primary Indian City or State for the destination.
Finally, generate an array of itinerary stops based on the content. CRITICAL: ONLY generate stops for places explicitly mentioned or strongly implied by the content. Do NOT hallucinate extra days. A short blog should typically have 1 to 3 stops. (each with day (number, MUST be sequential starting from 1), title (string), location (string), description (string), lat (number), lng (number)).

Return ONLY a valid JSON object with the keys "budget", "season", "stay", "transit", "city", "category", and "stops". Do not include any markdown, code blocks, or explanations.

Lists:
budget: ["All", "Budget Explorer (< ₹8,000)", "Comfort Holiday (₹8k - ₹25k)", "Boutique & Heritage (₹25k+)"]
season: ["All", "Monsoon Greenery", "Winter Sunshine", "Summer Mountain Escape"]
stay: ["All", "Homestays & Eco-Cottages", "Heritage Havellis & Palaces", "Backpacker Hostels & Camps"]
transit: ["All", "Scenic Indian Railways", "Self-Drive Roadtrip", "Regional Flight & Cabs"]
category: ["Beaches & Shacks", "Himalayas & Hills", "Street Food & Chai", "Backpacking India", "Transit & Trains", "Budget Homestays", "Hidden Gems", "Romantic Retreats", "Family Safaris", "Monsoon Packing"]

Blog Title: ${title || ''}
City: ${city || ''}
Category: ${category || ''}
Content Snippet: ${(content || '').substring(0, 15000)}`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "GPT-OSS 20B",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Groq API Error:", text);
      return NextResponse.json({ error: `Groq API Error: ${text}` }, { status: 500 });
    }

    const data = await res.json();
    const resultText = data.choices[0].message.content;
    const result = JSON.parse(resultText);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Smart Fill Error:", error);
    return NextResponse.json({ error: "Failed to smart fill" }, { status: 500 });
  }
}
