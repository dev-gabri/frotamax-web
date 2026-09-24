import crypto from 'crypto';

const LOCAL_USER_ID = '00000000-0000-4000-8000-000000000001';

export const isLocalAuthEnabled = (): boolean =>
  process.env.NODE_ENV === 'development' && process.env.LOCAL_AUTH_ENABLED === 'true';

const safeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const authenticateLocalUser = (email: string, password: string) => {
  if (!isLocalAuthEnabled()) return null;

  const configuredEmail = process.env.LOCAL_AUTH_EMAIL;
  const configuredPassword = process.env.LOCAL_AUTH_PASSWORD;

  if (!configuredEmail || !configuredPassword) {
    throw new Error('Local authentication is enabled but credentials are missing');
  }

  if (!safeEqual(email.toLowerCase(), configuredEmail.toLowerCase())
      || !safeEqual(password, configuredPassword)) {
    return null;
  }

  const timestamp = new Date().toISOString();
  return {
    user: {
      id: LOCAL_USER_ID,
      email: configuredEmail.toLowerCase(),
      role: 'admin' as const,
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp
    },
    profile: {
      id: LOCAL_USER_ID,
      user_id: LOCAL_USER_ID,
      full_name: process.env.LOCAL_AUTH_NAME || 'Administrador Local',
      department: 'Desenvolvimento',
      created_at: timestamp,
      updated_at: timestamp
    }
  };
};

export const getLocalUserFromToken = (decoded: any) => {
  if (!isLocalAuthEnabled() || decoded?.local !== true || decoded?.userId !== LOCAL_USER_ID) {
    return null;
  }

  return {
    id: LOCAL_USER_ID,
    email: process.env.LOCAL_AUTH_EMAIL || 'admin@frotamax.local',
    role: 'admin',
    is_active: true,
    account_status: 'active'
  };
};
