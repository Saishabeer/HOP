exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Very basic proxy that expects the client to still send formData
  // For a true secure signed upload, the client should request a signature,
  // but to keep it simple, we just proxy the request to hide the cloud name and preset if needed.
  // Actually, Cloudinary uploads are often done direct from client with an unsigned preset.
  // This proxy is here as a placeholder for full signed uploads if the user wants to upgrade later.

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Cloudinary proxy ready. Use signed endpoints for production." })
  };
};
