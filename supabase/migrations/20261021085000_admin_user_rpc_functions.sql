-- ============================================================================
-- MIGRATION: Funções Seguras de Banco (RPC) para Gestão de Usuários e Permissões
-- Data: 2026-10-21
-- Objetivo: Permitir que administradores gerenciem contas, senhas e permissões
--           diretamente via Supabase RPC, funcionando em qualquer hospedagem
--           (Vercel, Lovable, Localhost) sem depender de SUPABASE_SERVICE_ROLE_KEY.
-- ============================================================================

-- 1. Garante que a extensão pgcrypto está ativa no schema extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. FUNÇÃO: admin_create_user
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_name text,
  p_username text,
  p_password text,
  p_status text DEFAULT 'ativo',
  p_notes text DEFAULT '',
  p_permissions jsonb DEFAULT '[]'::jsonb,
  p_is_admin boolean DEFAULT false,
  p_read_only boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_encrypted_pw text;
  v_clean_username text;
  v_clean_name text;
BEGIN
  -- 2.1 Verifica se o usuário que está chamando é um administrador autenticado
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem cadastrar usuários.';
  END IF;

  v_clean_name := trim(p_name);
  v_clean_username := lower(trim(p_username));

  -- 2.2 Validações de entrada
  IF v_clean_name IS NULL OR length(v_clean_name) = 0 THEN
    RAISE EXCEPTION 'Informe o nome do usuário.';
  END IF;

  IF v_clean_username IS NULL OR length(v_clean_username) = 0 THEN
    RAISE EXCEPTION 'Informe o nome de usuário (login).';
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'A senha deve ter ao menos 6 caracteres.';
  END IF;

  v_email := v_clean_username || '@sumel.local';

  -- 2.3 Verifica duplicidade no profiles e no auth.users
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = v_clean_username) THEN
    RAISE EXCEPTION 'Já existe um usuário com esse login.';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'Já existe um usuário com esse email de autenticação.';
  END IF;

  -- 2.4 Gera UUID e hash seguro da senha via bcrypt
  v_user_id := gen_random_uuid();
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf', 10));

  -- 2.5 Insere na tabela auth.users do Supabase
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    v_email,
    v_encrypted_pw,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', v_clean_name, 'username', v_clean_username),
    false,
    now(),
    now()
  );

  -- 2.6 Insere na tabela auth.identities (identidade de login por email/senha)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'provider_id'
  ) THEN
    EXECUTE 'INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at) ' ||
            'VALUES ($1, $2, $3, ''email'', $4, now(), now(), now())'
    USING v_user_id::text, v_user_id, jsonb_build_object('sub', v_user_id::text, 'email', v_email), v_email;
  ELSE
    EXECUTE 'INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) ' ||
            'VALUES ($1, $2, $3, ''email'', now(), now(), now())'
    USING v_user_id::text, v_user_id, jsonb_build_object('sub', v_user_id::text, 'email', v_email);
  END IF;

  -- 2.7 Insere no public.profiles
  INSERT INTO public.profiles (
    id,
    name,
    username,
    status,
    notes,
    permissions,
    read_only,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_clean_name,
    v_clean_username,
    coalesce(p_status, 'ativo'),
    coalesce(trim(p_notes), ''),
    coalesce(p_permissions, '[]'::jsonb),
    coalesce(p_read_only, false),
    now(),
    now()
  );

  -- 2.8 Insere na tabela public.user_roles
  INSERT INTO public.user_roles (
    user_id,
    role
  ) VALUES (
    v_user_id,
    CASE WHEN p_is_admin THEN 'admin'::public.app_role ELSE 'user'::public.app_role END
  );

  RETURN jsonb_build_object('ok', true, 'id', v_user_id);
END;
$$;


