# Cloudflare en Codex

Se siguió la [guía oficial de configuración para agentes](https://developers.cloudflare.com/agent-setup/prompt.md), en la sección de Codex.

## Instalado en la computadora del propietario

- 22 habilidades oficiales del repositorio `cloudflare/skills`, instaladas en `%USERPROFILE%\.codex\skills\` mediante el instalador de habilidades de Codex.
- Servidor MCP `cloudflare`, habilitado en `%USERPROFILE%\.codex\config.toml`, con URL `https://mcp.cloudflare.com/mcp`.
- Autorización OAuth completada personalmente por el propietario con permisos iniciales mínimos. Las credenciales no se guardan en este repositorio.
- Respaldo de la configuración anterior creado antes de registrar el servidor MCP.

Las habilidades se detectan en el siguiente turno; reinicia Codex para cargar el nuevo servidor MCP. La CLI opcional `cf` en beta no se instaló.

## Configurar otra computadora

Cada compañero autoriza su propia cuenta; no se copia el archivo de credenciales del propietario. La guía oficial publica estos comandos para Codex:

```sh
npx -y skills add cloudflare/skills --skill '*' --yes --global
codex mcp add cloudflare --url https://mcp.cloudflare.com/mcp
codex mcp login cloudflare
```

Si `mcp add` inicia automáticamente la autorización OAuth, completar ese flujo es suficiente; no es necesario repetir el login. Después reinicia Codex.

Mantén los permisos limitados al trabajo que necesites realizar. El acceso a Cloudflare debe concederlo el propietario mediante miembros de cuenta; la autorización MCP de una persona no da acceso a los otros desarrolladores.

## Dos conexiones distintas

La conexión MCP permite que Codex use herramientas de Cloudflare. La integración **Cloudflare Workers and Pages** en GitHub permite que Pages construya y despliegue los commits automáticamente. Una no sustituye a la otra. La integración de GitHub debe limitarse al repositorio `spherex-explorer`.
