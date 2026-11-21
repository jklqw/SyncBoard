import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional class names while respecting Tailwind's utility precedence. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
