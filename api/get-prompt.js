export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful assistant for drawing prompts." },
          { role: "user", content: "Give me a simple object for the user to draw using 1 word. Make it random each time." }
        ],
        max_tokens: 50
      })
    });

    const data = await response.json();
    const prompt = data?.choices?.[0]?.message?.content?.trim();

    if (prompt) {
      res.status(200).json({ prompt });
    } else {
      res.status(500).json({ error: "Invalid response from OpenAI", raw: data });
    }
  } catch (err) {
    console.error("Error fetching prompt:", err);
    res.status(500).json({ error: "Failed to fetch prompt" });
  }
}
