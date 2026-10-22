# Guía de configuración de la infraestructura

Pasos manuales, que se hacen una sola vez, para habilitar los tres ambientes. Ninguno requiere tarjeta de crédito ni activar facturación (plan **Spark**).

| Ambiente | Proyecto Firebase | Número de proyecto | GitHub Environment | Rama |
|---|---|---|---|---|
| DEV | `taskflow-dev-mf1818` | `977902311183` | `development` | `develop` |
| QA | _pendiente_ | _pendiente_ | `qa` | `qa` |
| PDN | _pendiente_ | _pendiente_ | `production` | `main` |

Identificadores de GitHub (públicos, obtenidos de `api.github.com`):

| Dato | Valor |
|---|---|
| Repositorio | `MariaFernanda1818/devops-cloud-deployment` |
| ID numérico del repositorio | `1429098189` |
| ID numérico del propietario | `83258884` |

---

## 1. Proyecto Firebase (por ambiente)

En https://console.firebase.google.com:

1. Crear el proyecto (plan Spark, sin Google Analytics).
2. **Firestore Database** → crear `(default)` en modo producción. DEV usa `nam5`; usa la misma ubicación en QA y PDN.
3. **Authentication** → Método de acceso → **Anónimo** → Habilitar.
4. **Hosting** → Comenzar.
5. **Configuración del proyecto → General → Tus apps** → registrar app web.
6. **Vincular la app web al sitio de Hosting** (sección *Firebase Hosting* de la tarjeta de la app). Así `/__/firebase/init.json` entrega la configuración de esta app. En DEV ya está vinculado (`taskflow-web-dev`).

> **Variables `VITE_*`: no se necesitan en GitHub.** La configuración web no se inyecta en el build; cada sitio la sirve en `/__/firebase/init.json`. Las `VITE_FIREBASE_*` de `src/vite-env.d.ts` son opcionales y solo sirven para pruebas locales. El ambiente que se muestra en la app lo define el pipeline con `APP_ENV`.

---

## 2. Autenticación de GitHub Actions sin claves (Workload Identity Federation)

GitHub emite un token OIDC firmado y de corta duración en cada job. Google lo valida contra el proveedor configurado y entrega credenciales temporales (≈1 h) de la cuenta de servicio `github-deployer`. **No se crea ninguna clave JSON.**

### 2.1 Capas de restricción

| Capa | Dónde | Qué exige |
|---|---|---|
| 1. Condición del proveedor OIDC | Pool `github` / proveedor `github-oidc` | `repository_id == 1429098189` **y** `repository_owner_id == 83258884` **y** `repository == MariaFernanda1818/devops-cloud-deployment` **y** `environment == development` |
| 2. Principal autorizado en la cuenta de servicio | IAM de `github-deployer` | Solo el sujeto `repo:MariaFernanda1818/devops-cloud-deployment:environment:development` tiene `roles/iam.workloadIdentityUser` |
| 3. Roles de la cuenta de servicio | IAM del proyecto | Solo los 4 roles de §2.3 |
| 4. GitHub Environment | Settings → Environments | El environment `development` solo acepta jobs de la rama `develop` |

- Los **IDs numéricos** no cambian si se renombra la cuenta o el repositorio. Esto impide que otra cuenta que registre el nombre liberado obtenga acceso.
- La **comparación por nombre** hace que la autenticación falle de forma segura (se deniega) si el repositorio se renombra.

### 2.2 Verificación del principal IAM para `development`

El claim `sub` del token de GitHub para un job que declara `environment:` tiene, por defecto, este formato:

```
repo:<owner>/<repo>:environment:<nombre-del-environment>
```

En este repositorio el job de despliegue (`.github/workflows/deploy-firebase.yml`) declara `environment.name: ${{ inputs.github_environment }}` y `cd.yml` lo invoca con `development` para la rama `develop`. Además, en workflows reutilizables el `sub` corresponde al repositorio que los invoca. El sujeto esperado es entonces:

```
repo:MariaFernanda1818/devops-cloud-deployment:environment:development
```

