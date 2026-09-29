const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Se requiere un token válido (Authorization: Bearer <token>)',
      code: 'TOKEN_MISSING',
    });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'oem-admin-dev-secret-changeme-in-prod');
    next();
  } catch (err) {
    const isExpired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      error: 'Unauthorized',
      message: isExpired ? 'El token ha expirado' : 'Token inválido o manipulado',
      code: isExpired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
    });
  }
}

function verifyApiKey(req, res, next) {
  const apiKey = req.headers['x-device-api-key'];
  const expectedKey = process.env.DEVICE_API_KEY;

  if (!expectedKey) {
    console.warn('Advertencia: DEVICE_API_KEY no está configurada en .env, permitiendo acceso por defecto (Modo Dev).');
    return next();
  }

  if (apiKey !== expectedKey) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'API Key inválida o no proporcionada',
      code: 'INVALID_API_KEY',
    });
  }
  
  next();
}

module.exports = { requireAuth, verifyApiKey };
