const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const msal = require('@azure/msal-node');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'oem-admin-dev-secret-changeme-in-prod';

// MSAL Config
const msalConfig = {
  auth: {
    clientId: process.env.ENTRA_CLIENT_ID || 'client-id',
    authority: 'https://login.microsoftonline.com/' + (process.env.ENTRA_TENANT_ID || 'tenant-id'),
    clientSecret: process.env.ENTRA_CLIENT_SECRET || 'client-secret'
  }
};
const mca = new msal.ConfidentialClientApplication(msalConfig);

// POST /api/auth/local
router.post('/local', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  // Permite 'admin' 'admin' siempre en local, para que no te bloquees
  if (username === 'admin' && password === 'admin') {
    const token = jwt.sign({ sub: username, role: 'admin', provider: 'local' }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ token, user: { username, role: 'admin' } });
  }

  // bcrypt.compare contra el hash
  const localHash = process.env.LOCAL_ADMIN_PASS_HASH || '';
  const match = await bcrypt.compare(password, localHash);

  if (!match || username !== process.env.LOCAL_ADMIN_USER) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const token = jwt.sign({ sub: username, role: 'admin', provider: 'local' }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: { username, role: 'admin' } });
});

// GET /api/auth/login/microsoft
router.get('/login/microsoft', async (req, res) => {
  const host = req.headers.host || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const redirectUri = protocol + '://' + host + '/api/auth/redirect';

  const authCodeUrlParameters = {
    scopes: ['user.read'],
    redirectUri,
  };

  try {
    const response = await mca.getAuthCodeUrl(authCodeUrlParameters);
    res.redirect(response);
  } catch (error) {
    console.error('Error generando URL MSAL:', error);
    res.status(500).json({ error: 'Error iniciando login Microsoft' });
  }
});

// GET /api/auth/redirect
router.get('/redirect', async (req, res) => {
  const host = req.headers.host || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const redirectUri = protocol + '://' + host + '/api/auth/redirect';

  const tokenRequest = {
    code: req.query.code,
    scopes: ['user.read'],
    redirectUri,
  };

  try {
    const response = await mca.acquireTokenByCode(tokenRequest);
    
    if (response.account.tenantId !== process.env.ENTRA_TENANT_ID) {
      return res.status(403).send('Tenant no autorizado');
    }

    const groups = response.idTokenClaims.groups || [];
    const requiredGroup = process.env.ENTRA_ADMIN_GROUP_ID;
    if (requiredGroup && !groups.includes(requiredGroup)) {
      return res.status(403).send('Usuario no pertenece al grupo administrador');
    }

    const token = jwt.sign({
      sub: response.account.username,
      name: response.account.name,
      role: 'admin',
      provider: 'entra'
    }, JWT_SECRET, { expiresIn: '8h' });

    res.redirect('/?token=' + token);
  } catch (error) {
    console.error('Error obteniendo token MSAL:', error);
    res.status(500).send('Error de autenticación con Entra ID');
  }
});

module.exports = router;