y el principal que recibe `roles/iam.workloadIdentityUser`:

```
principal://iam.googleapis.com/projects/977902311183/locations/global/workloadIdentityPools/github/subject/repo:MariaFernanda1818/devops-cloud-deployment:environment:development
```

Notas:
- La comparación distingue mayúsculas y minúsculas. `MariaFernanda1818` coincide con el nombre devuelto por la API de GitHub.
- Esto supone que el repositorio **no** tiene una plantilla personalizada del claim `sub`, que es lo predeterminado. Si alguien la personalizara, el login fallaría con `unauthorized_client` / `subject` (falla segura) y habría que ajustar el principal.
- Los jobs de CI (pruebas) no declaran environment, así que su `sub` no coincide y **no pueden** obtener credenciales.

### 2.3 Permisos mínimos verificados

Revisados en el código de `firebase-tools` 15.34.1 (la versión fijada en `package-lock.json`):

| Rol | Por qué es necesario (archivo de `firebase-tools/lib`) |
|---|---|
| `roles/firebasehosting.admin` | Comprobación previa `firebase.projects.get` + `firebasehosting.sites.update` (`requirePermissions.js`, `deploy/index.js`); lectura del sitio, subida de versión y release (`deploy/hosting/*`) |
| `roles/firebaserules.admin` | Compilar, crear el ruleset y publicar el release de `cloud.firestore` (`rulesDeploy.js`, `deploy/firestore/deploy.js`) |
| `roles/datastore.indexAdmin` | La comprobación previa de **cualquier** destino `firestore` (también `firestore:rules`) exige `datastore.indexes.list/create/update/delete`; sin ellos el deploy aborta con *Authorization failed* (`deploy/index.js` → `TARGET_PERMISSIONS.firestore`). También despliega `firestore.indexes.json` y lee los metadatos de la base (`getDatabase`) |
| `roles/serviceusage.serviceUsageConsumer` | `ensureApiEnabled.js` consulta `services.get` para confirmar que la API de Firestore está activa. Este rol **no** permite habilitar APIs |

Lo que la cuenta **no** puede hacer:
- leer ni escribir documentos de Firestore (no tiene `datastore.entities.*`);
- crear bases de datos, administrar usuarios de Auth, cambiar IAM, habilitar APIs ni tocar facturación;
- actuar sobre otros proyectos (QA y PDN tendrán su propia cuenta).

> Para reducir aún más el alcance se podría crear un **rol personalizado** con la lista exacta de permisos. No lo hacemos aquí porque los roles predefinidos se mantienen solos cuando Firebase agrega permisos, y el beneficio adicional es marginal.

### 2.4 APIs y plan Spark

| API | Para qué | Estado esperado |
|---|---|---|
| `iam.googleapis.com` | Cuentas de servicio y pools de identidad | Probablemente hay que habilitarla |
| `iamcredentials.googleapis.com` | Emitir tokens temporales de la cuenta de servicio | Probablemente hay que habilitarla |
| `sts.googleapis.com` | Intercambiar el token de GitHub por uno de Google | Probablemente hay que habilitarla |
| `cloudresourcemanager.googleapis.com` | Políticas IAM del proyecto y `testIamPermissions` | Probablemente hay que habilitarla |
| `serviceusage.googleapis.com`, `firebase.googleapis.com`, `firebasehosting.googleapis.com`, `firebaserules.googleapis.com`, `firestore.googleapis.com` | Servicios de Firebase | Ya habilitadas al configurar Firebase; el script solo lo verifica |

- Ninguna de estas APIs cobra por uso ni exige cuenta de facturación. Las que sí lo exigen son, por ejemplo, Cloud Functions, Cloud Build, Artifact Registry o Cloud Run, que **no** se usan aquí. Workload Identity Federation no tiene costo.
- **Esto no se puede comprobar desde fuera sin intentarlo.** Por eso el script primero lista las APIs ya activas, habilita **solo las faltantes una por una** y **se detiene** si Google responde con cualquier error. Un error de facturación diría algo como *billing account … required*. Si ocurre, **no actives Blaze** y avísame.

