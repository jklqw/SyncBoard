import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email().max(254),
  username: z.string().min(2).max(64).regex(/^[a-zA-Z0-9_.-]+$/),
  displayName: z.string().min(1).max(120),
  password: z.string().min(8).max(128),
});

export const LoginSchema = z.object({
  identifier: z.string().min(2).max(254),
  password: z.string().min(1).max(128),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

export interface AccessTokenPayload {
  sub: string;
  username: string;
  displayName: string;
  avatarColor: string;
}
