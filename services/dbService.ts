import { DailyRecord } from '../types';

const LOCAL_STORAGE_KEY = 'ccs_v3_db';

export type DBResponse = {
  data: DailyRecord[];
  status: 'synced' | 'local' | 'config_missing' | 'error';
};

export const dbService = {
  async loadData(): Promise<DBResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch('/api/data', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.warn('API Response Error:', response.status, errData);
        
        if (errData.details) {
            console.info('Helpful Hint:', errData.details.solution);
        }

        if (errData.error?.includes('یافت نشدند') || errData.error?.includes('تنظیمات')) {
          return { data: this.getLocalBackup(), status: 'config_missing' };
        }
        return { data: this.getLocalBackup(), status: 'error' };
      }

      const data = await response.json();
      if (data && Array.isArray(data)) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
        return { data, status: 'synced' };
      }
      
      return { data: this.getLocalBackup(), status: 'local' };
    } catch (error) {
      console.error('Database Fetch Fatal Error:', error);
      return { data: this.getLocalBackup(), status: 'error' };
    }
  },

  async saveData(data: DailyRecord[]): Promise<'synced' | 'error' | 'config_missing'> {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));

    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (errData.error?.includes('یافت نشدند') || errData.error?.includes('تنظیمات')) {
          return 'config_missing';
        }
        return 'error';
      }

      return 'synced';
    } catch (error) {
      console.error('Cloud Save Network Error:', error);
      return 'error';
    }
  },

  getLocalBackup(): DailyRecord[] {
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    return local ? JSON.parse(local) : [];
  }
};