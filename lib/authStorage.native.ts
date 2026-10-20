import Storage from 'expo-sqlite/kv-store';

// expo-sqlite's key-value store is a drop-in replacement for AsyncStorage,
// so the login session survives app restarts without any extra package.
export const authStorage = Storage;