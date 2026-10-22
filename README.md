# TaskFlow · Despliegue cloud con CI/CD en tres ambientes

Aplicación web de gestión de tareas (React + TypeScript + Vite) con persistencia real en **Cloud Firestore**, publicada en **Firebase Hosting** en tres ambientes independientes: **DEV, QA y PRODUCCIÓN**.

Un pipeline de **GitHub Actions** construye y prueba la aplicación, la despliega por rama y promueve los cambios mediante Pull Requests. Producción exige **aprobación manual**. GitHub Actions se autentica en Google Cloud **sin claves**, mediante Workload Identity Federation (OIDC).

> Taller práctico *Despliegue de aplicaciones e infraestructura en la nube* · Electiva Laboratorio DevOps.

**Contenido:**
[1. Entrega](#1-formato-de-entrega-del-equipo) ·
[2. Aplicación](#2-la-aplicación) ·
[3. Arquitectura](#3-arquitectura) ·
[4. Servicios](#4-servicios-utilizados) ·
[5. Pipeline](#5-pipeline-cicd) ·
[6. Pruebas](#6-pruebas-y-resultados) ·
[7. Seguridad](#7-seguridad) ·
[8. Costos](#8-costos-plan-spark) ·
[9. Limpieza](#9-desactivación-y-eliminación-de-recursos) ·
[10. Evidencias](#10-evidencias) ·
[11. Sustentación](#11-sustentación-flujo-dev--qa--producción) ·
[12. Ejecución local](#12-ejecución-local) ·
[13. Incidentes](#13-incidentes-y-lecciones-aprendidas)

---

## 1. Formato de entrega del equipo

| Campo | Respuesta del equipo |
|---|---|
| Integrantes | **⟦PENDIENTE: nombres completos de los integrantes⟧** |
| Modalidad | Proyecto propio (Modalidad B) |
| Plataforma principal | Firebase (Hosting, Cloud Firestore, Authentication) + Google Cloud IAM, con CI/CD en GitHub Actions |
| Repositorio | https://github.com/MariaFernanda1818/devops-cloud-deployment |
| URL DEV | https://taskflow-dev-mf1818.web.app |
| URL QA | https://taskflow-qa-mf1818.web.app |
| URL PDN/Producción | https://taskflow-prod-mf1818.web.app |
| API DEV / QA / PDN | **No aplica como API REST propia.** Arquitectura serverless: el servicio de datos es Cloud Firestore de cada proyecto (`taskflow-dev-mf1818`, `taskflow-qa-mf1818`, `taskflow-prod-mf1818`), al que la app accede con el SDK de Firebase. Las reglas de seguridad hacen el papel de capa de autorización. No se expone como endpoint abierto (ver [§3](#3-arquitectura)). |
| Base de datos y estrategia de persistencia | Cloud Firestore (modo Native, edición Standard, ubicación `nam5`): una base `(default)` **por ambiente**, en proyectos separados. Cada usuario obtiene un `uid` anónimo y solo accede a `users/{uid}/tasks`. No se incluyen credenciales. |
| Pipeline | https://github.com/MariaFernanda1818/devops-cloud-deployment/actions · Despliegue a producción: [CD #7](https://github.com/MariaFernanda1818/devops-cloud-deployment/actions/runs/39859676964) |
| Video | **⟦PENDIENTE: enlace al video con permisos de visualización⟧** |
| Costos y limpieza | Plan **Spark** (gratuito) **sin facturación** en los tres proyectos; GitHub Actions gratuito en repositorio público. Plan de eliminación en [§9](#9-desactivación-y-eliminación-de-recursos). |

### Ambientes

| Ambiente | Rama | URL de la aplicación | Servicio de datos ("API") | Proyecto Firebase | GitHub Environment | Commit publicado | Estado |
|---|---|---|---|---|---|---|---|
| DEV | `develop` | https://taskflow-dev-mf1818.web.app | Firestore `taskflow-dev-mf1818` | `taskflow-dev-mf1818` | `development` | `eace8ab` | ✅ Verificado |
| QA | `qa` | https://taskflow-qa-mf1818.web.app | Firestore `taskflow-qa-mf1818` | `taskflow-qa-mf1818` | `qa` | `3514960` | ✅ Verificado |
| PDN | `main` | https://taskflow-prod-mf1818.web.app | Firestore `taskflow-prod-mf1818` | `taskflow-prod-mf1818` | `production` (con aprobación) | `0fb3f92` | ✅ Verificado |

*Estado verificado el 2026-10-22: smoke test 7/7 contra las tres URLs públicas, ver [§6](#6-pruebas-y-resultados). Cada sitio publica su versión en `/version.json` (p. ej. https://taskflow-prod-mf1818.web.app/version.json).*

**Rúbrica del profesor → dónde está cada entregable**

| # | Entregable | Ubicación |
|---|---|---|
| 1-3 | URLs DEV, QA y Producción | [Tabla de ambientes](#ambientes) |
| 4 | Repositorio con README, instrucciones y pipeline | Este README · [`docs/CONFIGURACION.md`](docs/CONFIGURACION.md) · [`.github/workflows/`](.github/workflows) |
| 5 | Diagrama de arquitectura (servicios, ambientes y flujos) | [§3](#3-arquitectura) |
| 6 | Tabla de servicios, seguridad y costos potenciales | [§4](#4-servicios-utilizados), [§7](#7-seguridad), [§8](#8-costos-plan-spark) |
| 7 | Desactivación y eliminación de recursos | [§9](#9-desactivación-y-eliminación-de-recursos) |
| 8 | Formato de entrega del equipo | [§1](#1-formato-de-entrega-del-equipo) |
| 9 | Evidencias visuales | [§10](#10-evidencias) · [`docs/EVIDENCIAS.md`](docs/EVIDENCIAS.md) |
| 10 | Video de demostración | [§1](#1-formato-de-entrega-del-equipo) (pendiente) · guion en [`docs/SUSTENTACION.md`](docs/SUSTENTACION.md) |

---

## 2. La aplicación

**TaskFlow** es un gestor de tareas personal:

- Crear, editar, completar y eliminar tareas, con título, descripción, prioridad y fecha límite. La eliminación pide confirmación.
- Persistencia en **Cloud Firestore** con actualización en tiempo real (`onSnapshot`). Cada tarea muestra "Sincronizando…" hasta que el servidor confirma la escritura.
- Filtros por estado y prioridad, búsqueda y orden por fecha de creación, fecha límite o prioridad.
- Estadísticas: total, pendientes, completadas, vencidas y porcentaje de avance.
- Validación en el cliente (`src/domain/task.ts`) **y** en el servidor (`firestore.rules`).
- Diseño responsive, modo oscuro automático y accesibilidad (roles ARIA, etiquetas y foco visible).
- **Trazabilidad del despliegue:** la insignia DEV / QA / PRODUCCIÓN y el pie (versión, commit y fecha de build) muestran qué está publicado en cada ambiente.

| DEV | QA | Producción |
|---|---|---|
| ![DEV](docs/evidencias/dev-desktop.png) | ![QA](docs/evidencias/qa-desktop.png) | ![Producción](docs/evidencias/prod-desktop.png) |

**Estructura del código**

```
src/domain/       Modelo y reglas de negocio puras: validación, filtros, orden, estadísticas
src/data/         TaskRepository: Firestore (ambientes reales) y en memoria (pruebas); arranque de Firebase
src/hooks/        useTasks: suscripción en tiempo real y operaciones
src/components/   UI: TaskBoard, TaskForm, TaskItem, TaskToolbar, StatsBar
tests/rules/      Pruebas de las reglas de seguridad de Firestore (emulador)
e2e/              Pruebas E2E / aceptación con Playwright
scripts/          smoke-test.mjs (verificación posterior al despliegue)
firebase.json     Hosting (cabeceras, caché, SPA), Firestore y emuladores
firestore.rules   Reglas de seguridad
```

---

## 3. Arquitectura

### 3.1 Diagrama: servicios, ambientes y flujos

```mermaid
flowchart TB
  dev([Desarrollador]) -->|push / Pull Request| gh

  subgraph gh[GitHub · MariaFernanda1818/devops-cloud-deployment]
    direction TB
    bd[rama develop] -->|PR + Promotion guard| bq[rama qa]
    bq -->|PR + Promotion guard| bm[rama main]
  end

  subgraph gha[GitHub Actions]
    direction TB
    ci[CI · ci.yml<br/>ESLint · TypeScript · Vitest + cobertura · build<br/>reglas Firestore en emulador · E2E con emuladores · npm audit]
    cd[CD · cd.yml → deploy-firebase.yml<br/>build APP_ENV · firebase deploy · smoke test]
    appr{{Aprobación manual<br/>environment production}}
    ci -->|si todo pasa| cd
  end

  bd -->|push| ci
  bq -->|push| ci
  bm -->|push| ci

  subgraph gcp[Google Cloud · autenticación sin claves]
    direction TB
    oidc[Token OIDC de GitHub<br/>sub = repo:MariaFernanda1818@83258884/<br/>devops-cloud-deployment@1429098189:environment:ENV]
    wif[Workload Identity Federation<br/>pool github · proveedor github-oidc<br/>condición: repo_id, owner_id, repo, environment]
    sa[Cuenta de servicio github-deployer<br/>4 roles mínimos · sin claves JSON]
    oidc --> wif --> sa
  end

  cd -. "development (develop)" .-> oidc
  cd -. "qa (qa)" .-> oidc
  cd --> appr -. "production (main)" .-> oidc

  subgraph pdev[Proyecto Firebase DEV · taskflow-dev-mf1818]
    hdev[Hosting<br/>taskflow-dev-mf1818.web.app]
    fdev[(Firestore)]
    adev[Auth anónima]
  end
  subgraph pqa[Proyecto Firebase QA · taskflow-qa-mf1818]
    hqa[Hosting<br/>taskflow-qa-mf1818.web.app]
    fqa[(Firestore)]
    aqa[Auth anónima]
  end
  subgraph pprod[Proyecto Firebase PDN · taskflow-prod-mf1818]
    hprod[Hosting<br/>taskflow-prod-mf1818.web.app]
    fprod[(Firestore)]
    aprod[Auth anónima]
  end

  sa -->|deploy Hosting + reglas| pdev
  sa -->|deploy Hosting + reglas| pqa
  sa -->|deploy Hosting + reglas| pprod

  user([Usuario · navegador]) -->|HTTPS| hprod
  hprod -. "/__/firebase/init.json" .-> user
  user -->|SDK Firebase · reglas de seguridad| fprod
  user --> aprod
```

> Cada proyecto Firebase tiene **su propio** pool `github`, proveedor `github-oidc` y cuenta `github-deployer`. En el diagrama se agrupan para simplificar, pero las credenciales de un ambiente no sirven en otro: la condición del proveedor exige el `environment` correspondiente.

### 3.2 Flujo de una petición del usuario

```mermaid
sequenceDiagram
  participant N as Navegador
  participant H as Firebase Hosting (CDN)
  participant A as Firebase Auth
  participant F as Cloud Firestore
  N->>H: GET / (HTTPS, cabeceras CSP/HSTS)
  H-->>N: index.html + assets (bundle Vite)
  N->>H: GET /__/firebase/init.json
  H-->>N: configuración web del proyecto de ese ambiente
  N->>A: signInAnonymously()
  A-->>N: uid anónimo + token
  N->>F: onSnapshot(users/{uid}/tasks) · setDoc / updateDoc / deleteDoc
  F-->>N: datos en tiempo real (las reglas validan dueño y esquema)
```

### 3.3 Decisiones de arquitectura

| Decisión | Motivo |
|---|---|
| **Un proyecto Firebase por ambiente** | Aislamiento total: base de datos, usuarios, reglas, cuotas y credenciales propias. Un error en DEV no puede afectar datos de producción. |
| **Serverless, sin API Spring Boot** | Firestore expone la API de datos al cliente y la autorización se evalúa en el servidor de Google con las reglas de seguridad. No hay servidor que mantener ni pagar. El taller lo permite en la Modalidad B si se justifica. |
| **Configuración por ambiente sin variables en el build** | La app lee su configuración de `/__/firebase/init.json`, que Hosting sirve para el proyecto donde está publicada. No hay variables `VITE_*` por ambiente ni configuración web versionada. |
| **Autenticación anónima** | Cada navegador obtiene un `uid` propio sin registro, y las reglas restringen cada usuario a `users/{uid}/tasks`. |
| **Patrón Repository** (`TaskRepository`) | La UI no depende de Firestore: las pruebas usan un repositorio en memoria. |
| **`version.json` en cada build** | El smoke test confirma que el commit publicado es exactamente el que construyó el pipeline. |
| **Workload Identity Federation** | GitHub Actions obtiene credenciales temporales (~1 h) sin claves JSON permanentes. |

**Modelo de datos (Firestore)**

```
users/{uid}/tasks/{taskId}
  title: string (1-120)            description: string (≤ 500)
  priority: 'low'|'medium'|'high'  dueDate: 'YYYY-MM-DD' | null
  completed: bool                  createdAt: timestamp (servidor)   updatedAt: timestamp (servidor)
```

---

## 4. Servicios utilizados

| Servicio | Uso en el proyecto | Configuración relevante | Ambientes |
|---|---|---|---|
| **Firebase Hosting** | Publica el frontend estático (`dist/`) por HTTPS en la CDN de Google | `firebase.json`: reescritura SPA, cabeceras de seguridad, `index.html` y `version.json` sin caché, assets inmutables | Un sitio por proyecto (`*.web.app`) |
| **Cloud Firestore** | Persistencia de las tareas en tiempo real | Native, Standard, `nam5`; reglas en `firestore.rules` desplegadas por el pipeline | Una base `(default)` por proyecto |
| **Firebase Authentication** | Identidad anónima por navegador | Proveedor **Anónimo** habilitado | Uno por proyecto |
| **Google Cloud IAM** | Identidad del pipeline | Cuenta `github-deployer` con 4 roles; pool `github` y proveedor OIDC `github-oidc` | Uno por proyecto |
| **GitHub Actions** | CI/CD | `ci.yml`, `cd.yml`, `deploy-firebase.yml`, `promotion-guard.yml` | Environments `development`, `qa`, `production` |
| **GitHub Environments** | Variables por ambiente y protección | Ramas permitidas por environment; `production` con revisores obligatorios | 3 |

---

## 5. Pipeline CI/CD

### 5.1 Workflows

| Workflow | Disparador | Qué hace |
|---|---|---|
| [`ci.yml`](.github/workflows/ci.yml) | Pull Requests y pushes a ramas de trabajo; además, primera etapa de `cd.yml` | 4 jobs en paralelo: **Lint, tipos, pruebas unitarias y build** (ESLint 0 warnings, `tsc` estricto, Vitest con umbral de cobertura, `vite build`) · **Reglas de seguridad de Firestore** (emulador, Java 21) · **E2E con emuladores** (Playwright, Chromium escritorio y móvil) · **Auditoría de dependencias de producción** (`npm audit --omit=dev`) |
| [`cd.yml`](.github/workflows/cd.yml) | Push a `develop`, `qa` o `main`; ejecución manual (`workflow_dispatch`) | Ejecuta la CI completa y, solo si pasa, el despliegue del ambiente de la rama. La creación de una rama no despliega. |
| [`deploy-firebase.yml`](.github/workflows/deploy-firebase.yml) | Reutilizable | Valida la configuración → build con `APP_ENV` → autenticación OIDC → `firebase deploy --only hosting,firestore:rules,firestore:indexes` → **smoke test** → (QA) **aceptación E2E contra la URL pública** → registro del despliegue |
| [`promotion-guard.yml`](.github/workflows/promotion-guard.yml) | PR hacia `qa` o `main` | Solo permite `develop → qa` y `qa → main` (o `hotfix/*`) |

### 5.2 Flujo (corresponde a la §5 del taller)

```mermaid
flowchart TD
  A[Commit y push / Pull Request] --> B[npm ci · ESLint · TypeScript]
  B --> C[Vitest + cobertura · reglas Firestore · E2E emuladores · npm audit]
  C -->|falla| X[⛔ Pipeline detenido: no se despliega]
  C -->|ok| E{Rama}
  E -->|develop| F[Build APP_ENV=dev → deploy DEV → smoke test]
  E -->|qa| G[Build APP_ENV=qa → deploy QA → smoke test → aceptación E2E en la URL pública]
  E -->|main| H[⏸ Job en espera: aprobación del revisor en environment production]
  H -->|aprobado| I[Build APP_ENV=prod → deploy PDN → smoke test]
  F & G & I --> J[Registro: URL, proyecto, commit, autor y fecha en el Summary y en Deployments]
```

| Paso del taller | Implementación |
|---|---|
| Commit y push | Ramas `develop` → `qa` → `main`, promovidas por Pull Request |
| Dependencias y análisis | `npm ci`, ESLint, TypeScript estricto, `npm audit` |
| Pruebas automatizadas | Vitest, reglas de Firestore en emulador, E2E con Playwright |
| Construcción | `npm run build` con `APP_ENV` por ambiente |
| Despliegue automático a DEV | Job DEV en push a `develop` |
| Smoke test en DEV y promoción a QA | `scripts/smoke-test.mjs` + PR `develop → qa` validado por `promotion-guard` |
| Pruebas de aceptación en QA | Playwright contra https://taskflow-qa-mf1818.web.app |
| Aprobación explícita antes de PDN | Environment `production` con *Required reviewers* (bypass de administradores desactivado) |
| Despliegue de producción y verificación | Job PRODUCCIÓN + smoke test |
| Registro de versión y evidencias | `version.json`, Summary del run, GitHub Deployments y versión de Firebase Hosting con mensaje `ENV commit run #N` |

**Regla de promoción:** cualquier fallo de lint, tipos, pruebas, build, autenticación, despliegue o smoke test detiene el pipeline. La promoción a producción no se hace copiando archivos a mano: pasa por un PR `qa → main`, la CI y la aprobación del environment.

### 5.3 Rollback

- **Firebase Console → Hosting → historial de versiones → Rollback.** Es instantáneo y no requiere build.
- **Actions → CD → Run workflow:** se elige el ambiente y una ref anterior. Producción solo acepta `main` o tags `v*` y sigue exigiendo aprobación.

---

## 6. Pruebas y resultados

| Tipo | Herramienta | Qué cubre | Comando |
|---|---|---|---|
| Unitarias de dominio | Vitest | Validación, normalización, filtros, orden, estadísticas y fechas | `npm test` |
| Componentes | Vitest + Testing Library | Crear, validar, editar, completar, eliminar con confirmación, filtrar, ordenar, errores y sincronización | `npm test` |
| Cobertura | @vitest/coverage-v8 | Umbral: 85 % líneas, funciones y sentencias; 80 % ramas | `npm run test:ci` |
| Reglas de seguridad | @firebase/rules-unit-testing + emulador | CRUD del dueño; acceso sin autenticación denegado; aislamiento entre usuarios; esquema; `createdAt` inmutable; colecciones no declaradas denegadas | `npm run test:rules` |
| E2E / aceptación | Playwright (escritorio + móvil) | Ciclo de vida completo con persistencia verificada por recarga; validación del formulario | `npm run test:e2e:emulator` · `E2E_BASE_URL=<url> npm run test:e2e` |
| Smoke posterior al despliegue | `scripts/smoke-test.mjs` | HTTPS, app, ambiente y commit en `version.json`, cabeceras de seguridad, sin caché en `index`/`version.json`, reescritura SPA, `projectId` correcto | `npm run smoke -- --url <url> --env <dev\|qa\|prod> [--sha <commit>] [--project <id>]` |

### 6.1 Resultados

| Suite | Resultado |
|---|---|
| ESLint | 0 errores, 0 warnings |
| TypeScript (`strict`) | Sin errores |
| Vitest | **35/35** · cobertura 98.97 % sentencias, 92.3 % ramas |
| Reglas de Firestore (emulador) | **6/6** |
| Playwright E2E con emuladores | **4/4** (2 pruebas × escritorio y móvil) |
| Aceptación E2E contra QA pública | ✅ en [CD #5](https://github.com/MariaFernanda1818/devops-cloud-deployment/actions/runs/39817039305) |
| `npm audit --omit=dev` | 0 vulnerabilidades |
| Smoke test contra DEV, QA y PDN (2026-10-22) | **7/7** en cada ambiente |

### 6.2 Runs de GitHub Actions

| Run | Rama / evento | Commit | Resultado | Qué demuestra |
|---|---|---|---|---|
| [CD #1](https://github.com/MariaFernanda1818/devops-cloud-deployment/actions/runs/39720368963) | `develop` · push | `139372d` | ❌ | Un fallo de autenticación **detuvo** el pipeline: no se publicó nada (ver [§13](#13-incidentes-y-lecciones-aprendidas)) |
| [CD #2](https://github.com/MariaFernanda1818/devops-cloud-deployment/actions/runs/39720712127) | `develop` · push | `bb6e8d8` | ✅ (intento 4) | Primer despliegue DEV, tras corregir el principal de WIF; los intentos 1 a 3 fallaron por el formato del `sub` |
| [CD #3](https://github.com/MariaFernanda1818/devops-cloud-deployment/actions/runs/39813146037) | `develop` · push | `eace8ab` | ✅ | Despliegue DEV de la versión promovida |
| [CD #4](https://github.com/MariaFernanda1818/devops-cloud-deployment/actions/runs/39813685476) | `qa` · creación de rama | `b5b4859` | ✅ | Crear `qa` ejecutó la CI pero **no** desplegó |
| [CI #1](https://github.com/MariaFernanda1818/devops-cloud-deployment/actions/runs/39813973370) · [Promotion guard #1](https://github.com/MariaFernanda1818/devops-cloud-deployment/actions/runs/39813973180) | PR [#1](https://github.com/MariaFernanda1818/devops-cloud-deployment/pull/1) `develop → qa` | `eace8ab` | ✅ | Validaciones de la promoción a QA |
| [CD #5](https://github.com/MariaFernanda1818/devops-cloud-deployment/actions/runs/39817039305) | `qa` · manual | `3514960` | ✅ (intento 2) | Despliegue QA con smoke test y **aceptación E2E en la URL pública**; el intento 1 se detuvo en "Validar configuración del ambiente" |
| [CD #6](https://github.com/MariaFernanda1818/devops-cloud-deployment/actions/runs/39858080694) | `main` · creación de rama | `b5b4859` | ✅ | Crear `main` ejecutó la CI pero **no** desplegó producción |
| [CI #2](https://github.com/MariaFernanda1818/devops-cloud-deployment/actions/runs/39858134394) · [Promotion guard #2](https://github.com/MariaFernanda1818/devops-cloud-deployment/actions/runs/39858134463) | PR [#2](https://github.com/MariaFernanda1818/devops-cloud-deployment/pull/2) `qa → main` | `3514960` | ✅ | Validaciones de la promoción a producción |
| [CD #7](https://github.com/MariaFernanda1818/devops-cloud-deployment/actions/runs/39859676964) | `main` · push (merge del PR #2) | `0fb3f92` | ✅ | CI → **espera de aprobación** (CI terminada 21:45:39 UTC; job iniciado 22:01:55 UTC tras aprobar `MariaFernanda1818` el environment `production`) → despliegue PDN → smoke test |

El contenido de `main` (`0fb3f92`) es idéntico al validado en QA (`3514960`): `git diff 3514960 0fb3f92` no muestra cambios.

---

## 7. Seguridad

| Aspecto | Medida |
|---|---|
| Secretos | **Ningún secreto en el repositorio ni claves permanentes.** El pipeline se autentica con Workload Identity Federation y los GitHub Environments solo guardan identificadores no sensibles (`FIREBASE_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`). `.gitignore` bloquea `.env*`, `service-account*.json` y `gha-creds-*.json`. |
| Confianza OIDC | La condición del proveedor exige `repository_id == 1429098189`, `repository_owner_id == 83258884`, `repository == MariaFernanda1818/devops-cloud-deployment` y el `environment` del proyecto. La cuenta de servicio solo acepta el sujeto inmutable de ese environment. Los jobs de CI (sin environment) no pueden obtener credenciales. |
| Mínimo privilegio | `github-deployer` tiene solo: Firebase Hosting Admin, Firebase Rules Admin, Cloud Datastore Index Admin y Service Usage Consumer. Cada rol está justificado en [`docs/CONFIGURACION.md` §2.3](docs/CONFIGURACION.md). No puede leer datos de Firestore, cambiar IAM, habilitar APIs ni tocar facturación. |
| Producción protegida | Environment `production`: revisores obligatorios, bypass de administradores desactivado y solo la rama `main`. El job no inicia (ni obtiene credenciales) hasta la aprobación, y el workflow además rechaza refs distintas de `main` o `v*`. |
| Promoción controlada | `promotion-guard` (develop → qa → main); crear ramas no despliega. |
| Autorización de datos | [`firestore.rules`](firestore.rules): solo el dueño (`request.auth.uid`) accede a sus tareas; valida campos, tipos, longitudes y timestamps del servidor; lo demás se deniega. Probado automáticamente (6 pruebas). |
| Cabeceras HTTP | CSP estricta (`script-src 'self'`, `frame-ancestors 'none'`), HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` y `Permissions-Policy`. El smoke test las verifica en cada despliegue. |
| Configuración web de Firebase | `apiKey`/`appId` no son secretos: identifican el proyecto y se sirven desde `/__/firebase/init.json`. La protección real la dan las reglas. |
| Dependencias | `npm audit` en CI. `overrides` fuerza `@grpc/grpc-js ≥ 1.14.6` (vulnerabilidad en la versión transitiva de Firestore). |

---

## 8. Costos (plan Spark)

Los tres proyectos Firebase usan el plan **Spark (gratuito)** y **no tienen cuenta de facturación vinculada**. En Spark, al agotar una cuota gratuita el servicio se limita hasta el siguiente periodo: **no se genera ningún cobro**.

| Servicio | Uso | Cuota gratuita relevante (Spark)* | Costo |
|---|---|---|---|
| Firebase Hosting (×3) | Frontend estático (~800 kB por build) | 10 GB de almacenamiento; 360 MB/día de transferencia | $0 |
| Cloud Firestore (×3) | Persistencia | 1 GiB almacenado; 50 000 lecturas, 20 000 escrituras y 20 000 borrados por día | $0 |
| Firebase Authentication (anónima) | Identidad | Incluida en Spark, con los límites de uso publicados | $0 |
| Google Cloud IAM, STS, IAM Credentials (WIF) | Autenticación del pipeline | Sin costo | $0 |
| GitHub Actions | CI/CD | Minutos ilimitados en repositorios públicos | $0 |

\*Según [firebase.google.com/pricing](https://firebase.google.com/pricing); las cuotas pueden cambiar y deben confirmarse ahí.

**Riesgos de pasar a Blaze (pago por uso), que no se hizo:**
- Blaze exige vincular una cuenta de facturación. Lo que excede las cuotas gratuitas se cobra y **no hay un tope de gasto automático**: los presupuestos de Cloud Billing solo envían alertas, no detienen el consumo.
- Una regla de seguridad mal configurada, un bucle de lecturas o un pico de tráfico puede convertirse en un costo real.
- Blaze habilita servicios que cobran desde el primer uso o requieren facturación: Cloud Functions, Cloud Run, Cloud Build, Artifact Registry, Cloud SQL, entre otros. Este proyecto no usa ninguno.
- **Mitigación si algún día se activa:** crear antes un presupuesto con alertas (50/90/100 %), revisar las reglas de Firestore y monitorear el uso en la consola.

---

## 9. Desactivación y eliminación de recursos

**Antes de eliminar, conserva las evidencias** (paso 0). Al borrar un proyecto se pierden su historial de Hosting y sus datos. Los runs de GitHub Actions caducan según la política de retención (90 días por defecto en repos públicos).

**0. Conservar evidencias**
- Guardar en `docs/evidencias/` las capturas listadas en [`docs/EVIDENCIAS.md`](docs/EVIDENCIAS.md) y hacer commit.
- Descargar los logs de los runs clave: en cada run, ⚙️ → *Download log archive* para CD #5 y CD #7.
- Exportar el historial de versiones de Hosting con una captura de Firebase Console → Hosting de cada proyecto.

**1. Desactivar Hosting** (la URL deja de servir la app; reversible con un nuevo deploy):

```bash
npx firebase hosting:disable --project taskflow-dev-mf1818 --force
npx firebase hosting:disable --project taskflow-qa-mf1818 --force
npx firebase hosting:disable --project taskflow-prod-mf1818 --force
```

**2. Revocar el acceso del pipeline** (en Cloud Shell, por cada proyecto; ejemplo para DEV):

```bash
PROJECT_ID=taskflow-dev-mf1818
gcloud iam workload-identity-pools providers delete github-oidc \
  --workload-identity-pool=github --location=global --project="$PROJECT_ID" --quiet
gcloud iam workload-identity-pools delete github --location=global --project="$PROJECT_ID" --quiet
gcloud iam service-accounts delete "github-deployer@${PROJECT_ID}.iam.gserviceaccount.com" \
  --project="$PROJECT_ID" --quiet
```

En GitHub: **Settings → Environments** → eliminar `development`, `qa` y `production`, y **Settings → Actions → General → Disable actions**.

**3. Eliminar los proyectos** (borra Hosting, Firestore, Auth e IAM): Firebase Console → ⚙️ Configuración del proyecto → **Eliminar proyecto**, o en Cloud Shell:

```bash
gcloud projects delete taskflow-dev-mf1818
gcloud projects delete taskflow-qa-mf1818
gcloud projects delete taskflow-prod-mf1818
```

Google mantiene un proyecto eliminado unos 30 días en estado *pendiente de eliminación*; durante ese tiempo puede restaurarse con `gcloud projects undelete <id>`.

**4. Verificar:** las tres URLs responden 404 o "Site Not Found", y `gcloud projects list` ya no muestra los proyectos (o los muestra como `DELETE_REQUESTED`).

---

## 10. Evidencias

Las evidencias visuales están en [`docs/evidencias/`](docs/evidencias). La lista completa, con lo que falta capturar, está en [`docs/EVIDENCIAS.md`](docs/EVIDENCIAS.md).

| Evidencia | Archivo |
|---|---|
| DEV publicado (insignia DEV, commit `eace8ab`) | [`dev-desktop.png`](docs/evidencias/dev-desktop.png) |
| QA publicado (insignia QA, commit `3514960`) | [`qa-desktop.png`](docs/evidencias/qa-desktop.png) |
| Producción publicada (insignia PRODUCCIÓN, commit `0fb3f92`) | [`prod-desktop.png`](docs/evidencias/prod-desktop.png) · [`prod-mobile.png`](docs/evidencias/prod-mobile.png) |
| App con datos de ejemplo, escritorio y móvil (emuladores locales) | [`local-desktop.png`](docs/evidencias/local-desktop.png) · [`local-mobile.png`](docs/evidencias/local-mobile.png) |

---

## 11. Sustentación: flujo DEV → QA → PRODUCCIÓN

1. **DEV:** un cambio llega a `develop`. CD ejecuta la CI (lint, tipos, 35 pruebas, reglas, E2E y audit) y despliega a https://taskflow-dev-mf1818.web.app. El smoke test confirma el commit publicado.
2. **Promoción a QA:** PR `develop → qa`. La CI y `promotion-guard` deben pasar. Al hacer merge se despliega https://taskflow-qa-mf1818.web.app y se ejecutan las **pruebas de aceptación E2E contra la URL pública**: crear, recargar, completar y eliminar una tarea con persistencia real.
3. **Promoción a producción:** PR `qa → main` con las mismas validaciones. Tras el merge, la CI corre y el job **PRODUCCIÓN queda en espera**: no inicia ni obtiene credenciales.
4. **Aprobación manual:** un revisor del environment `production` pulsa *Review deployments → Approve and deploy*. En [CD #7](https://github.com/MariaFernanda1818/devops-cloud-deployment/actions/runs/39859676964) la aprobó `MariaFernanda1818` (21:45:39 → 22:01:55 UTC).
5. **Despliegue y verificación:** autenticación por OIDC, publicación en https://taskflow-prod-mf1818.web.app y smoke test. La insignia **PRODUCCIÓN** y el commit `0fb3f92` en el pie permiten verificarlo a simple vista.

Guion detallado para el video y preguntas frecuentes: [`docs/SUSTENTACION.md`](docs/SUSTENTACION.md).

---

## 12. Ejecución local

Requisitos: Node 24 (`.nvmrc`) y Java 21+ (solo para los emuladores).

```bash
npm ci
npm run emulators          # terminal 1: emuladores de Auth y Firestore (UI en http://127.0.0.1:4000)
npm run dev:emulator       # terminal 2: app en http://localhost:5173 contra los emuladores
npm run verify             # lint + tipos + pruebas con cobertura + build
npm run test:rules         # reglas de seguridad (emulador)
npm run test:e2e:emulator  # E2E (emuladores)
```

Los emuladores usan el proyecto ficticio `demo-taskflow` (`.env.emulator` solo contiene valores `demo-*`): no se conectan a ningún proyecto real. La configuración de la infraestructura paso a paso está en [`docs/CONFIGURACION.md`](docs/CONFIGURACION.md).

---

## 13. Incidentes y lecciones aprendidas

| Incidente | Causa | Solución |
|---|---|---|
| CD #1-#2: `Failed to authenticate` y después `Permission 'iam.serviceAccounts.getAccessToken' denied` | El repositorio, creado después del 15 de julio de 2026, emite el **`sub` OIDC inmutable** (`repo:OWNER@ID/REPO@ID:environment:ENV`), pero el principal IAM usaba el formato antiguo. Además, `firebase-tools` ocultaba el error original. | Se actualizó el binding `roles/iam.workloadIdentityUser` al sujeto inmutable, y `token_format: access_token` hace visible el error real de Google en el paso de autenticación. |
| Prueba de aceptación fallando contra la Firestore real | `metadata.hasPendingWrites` tardaba 18-29 s en actualizarse aunque la escritura se confirmaba en menos de 1 s (medido con WebChannel y con gRPC) | "Sincronizando…" se basa en la confirmación de `setDoc`/`updateDoc` |
| `/` se servía con caché de 1 h | La regla `no-cache` no cubría la raíz | Regex `^/(index\.html|version\.json)?$`, verificada por el smoke test |
| Crear una rama podía desplegar un ambiente sin PR | Un push que crea una rama también dispara `cd.yml` | Condición `github.event.created != true` (comprobada en CD #4 y CD #6) |
| El merge del PR #1 no generó un run por push en `qa` | No se identificó la causa: no había marcadores de skip ni concurrencia, y los demás pushes sí dispararon | Se desplegó QA con `workflow_dispatch` (CD #5), con la misma CI y verificación. El merge del PR #2 sí disparó CD #7. |
| Emulador local de Hosting sin cabeceras personalizadas | Limitación del emulador (firebase-tools 15.34.1) | Las cabeceras se verifican contra los sitios reales en cada smoke test |
