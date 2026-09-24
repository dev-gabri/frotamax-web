import { apiService } from './apiService';
import { UserProfile, UserSettings, ApiResponse } from '../types';

export class ProfileService {
  // Get user profile
  static async getProfile(): Promise<ApiResponse<UserProfile>> {
    return apiService.get<UserProfile>('/users/profile');
  }

  // Update user profile
  static async updateProfile(profileData: {
    full_name: string;
    phone?: string;
    department?: string;
    cost_center?: string;
  }): Promise<ApiResponse<UserProfile>> {
    return apiService.put<UserProfile>('/users/profile', profileData);
  }

  // Upload avatar
  static async uploadAvatar(file: File): Promise<ApiResponse<{ avatar_url: string }>> {
    const formData = new FormData();
    formData.append('avatar', file);

    // Use fetch directly for file upload with proper headers
    const token = localStorage.getItem('frotamax_token');
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/users/profile/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();
      return result;
    } catch (error) {
      return {
        success: false,
        error: 'Erro ao fazer upload do avatar'
      };
    }
  }

  // Change password
  static async changePassword(passwordData: {
    current_password: string;
    new_password: string;
  }): Promise<ApiResponse<void>> {
    return apiService.patch<void>('/users/change-password', passwordData);
  }

  // Get user settings
  static async getSettings(): Promise<ApiResponse<UserSettings>> {
    return apiService.get<UserSettings>('/settings');
  }

  // Update user settings
  static async updateSettings(settings: UserSettings): Promise<ApiResponse<UserSettings>> {
    return apiService.put<UserSettings>('/settings', settings);
  }
}

export default ProfileService;