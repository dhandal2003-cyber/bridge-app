const fs = require('fs');
const code = `import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const WebStorage = {
  getItem: (key) => Promise.resolve(localStorage.getItem(key)),
  setItem: (key, value) => Promise.resolve(localStorage.setItem(key, value)),
  removeItem: (key) => Promise.resolve(localStorage.removeItem(key)),
};

const NativeStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  'https://xdmvwmcuhkazbseiqajt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkbXZ3bWN1aGthemJzZWlxYWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MTA1MzAsImV4cCI6MjA5NTE4NjUzMH0.TcD_9P0Tt_CDDBjq09XCYWHWqzqBUnkOqUBnzOpH4VE',
  {
    auth: {
      storage: Platform.OS === 'web' ? WebStorage : NativeStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
`;
fs.writeFileSync('lib/supabase.js', code);
console.log('Done!');
