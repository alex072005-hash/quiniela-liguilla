-- =====================================================================
--  QUINIELA LIGUILLA · Instalación de la base de datos (Supabase)
--
--  Cómo usarlo: Supabase › SQL Editor › New query › pega TODO este
--  archivo › Run.  Se puede volver a correr sin perder datos: solo
--  actualiza funciones, vistas y permisos.
--
--  Cómo funciona el acceso (pensado para un grupo familiar):
--   · Cada quien entra con su número de celular + un NIP de 4 dígitos.
--   · Todos pueden VER partidos, tablas, pagos e historial.
--   · Los pronósticos de los demás solo se ven cuando el partido empieza.
--   · Nadie escribe directo en las tablas: todo pasa por funciones que
--     validan la sesión y la hora del servidor (ej. el cierre al inicio).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists privado;
revoke all on schema privado from public;

-- ---------------------------------------------------------------------
-- 1. Tablas públicas (lectura para todos; escritura solo por funciones)
-- ---------------------------------------------------------------------
create table if not exists public.jugadores (
  id         uuid primary key default gen_random_uuid(),
  apodo      text not null check (char_length(apodo) between 2 and 20),
  es_admin   boolean not null default false,
  activo     boolean not null default true,
  es_prueba  boolean not null default false,
  creado_en  timestamptz not null default now()
);
create unique index if not exists jugadores_apodo_unico on public.jugadores (lower(apodo));

create table if not exists public.equipos (
  id      text primary key check (id ~ '^[A-Z0-9]{2,4}$'),
  nombre  text not null unique check (char_length(nombre) between 2 and 30),
  color   text not null default '#26352d' check (color ~ '^#[0-9a-fA-F]{6}$'),
  texto   text not null default '#ffffff' check (texto ~ '^#[0-9a-fA-F]{6}$')
);

create table if not exists public.torneos (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null check (char_length(nombre) between 2 and 60),
  activo     boolean not null default false,
  es_prueba  boolean not null default false,
  creado_en  timestamptz not null default now()
);
create unique index if not exists torneos_un_activo on public.torneos (activo) where activo;

create table if not exists public.partidos (
  id               uuid primary key default gen_random_uuid(),
  torneo_id        uuid not null references public.torneos(id) on delete cascade,
  fase             text not null check (fase in ('cuartos', 'semis', 'final')),
  ida_vuelta       text not null check (ida_vuelta in ('ida', 'vuelta')),
  local            text not null references public.equipos(id),
  visitante        text not null references public.equipos(id),
  inicio           timestamptz not null,
  goles_local      smallint check (goles_local between 0 and 30),
  goles_visitante  smallint check (goles_visitante between 0 and 30),
  constraint partidos_equipos_distintos check (local <> visitante),
  constraint partidos_resultado_completo check ((goles_local is null) = (goles_visitante is null))
);
create index if not exists partidos_torneo on public.partidos (torneo_id, inicio);

create table if not exists public.pronosticos (
  partido_id       uuid not null references public.partidos(id) on delete cascade,
  jugador_id       uuid not null references public.jugadores(id) on delete cascade,
  goles_local      smallint not null check (goles_local between 0 and 30),
  goles_visitante  smallint not null check (goles_visitante between 0 and 30),
  actualizado_en   timestamptz not null default now(),
  primary key (partido_id, jugador_id)
);
create index if not exists pronosticos_jugador on public.pronosticos (jugador_id);

-- fase / ida_vuelta vacíos = la bolsa cuenta todos esos partidos
create table if not exists public.bolsas (
  id          uuid primary key default gen_random_uuid(),
  torneo_id   uuid not null references public.torneos(id) on delete cascade,
  nombre      text not null,
  corto       text not null,
  monto       numeric(10,2) not null default 30 check (monto >= 0),
  fase        text check (fase in ('cuartos', 'semis', 'final')),
  ida_vuelta  text check (ida_vuelta in ('ida', 'vuelta')),
  orden       smallint not null default 0,
  cerrada_en  timestamptz
);
create index if not exists bolsas_torneo on public.bolsas (torneo_id, orden);

-- Si existe la fila, ese jugador pagó (y compite por) esa bolsa
create table if not exists public.pagos (
  bolsa_id    uuid not null references public.bolsas(id) on delete cascade,
  jugador_id  uuid not null references public.jugadores(id) on delete cascade,
  pagado_en   timestamptz not null default now(),
  primary key (bolsa_id, jugador_id)
);
create index if not exists pagos_jugador on public.pagos (jugador_id);

-- Foto de la tabla final de cada bolsa al cerrarla
create table if not exists public.historial (
  bolsa_id    uuid not null references public.bolsas(id) on delete cascade,
  jugador_id  uuid not null references public.jugadores(id) on delete cascade,
  posicion    smallint,               -- vacío = no compitió (no pagó)
  apodo       text not null,
  puntos      int not null,
  exactos     int not null,
  aciertos    int not null,
  pagado      boolean not null,
  premio      numeric(10,2) not null default 0,
  primary key (bolsa_id, jugador_id)
);
create index if not exists historial_jugador on public.historial (jugador_id);

