'use server';

import { z } from 'zod';
import { createAccount, login, logout, getCurrentUser, updatePassword as updatePasswordAuth } from '@/lib/auth/server-auth';
import { activityService, ActivityType } from '@/lib/services/activity-service';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export type ActionState = {
  error?: string;
  success?: string;
  [key: string]: any;
};

async function getClientIP(): Promise<string> {
  const headersList = await headers();
  return headersList.get('x-forwarded-for')?.split(',')[0] || 
         headersList.get('x-real-ip') || 
         '0.0.0.0';
}

async function logActivity(
  userId: string,
  type: ActivityType,
  ipAddress?: string,
  metadata?: string
) {
  try {
    const ip = ipAddress || await getClientIP();
    await activityService.logActivity({
      user_id: userId,
      action: type,
      ip_address: ip,
      metadata
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - logging failure shouldn't break auth flow
  }
}

const signInSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(100)
});

export async function signInAction(prevState: ActionState, formData: FormData) {
  const result = signInSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    return { error: result.error.errors[0].message };
  }

  const { email, password } = result.data;

  try {
    await login(email, password);
    
    const user = await getCurrentUser();
    if (user) {
      await logActivity(user.id, ActivityType.SIGN_IN);
    }

    redirect('/');
  } catch (error: any) {
    console.error('Sign in error:', error);
    return {
      error: error.message || 'Invalid email or password. Please try again.',
      email,
      password
    };
  }
}

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100)
});

export async function signUpAction(prevState: ActionState, formData: FormData) {
  const result = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    return { error: result.error.errors[0].message };
  }

  const { email, password, name } = result.data;

  try {
    const user = await createAccount(email, password, name);
    await login(email, password);
    await logActivity(user.id, ActivityType.SIGN_UP);

    redirect('/');
  } catch (error: any) {
    console.error('Sign up error:', error);
    return {
      error: error.message || 'Failed to create account. Please try again.',
      email,
      password,
      name
    };
  }
}

export async function signOutAction() {
  try {
    const user = await getCurrentUser();
    await logout();
    if (user) {
      await logActivity(user.id, ActivityType.SIGN_OUT);
    }
    redirect('/sign-in');
  } catch (error: any) {
    console.error('Sign out error:', error);
    redirect('/sign-in');
  }
}

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(100),
  newPassword: z.string().min(8).max(100),
  confirmPassword: z.string().min(8).max(100)
});

export async function updatePasswordAction(prevState: ActionState, formData: FormData) {
  const result = updatePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    return { error: result.error.errors[0].message };
  }

  const { currentPassword, newPassword, confirmPassword } = result.data;

  if (newPassword !== confirmPassword) {
    return { error: 'New passwords do not match.' };
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: 'User not authenticated' };
    }

    await updatePasswordAuth(currentPassword, newPassword);
    await logActivity(user.id, ActivityType.UPDATE_PASSWORD);

    return { success: 'Password updated successfully.' };
  } catch (error: any) {
    console.error('Update password error:', error);
    return {
      error: error.message || 'Failed to update password. Please check your current password.',
      currentPassword,
      newPassword,
      confirmPassword
    };
  }
}

// Re-export for convenience
export const signIn = signInAction;
export const signUp = signUpAction;
export const signOut = signOutAction;
export const updatePassword = updatePasswordAction;