### 2.5 Script final de Cloud Shell (DEV)

1. Abre https://console.cloud.google.com/welcome?project=taskflow-dev-mf1818 y verifica arriba que el proyecto seleccionado sea **taskflow-dev-mf1818**.
2. Abre **Cloud Shell** (icono `>_`). Es gratuito y no requiere facturación.
3. Pega el bloque completo. Es **idempotente**: si se interrumpe, puedes volver a ejecutarlo sin duplicar recursos.

```bash
#!/usr/bin/env bash
# TaskFlow · Workload Identity Federation para GitHub Actions · ambiente DEV
set -euo pipefail

# ---------- Parámetros del ambiente ----------
PROJECT_ID="taskflow-dev-mf1818"
PROJECT_NUMBER="977902311183"
GH_ENVIRONMENT="development"
REPO="MariaFernanda1818/devops-cloud-deployment"
REPO_ID="1429098189"
OWNER_ID="83258884"
# --------------------------------------------
POOL_ID="github"
PROVIDER_ID="github-oidc"
SA_NAME="github-deployer"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SUBJECT="repo:${REPO}:environment:${GH_ENVIRONMENT}"
PRINCIPAL="principal://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/subject/${SUBJECT}"
ROLES=(
  roles/firebasehosting.admin
  roles/firebaserules.admin
  roles/datastore.indexAdmin
  roles/serviceusage.serviceUsageConsumer
)
APIS=(
  iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com
  cloudresourcemanager.googleapis.com serviceusage.googleapis.com
  firebase.googleapis.com firebasehosting.googleapis.com
  firebaserules.googleapis.com firestore.googleapis.com
)

echo "== 0. Verificaciones previas"
gcloud config set project "$PROJECT_ID" --quiet
ACTUAL_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
if [[ "$ACTUAL_NUMBER" != "$PROJECT_NUMBER" ]]; then
  echo "ERROR: el número de proyecto es $ACTUAL_NUMBER, se esperaba $PROJECT_NUMBER"; exit 1
fi
echo "Proyecto $PROJECT_ID ($PROJECT_NUMBER) OK"

echo "== 1. APIs (solo se habilitan las faltantes; se detiene ante cualquier error)"
ENABLED="$(gcloud services list --enabled --format='value(config.name)')"
for API in "${APIS[@]}"; do
  if grep -qx "$API" <<<"$ENABLED"; then
    echo "  ya habilitada: $API"
  else
    echo "  habilitando:   $API"
    if ! gcloud services enable "$API" --quiet; then
      echo "ERROR al habilitar $API. Si menciona facturación (billing), NO actives Blaze: detente y reporta el mensaje."
      exit 1
    fi
  fi
done

echo "== 2. Cuenta de servicio de despliegue (sin claves)"
if ! gcloud iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_NAME" \
    --display-name="GitHub Actions deployer (${GH_ENVIRONMENT})" \
    --description="Despliega Hosting y reglas de Firestore desde GitHub Actions via OIDC. Sin claves."
fi

echo "== 3. Roles mínimos en el proyecto"
for ROLE in "${ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" --role="$ROLE" --condition=None --quiet >/dev/null
  echo "  $ROLE"
done

echo "== 4. Pool de identidades"
if ! gcloud iam workload-identity-pools describe "$POOL_ID" --location=global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL_ID" \
    --location=global --display-name="GitHub Actions"
fi

echo "== 5. Proveedor OIDC de GitHub (repositorio, propietario y environment)"
CONDITION="assertion.repository_id=='${REPO_ID}' && assertion.repository_owner_id=='${OWNER_ID}' && assertion.repository=='${REPO}' && assertion.environment=='${GH_ENVIRONMENT}'"
MAPPING="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id,attribute.environment=assertion.environment,attribute.ref=assertion.ref"
if gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
     --location=global --workload-identity-pool="$POOL_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers update-oidc "$PROVIDER_ID" \
    --location=global --workload-identity-pool="$POOL_ID" \
    --attribute-mapping="$MAPPING" --attribute-condition="$CONDITION"
else
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
    --location=global --workload-identity-pool="$POOL_ID" \
    --display-name="GitHub OIDC" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="$MAPPING" --attribute-condition="$CONDITION"
fi

echo "== 6. Autorizar SOLO al environment ${GH_ENVIRONMENT} a usar la cuenta de servicio"
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --role=roles/iam.workloadIdentityUser --member="$PRINCIPAL" --condition=None --quiet >/dev/null

echo
echo "================= VERIFICACIÓN ================="
echo "-- Condición del proveedor:"
gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --location=global --workload-identity-pool="$POOL_ID" --format='value(attributeCondition)'
echo "-- Principales que pueden usar la cuenta de servicio (debe ser solo uno):"
gcloud iam service-accounts get-iam-policy "$SA_EMAIL" \
  --flatten='bindings[].members[]' --format='table(bindings.role,bindings.members)'
echo "-- Roles de la cuenta de servicio en el proyecto (deben ser exactamente 4):"
gcloud projects get-iam-policy "$PROJECT_ID" \
  --flatten='bindings[].members[]' --filter="bindings.members:serviceAccount:${SA_EMAIL}" \
  --format='value(bindings.role)'
echo "-- Claves gestionadas por el usuario (debe estar vacío):"
gcloud iam service-accounts keys list --iam-account="$SA_EMAIL" --managed-by=user --format='value(name)'

echo
echo "================= VALORES PARA GITHUB (environment: ${GH_ENVIRONMENT}) ================="
echo "FIREBASE_PROJECT_ID            = ${PROJECT_ID}"
echo "GCP_WORKLOAD_IDENTITY_PROVIDER = $(gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" --location=global --workload-identity-pool="$POOL_ID" --format='value(name)')"
echo "GCP_SERVICE_ACCOUNT            = ${SA_EMAIL}"
```

