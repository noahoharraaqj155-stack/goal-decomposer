exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { goal, domain, horizon, context: userContext } = body;

  if (!goal) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Цель не указана' }) };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'OpenRouter API ключ не настроен на сервере' }) };
  }

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
${userContext ? 'Контекст: ' + userContext : ''}

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
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-8b-instruct:free',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(function() { return {}; });
      return { statusCode: 502, headers, body: JSON.stringify({ error: err.error ? err.error.message : 'Ошибка OpenRouter API' }) };
    }

    const data = await response.json();
    const text = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
    const clean = text.replace(/```json|```/g, '').trim();
    const plan = JSON.parse(clean);

    return { statusCode: 200, headers, body: JSON.stringify(plan) };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Ошибка сервера: ' + e.message }) };
  }
};