-- =====================================================================
--  QUINIELA LIGUILLA · Datos de prueba (opcional)
--
--  Crea "Liguilla Demo" con 8 jugadores ficticios, partidos de cuartos
--  y semis (unos jugados, uno en juego y dos por jugar), pagos variados
--  y un empate a propósito en "Cuartos – ida" para ver el reparto.
--  Las bolsas de cuartos quedan cerradas para que veas el Historial.
--
--  Para quitarlo: en la app, Admin › Grupo › "Borrar datos de prueba",
--  o corre 03_borrar_prueba.sql.
-- =====================================================================
do $$
declare
  t    uuid;
  base timestamptz := date_trunc('hour', now());
begin
  if exists (select 1 from public.torneos where es_prueba) then
    raise notice 'Ya existen datos de prueba; no se vuelven a crear.';
    return;
  end if;

  insert into public.torneos (nombre, activo, es_prueba)
  values ('Liguilla Demo', not exists (select 1 from public.torneos where activo), true)
  returning id into t;
  perform privado.crear_bolsas(t);

  insert into public.jugadores (apodo, es_prueba)
  select x, true
    from unnest(array['Toño (demo)', 'Lupita (demo)', 'Memo (demo)', 'Paty (demo)',
                      'Chuy (demo)', 'Rosy (demo)', 'Beto (demo)', 'Nena (demo)']) as x
  on conflict do nothing;

  create temp table _demo_partidos on commit drop as
  select gen_random_uuid() as id, v.*
    from (values
      ( 1, 'cuartos', 'ida',    'PAC', 'TOL', base - interval '9 days',                      1, 2),
      ( 2, 'cuartos', 'ida',    'PUM', 'AME', base - interval '9 days' + interval '2 hours', 0, 0),
      ( 3, 'cuartos', 'ida',    'MTY', 'CAZ', base - interval '8 days',                      2, 1),
      ( 4, 'cuartos', 'ida',    'CHI', 'TIG', base - interval '8 days' + interval '2 hours', 1, 1),
      ( 5, 'cuartos', 'vuelta', 'TOL', 'PAC', base - interval '6 days',                      2, 0),
      ( 6, 'cuartos', 'vuelta', 'AME', 'PUM', base - interval '6 days' + interval '2 hours', 3, 1),
      ( 7, 'cuartos', 'vuelta', 'CAZ', 'MTY', base - interval '5 days',                      2, 0),
      ( 8, 'cuartos', 'vuelta', 'TIG', 'CHI', base - interval '5 days' + interval '2 hours', 2, 1),
      ( 9, 'semis',   'ida',    'TIG', 'TOL', base - interval '1 day',                       1, 1),
      (10, 'semis',   'ida',    'CAZ', 'AME', now() - interval '90 minutes',                 null, null),
      (11, 'semis',   'vuelta', 'TOL', 'TIG', base + interval '2 days',                      null, null),
      (12, 'semis',   'vuelta', 'AME', 'CAZ', base + interval '2 days' + interval '2 hours', null, null)
    ) as v(n, fase, iv, loc, vis, ini, gl, gv);

  insert into public.partidos (id, torneo_id, fase, ida_vuelta, local, visitante, inicio, goles_local, goles_visitante)
  select id, t, fase, iv, loc, vis, ini, gl, gv from _demo_partidos;

  -- Un renglón por jugador; cada marcador es un partido (en orden 1..12). x = no pronosticó
  insert into public.pronosticos (partido_id, jugador_id, goles_local, goles_visitante, actualizado_en)
  select p.id, j.id,
         split_part(x.marcador, '-', 1)::int,
         split_part(x.marcador, '-', 2)::int,
         least(p.ini - interval '3 hours', now() - interval '1 hour')
    from (values
      ('Toño (demo)',   '1-2 1-1 2-0 1-1  1-0 1-1 1-1 2-0  1-1 1-2  2-1 1-1'),
      ('Lupita (demo)', '0-1 0-0 2-1 2-2  2-1 2-1 0-1 1-1  2-1 0-1  1-0 2-1'),
      ('Memo (demo)',   '1-1 1-0 2-1 0-0  2-0 3-1 1-0 2-1  0-0 1-1  2-0 x'),
      ('Paty (demo)',   '2-1 0-0 1-1 1-2  3-0 2-0 2-0 1-2  1-2 2-1  x   0-1'),
      ('Chuy (demo)',   '0-2 2-1 3-1 1-0  1-1 3-1 2-1 0-1  1-1 0-2  1-1 2-0'),
      ('Rosy (demo)',   '1-3 1-1 1-0 0-1  2-0 1-2 1-1 2-1  2-2 1-0  x   x'),
      ('Beto (demo)',   '2-2 0-1 2-2 1-1  0-1 2-2 2-0 3-1  0-1 2-2  3-1 1-2'),
      ('Nena (demo)',   '1-2 2-0 0-1 2-1  1-0 1-0 0-0 1-1  1-0 1-1  x   x')
    ) as s(apodo, linea)
   cross join lateral regexp_split_to_table(btrim(s.linea), '\s+') with ordinality as x(marcador, n)
    join _demo_partidos p on p.n = x.n
    join public.jugadores j on j.apodo = s.apodo
   where x.marcador <> 'x';

  -- Quién pagó cada bolsa (orden: 1 C. ida, 2 C. vuelta, 3 Semis, 4 Final, 5 General)
  insert into public.pagos (bolsa_id, jugador_id)
  select b.id, j.id
    from public.bolsas b
    join (values
      (1, array['Toño', 'Lupita', 'Memo', 'Paty', 'Chuy', 'Rosy', 'Beto', 'Nena']),
      (2, array['Toño', 'Lupita', 'Memo', 'Paty', 'Chuy', 'Rosy', 'Beto']),
      (3, array['Toño', 'Lupita', 'Memo', 'Paty', 'Chuy', 'Rosy']),
      (4, array['Toño', 'Memo', 'Rosy']),
      (5, array['Toño', 'Lupita', 'Memo', 'Paty', 'Chuy', 'Rosy', 'Nena'])
    ) as v(orden, quienes) on v.orden = b.orden
    join public.jugadores j on j.apodo in (select q || ' (demo)' from unnest(v.quienes) as q)
   where b.torneo_id = t;

  -- Cuartos ya terminaron: se cierran y quedan en el Historial
  perform privado.cerrar_bolsa(b.id) from public.bolsas b where b.torneo_id = t and b.orden in (1, 2);
end $$;
