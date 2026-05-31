-- Add is_validated column to videos table for admin validation of shared exercises
ALTER TABLE public.videos ADD COLUMN is_validated boolean DEFAULT false;