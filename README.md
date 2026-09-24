# OEM Driver Explorer — Auditoría de Flota & Windows Update

Plataforma corporativa centralizada para la auditoría, validación de admisibilidad en **Microsoft Windows Update (WHQL)** y despliegue desatendido de controladores y firmware BIOS para equipos **Lenovo ThinkPad** y **HP ProBook / EliteBook**.

---

## Características Principales

- **Auditoría Multi-Fabricante Oficial:**
  - **Lenovo:** Integración con la API oficial v4 de Lenovo PC Support (ThinkPad T460 a T490, P15, L14, etc.).
  - **HP:** Catálogo de plataformas corporativas con compatibilidad para ProBook 440 (G5 a G11) y EliteBook 840 (G5 a G11).
- **Admisión en Microsoft Windows Update:**
  - Distingue qué controladores están ofertados vía Windows Update / Intune (firmados WHQL) frente a los exclusivos del portal OEM.
  - Muestra el nombre canónico oficial de Microsoft para facilitar su localización en perfiles de actualización de **Microsoft Intune**.
- **Detalle Técnico en Español:**
  - Desglose de vulnerabilidades corregidas (CVE), mejoras de estabilidad y guías de despliegue.
- **Auditoría e Instalación Local por PowerShell:**
  - Generación de comandos de una sola línea (`one-liner`) para terminales de clientes.
  - Validación de hardware local, escaneo Plug & Play de controladores instalados y menú interactivo de instalación desatendida.
- **Exportación de Datos:** Exportación a CSV compatible con Excel y JSON estructurado.

---

## Despliegue en Producción con Docker y Coolify

Esta aplicación está optimizada para desplegarse en **Coolify** bajo el dominio `oem.elfakir.com`.

### 1. Despliegue mediante Dockerfile
1. En el panel de Coolify, crea una nueva aplicación seleccionando tu repositorio Git.
2. Selecciona el tipo de construcción: **Dockerfile**.
3. Configura el dominio: `https://oem.elfakir.com`.
4. El puerto de escucha del contenedor es `3000`.
5. Coolify se encargará de gestionar el certificado SSL (Let's Encrypt) y el enrutamiento con Traefik automáticamente.

### 2. Despliegue local con Docker Compose
```bash
docker compose up -d --build
```
Accede desde tu navegador en: `http://localhost:3000`.

---

## Ejecución Local para Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servidor en modo desarrollo
npm run dev

# Iniciar servidor en modo producción
npm start
```

---

## Generación del Instalador Nativo Windows (.MSI)

Para generar el instalador de escritorio autónomo para despliegue en estaciones de trabajo:

```bash
npm run dist:msi
```
El instalador `.msi` se generará en la carpeta `dist/`, configurado para instalación corporativa por máquina (`perMachine: true`).

---

## Estructura del Proyecto

```
oem-driver-auditor/
├── Dockerfile                  # Imagen Docker optimizada para producción
├── docker-compose.yml          # Configuración de servicios para Coolify
├── server.js                   # API Gateway y servidor web Express
├── lib/
│   ├── lenovoService.js        # Integración con Lenovo PC Support API v4
│   ├── hpService.js            # Catálogo y normalización HP Image Assistant
│   ├── windowsCatalogService.js# Taxonomía y verificación WHQL Microsoft
│   ├── scriptGeneratorService.js# Generador dinámico de scripts PowerShell
│   └── translationService.js   # Enriquecimiento de descripciones técnicas
├── public/
│   ├── index.html              # Interfaz SPA principal
│   ├── detail.html             # Dossier técnico independiente
│   ├── app.js                  # Lógica de cliente, autocompletado y filtros
│   └── style.css               # Sistema de diseño y estilos visuales
└── electron/
    └── main.js                 # Proceso principal para aplicación de escritorio
```

---

## Licencia

Distribuido bajo licencia MIT.
