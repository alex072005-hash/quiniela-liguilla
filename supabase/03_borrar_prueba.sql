-- =====================================================================
--  QUINIELA LIGUILLA · Borrar datos de prueba
--  (Lo mismo que el botón Admin › Grupo › "Borrar datos de prueba")
-- =====================================================================
delete from public.torneos   where es_prueba;  -- borra también sus partidos, bolsas, pagos e historial
delete from public.jugadores where es_prueba;  -- borra también sus pronósticos