-- ---------------------------------------------------------------------
-- 2. Tablas privadas (no se pueden leer desde la página)
-- ---------------------------------------------------------------------
create table if not exists privado.ajustes (
  id            int primary key default 1 check (id = 1),
  nombre_grupo  text not null default 'Quiniela familiar',
  codigo_grupo  text not null
);
insert into privado.ajustes (id, codigo_grupo)
values (1, 'LIGA-' || upper(substr(md5(random()::text), 1, 4)))
on conflict (id) do nothing;

create table if not exists privado.credenciales (
  jugador_id       uuid primary key references public.jugadores(id) on delete cascade,
  telefono         text not null unique check (telefono ~ '^[0-9]{10}$'),
  nip_hash         text not null,
  intentos         int not null default 0,
  bloqueado_hasta  timestamptz
);

create table if not exists privado.sesiones (
  token       text primary key,
  jugador_id  uuid not null references public.jugadores(id) on delete cascade,
  creada_en   timestamptz not null default now(),
  usada_en    timestamptz not null default now()
);
create index if not exists sesiones_jugador on privado.sesiones (jugador_id);

alter table privado.ajustes      enable row level security;
alter table privado.credenciales enable row level security;
alter table privado.sesiones     enable row level security;

-- ---------------------------------------------------------------------
-- 3. Reglas del juego
-- ---------------------------------------------------------------------
-- 4 = marcador exacto · 3 = solo resultado · 0 = falló · null = sin resultado
create or replace function public.calc_puntos(pl int, pv int, rl int, rv int)
returns int language sql immutable set search_path = '' as $$
  select case
    when pl is null or pv is null or rl is null or rv is null then null
    when pl = rl and pv = rv then 4
    when sign(pl - pv) = sign(rl - rv) then 3
    else 0
  end
$$;

-- ¿El partido (fase, ida/vuelta) cuenta para la bolsa (fase, ida/vuelta)?
create or replace function public.en_bolsa(p_fase text, p_iv text, b_fase text, b_iv text)
returns boolean language sql immutable set search_path = '' as $$
  select (b_fase is null or b_fase = p_fase) and (b_iv is null or b_iv = p_iv)
$$;

-- ---------------------------------------------------------------------
-- 4. Vistas (se calculan solas; si cambias un resultado, todo se ajusta)
-- ---------------------------------------------------------------------
drop view if exists public.v_historial;
drop view if exists public.v_tabla;
drop view if exists public.v_bolsas;
drop view if exists public.v_pronosticos;

-- Pronósticos visibles (solo de partidos que ya empezaron) con sus puntos
create view public.v_pronosticos with (security_invoker = true) as
select pr.partido_id, p.torneo_id, pr.jugador_id, j.apodo,
       pr.goles_local, pr.goles_visitante, pr.actualizado_en,
       public.calc_puntos(pr.goles_local, pr.goles_visitante, p.goles_local, p.goles_visitante) as puntos
  from public.pronosticos pr
  join public.partidos p on p.id = pr.partido_id
  join public.jugadores j on j.id = pr.jugador_id
 where p.inicio <= now();

-- Resumen de cada bolsa: pagados, total y avance
create view public.v_bolsas with (security_invoker = true) as
select b.id, b.torneo_id, b.nombre, b.corto, b.monto, b.fase, b.ida_vuelta, b.orden, b.cerrada_en,
       coalesce(pg.n, 0)::int                       as pagados,
       (coalesce(pg.n, 0) * b.monto)::numeric(10,2) as total,
       coalesce(pa.total, 0)::int                   as partidos_total,
       coalesce(pa.jugados, 0)::int                 as partidos_jugados
  from public.bolsas b
  left join lateral (
    select count(*) as n from public.pagos x where x.bolsa_id = b.id
  ) pg on true
  left join lateral (
    select count(*) as total,
           count(*) filter (where p.goles_local is not null) as jugados
      from public.partidos p
     where p.torneo_id = b.torneo_id
       and public.en_bolsa(p.fase, p.ida_vuelta, b.fase, b.ida_vuelta)
  ) pa on true;

