import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(express.json());

console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY);

// Serve static files from "public"
app.use(express.static('public'));

// Endpoint to get drawing prompt from OpenAI
app.post('/get-prompt', async (req, res) => {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: "system", content: "You are a helpful assistant for drawing prompts." },
          { role: "user", content: "Give me a simple object for the user to draw using 1 word. Make it random each time." }
        ],
        max_tokens: 50
      })
    });

    const data = await response.json();
    console.log("OpenAI response:", JSON.stringify(data, null, 2));

    // Safely access the prompt
    const prompt = data?.choices?.[0]?.message?.content?.trim();

    if (prompt) {
      res.json({ prompt });
    } else {
      res.status(500).json({ error: "Invalid response from OpenAI", raw: data });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch prompt' });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
