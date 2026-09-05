import { z } from 'zod';

// ============= Validation Schemas =============

// Menu Item validation
export const menuItemSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional().nullable(),
  price: z.number().positive('Price must be positive').max(999999, 'Price too high'),
  category_id: z.string().uuid('Invalid category'),
  is_available: z.boolean().optional(),
});

// Menu Category validation
export const menuCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(100, 'Category name must be less than 100 characters'),
});

// Restaurant setup validation
export const restaurantSetupSchema = z.object({
  name: z.string().trim().min(1, 'Restaurant name is required').max(200, 'Name must be less than 200 characters'),
  phone: z.string().trim().min(5, 'Phone number is required').max(20, 'Phone number too long'),
  email: z.string().email('Invalid email address').max(255, 'Email too long').optional(),
  address: z.string().max(500, 'Address must be less than 500 characters').optional().nullable(),
  cuisine_type: z.string().max(100, 'Cuisine type must be less than 100 characters').optional().nullable(),
});

// Restaurant settings validation
export const restaurantSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Restaurant name is required').max(200, 'Name must be less than 200 characters'),
  email: z.string().email('Invalid email address').max(255, 'Email too long'),
  phone: z.string().trim().min(5, 'Phone number is required').max(20, 'Phone number too long'),
  address: z.string().max(500, 'Address must be less than 500 characters').optional().nullable(),
  cuisine_type: z.string().max(100, 'Cuisine type must be less than 100 characters').optional().nullable(),
  currency: z.string().trim().min(1, 'Currency is required').max(10, 'Currency code too long'),
  tax_percentage: z.number().min(0, 'Tax cannot be negative').max(100, 'Tax cannot exceed 100%'),
});

// Customer order validation
export const orderSchema = z.object({
  special_instructions: z.string().max(500, 'Instructions must be less than 500 characters').optional().nullable(),
  cart: z.array(z.object({
    menuItem: z.object({
      id: z.string().uuid(),
      name: z.string(),
      price: z.number().positive(),
    }),
    quantity: z.number().int().min(1, 'Quantity must be at least 1').max(99, 'Maximum 99 items'),
  })).min(1, 'Cart cannot be empty'),
});

// Customer identity validation (already exists but kept here for completeness)
export const customerIdentitySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  phone: z.string().trim().min(5, 'Phone number must be at least 5 characters').max(20, 'Phone number too long'),
});

// Auth validation
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().trim().min(5, 'Phone number is required').max(20, 'Phone number too long'),
});

// ============= Validation Helpers =============

export interface ValidationSuccess<T> {
  success: true;
  data: T;
  errors: null;
}

export interface ValidationError {
  success: false;
  data: null;
  errors: string[];
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data, errors: null };
  }
  return {
    success: false,
    data: null,
    errors: result.error.errors.map(e => e.message),
  };
}