-- Tabla de posiciones de cada bolsa (empates comparten lugar y premio)
create view public.v_tabla with (security_invoker = true) as
with base as (
  select b.id as bolsa_id, b.torneo_id, b.monto, j.id as jugador_id, j.apodo, j.es_prueba,
         exists (select 1 from public.pagos x
                  where x.bolsa_id = b.id and x.jugador_id = j.id) as pagado
    from public.bolsas b
   cross join public.jugadores j
   where j.activo
      or exists (select 1 from public.pagos x where x.bolsa_id = b.id and x.jugador_id = j.id)
),
pts as (
  select b.id as bolsa_id, pr.jugador_id,
         count(*)::int as pronosticados,
         sum(public.calc_puntos(pr.goles_local, pr.goles_visitante, p.goles_local, p.goles_visitante))::int as puntos,
         count(*) filter (where public.calc_puntos(pr.goles_local, pr.goles_visitante, p.goles_local, p.goles_visitante) = 4)::int as exactos,
         count(*) filter (where public.calc_puntos(pr.goles_local, pr.goles_visitante, p.goles_local, p.goles_visitante) = 3)::int as aciertos
    from public.bolsas b
    join public.partidos p on p.torneo_id = b.torneo_id
                          and public.en_bolsa(p.fase, p.ida_vuelta, b.fase, b.ida_vuelta)
                          and p.goles_local is not null
    join public.pronosticos pr on pr.partido_id = p.id
   group by b.id, pr.jugador_id
),
t as (
  select base.*,
         coalesce(pts.puntos, 0)        as puntos,
         coalesce(pts.exactos, 0)       as exactos,
         coalesce(pts.aciertos, 0)      as aciertos,
         coalesce(pts.pronosticados, 0) as pronosticados
    from base
    left join pts using (bolsa_id, jugador_id)
),
r as (
  select t.*,
         case when pagado then rank() over (partition by bolsa_id, pagado order by puntos desc) end as posicion,
         count(*) filter (where pagado) over (partition by bolsa_id) as pagados
    from t
),
l as (
  select r.*, count(*) filter (where posicion = 1) over (partition by bolsa_id) as lideres
    from r
)
select bolsa_id, torneo_id, jugador_id, apodo, es_prueba, pagado,
       puntos, exactos, aciertos, pronosticados,
       posicion::int as posicion,
       (case when posicion = 1 and lideres > 0
             then round(monto * pagados / lideres, 2)
             else 0 end)::numeric(10,2) as premio
  from l;

-- Historial con los datos de su bolsa
create view public.v_historial with (security_invoker = true) as
select h.bolsa_id, b.torneo_id, b.nombre as bolsa, b.corto, b.orden, b.monto, b.cerrada_en,
       h.jugador_id, h.apodo, h.posicion, h.puntos, h.exactos, h.aciertos, h.pagado, h.premio
  from public.historial h
  join public.bolsas b on b.id = h.bolsa_id;

-- ---------------------------------------------------------------------
-- 5. Funciones internas
-- ---------------------------------------------------------------------
create or replace function privado.normalizar_telefono(p text)
returns text language sql immutable set search_path = '' as $$
  select case when char_length(d) >= 10 then right(d, 10) end
    from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) x
$$;

create or replace function privado.limpiar_apodo(p text)
returns text language sql immutable set search_path = '' as $$
  select case when char_length(a) between 2 and 20 then a end
    from (select regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g') as a) x
$$;

create or replace function privado.sesion(p_token text)
returns uuid language plpgsql set search_path = '' as $$
declare v_id uuid;
begin
  select s.jugador_id into v_id
    from privado.sesiones s
    join public.jugadores j on j.id = s.jugador_id
   where s.token = p_token and j.activo;
  if v_id is null then
    raise exception 'SESION_INVALIDA';
  end if;
  update privado.sesiones set usada_en = now()
   where token = p_token and usada_en < now() - interval '1 hour';
  return v_id;
end $$;

create or replace function privado.admin(p_token text)
returns uuid language plpgsql set search_path = '' as $$
declare v_id uuid := privado.sesion(p_token);
begin
  if not exists (select 1 from public.jugadores where id = v_id and es_admin) then
    raise exception 'NO_AUTORIZADO';
  end if;
  return v_id;
end $$;

create or replace function privado.nueva_sesion(p_jugador uuid)
returns text language plpgsql set search_path = '' as $$
declare v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  insert into privado.sesiones (token, jugador_id) values (v_token, p_jugador);
  return v_token;
end $$;

create or replace function privado.torneo_activo()
returns uuid language sql stable set search_path = '' as $$
  select id from public.torneos where activo limit 1
$$;

create or replace function privado.crear_bolsas(p_torneo uuid)
returns void language sql set search_path = '' as $$
  insert into public.bolsas (torneo_id, nombre, corto, monto, fase, ida_vuelta, orden) values
    (p_torneo, 'Cuartos – ida',    'C. ida',    30,  'cuartos', 'ida',    1),
    (p_torneo, 'Cuartos – vuelta', 'C. vuelta', 30,  'cuartos', 'vuelta', 2),
    (p_torneo, 'Semifinales',      'Semis',     30,  'semis',   null,     3),
    (p_torneo, 'Final',            'Final',     30,  'final',   null,     4),
    (p_torneo, 'General',          'General',   100, null,      null,     5);
$$;

create or replace function privado.hay_bolsa_cerrada(p_torneo uuid, p_fase text, p_iv text)
returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from public.bolsas b
                  where b.torneo_id = p_torneo and b.cerrada_en is not null
                    and public.en_bolsa(p_fase, p_iv, b.fase, b.ida_vuelta))
$$;

