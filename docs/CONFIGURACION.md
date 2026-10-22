# Guía de configuración de la infraestructura

Pasos manuales, que se hacen una sola vez, para habilitar los tres ambientes. Ninguno requiere tarjeta de crédito ni activar facturación.

> Convención usada en esta guía: `<sufijo>` = algo único, p. ej. tus iniciales + número (`mfv27`). Los IDs de proyecto de Firebase son globales y no se pueden cambiar después.

## 1. Crear los tres proyectos Firebase

Repite para **dev**, **qa** y **prod** en https://console.firebase.google.com:

1. **Agregar proyecto** → nombre `taskflow-dev-<sufijo>` (igual con `qa` y `prod`). Anota el **ID del proyecto** que muestra la consola.
2. Google Analytics: **desactivado** (no se necesita).
3. Verifica que el plan sea **Spark (gratuito)**. **No** actualices a Blaze.
4. **Build → Firestore Database → Crear base de datos** → modo **producción** → ubicación (p. ej. `nam5` o `southamerica-east1`, la misma en los tres).
5. **Build → Authentication → Comenzar → Método de acceso → Anónimo → Habilitar.**
6. **Build → Hosting → Comenzar** (solo para activar el sitio por defecto `<id-proyecto>.web.app`; no hace falta ejecutar los comandos que sugiere).
7. **Configuración del proyecto → General → Tus apps → Agregar app web (</>)** con apodo `taskflow-web`, sin marcar “configurar Hosting”. Esto genera la configuración web que Hosting publicará en `/__/firebase/init.json`.

## 2. Cuenta de servicio para el despliegue (una por proyecto)

En https://console.cloud.google.com, con el proyecto correspondiente seleccionado:

1. **IAM y administración → Cuentas de servicio → Crear cuenta de servicio** → nombre `github-deployer`.
2. Asigna los roles:
   - `Administrador de Firebase Hosting` (Firebase Hosting Admin)
   - `Administrador de reglas de Firebase` (Firebase Rules Admin)
   - `Administrador de índices de Cloud Datastore` (Cloud Datastore Index Admin)
   - `Consumidor de Service Usage` (Service Usage Consumer)
3. Abre la cuenta → **Claves → Agregar clave → JSON**. Se descarga un archivo.
   - **No lo guardes dentro del repositorio.** Úsalo en el paso 3 y luego bórralo de tu equipo.

> Si el primer despliegue falla con `403 PERMISSION_DENIED`, el log indicará el permiso faltante. Agrega ese rol puntual en lugar de dar permisos amplios.

## 3. GitHub Environments (Settings → Environments)

Crea tres environments con exactamente estos nombres:

| Environment | Variable `FIREBASE_PROJECT_ID` | Secreto `FIREBASE_SERVICE_ACCOUNT` | Reglas de protección |
|---|---|---|---|
| `development` | ID del proyecto dev | JSON completo de la clave dev | Deployment branches: `develop` |
| `qa` | ID del proyecto qa | JSON completo de la clave qa | Deployment branches: `qa` |
| `production` | ID del proyecto prod | JSON completo de la clave prod | **Required reviewers**: tú (y el docente si aplica) · Deployment branches: `main` y tags `v*` · *Prevent self-review* opcional |

- La **variable** se crea en *Environment variables*.
- El **secreto** se crea en *Environment secrets*: pega todo el contenido del JSON.

## 4. Protección de ramas (Settings → Branches → Add rule), o Rulesets

Para `develop`, `qa` y `main`:

- ✅ Require a pull request before merging
- ✅ Require status checks to pass: `Lint, tipos, pruebas unitarias y build`, `Reglas de seguridad de Firestore (emulador)`, `E2E con emuladores (Chromium escritorio y móvil)`
- Para `qa` y `main`, además: `Validar rama de origen` (promotion guard)
- ✅ Do not allow bypassing the above settings (opcional, recomendado en `main`)

Los nombres de los checks aparecen en la lista después de que los workflows se ejecutan al menos una vez.

## 5. Restringir la API key web (recomendado)

Google Cloud Console → **APIs y servicios → Credenciales** → la clave “Browser key (auto created by Firebase)” → *Restricciones de aplicaciones* → **Sitios web**: agrega `https://<id-proyecto>.web.app/*` y `https://<id-proyecto>.firebaseapp.com/*`. Repite en cada proyecto.

## 6. Primer despliegue

1. Push de `develop` → revisar **Actions → CD** → job DEV en verde → abrir la URL del environment.
2. PR `develop → qa` → merge → job QA ejecuta smoke test y aceptación E2E contra la URL real.
3. PR `qa → main` → merge → el job PRODUCCIÓN queda **Waiting for review** → *Review deployments* → **Approve** → despliegue y smoke test.
4. Registrar las tres URLs reales en el README (sección 1).

## 7. Evidencias a capturar para la entrega

- Actions: un run de CD por ambiente en verde (resumen con tabla del smoke test y registro del despliegue).
- Un run donde una prueba falla y **no** se despliega (p. ej. un PR con un test roto).
- La pantalla de aprobación pendiente de `production` y el registro de quién aprobó.
- Settings → Environments y Branch protection configurados.
- Las tres URLs abiertas mostrando la insignia DEV / QA / PRODUCCIÓN y el commit en el pie.
- Firebase Console: Hosting (historial de versiones) y Firestore (datos de demostración) de cada proyecto.
