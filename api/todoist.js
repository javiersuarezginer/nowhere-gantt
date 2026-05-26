// api/todoist.js
// Proxy serverless para Todoist API v1 — evita CORS en el browser

export const config = {
  api: { bodyParser: true },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-todoist-token');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.TODOIST_TOKEN || req.headers['x-todoist-token'];
  if (!token) return res.status(401).json({ error: 'Token no configurado' });

  const path = req.query.path || '';
  const url = `https://api.todoist.com/api/v1/${path}`;

  try {
    const options = {
      method: req.method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    if (req.method === 'POST' && req.body) {
      options.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const response = await fetch(url, options);
    const text = await response.text();

    let data;
    try {
      const parsed = JSON.parse(text);
      // API v1 devuelve los datos dentro de "results" para listados
      data = parsed.results !== undefined ? parsed.results : parsed;
    } catch {
      data = text;
    }

    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