-- 3. FUNÇÃO: admin_update_user
CREATE OR REPLACE FUNCTION public.admin_update_user(
  p_id uuid,
  p_name text,
  p_username text,
  p_password text DEFAULT NULL,
  p_status text DEFAULT 'ativo',
  p_notes text DEFAULT '',
  p_permissions jsonb DEFAULT '[]'::jsonb,
  p_is_admin boolean DEFAULT false,
  p_read_only boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_email text;
  v_encrypted_pw text;
  v_admin_count int;
  v_clean_username text;
  v_clean_name text;
BEGIN
  -- 3.1 Verifica se quem está chamando é admin
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar usuários.';
  END IF;

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não informado para atualização.';
  END IF;

  v_clean_name := trim(p_name);
  v_clean_username := lower(trim(p_username));

  IF v_clean_name IS NULL OR length(v_clean_name) = 0 THEN
    RAISE EXCEPTION 'Informe o nome do usuário.';
  END IF;

  IF v_clean_username IS NULL OR length(v_clean_username) = 0 THEN
    RAISE EXCEPTION 'Informe o nome de usuário (login).';
  END IF;

  v_email := v_clean_username || '@sumel.local';

  -- 3.2 Não permite remover privilégios do único administrador
  IF NOT p_is_admin AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_id AND role = 'admin') THEN
    SELECT count(*) INTO v_admin_count FROM public.user_roles WHERE role = 'admin';
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'Não é possível remover os privilégios do único administrador.';
    END IF;
  END IF;

  -- 3.3 Verifica se outro usuário já possui esse login
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = v_clean_username AND id != p_id) THEN
    RAISE EXCEPTION 'Já existe outro usuário com esse login.';
  END IF;

  -- 3.4 Atualiza auth.users (com ou sem nova senha)
  IF p_password IS NOT NULL AND length(trim(p_password)) > 0 THEN
    IF length(p_password) < 6 THEN
      RAISE EXCEPTION 'A nova senha deve ter ao menos 6 caracteres.';
    END IF;
    v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf', 10));
    UPDATE auth.users
    SET email = v_email,
        encrypted_password = v_encrypted_pw,
        raw_user_meta_data = jsonb_build_object('name', v_clean_name, 'username', v_clean_username),
        updated_at = now()
    WHERE id = p_id;
  ELSE
    UPDATE auth.users
    SET email = v_email,
        raw_user_meta_data = jsonb_build_object('name', v_clean_name, 'username', v_clean_username),
        updated_at = now()
    WHERE id = p_id;
  END IF;

  -- 3.5 Atualiza auth.identities
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'provider_id'
  ) THEN
    EXECUTE 'UPDATE auth.identities SET provider_id = $1, identity_data = $2, updated_at = now() WHERE user_id = $3 AND provider = ''email'''
    USING v_email, jsonb_build_object('sub', p_id::text, 'email', v_email), p_id;
  ELSE
    EXECUTE 'UPDATE auth.identities SET identity_data = $1, updated_at = now() WHERE user_id = $2 AND provider = ''email'''
    USING jsonb_build_object('sub', p_id::text, 'email', v_email), p_id;
  END IF;

  -- 3.6 Atualiza public.profiles
  UPDATE public.profiles
  SET name = v_clean_name,
      username = v_clean_username,
      status = coalesce(p_status, 'ativo'),
      notes = coalesce(trim(p_notes), ''),
      permissions = coalesce(p_permissions, '[]'::jsonb),
      read_only = coalesce(p_read_only, false),
      updated_at = now()
  WHERE id = p_id;

  -- 3.7 Atualiza public.user_roles
  DELETE FROM public.user_roles WHERE user_id = p_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_id, CASE WHEN p_is_admin THEN 'admin'::public.app_role ELSE 'user'::public.app_role END);

  RETURN jsonb_build_object('ok', true, 'id', p_id);
END;
$$;


-- 4. FUNÇÃO: admin_delete_user
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_admin_count int;
BEGIN
  -- 4.1 Verifica se quem está chamando é admin
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem excluir usuários.';
  END IF;

  -- 4.2 Impede auto-exclusão
  IF p_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir sua própria conta.';
  END IF;

  -- 4.3 Impede exclusão do único admin
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_id AND role = 'admin') THEN
    SELECT count(*) INTO v_admin_count FROM public.user_roles WHERE role = 'admin';
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'Não é possível excluir o único administrador.';
    END IF;
  END IF;

  -- 4.4 Exclusão atômica (auth.users cascata para profiles e user_roles)
  DELETE FROM auth.users WHERE id = p_id;
  DELETE FROM public.profiles WHERE id = p_id;
  DELETE FROM public.user_roles WHERE user_id = p_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;


-- 5. PERMISSÕES DE EXECUÇÃO (GRANT / REVOKE)
REVOKE ALL ON FUNCTION public.admin_create_user(text, text, text, text, text, jsonb, boolean, boolean) FROM public;
REVOKE ALL ON FUNCTION public.admin_create_user(text, text, text, text, text, jsonb, boolean, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, text, jsonb, boolean, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_user(uuid, text, text, text, text, text, jsonb, boolean, boolean) FROM public;
REVOKE ALL ON FUNCTION public.admin_update_user(uuid, text, text, text, text, text, jsonb, boolean, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user(uuid, text, text, text, text, text, jsonb, boolean, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM public;
REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
