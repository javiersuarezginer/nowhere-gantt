// api/todoist.js
// Proxy serverless para Todoist API — evita CORS en el browser

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Todoist-Token');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers['x-todoist-token'];
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  // path: /api/todoist?path=projects
  const path = req.query.path || '';
  const url = `https://api.todoist.com/rest/v2/${path}`;

  try {
    const options = {
      method: req.method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    if (req.method === 'POST' && req.body) {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(url, options);
    const text = await response.text();

    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
