/**
 * Authentication API
 */

import { apiClient } from './client';
import { API_ENDPOINTS } from '../constants/api';

export const authApi = {
  /**
   * Login with username and password
   */
  login: (username: string, password: string) =>
    apiClient.post<{ success: boolean; message?: string }>(
      API_ENDPOINTS.LOGIN,
      { username, password }
    ),
};
