/**
 * File responsibility: HTTP controller.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: authController should handle request/response orchestration and delegate actual work to services.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import dotenv from 'dotenv';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import dns from 'dns';
import * as authService from '../services/authService.js';

dotenv.config();
dns.setServers(['8.8.8.8', '8.8.4.4']);

/**
 * Purpose: Execute the main responsibility for getGoogleClient.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const getGoogleClient = () => new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 24 * 60 * 60 * 1000,
  path: '/'
};

/**
 * Purpose: Execute the main responsibility for successResponse.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const successResponse = (res, data, msg = 'success', code = 200) => {
  res.status(code).json({ code, msg, data });
};

/**
 * Purpose: Execute the main responsibility for errorResponse.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const errorResponse = (res, msg, code = 400) => {
  res.status(code).json({ code, msg, data: null });
};

/**
 * Purpose: Execute the main responsibility for generateToken.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const generateToken = (id) => {
  const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev';
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });
};

/**
 * Purpose: Execute the main responsibility for serializeUser.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const serializeUser = (user) => ({
  id: user.id,
  email: user.email,
  full_name: user.full_name
});

/**
 * Purpose: Execute the main responsibility for getMe.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const getMe = async (req, res) => {
  try {
    const userId = req.user?.id;

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

/**
 * Purpose: Execute the main responsibility for googleClientConfig.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
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

/**
 * Purpose: Execute the main responsibility for googleLogin.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return errorResponse(res, 'Google ID Token is required');
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return errorResponse(res, 'GOOGLE_CLIENT_ID is not configured', 500);
    }

    const ticket = await getGoogleClient().verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { email, name, sub } = payload;

    if (!email) {
      return errorResponse(res, 'Google account email is missing', 401);
    }

    const user = await authService.findOrCreateGoogleUser(email, name, sub);
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

/**
 * Purpose: Execute the main responsibility for logout.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const logout = (req, res) => {
  res.clearCookie('auth_token', { path: '/' });
  res.json({ message: 'Logged out successfully' });
};
