import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant for drawing prompts." },
        { role: "user", content: "Give me a simple object for the user to draw using 1 word. Make it random each time." }
      ],
      max_tokens: 50
    });

    const prompt = response?.choices?.[0]?.message?.content?.trim();

    if (prompt) {
      res.status(200).json({ prompt });
    } else {
      res.status(500).json({ error: "Invalid response from OpenAI", raw: response });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch prompt' });
  }
}
