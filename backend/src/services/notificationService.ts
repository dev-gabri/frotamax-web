import { supabase } from './supabaseClient';

export class NotificationService {
  static async checkExpiringDocuments() {
    try {
      // Execute the database function for checking expiring documents
      const { error } = await supabase.rpc('check_expiring_documents');
      
      if (error) {
        console.error('Error checking expiring documents:', error);
        throw error;
      }

      console.log('Successfully checked for expiring documents');
    } catch (error) {
      console.error('NotificationService.checkExpiringDocuments error:', error);
      throw error;
    }
  }

  static async createNotification(data: {
    user_id: string;
    type: string;
    title: string;
    message: string;
    priority?: string;
    related_entity_type?: string;
    related_entity_id?: string;
  }) {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert(data);

      if (error) {
        console.error('Error creating notification:', error);
        throw error;
      }

      console.log('Notification created successfully');
    } catch (error) {
      console.error('NotificationService.createNotification error:', error);
      throw error;
    }
  }
}