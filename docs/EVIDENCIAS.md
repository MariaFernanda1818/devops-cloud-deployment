# Evidencias

Las capturas van en `docs/evidencias/` con el nombre indicado. Las marcadas ✅ ya están en el repositorio; las marcadas ⬜ **todavía no existen** y no deben citarse como evidencia hasta agregarlas.

## Existentes

| Archivo | Qué muestra | Cómo se obtuvo |
|---|---|---|
| ✅ `dev-desktop.png` | https://taskflow-dev-mf1818.web.app con insignia **DEV** y pie `commit eace8ab` | Playwright contra la URL pública (2026-10-22) |
| ✅ `qa-desktop.png` | https://taskflow-qa-mf1818.web.app con insignia **QA** y pie `commit 3514960` | Playwright contra la URL pública (2026-10-22) |
| ✅ `prod-desktop.png` | https://taskflow-prod-mf1818.web.app con insignia **PRODUCCIÓN** y pie `commit 0fb3f92` | Playwright contra la URL pública (2026-10-22) |
| ✅ `prod-mobile.png` | Producción en vista móvil (Pixel 7) | Playwright contra la URL pública (2026-10-22) |
| ✅ `local-desktop.png` | App con tareas de ejemplo (estadísticas, vencida, completada) | Playwright contra los emuladores locales |
| ✅ `local-mobile.png` | Lo mismo en vista móvil | Playwright contra los emuladores locales |

## Faltantes (⬜ pendientes: requieren tu sesión de GitHub o Google)

| # | Estado | Archivo sugerido | Qué capturar | Dónde |
|---|---|---|---|---|
| 1 | ⬜ Pendiente | `gh-actions-lista.png` | Lista de runs del workflow **CD** con #3 a #7 en verde | https://github.com/MariaFernanda1818/devops-cloud-deployment/actions/workflows/cd.yml |
| 2 | ⬜ Pendiente | `gh-cd7-grafo.png` | Grafo de jobs de CD #7: CI 4/4 → PRODUCCIÓN en verde, DEV/QA *skipped* | https://github.com/MariaFernanda1818/devops-cloud-deployment/actions/runs/39859676964 |
| 3 | ⬜ Pendiente | `gh-cd7-aprobacion.png` | Registro de aprobación del environment `production` (quién y cuándo) | Mismo run → anotación *"… approved"* / sección de deployment review |
| 4 | ⬜ Pendiente | `gh-cd7-summary.png` | Summary de CD #7: tabla "Smoke test PROD" y "Despliegue prod completado" | Mismo run → *Summary* |
| 5 | ⬜ Pendiente | `gh-cd5-aceptacion.png` | Paso "Pruebas de aceptación E2E contra https://taskflow-qa-mf1818.web.app" en verde | https://github.com/MariaFernanda1818/devops-cloud-deployment/actions/runs/39817039305 |
| 6 | ⬜ Pendiente | `gh-cd1-fallo.png` | Pipeline detenido por un fallo (CD #1): no se desplegó | https://github.com/MariaFernanda1818/devops-cloud-deployment/actions/runs/39720368963 |
| 7 | ⬜ Pendiente | `gh-pr2-checks.png` | PR #2 `qa → main` con los 5 checks en verde y *Validar rama de origen* | https://github.com/MariaFernanda1818/devops-cloud-deployment/pull/2 |
| 8 | ⬜ Pendiente | `gh-environments.png` | Settings → Environments: `development`, `qa`, `production` | Settings → Environments |
| 9 | ⬜ Pendiente | `gh-env-production.png` | Configuración de `production`: *Required reviewers* (`MariaFernanda1818`), rama `main`, sin bypass de administradores, *Prevent self-review* desactivado | Settings → Environments → production |
| 10 | ⬜ Pendiente | `gh-deployments.png` | Historial de Deployments por ambiente | Página principal del repositorio → panel lateral **Deployments** (requiere sesión iniciada) |
| 11 | ⬜ No aplica hoy | `gh-rulesets.png` | Solo si se configura la protección de ramas (hoy **no existe**; ver `CONFIGURACION.md` §3.4) | Settings → Rules → Rulesets |
| 12 | ⬜ Pendiente | `firebase-hosting-prod.png` | Hosting de `taskflow-prod-mf1818`: historial de versiones con mensaje `prod 0fb3f92 run #7` | Firebase Console → Hosting |
| 13 | ⬜ Pendiente | `firebase-firestore-reglas.png` | Firestore → Reglas publicadas (igual a `firestore.rules`) | Firebase Console → Firestore → Reglas |
| 14 | ⬜ Pendiente | `firebase-plan-spark.png` | Plan **Spark** en los proyectos (sin facturación) | Firebase Console → Uso y facturación |
| 15 | ⬜ Pendiente | `gcp-wif-proveedor.png` | Proveedor `github-oidc` con la condición de atributos | Google Cloud → IAM → Workload Identity Federation |
| 16 | ⬜ Pendiente | `gcp-sa-roles.png` | Roles de `github-deployer` (exactamente 4) y sin claves | Google Cloud → IAM |
| 17 | ⬜ Pendiente | `prod-tarea-creada.png` | Producción con una tarea de demostración creada y persistida tras recargar | https://taskflow-prod-mf1818.web.app |
| 18 | ⬜ Pendiente (opcional) | `gh-ci-prueba-fallida.png` | *(Opcional, recomendada para el criterio «pruebas que bloquean despliegues fallidos»)* CI en rojo en un PR de prueba con un test roto a propósito, **sin hacer merge** | PR temporal hacia `develop`; cerrarlo sin fusionar |

> No incluyas en las capturas datos sensibles: correos personales visibles, tokens o la API key completa. Los IDs de proyecto, de repositorio y de cuenta de servicio no son secretos.
