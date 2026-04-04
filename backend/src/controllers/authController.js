import dotenv from 'dotenv';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import dns from 'dns';
import * as authService from '../services/authService.js';

dotenv.config();
dns.setServers(['8.8.8.8', '8.8.4.4']);

const getGoogleClient = () => new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 24 * 60 * 60 * 1000,
  path: '/'
};

const successResponse = (res, data, msg = 'success', code = 200) => {
  res.status(code).json({ code, msg, data });
};

const errorResponse = (res, msg, code = 400) => {
  res.status(code).json({ code, msg, data: null });
};

const generateToken = (id) => {
  const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev';
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });
};

const serializeUser = (user) => ({
  id: user.id,
  email: user.email,
  full_name: user.full_name
});

export const getMe = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;

    if (!userId) {
      return errorResponse(res, 'User id is required', 401);
    }

    const user = await authService.getUserById(userId);
    return successResponse(res, { user: serializeUser(user) }, 'User loaded');
  } catch (error) {
    const status = error.message === 'User not found' ? 401 : 500;
    return errorResponse(res, error.message, status);
  }
};

export const googleClientConfig = (_req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return errorResponse(res, 'GOOGLE_CLIENT_ID is not configured', 500);
  }

  return successResponse(
    res,
    { clientId: process.env.GOOGLE_CLIENT_ID || '' },
    'Google client config loaded'
  );
};

export const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return errorResponse(res, 'Google ID Token is required');
    }

    console.log('GOOGLE_CLIENT_ID =', process.env.GOOGLE_CLIENT_ID);
    console.log('idToken received =', Boolean(idToken));
    console.log('Backend expected audience =', process.env.GOOGLE_CLIENT_ID);

    if (!process.env.GOOGLE_CLIENT_ID) {
      return errorResponse(res, 'GOOGLE_CLIENT_ID is not configured', 500);
    }

    const ticket = await getGoogleClient().verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { email, name } = payload;

    if (!email) {
      return errorResponse(res, 'Google account email is missing', 401);
    }

    const user = await authService.findOrCreateGoogleUser(email, name);
    const token = generateToken(user.id);

    res.cookie('auth_token', token, cookieOptions);

    return successResponse(
      res,
      {
        user: serializeUser(user),
        token
      },
      'Google login successful'
    );
  } catch (error) {
    console.error('Google Auth Error:', error);
    return errorResponse(res, error.message || 'Invalid Google token', 401);
  }
};

export const logout = (req, res) => {
  res.clearCookie('auth_token', { path: '/' });
  res.json({ message: 'Logged out successfully' });
};
