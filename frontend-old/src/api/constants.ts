/**
 * Constants (constant cards) API
 */

import { apiClient } from './client';
import { API_ENDPOINTS } from '../constants/api';

interface ConstantData {
  name: string;
  value: number;
  unit?: string;
  color?: string;
  description?: string;
  decimal_places?: number;
}

export const constantApi = {
  /**
   * Create a new constant card
   */
  create: (data: ConstantData) =>
    apiClient.post(API_ENDPOINTS.CONSTANT, data),

  /**
   * Update an existing constant card
   */
  update: (monitorId: string, data: ConstantData) =>
    apiClient.put(API_ENDPOINTS.CONSTANT_BY_ID(monitorId), data),

  /**
   * Delete a constant card
   */
  delete: (monitorId: string) =>
    apiClient.delete(API_ENDPOINTS.CONSTANT_BY_ID(monitorId)),
};
