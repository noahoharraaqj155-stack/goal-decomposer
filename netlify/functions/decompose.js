exports.handler = async function(event, context) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { goal, domain, horizon, context } = req.body;

  if (!goal) return res.status(400).json({ error: 'Цель не указана' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API ключ не настроен на сервере' });

  const domainMap = {
    general: 'общей тематики', startup: 'стартапа и бизнеса', personal: 'личного развития',
    tech: 'разработки и IT', marketing: 'маркетинга', education: 'обучения',
    career: 'карьеры', health: 'здоровья и спорта', creative: 'творчества', finance: 'финансов'
  };
  const horizonMap = {
    week: '1 неделю', month: '1 месяц', quarter: '3 месяца',
    halfyear: '6 месяцев', year: '1 год', open: 'без временных ограничений'
  };

  const prompt = `Ты — эксперт по декомпозиции задач с 15-летним опытом. Стиль: деловой, конкретный, без воды, с лёгким умным юмором. Отвечай ТОЛЬКО валидным JSON без markdown-обёрток и без текста до/после JSON.

Разбей цель на 5-10 конкретных шагов.

Цель: ${goal}
Область: ${domainMap[domain] || 'общей тематики'}
Горизонт: ${horizonMap[horizon] || '3 месяца'}
${context ? 'Контекст: ' + context : ''}

Верни JSON строго по схеме:
{
  "title": "краткое название плана (5-8 слов)",
  "summary": "2-3 предложения: суть, почему декомпозиция важна, уместный юмор",
  "total_time": "общее реалистичное время",
  "steps": [
    {
      "num": 1,
      "name": "Глагол + результат",
      "description": "2-3 предложения: что, как, почему именно так",
      "time": "конкретно (напр: 3 дня)",
      "result": "измеримый результат этого шага",
      "depends_on": []
    }
  ],
  "joke": "умная короткая шутка про эту цель"
}

Требования: каждый шаг конечен и имеет измеримый результат, время реалистично, шаги логически связаны.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2000 }
        })
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(502).json({ error: err.error?.message || 'Ошибка Gemini API' });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const plan = JSON.parse(clean);

    return res.status(200).json(plan);
  } catch (e) {
    return res.status(500).json({ error: 'Ошибка сервера: ' + e.message });
  }
}
