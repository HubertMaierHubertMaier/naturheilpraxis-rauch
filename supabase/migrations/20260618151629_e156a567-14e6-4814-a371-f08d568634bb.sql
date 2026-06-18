DELETE FROM public.verification_codes WHERE user_id = 'e84ac709-fd6b-4c56-9159-98878b1557f4';
DELETE FROM public.user_roles WHERE user_id = 'e84ac709-fd6b-4c56-9159-98878b1557f4';
DELETE FROM public.profiles WHERE user_id = 'e84ac709-fd6b-4c56-9159-98878b1557f4';
DELETE FROM auth.users WHERE id = 'e84ac709-fd6b-4c56-9159-98878b1557f4';