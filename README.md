# NOWHERE — Timeline

Gantt interactivo conectado a Todoist. Lee todos los proyectos y tareas, permite mover fechas arrastrando las barras y sincroniza con Todoist en tiempo real.

## Deploy en Vercel

1. Sube este repo a GitHub
2. Ve a vercel.com → Add New Project → importa el repo
3. Framework preset: **Vite**
4. Deploy

No hace falta configurar variables de entorno. El token de Todoist lo introduces en la app al entrar.

## Desarrollo local

```bash
npm install
npm run dev
```

## Estructura

```
/api/todoist.js     → Proxy serverless (evita CORS)
/src/App.jsx        → App principal
/src/main.jsx       → Entry point
/index.html         → HTML base
/vercel.json        → Config de rutas Vercel
```