**Resultado esperado de la verificación:**
- La condición contiene los tres identificadores y `assertion.environment=='development'`.
- En la cuenta de servicio, un solo binding `roles/iam.workloadIdentityUser` → `principal://…/subject/repo:MariaFernanda1818/devops-cloud-deployment:environment:development`.
- Exactamente los 4 roles de §2.3.
- Ninguna clave gestionada por el usuario.
- `GCP_WORKLOAD_IDENTITY_PROVIDER` = `projects/977902311183/locations/global/workloadIdentityPools/github/providers/github-oidc`.

Para QA y PDN se reutiliza el script cambiando `PROJECT_ID`, `PROJECT_NUMBER` y `GH_ENVIRONMENT` (`qa` / `production`).

> Si el primer despliegue falla con `403 … Permission 'X' denied`, comparte el mensaje: se agrega solo el rol que contenga ese permiso, nunca *Editor* ni *Firebase Admin*.

### 2.6 Alternativa con clave JSON (no recomendada)

Solo si WIF no funcionara: crea una clave JSON para `github-deployer`, guárdala como secreto `FIREBASE_SERVICE_ACCOUNT` del environment y elimínala de tu equipo. El workflow la usa solo si **no** existe la variable `GCP_WORKLOAD_IDENTITY_PROVIDER`.

---

## 3. Configuración de GitHub

### 3.1 Permisos de Actions del repositorio

**Settings → Actions → General**:
- *Actions permissions*: **Allow all actions and reusable workflows**. Si prefieres restringir, permite `actions/*` y `google-github-actions/*`.
- *Workflow permissions*: **Read repository contents and packages permissions**. Los workflows piden `id-token: write` explícitamente solo en el job de despliegue.
- *Fork pull request workflows*: deja activado **Require approval for all external contributors**. El repositorio es público.

### 3.2 Environment `development`

**Settings → Environments → New environment** → nombre exacto `development`:

1. **Deployment branches and tags** → *Selected branches and tags* → *Add deployment branch or tag rule* → tipo **Branch**, patrón `develop`.
2. **Environment variables** → *Add environment variable* (no son secretos, son identificadores):

