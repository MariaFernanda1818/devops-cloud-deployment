# Guía de configuración de la infraestructura

Pasos manuales, que se hacen una sola vez, para habilitar los tres ambientes. Ninguno requiere tarjeta de crédito ni activar facturación (plan **Spark**).

| Ambiente | Proyecto Firebase | Número de proyecto | GitHub Environment | Rama |
|---|---|---|---|---|
| DEV | `taskflow-dev-mf1818` | `977902311183` | `development` | `develop` |
| QA | _pendiente_ | _pendiente_ | `qa` | `qa` |
| PDN | _pendiente_ | _pendiente_ | `production` | `main` |

---

## 1. Proyecto Firebase (por ambiente)

En https://console.firebase.google.com:

1. Crear el proyecto (plan Spark, sin Google Analytics).
2. **Firestore Database** → crear `(default)` en modo producción. DEV usa `nam5`; usa la misma ubicación en QA y PDN.
3. **Authentication** → Método de acceso → **Anónimo** → Habilitar.
4. **Hosting** → Comenzar.
5. **Configuración del proyecto → General → Tus apps** → registrar app web.
6. **Vincular la app web al sitio de Hosting.** En la misma tarjeta de la app web, en la sección *Firebase Hosting*, elige **Vincular a un sitio** y selecciona el sitio del proyecto (p. ej. `taskflow-dev-mf1818`).
   La app obtiene su configuración de `/__/firebase/init.json`, que publica Hosting. Vincular la app al sitio garantiza que ese archivo entregue la configuración de esta app. Comprobación: `npx firebase hosting:sites:list --project <id>` debe mostrar el App ID en la columna *App ID (if set)*.

> **Variables `VITE_*`: no se necesitan en GitHub.** La configuración web (apiKey, appId, projectId…) no se inyecta en el build: cada sitio la sirve en `/__/firebase/init.json`. Las variables `VITE_FIREBASE_*` de `src/vite-env.d.ts` son opcionales y solo sirven para correr la app en local apuntando a un proyecto real. El ambiente que se muestra en la app lo define el pipeline con `APP_ENV`.

---

## 2. Autenticación de GitHub Actions sin claves (Workload Identity Federation)

GitHub emite un token OIDC de corta duración en cada ejecución. Google lo valida y entrega credenciales temporales (≈1 h) de una cuenta de servicio. **No existe ninguna clave JSON que se pueda filtrar o que haya que rotar.** WIF no tiene costo y funciona en proyectos Spark.

La confianza queda restringida a:
- el dueño del repositorio por **ID numérico** (`83258884`), que no se puede suplantar renombrando una cuenta;
- el repositorio `MariaFernanda1818/devops-cloud-deployment`;
- y, en la cuenta de servicio, **solo a los jobs que corren en el environment correspondiente** (`development`, `qa` o `production`).

### 2.1 Ejecutar en Cloud Shell

Abre https://console.cloud.google.com/?cloudshell=true con el proyecto DEV seleccionado. Cloud Shell es gratuito y ya trae `gcloud`. Pega este bloque:

```bash
# ---- Valores del ambiente DEV ----
PROJECT_ID=taskflow-dev-mf1818
PROJECT_NUMBER=977902311183
GH_ENVIRONMENT=development
REPO=MariaFernanda1818/devops-cloud-deployment
GH_OWNER_ID=83258884
# ----------------------------------
SA_EMAIL="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud config set project "$PROJECT_ID"

# APIs necesarias (gratuitas)
gcloud services enable \
  iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  cloudresourcemanager.googleapis.com serviceusage.googleapis.com \
  firebase.googleapis.com firebasehosting.googleapis.com \
  firebaserules.googleapis.com firestore.googleapis.com

# Cuenta de servicio de despliegue, sin claves
gcloud iam service-accounts create github-deployer \
  --display-name="GitHub Actions deployer (${GH_ENVIRONMENT})"

# Roles mínimos: Hosting, reglas, índices y verificación de APIs
for ROLE in roles/firebasehosting.admin roles/firebaserules.admin \
            roles/datastore.indexAdmin roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" --role="$ROLE" --condition=None --quiet >/dev/null
done

# Pool y proveedor OIDC de GitHub, restringidos al dueño y al repositorio
gcloud iam workload-identity-pools create github \
  --location=global --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github-oidc \
  --location=global --workload-identity-pool=github \
  --display-name="GitHub OIDC" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner_id=assertion.repository_owner_id,attribute.environment=assertion.environment" \
  --attribute-condition="assertion.repository_owner_id=='${GH_OWNER_ID}' && assertion.repository=='${REPO}'"

# Solo los jobs del environment indicado pueden usar la cuenta de servicio
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --role=roles/iam.workloadIdentityUser \
  --member="principal://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/subject/repo:${REPO}:environment:${GH_ENVIRONMENT}"

# Valores para GitHub
echo "GCP_WORKLOAD_IDENTITY_PROVIDER = $(gcloud iam workload-identity-pools providers describe github-oidc --location=global --workload-identity-pool=github --format='value(name)')"
echo "GCP_SERVICE_ACCOUNT            = ${SA_EMAIL}"
```

