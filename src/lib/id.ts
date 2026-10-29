import * as Crypto from 'expo-crypto';

/** Opaque local identifier. Carries no user or device information. */
export const newId = (): string => Crypto.randomUUID();
