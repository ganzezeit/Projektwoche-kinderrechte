exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' };

  try {
    const { pollUrl } = JSON.parse(event.body);
    if (!pollUrl || !process.env.REPLICATE_API_KEY) {
      return { statusCode: 400, headers, body: JSON.stringify({ status: 'failed', error: 'Missing parameters' }) };
    }

    const response = await fetch(pollUrl, {
      headers: { 'Authorization': 'Bearer ' + process.env.REPLICATE_API_KEY }
    });

    if (!response.ok) {
      return { statusCode: 200, headers, body: JSON.stringify({ status: 'failed', error: 'Poll failed: HTTP ' + response.status }) };
    }

    const result = await response.json();

    if (result.status === 'succeeded' && result.output) {
      const output = result.output;
      let imageUrl;
      if (Array.isArray(output)) imageUrl = output[0];
      else if (typeof output === 'string') imageUrl = output;
      else if (output.url) imageUrl = output.url;
      else if (output.images && output.images[0]) imageUrl = output.images[0].url || output.images[0];

      if (imageUrl) {
        return { statusCode: 200, headers, body: JSON.stringify({ status: 'succeeded', imageUrl }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ status: 'failed', error: 'Unknown output format' }) };
    }

    if (result.status === 'failed' || result.status === 'canceled') {
      return { statusCode: 200, headers, body: JSON.stringify({ status: 'failed', error: result.error || 'Generation failed' }) };
    }

    // Still processing
    return { statusCode: 200, headers, body: JSON.stringify({ status: 'processing' }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ status: 'failed', error: err.message }) };
  }
};