Para QA y PDN, repite el bloque en su proyecto cambiando `PROJECT_ID`, `PROJECT_NUMBER` y `GH_ENVIRONMENT` (`qa` / `production`).

> Si algún comando pide habilitar facturación, **detente**: no actives Blaze y avísame.
> Si el primer despliegue falla con `403 ... Permission 'X' denied`, agrega solo el rol que contiene ese permiso; no uses roles amplios como *Editor* o *Firebase Admin*.

### 2.2 Alternativa con clave JSON (no recomendada)

Solo si WIF no funcionara: crea una clave JSON para `github-deployer`, guárdala como secreto `FIREBASE_SERVICE_ACCOUNT` del environment y elimínala de tu equipo. El workflow la usa solo si **no** existe la variable `GCP_WORKLOAD_IDENTITY_PROVIDER`.

---

## 3. GitHub Environments

Ruta: **GitHub → repositorio → Settings → Environments → New environment**.

### `development` (configúralo ahora)

| Tipo | Nombre | Valor |
|---|---|---|
| Environment **variable** | `FIREBASE_PROJECT_ID` | `taskflow-dev-mf1818` |
| Environment **variable** | `GCP_WORKLOAD_IDENTITY_PROVIDER` | Salida del paso 2.1 (`projects/977902311183/locations/global/workloadIdentityPools/github/providers/github-oidc`) |
| Environment **variable** | `GCP_SERVICE_ACCOUNT` | `github-deployer@taskflow-dev-mf1818.iam.gserviceaccount.com` |
| Deployment branches and tags | *Selected branches and tags* | Regla: `develop` |

No hace falta ningún **secret**: con WIF todos los valores son identificadores no sensibles.

### `qa` y `production` (créalos ahora, aunque todavía no tengan proyecto)

Crea los environments vacíos **antes de subir `qa` o `main`**. Si un workflow referencia un environment que no existe, GitHub lo crea automáticamente **sin protección**.

- `qa` → Deployment branches: `qa`.
- `production` → ✅ **Required reviewers**: tu usuario (y el docente si aplica) · Deployment branches: `main` y tags `v*`.

---

## 4. Protección de ramas

**Settings → Rules → Rulesets** (o *Branches*). Configúrala después del primer push, cuando los checks ya existan:

- `develop`, `qa`, `main`: requerir PR y los checks `Lint, tipos, pruebas unitarias y build`, `Reglas de seguridad de Firestore (emulador)`, `E2E con emuladores (Chromium escritorio y móvil)`.
- `qa` y `main`: además, `Validar rama de origen`.

---

## 5. Restringir la API key web (recomendado)

Google Cloud Console → **APIs y servicios → Credenciales** → “Browser key (auto created by Firebase)” → *Restricciones de aplicaciones* → **Sitios web**:
`https://taskflow-dev-mf1818.web.app/*` y `https://taskflow-dev-mf1818.firebaseapp.com/*`.

---

## 6. Primer despliegue (solo DEV)

1. `git push -u origin develop`. Al ser la primera rama del repositorio vacío, GitHub la marcará como rama por defecto; se cambia a `main` cuando subamos `main`.
2. **Actions → CD**: corren los 4 jobs de CI y luego **DEV**. Los jobs QA y PRODUCCIÓN aparecen como *skipped*.
3. Al terminar, el smoke test verifica HTTPS, la app, el commit y ambiente en `version.json`, las cabeceras de seguridad, las reescrituras SPA y que `init.json` corresponda a `taskflow-dev-mf1818`.

## 7. Evidencias a capturar

- Run de CD en verde con el resumen del smoke test y el registro del despliegue.
- Settings → Environments (`development` con su regla de ramas; `production` con revisores).
- La URL DEV abierta con la insignia **DEV** y el commit en el pie.
- Firebase Console → Hosting (historial de versiones) y Firestore (tareas de prueba).