create or replace function privado.cerrar_bolsa(p_bolsa uuid)
returns void language plpgsql set search_path = '' as $$
declare v_total int; v_jugados int;
begin
  select partidos_total, partidos_jugados into v_total, v_jugados
    from public.v_bolsas where id = p_bolsa;
  if v_total is null then raise exception 'BOLSA_NO_EXISTE'; end if;
  if v_total = 0 then raise exception 'BOLSA_SIN_PARTIDOS'; end if;
  if v_jugados < v_total then raise exception 'FALTAN_RESULTADOS'; end if;
  delete from public.historial where bolsa_id = p_bolsa;
  insert into public.historial (bolsa_id, jugador_id, posicion, apodo, puntos, exactos, aciertos, pagado, premio)
  select bolsa_id, jugador_id, posicion, apodo, puntos, exactos, aciertos, pagado, premio
    from public.v_tabla
   where bolsa_id = p_bolsa and (pagado or pronosticados > 0);
  update public.bolsas set cerrada_en = now() where id = p_bolsa;
end $$;

revoke all on all functions in schema privado from public;

-- ---------------------------------------------------------------------
-- 6. API para la página (funciones que se llaman desde el celular)
-- ---------------------------------------------------------------------
create or replace function public.info_grupo()
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
           'nombre', a.nombre_grupo,
           'hay_admin', exists (select 1 from public.jugadores where es_admin))
    from privado.ajustes a where a.id = 1
$$;