| Nombre | Valor |
|---|---|
| `FIREBASE_PROJECT_ID` | `taskflow-dev-mf1818` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/977902311183/locations/global/workloadIdentityPools/github/providers/github-oidc` (copia el valor que imprime el script) |
| `GCP_SERVICE_ACCOUNT` | `github-deployer@taskflow-dev-mf1818.iam.gserviceaccount.com` |

3. **Environment secrets**: ninguno.

> Crea las variables en el **environment**, no como *Repository variables*. Así cada ambiente tiene sus propios valores y un job de otro ambiente no puede leerlos.

### 3.3 Environments `qa` y `production` (crearlos ya, vacíos)

Créalos **antes de subir las ramas `qa` o `main`**. Si un workflow referencia un environment inexistente, GitHub lo crea automáticamente **sin protección**.

- `qa` → Deployment branches: `qa`.
- `production` → ✅ **Required reviewers**: tu usuario (y el docente si aplica). Deployment branches: rama `main` y tag `v*`. Opcional: ✅ *Prevent self-review* si hay otro revisor.

### 3.4 Protección de ramas

Se configura **después del primer push**, cuando los checks ya existen: **Settings → Rules → Rulesets → New branch ruleset**.

- `develop`, `qa`, `main`: *Require a pull request before merging* y *Require status checks to pass*: `Lint, tipos, pruebas unitarias y build`, `Reglas de seguridad de Firestore (emulador)`, `E2E con emuladores (Chromium escritorio y móvil)`.
- `qa` y `main`: además `Validar rama de origen`.
- *Block force pushes* en las tres.

---

## 4. Restringir la API key web (recomendado)

Google Cloud Console → **APIs y servicios → Credenciales** → “Browser key (auto created by Firebase)” → *Restricciones de aplicaciones* → **Sitios web**:
`https://taskflow-dev-mf1818.web.app/*` y `https://taskflow-dev-mf1818.firebaseapp.com/*`.

---

## 5. Primer despliegue (solo DEV)

1. `git push -u origin develop`. Al ser la primera rama del repositorio vacío, GitHub la marcará como rama por defecto; se cambia a `main` cuando subamos `main`.
2. **Actions → CD**: corren los 4 jobs de CI y luego **DEV**. Los jobs QA y PRODUCCIÓN aparecen como *skipped*: sus condiciones exigen las ramas `qa`/`main`, y no se crean sus environments.
3. El job DEV valida la configuración, compila con `APP_ENV=dev`, se autentica por OIDC, despliega Hosting y reglas/índices de Firestore en `taskflow-dev-mf1818` y ejecuta el smoke test. El smoke test verifica HTTPS, la app, el commit y el ambiente en `version.json`, las cabeceras de seguridad, las reescrituras SPA y que `init.json` corresponda a `taskflow-dev-mf1818`.

### Errores posibles y su significado

| Mensaje | Causa probable |
|---|---|
| `Falta la variable FIREBASE_PROJECT_ID…` | Variable creada a nivel de repositorio en vez de environment, o nombre del environment distinto de `development` |
| `unable to retrieve … ID token` / `ACTIONS_ID_TOKEN_REQUEST_URL` | Falta `id-token: write`. Ya está en `cd.yml` y `deploy-firebase.yml`; revisa Settings → Actions si hay una política de organización |
| `unauthorized_client … attribute condition` | El token no cumple la condición del proveedor (ID de repo/propietario, nombre o environment) |
| `Permission 'iam.serviceAccounts.getAccessToken' denied` | El principal de §2.2 no coincide con el `sub` real del token |
| `Authorization failed … missing the following required permissions` | Falta alguno de los 4 roles en la cuenta de servicio |

## 6. Evidencias a capturar

- Run de CD en verde con el resumen del smoke test y el registro del despliegue.
- La salida de la sección **VERIFICACIÓN** del script (sin datos sensibles: solo identificadores).
- Settings → Environments (`development` con su regla de ramas; `production` con revisores).
- La URL DEV abierta con la insignia **DEV** y el commit en el pie.
- Firebase Console → Hosting (historial de versiones) y Firestore (tareas de prueba).
