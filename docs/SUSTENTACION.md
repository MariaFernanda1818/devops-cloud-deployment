# Guion de sustentación y video

Duración sugerida: 8 a 10 minutos. Integrantes: Carlos Daniel Quintero, Geronimo Valencia Gonzalez, Mariana Duarte Castro, Sofia Salgado Osorio, Maria Fernanda Valencia Noreña.

## 1. Introducción (≈1 min)
- TaskFlow: gestor de tareas en React + TypeScript + Vite, con persistencia en Cloud Firestore.
- Modalidad B (proyecto propio). Plataforma: Firebase + Google Cloud IAM, con CI/CD en GitHub Actions.
- Por qué serverless: no hay API Spring Boot; Firestore y sus reglas de seguridad cumplen ese papel (README §3.3).

## 2. Tres ambientes y tres URLs (≈1,5 min)
Abrir las tres URLs y señalar la insignia y el commit del pie en cada una:

| Ambiente | URL | Qué mostrar |
|---|---|---|
| DEV | https://taskflow-dev-mf1818.web.app | Insignia DEV · `/version.json` |
| QA | https://taskflow-qa-mf1818.web.app | Insignia QA |
| PDN | https://taskflow-prod-mf1818.web.app | Insignia PRODUCCIÓN · crear una tarea, recargar y ver que persiste |

Explicar que cada ambiente es un **proyecto Firebase distinto**, con datos, usuarios y credenciales propios.

## 3. Arquitectura (≈1,5 min)
- Mostrar el diagrama del README §3.1.
- Recorrer el flujo de una petición (§3.2): Hosting → `init.json` → Auth anónima → Firestore con reglas.
- Workload Identity Federation: GitHub entrega un token OIDC; Google lo valida (IDs de repositorio y propietario, y environment) y da credenciales temporales de `github-deployer`. No hay claves JSON.

## 4. Pipeline en vivo (≈3 min)
1. `.github/workflows/`: `ci.yml`, `cd.yml`, `deploy-firebase.yml`, `promotion-guard.yml`.
2. **CD #1** (fallo): un error en la autenticación del despliegue detiene el pipeline y no se publica nada. Si se graba la evidencia opcional #18 de `EVIDENCIAS.md`, mostrar también un PR con una prueba fallida y la CI en rojo.
3. **PR #1** (`develop → qa`) y **CD #5**: smoke test y **pruebas de aceptación E2E contra la URL de QA**.
4. **PR #2** (`qa → main`): 5 checks en verde, incluido *Validar rama de origen*.
5. **CD #7**: grafo de jobs, la **espera de aprobación** del environment `production`, el registro de quién aprobó y el Summary con el smoke test de producción.
6. Settings → Environments → `production`: *Required reviewers* y la rama `main`.

## 5. Seguridad y costos (≈1 min)
- Reglas de Firestore y sus 6 pruebas, cabeceras de seguridad verificadas por el smoke test, mínimo privilegio (4 roles) y ningún secreto en el repositorio.
- Plan Spark sin facturación: al agotar una cuota el servicio se limita, no se cobra. Riesgos de Blaze (README §8).

## 6. Limpieza y cierre (≈1 min)
- Procedimiento del README §9: conservar evidencias → desactivar Hosting → revocar WIF y la cuenta de servicio → eliminar proyectos.
- Lecciones aprendidas (README §13): `sub` OIDC inmutable, latencia del listener, caché de `index`.

## Preguntas probables

| Pregunta | Respuesta breve |
|---|---|
| ¿Dónde está la API? | Arquitectura serverless: Firestore expone la API de datos y las reglas de seguridad autorizan cada operación en el servidor. |
| ¿Cómo se evita que alguien despliegue a producción sin permiso? | Environment `production` con revisor obligatorio y sin bypass de administradores; el job no obtiene credenciales hasta la aprobación; el environment solo admite la rama `main`; y el proveedor OIDC exige el environment `production`. |
| ¿Hubo separación de funciones? | No. La misma cuenta fusionó el PR #2, inició CD #7 y aprobó el despliegue. Hubo control manual, no separación de funciones. Mejora: un segundo revisor y *Prevent self-review*. |
| ¿Los checks son obligatorios para hacer merge? | No: no hay protección de ramas configurada. Los checks se ejecutaron y pasaron en ambos PR antes del merge, pero GitHub no los exige. Mejora: rulesets (`CONFIGURACION.md` §3.4). |
| ¿Qué pasa si fallan las pruebas? | El job de despliegue depende de la CI (`needs: ci`): si un job de CI falla, el despliegue no se ejecuta. En el historial no hay un run con pruebas fallidas; CD #1 muestra que un fallo (en la autenticación del despliegue) detiene el pipeline sin publicar. |
| ¿Cómo se revierte una versión? | Firebase Hosting → *Rollback* (inmediato, solo el sitio) o `git revert` promovido por PR con todo el pipeline. *Run workflow* solo vuelve a desplegar la punta de la rama, no un commit anterior. |
| ¿Cómo se sabe qué versión está publicada? | Insignia y pie de la app, `/version.json` y el smoke test, que compara el commit con el del pipeline. |
| ¿Por qué no hay claves de servicio? | Workload Identity Federation: credenciales temporales emitidas por OIDC, restringidas por IDs inmutables y por environment. |
