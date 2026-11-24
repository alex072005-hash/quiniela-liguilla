# Quiniela Liguilla ⚽🏆

Quiniela familiar para la Liguilla de la Liga MX. Cada quien entra con su **número de celular + un NIP de 4 números**, pronostica el marcador de cada partido y la app lleva los puntos, las tablas, las bolsas y el historial. La sesión se queda guardada en el celular.

- **La página** (lo que se publica en GitHub Pages o Hostinger): `index.html`, `manifest.json` y las carpetas `css/`, `js/` e `img/`.
- **La base de datos** (se pega en Supabase): la carpeta `supabase/`.

---

## Paso 1 · Crear el proyecto en Supabase (gratis)

1. Entra a [supabase.com](https://supabase.com) con tu cuenta.
2. **New project** › nombre `quiniela-liguilla` › región **East US (North Virginia)** (la más cercana a Monterrey) › pon una contraseña de base de datos (guárdala) › **Create new project**.
3. Espera 1–2 minutos a que diga que está listo.

> El plan gratis permite 2 proyectos activos a la vez. Si ya tienes 2 activos, pausa uno que no uses.

## Paso 2 · Instalar la base de datos

1. En el menú de la izquierda: **SQL Editor** › **New query**.
2. Abre `supabase/01_instalar.sql` con el Bloc de notas, copia **todo**, pégalo y dale **Run**. Debe decir *Success*.
3. (Opcional, para ver la app con datos) Otra **New query** con todo `supabase/02_datos_prueba.sql` › **Run**. Crea un torneo "Liguilla Demo" con 8 jugadores de prueba.

> `01_instalar.sql` se puede volver a correr cuando quieras: actualiza las funciones sin borrar datos.

## Paso 3 · Conectar la página con Supabase

1. En tu proyecto de Supabase, botón **Connect** (arriba) o **Project Settings › Data API**: copia el **Project URL** (algo como `https://abcdefgh.supabase.co`).
2. **Project Settings › API Keys**: copia la **Publishable key** (empieza con `sb_publishable_`). Si solo ves la llave *anon public*, también sirve.
3. Abre `js/config.js` con el Bloc de notas y pega los dos valores entre las comillas:

```js
SUPABASE_URL: 'https://abcdefgh.supabase.co',
SUPABASE_KEY: 'sb_publishable_xxxxxxxxxxxx',
```

> Esa llave es pública a propósito (va en la página). **Nunca** pegues la *secret key* ni la *service_role*.

## Paso 4 · Probar en tu computadora

Dale doble clic a `index.html` (se abre en Chrome o Edge). Como todavía no hay admin, te pide crear tu cuenta: **la primera cuenta queda como admin**.

## Paso 5 · Publicar la página

### Opción A · GitHub Pages (la que usamos)

La página vive en el repositorio `alex072005-hash/quiniela-liguilla` y GitHub Pages la publica desde la rama `main`:

**https://alex072005-hash.github.io/quiniela-liguilla/**

Cada cambio que se sube a `main` se publica solo en 1–2 minutos. Los celulares pueden tardar un poco más en ver la versión nueva: por eso en `index.html` los archivos llevan `?v=1` (súbelo a `?v=2` cuando cambies algo).

### Opción B · Hostinger

1. hPanel › **Sitios web** › tu sitio › **Administrador de archivos** › entra a `public_html`.
2. Si quieres que quede en `tudominio.com/quiniela`, crea ahí una carpeta `quiniela` y entra a ella (si no, súbelo directo en `public_html`).
3. Sube `index.html`, `manifest.json` y las carpetas `css`, `js` e `img`.
   Tip: comprímelos en un `.zip`, súbelo y usa **Extraer**. La carpeta `supabase` y este README no hace falta subirlos.
4. Abre `https://tudominio.com/quiniela/` en tu celular. Si aún no creaste tu cuenta, créala: quedas como admin.

## Paso 6 · Empezar a jugar

| Qué | Dónde |
|---|---|
| Invitar a la familia (link para WhatsApp) | Admin › **Grupo** |
| Quitar los datos de prueba y crear el torneo real con sus 5 bolsas | Admin › Grupo › **Borrar datos de prueba y empezar** |
| Dar de alta los cruces (día y hora de Monterrey) | Admin › **Partidos** |
| Marcar quién pagó cada bolsa | Admin › **Pagos** |
| Capturar el marcador al minuto 90 | Admin › **Resultados** |
| Cerrar una bolsa al terminar su fase (queda en el Historial) | Admin › **Bolsas** |

---

## Reglas

- Se pronostica el **marcador a 90 minutos** (sin tiempo extra ni penales).
- Se puede cambiar hasta que empieza el partido. A esa hora se cierra con candado: lo valida el servidor con su propia hora, así que cambiar la hora del celular no sirve.
- **4 puntos** marcador exacto · **3 puntos** solo el resultado (gana local, empate o gana visitante) · **0** si falla.
- Los pronósticos de los demás se ven en cuanto empieza el partido.
- 5 bolsas: Cuartos ida ($30), Cuartos vuelta ($30), Semifinales ($30), Final ($30) y General ($100). Los montos se cambian en Admin › Bolsas.
- Solo compite por una bolsa quien la pagó. Empate en puntos = la bolsa se reparte en partes iguales.
- La app **no cobra**: solo lleva la cuenta.

## Preguntas frecuentes

**Alguien olvidó su NIP.** Admin › Jugadores › toca su nombre › escribe un NIP nuevo › *Cambiar NIP*, y díselo.

**Alguien se registró con el número o el nombre mal.** Admin › Jugadores › toca su nombre y corrígelo.

**¿Hay que entrar cada vez?** No. La sesión se queda guardada en ese celular y navegador. Si cambia de celular (o de navegador), entra con su número y NIP.

**Ponerla como app en el celular.** iPhone: en Safari › Compartir › *Agregar a pantalla de inicio*. Android: en Chrome › ⋮ › *Agregar a la pantalla principal*. En iPhone, la primera vez que la abras desde el ícono hay que entrar con número y NIP.

**Me equivoqué en un resultado.** Admin › Resultados › *Corregir*. Los puntos se recalculan solos. Si la bolsa de ese partido ya estaba cerrada, primero reábrela en Admin › Bolsas.

**Supabase se "durmió".** Los proyectos gratis se pausan tras 7 días sin uso. Durante la liguilla no pasa; si pasa, entra a supabase.com, abre el proyecto y dale *Restore*.

**El siguiente torneo (Clausura 2027).** Admin › Grupo › *Nuevo torneo*. El anterior queda en el Historial.

**Escudos de los equipos.** Están en `img/escudos/` como `CLAVE.webp` (ej. `CAZ.webp`). Para agregar uno, guarda el archivo con la clave del equipo y añade esa clave a la lista `ESCUDOS` en `js/ui.js`. Los equipos sin escudo se ven como un círculo con sus siglas.

**Cambié archivos de la página y los celulares no ven el cambio.** En `index.html` cambia todos los `?v=1` por `?v=2` y vuelve a subirlo.

## Cómo está protegida

- Todos pueden **ver** partidos, tablas, pagos e historial; nadie puede escribir directo en la base de datos.
- Todo lo que se guarda pasa por funciones del servidor que revisan la sesión, la hora del partido y si eres admin.
- Los NIP se guardan cifrados; los teléfonos solo los ve el admin. Tras 5 NIP incorrectos, esa cuenta espera 5 minutos.
