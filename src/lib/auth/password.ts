import {
  argon2id,
  hash as argon2Hash,
  verify as argon2Verify,
} from "argon2";

const PASSWORD_OPTIONS = {
  type: argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
} as const;

export const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,p=1,t=3$qBIqhOBSCm3YhZlv0HNyBw$TParuK8a3LDL42pTwkvL/XcgYGyChktjLEXHR9WpoiA";

export function hashPassword(password: string) {
  return argon2Hash(password, PASSWORD_OPTIONS);
}

export function verifyPassword(passwordHash: string, password: string) {
  return argon2Verify(passwordHash, password);
}