create or replace function public.registrar(p_codigo text, p_telefono text, p_nip text, p_apodo text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_tel       text := privado.normalizar_telefono(p_telefono);
  v_apodo     text := privado.limpiar_apodo(p_apodo);
  v_hay_admin boolean := exists (select 1 from public.jugadores where es_admin);
  v_id        uuid;
begin
  -- El primer registro (cuando aún no hay admin) no pide código y queda como admin
  if v_hay_admin and not exists (
       select 1 from privado.ajustes
        where upper(btrim(codigo_grupo)) = upper(btrim(coalesce(p_codigo, '')))) then
    raise exception 'CODIGO_INVALIDO';
  end if;
  if v_apodo is null then raise exception 'APODO_INVALIDO'; end if;
  if v_tel is null then raise exception 'TELEFONO_INVALIDO'; end if;
  if coalesce(p_nip, '') !~ '^[0-9]{4}$' then raise exception 'NIP_INVALIDO'; end if;
  if exists (select 1 from privado.credenciales where telefono = v_tel) then
    raise exception 'TELEFONO_YA_REGISTRADO';
  end if;
  if exists (select 1 from public.jugadores where lower(apodo) = lower(v_apodo)) then
    raise exception 'APODO_OCUPADO';
  end if;

  insert into public.jugadores (apodo, es_admin) values (v_apodo, not v_hay_admin)
  returning id into v_id;
  insert into privado.credenciales (jugador_id, telefono, nip_hash)
  values (v_id, v_tel, extensions.crypt(p_nip, extensions.gen_salt('bf')));

  return json_build_object(
    'token', privado.nueva_sesion(v_id),
    'jugador', json_build_object('id', v_id, 'apodo', v_apodo, 'es_admin', not v_hay_admin));
end $$;

-- Devuelve {error: ...} en vez de lanzar error para que el contador de
-- intentos fallidos sí se guarde.
create or replace function public.entrar(p_telefono text, p_nip text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_tel text := privado.normalizar_telefono(p_telefono);
  c privado.credenciales%rowtype;
  j public.jugadores%rowtype;
begin
  if v_tel is null then
    return json_build_object('error', 'TELEFONO_INVALIDO');
  end if;
  select * into c from privado.credenciales where telefono = v_tel;
  if not found then
    return json_build_object('error', 'TELEFONO_NO_REGISTRADO');
  end if;
  if c.bloqueado_hasta is not null and c.bloqueado_hasta > now() then
    return json_build_object('error', 'DEMASIADOS_INTENTOS');
  end if;
  if c.nip_hash <> extensions.crypt(coalesce(p_nip, ''), c.nip_hash) then
    update privado.credenciales
       set intentos        = case when intentos + 1 >= 5 then 0 else intentos + 1 end,
           bloqueado_hasta = case when intentos + 1 >= 5 then now() + interval '5 minutes' end
     where jugador_id = c.jugador_id;
    return json_build_object('error', 'NIP_INCORRECTO');
  end if;
  select * into j from public.jugadores where id = c.jugador_id;
  if not j.activo then
    return json_build_object('error', 'CUENTA_DESACTIVADA');
  end if;
  update privado.credenciales set intentos = 0, bloqueado_hasta = null where jugador_id = j.id;
  return json_build_object(
    'token', privado.nueva_sesion(j.id),
    'jugador', json_build_object('id', j.id, 'apodo', j.apodo, 'es_admin', j.es_admin));
end $$;

create or replace function public.salir(p_token text)
returns json language plpgsql security definer set search_path = '' as $$
begin
  delete from privado.sesiones where token = p_token;
  return json_build_object('ok', true);
end $$;

create or replace function public.yo(p_token text)
returns json language plpgsql security definer set search_path = '' as $$
declare j public.jugadores%rowtype;
begin
  select pj.* into j
    from privado.sesiones s
    join public.jugadores pj on pj.id = s.jugador_id
   where s.token = p_token and pj.activo;
  if not found then
    return null;
  end if;
  update privado.sesiones set usada_en = now()
   where token = p_token and usada_en < now() - interval '1 hour';
  return json_build_object('id', j.id, 'apodo', j.apodo, 'es_admin', j.es_admin);
end $$;

create or replace function public.mis_pronosticos(p_token text, p_torneo uuid)
returns json language plpgsql security definer set search_path = '' as $$
declare v_j uuid := privado.sesion(p_token);
begin
  return coalesce((
    select json_agg(json_build_object(
             'partido_id', pr.partido_id,
             'goles_local', pr.goles_local,
             'goles_visitante', pr.goles_visitante,
             'actualizado_en', pr.actualizado_en))
      from public.pronosticos pr
      join public.partidos p on p.id = pr.partido_id
     where pr.jugador_id = v_j and p.torneo_id = p_torneo), '[]'::json);
end $$;

create or replace function public.guardar_pronostico(p_token text, p_partido uuid, p_local int, p_visitante int)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_j      uuid := privado.sesion(p_token);
  v_inicio timestamptz;
begin
  select inicio into v_inicio from public.partidos where id = p_partido;
  if v_inicio is null then raise exception 'PARTIDO_NO_EXISTE'; end if;
  -- El candado: se valida con la hora del servidor, no la del celular
  if now() >= v_inicio then raise exception 'PARTIDO_CERRADO'; end if;
  if p_local is null or p_visitante is null
     or p_local not between 0 and 20 or p_visitante not between 0 and 20 then
    raise exception 'MARCADOR_INVALIDO';
  end if;
  insert into public.pronosticos (partido_id, jugador_id, goles_local, goles_visitante, actualizado_en)
  values (p_partido, v_j, p_local, p_visitante, now())
  on conflict (partido_id, jugador_id) do update
     set goles_local     = excluded.goles_local,
         goles_visitante = excluded.goles_visitante,
         actualizado_en  = now();
  return json_build_object('ok', true);
end $$;

-- Quién ya pronosticó un partido (sin revelar marcadores)
create or replace function public.quien_pronostico(p_partido uuid)
returns json language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(json_build_object('jugador_id', j.id, 'apodo', j.apodo, 'ya', x.ya)
                           order by x.ya desc, lower(j.apodo)), '[]'::json)
    from public.jugadores j
   cross join lateral (
     select exists (select 1 from public.pronosticos pr
                     where pr.partido_id = p_partido and pr.jugador_id = j.id) as ya
   ) x
   where j.activo
$$;

create or replace function public.cambiar_apodo(p_token text, p_apodo text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_j     uuid := privado.sesion(p_token);
  v_apodo text := privado.limpiar_apodo(p_apodo);
begin
  if v_apodo is null then raise exception 'APODO_INVALIDO'; end if;
  if exists (select 1 from public.jugadores where lower(apodo) = lower(v_apodo) and id <> v_j) then
    raise exception 'APODO_OCUPADO';
  end if;
  update public.jugadores set apodo = v_apodo where id = v_j;
  return json_build_object('ok', true, 'apodo', v_apodo);
end $$;

create or replace function public.cambiar_nip(p_token text, p_actual text, p_nuevo text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_j    uuid := privado.sesion(p_token);
  v_hash text;
begin
  select nip_hash into v_hash from privado.credenciales where jugador_id = v_j;
  if v_hash is null then raise exception 'SIN_CREDENCIALES'; end if;
  if v_hash <> extensions.crypt(coalesce(p_actual, ''), v_hash) then raise exception 'NIP_ACTUAL_INCORRECTO'; end if;
  if coalesce(p_nuevo, '') !~ '^[0-9]{4}$' then raise exception 'NIP_INVALIDO'; end if;
  update privado.credenciales
     set nip_hash = extensions.crypt(p_nuevo, extensions.gen_salt('bf'))
   where jugador_id = v_j;
  return json_build_object('ok', true);
end $$;

-- ---------- Funciones del admin ----------
create or replace function public.admin_datos(p_token text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_a uuid := privado.admin(p_token);
begin
  return json_build_object(
    'grupo', (select json_build_object('nombre', nombre_grupo, 'codigo', codigo_grupo)
                from privado.ajustes where id = 1),
    'jugadores', (select coalesce(json_agg(json_build_object(
                     'id', j.id, 'apodo', j.apodo, 'es_admin', j.es_admin, 'activo', j.activo,
                     'es_prueba', j.es_prueba, 'telefono', c.telefono, 'creado_en', j.creado_en)
                   order by j.es_prueba, lower(j.apodo)), '[]'::json)
                    from public.jugadores j
                    left join privado.credenciales c on c.jugador_id = j.id),
    'torneos', (select coalesce(json_agg(json_build_object(
                   'id', t.id, 'nombre', t.nombre, 'activo', t.activo, 'es_prueba', t.es_prueba)
                 order by t.creado_en desc), '[]'::json)
                  from public.torneos t),
    'prueba', json_build_object(
                'jugadores', (select count(*) from public.jugadores where es_prueba),
                'torneos',   (select count(*) from public.torneos where es_prueba)));
end $$;

-- p_inicio llega como texto 'AAAA-MM-DDTHH:MM' en hora de Monterrey
create or replace function public.admin_guardar_partido(
  p_token text, p_id uuid, p_fase text, p_ida_vuelta text,
  p_local text, p_visitante text, p_inicio text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_a      uuid := privado.admin(p_token);
  v_t      uuid := privado.torneo_activo();
  v_inicio timestamptz;
  v_id     uuid;
  v        public.partidos%rowtype;
begin
  if v_t is null then raise exception 'SIN_TORNEO'; end if;
  if coalesce(p_fase, '') not in ('cuartos', 'semis', 'final')
     or coalesce(p_ida_vuelta, '') not in ('ida', 'vuelta') then
    raise exception 'DATOS_INVALIDOS';
  end if;
  if not exists (select 1 from public.equipos where id = p_local)
     or not exists (select 1 from public.equipos where id = p_visitante) then
    raise exception 'EQUIPO_INVALIDO';
  end if;
  if p_local = p_visitante then raise exception 'EQUIPOS_IGUALES'; end if;
  begin
    v_inicio := (p_inicio::timestamp) at time zone 'America/Monterrey';
  exception when others then
    raise exception 'FECHA_INVALIDA';
  end;
  if v_inicio is null then raise exception 'FECHA_INVALIDA'; end if;
  if privado.hay_bolsa_cerrada(v_t, p_fase, p_ida_vuelta) then raise exception 'BOLSA_CERRADA'; end if;

  if p_id is null then
    insert into public.partidos (torneo_id, fase, ida_vuelta, local, visitante, inicio)
    values (v_t, p_fase, p_ida_vuelta, p_local, p_visitante, v_inicio)
    returning id into v_id;
  else
    select * into v from public.partidos where id = p_id;
    if not found then raise exception 'PARTIDO_NO_EXISTE'; end if;
    if privado.hay_bolsa_cerrada(v.torneo_id, v.fase, v.ida_vuelta) then raise exception 'BOLSA_CERRADA'; end if;
    if v.goles_local is not null and v_inicio > now() then raise exception 'RESULTADO_FUTURO'; end if;
    update public.partidos
       set fase = p_fase, ida_vuelta = p_ida_vuelta, local = p_local,
           visitante = p_visitante, inicio = v_inicio
     where id = p_id
    returning id into v_id;
  end if;
  return json_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.admin_borrar_partido(p_token text, p_id uuid)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_a uuid := privado.admin(p_token);
  v   public.partidos%rowtype;
begin
  select * into v from public.partidos where id = p_id;
  if not found then raise exception 'PARTIDO_NO_EXISTE'; end if;
  if privado.hay_bolsa_cerrada(v.torneo_id, v.fase, v.ida_vuelta) then raise exception 'BOLSA_CERRADA'; end if;
  delete from public.partidos where id = p_id;
  return json_build_object('ok', true);
end $$;

-- Marcador a 90 minutos. Mandar ambos vacíos (null) borra el resultado.
create or replace function public.admin_resultado(p_token text, p_partido uuid, p_local int, p_visitante int)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_a uuid := privado.admin(p_token);
  v   public.partidos%rowtype;
begin
  select * into v from public.partidos where id = p_partido;
  if not found then raise exception 'PARTIDO_NO_EXISTE'; end if;
  if now() < v.inicio then raise exception 'PARTIDO_NO_HA_EMPEZADO'; end if;
  if (p_local is null) <> (p_visitante is null)
     or p_local not between 0 and 30 or p_visitante not between 0 and 30 then
    raise exception 'MARCADOR_INVALIDO';
  end if;
  if privado.hay_bolsa_cerrada(v.torneo_id, v.fase, v.ida_vuelta) then raise exception 'BOLSA_CERRADA'; end if;
  update public.partidos
     set goles_local = p_local, goles_visitante = p_visitante
   where id = p_partido;
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_pago(p_token text, p_bolsa uuid, p_jugador uuid, p_pagado boolean)
returns json language plpgsql security definer set search_path = '' as $$
declare v_a uuid := privado.admin(p_token);
begin
  if not exists (select 1 from public.bolsas where id = p_bolsa) then raise exception 'BOLSA_NO_EXISTE'; end if;
  if exists (select 1 from public.bolsas where id = p_bolsa and cerrada_en is not null) then
    raise exception 'BOLSA_CERRADA';
  end if;
  if p_pagado then
    insert into public.pagos (bolsa_id, jugador_id) values (p_bolsa, p_jugador)
    on conflict do nothing;
  else
    delete from public.pagos where bolsa_id = p_bolsa and jugador_id = p_jugador;
  end if;
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_monto(p_token text, p_bolsa uuid, p_monto numeric)
returns json language plpgsql security definer set search_path = '' as $$
declare v_a uuid := privado.admin(p_token);
begin
  if p_monto is null or p_monto < 0 or p_monto > 100000 then raise exception 'MONTO_INVALIDO'; end if;
  if not exists (select 1 from public.bolsas where id = p_bolsa) then raise exception 'BOLSA_NO_EXISTE'; end if;
  if exists (select 1 from public.bolsas where id = p_bolsa and cerrada_en is not null) then
    raise exception 'BOLSA_CERRADA';
  end if;
  update public.bolsas set monto = round(p_monto, 2) where id = p_bolsa;
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_cerrar_bolsa(p_token text, p_bolsa uuid)
returns json language plpgsql security definer set search_path = '' as $$
declare v_a uuid := privado.admin(p_token);
begin
  perform privado.cerrar_bolsa(p_bolsa);
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_reabrir_bolsa(p_token text, p_bolsa uuid)
returns json language plpgsql security definer set search_path = '' as $$
declare v_a uuid := privado.admin(p_token);
begin
  delete from public.historial where bolsa_id = p_bolsa;
  update public.bolsas set cerrada_en = null where id = p_bolsa;
  if not found then raise exception 'BOLSA_NO_EXISTE'; end if;
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_jugador(
  p_token text, p_jugador uuid, p_apodo text, p_telefono text, p_activo boolean, p_es_admin boolean)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_a     uuid := privado.admin(p_token);
  v_apodo text := privado.limpiar_apodo(p_apodo);
  v_tel   text;
begin
  if not exists (select 1 from public.jugadores where id = p_jugador) then raise exception 'JUGADOR_NO_EXISTE'; end if;
  if v_apodo is null then raise exception 'APODO_INVALIDO'; end if;
  if exists (select 1 from public.jugadores where lower(apodo) = lower(v_apodo) and id <> p_jugador) then
    raise exception 'APODO_OCUPADO';
  end if;
  if p_jugador = v_a and (not coalesce(p_activo, true) or not coalesce(p_es_admin, true)) then
    raise exception 'NO_PUEDES_QUITARTE';
  end if;
  update public.jugadores
     set apodo = v_apodo,
         activo = coalesce(p_activo, activo),
         es_admin = coalesce(p_es_admin, es_admin)
   where id = p_jugador;
  if nullif(btrim(coalesce(p_telefono, '')), '') is not null then
    v_tel := privado.normalizar_telefono(p_telefono);
    if v_tel is null then raise exception 'TELEFONO_INVALIDO'; end if;
    if exists (select 1 from privado.credenciales where telefono = v_tel and jugador_id <> p_jugador) then
      raise exception 'TELEFONO_YA_REGISTRADO';
    end if;
    update privado.credenciales set telefono = v_tel where jugador_id = p_jugador;
  end if;
  if not coalesce(p_activo, true) then
    delete from privado.sesiones where jugador_id = p_jugador;
  end if;
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_nip(p_token text, p_jugador uuid, p_nip text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_a uuid := privado.admin(p_token);
begin
  if coalesce(p_nip, '') !~ '^[0-9]{4}$' then raise exception 'NIP_INVALIDO'; end if;
  update privado.credenciales
     set nip_hash = extensions.crypt(p_nip, extensions.gen_salt('bf')),
         intentos = 0, bloqueado_hasta = null
   where jugador_id = p_jugador;
  if not found then raise exception 'SIN_CREDENCIALES'; end if;
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_grupo(p_token text, p_nombre text, p_codigo text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_a      uuid := privado.admin(p_token);
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_codigo text := upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
begin
  if char_length(v_nombre) not between 2 and 40 then raise exception 'NOMBRE_INVALIDO'; end if;
  if v_codigo !~ '^[A-Z0-9-]{4,20}$' then raise exception 'CODIGO_FORMATO'; end if;
  update privado.ajustes set nombre_grupo = v_nombre, codigo_grupo = v_codigo where id = 1;
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_nuevo_torneo(p_token text, p_nombre text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_a      uuid := privado.admin(p_token);
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_t      uuid;
begin
  if char_length(v_nombre) not between 2 and 60 then raise exception 'NOMBRE_INVALIDO'; end if;
  update public.torneos set activo = false where activo;
  insert into public.torneos (nombre, activo) values (v_nombre, true) returning id into v_t;
  perform privado.crear_bolsas(v_t);
  return json_build_object('ok', true, 'id', v_t);
end $$;

create or replace function public.admin_activar_torneo(p_token text, p_torneo uuid)
returns json language plpgsql security definer set search_path = '' as $$
declare v_a uuid := privado.admin(p_token);
begin
  if not exists (select 1 from public.torneos where id = p_torneo) then raise exception 'TORNEO_NO_EXISTE'; end if;
  update public.torneos set activo = false where activo and id <> p_torneo;
  update public.torneos set activo = true where id = p_torneo;
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_equipo(p_token text, p_id text, p_nombre text, p_color text, p_texto text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_a      uuid := privado.admin(p_token);
  v_id     text := upper(btrim(coalesce(p_id, '')));
  v_nombre text := btrim(coalesce(p_nombre, ''));
begin
  if v_id !~ '^[A-Z0-9]{2,4}$' then raise exception 'EQUIPO_CLAVE'; end if;
  if char_length(v_nombre) not between 2 and 30 then raise exception 'NOMBRE_INVALIDO'; end if;
  if coalesce(p_color, '') !~ '^#[0-9a-fA-F]{6}$' or coalesce(p_texto, '') !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'COLOR_INVALIDO';
  end if;
  if exists (select 1 from public.equipos where lower(nombre) = lower(v_nombre) and id <> v_id) then
    raise exception 'EQUIPO_NOMBRE_OCUPADO';
  end if;
  insert into public.equipos (id, nombre, color, texto) values (v_id, v_nombre, p_color, p_texto)
  on conflict (id) do update set nombre = excluded.nombre, color = excluded.color, texto = excluded.texto;
  return json_build_object('ok', true);
end $$;

-- Borra el torneo y los jugadores de prueba; opcionalmente crea el torneo real
create or replace function public.admin_borrar_prueba(p_token text, p_nuevo_torneo text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_a  uuid := privado.admin(p_token);
  v_t  uuid;
  n_t  int;
  n_j  int;
  v_nombre text := btrim(coalesce(p_nuevo_torneo, ''));
begin
  delete from public.torneos where es_prueba;
  get diagnostics n_t = row_count;
  delete from public.jugadores where es_prueba;
  get diagnostics n_j = row_count;
  if char_length(v_nombre) between 2 and 60 then
    update public.torneos set activo = false where activo;
    insert into public.torneos (nombre, activo) values (v_nombre, true) returning id into v_t;
    perform privado.crear_bolsas(v_t);
  end if;
  return json_build_object('ok', true, 'torneos', n_t, 'jugadores', n_j, 'nuevo_torneo', v_t);
end $$;

-- ---------------------------------------------------------------------
-- 7. Seguridad: lectura pública, escritura solo por las funciones
-- ---------------------------------------------------------------------
alter table public.jugadores   enable row level security;
alter table public.equipos     enable row level security;
alter table public.torneos     enable row level security;
alter table public.partidos    enable row level security;
alter table public.pronosticos enable row level security;
alter table public.bolsas      enable row level security;
alter table public.pagos       enable row level security;
alter table public.historial   enable row level security;

drop policy if exists lectura on public.jugadores;
create policy lectura on public.jugadores for select to anon, authenticated using (true);
drop policy if exists lectura on public.equipos;
create policy lectura on public.equipos for select to anon, authenticated using (true);
drop policy if exists lectura on public.torneos;
create policy lectura on public.torneos for select to anon, authenticated using (true);
drop policy if exists lectura on public.partidos;
create policy lectura on public.partidos for select to anon, authenticated using (true);
drop policy if exists lectura on public.bolsas;
create policy lectura on public.bolsas for select to anon, authenticated using (true);
drop policy if exists lectura on public.pagos;
create policy lectura on public.pagos for select to anon, authenticated using (true);
drop policy if exists lectura on public.historial;
create policy lectura on public.historial for select to anon, authenticated using (true);

-- Los pronósticos ajenos se ven hasta que empieza el partido (hora del servidor)
drop policy if exists lectura on public.pronosticos;
create policy lectura on public.pronosticos for select to anon, authenticated
  using (exists (select 1 from public.partidos p
                  where p.id = pronosticos.partido_id and p.inicio <= now()));

grant usage on schema public to anon, authenticated;
grant select on public.jugadores, public.equipos, public.torneos, public.partidos,
                public.pronosticos, public.bolsas, public.pagos, public.historial,
                public.v_pronosticos, public.v_bolsas, public.v_tabla, public.v_historial
   to anon, authenticated;
revoke insert, update, delete, truncate on
       public.jugadores, public.equipos, public.torneos, public.partidos,
       public.pronosticos, public.bolsas, public.pagos, public.historial
  from anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. Equipos de la Liga MX (se pueden editar desde Admin › Partidos)
-- ---------------------------------------------------------------------
insert into public.equipos (id, nombre, color, texto) values
  ('AME', 'América',    '#FFD100', '#0B1F4D'),
  ('ATL', 'Atlas',      '#141414', '#E4002B'),
  ('ASL', 'San Luis',   '#D3122A', '#FFFFFF'),
  ('CAZ', 'Cruz Azul',  '#0047AB', '#FFFFFF'),
  ('CHI', 'Chivas',     '#FFFFFF', '#C8102E'),
  ('JUA', 'Juárez',     '#8A1538', '#FFFFFF'),
  ('LEO', 'León',       '#00563F', '#FFFFFF'),
  ('MAZ', 'Mazatlán',   '#5B2C83', '#FFFFFF'),
  ('MTY', 'Monterrey',  '#0B2A5B', '#FFFFFF'),
  ('NEC', 'Necaxa',     '#E30613', '#FFFFFF'),
  ('PAC', 'Pachuca',    '#003DA5', '#FFFFFF'),
  ('PUE', 'Puebla',     '#F2F2F2', '#1C3F94'),
  ('QRO', 'Querétaro',  '#1B1B1B', '#4A9FE8'),
  ('SAN', 'Santos',     '#00843D', '#FFFFFF'),
  ('TIJ', 'Tijuana',    '#B5121B', '#111111'),
  ('TOL', 'Toluca',     '#D50032', '#FFFFFF'),
  ('TIG', 'Tigres',     '#FDB913', '#00338D'),
  ('PUM', 'Pumas',      '#001E62', '#C5A100'),
  ('ATE', 'Atlante',    '#0033A0', '#FFFFFF')
on conflict (id) do nothing;

notify pgrst, 'reload schema';
