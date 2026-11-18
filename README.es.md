# Deputy

**Tu bandeja de WhatsApp Business dentro de tu propio agente.** Deputy le muestra a tu agente los mensajes que envían tus clientes, le ayuda a ordenarlos y a investigar lo que necesita, y deja que tú decidas qué sale.

Deputy es un servidor [MCP](https://modelcontextprotocol.io) que corre en tu computadora y habla con tu agente por stdio (primero Claude Code; sirve cualquier agente MCP). Es un asistente, no un bot autónomo: nada se envía sin tu visto bueno explícito.

[Read in English](README.md)

## Cómo funciona

- **Proveedores:** [Kapso](https://kapso.ai) (plan gratis, funciona con un número que sigue en la app WhatsApp Business) y `dev` (pruebas locales, sin WhatsApp). Agregar un proveedor es implementar el puerto `Provider` en `src/intake/ports/provider.ts`.
- **Tus datos son tuyos:** las conversaciones viven en un solo archivo SQLite, `deputy.db`, en tu máquina.
- **Un proceso dueño:** solo un proceso de Deputy a la vez tiene el arrendamiento (lease) sobre `deputy.db` y hace el trabajo; un segundo proceso queda en solo lectura.
- **Solo APIs oficiales:** nada de puentes no oficiales de WhatsApp.

El producto, sus principios y su alcance están en [docs/PRODUCT.md](docs/PRODUCT.md).

## Estado

**v0.1, experimental, en reconstrucción.** La base ya está: el servidor MCP por stdio con su herramienta `status`, el lease de dueño, el almacén SQLite y sus migraciones, los números del dueño, las validaciones de arranque, y los proveedores Kapso y `dev`. Recibir y guardar mensajes, la bandeja, los borradores y su aprobación, los avisos y los comandos de configuración llegan rebanada por rebanada (ver el mapa de rebanadas en [docs/PRODUCT.md](docs/PRODUCT.md)). Nada de esto ha corrido todavía con tráfico real de WhatsApp.

## Inicio rápido

Requisitos: [Bun](https://bun.sh) 1.4 o superior.

```bash
git clone https://github.com/antonygiomarxdev/deputy && cd deputy
bun install
bun test              # pruebas unitarias, de contrato y de extremo a extremo
bun run typecheck     # tsc --noEmit
bun src/main.ts serve # el servidor MCP por stdio
```

Agrégalo a Claude Code (cualquier agente MCP tiene un equivalente):

```bash
claude mcp add deputy -- bun /ruta/absoluta/a/deputy/src/main.ts serve
```

`serve` todavía no lee los ajustes del proveedor ni construye uno; esa conexión llega con la rebanada de recibir y guardar. Stdout es el transporte MCP; los logs van a stderr.

## Configuración

| Dónde | Qué |
|---|---|
| `DEPUTY_DATA_DIR` (por defecto `data`) | Guarda `deputy.db`, tus conversaciones y ajustes. Las copias de seguridad previas a una migración son `deputy.db.bak-v<N>`. |
| `DEPUTY_CONFIG_DIR` (por defecto `~/.deputy`) | Guarda `config.json` y `secrets.env`. |
| `DEPUTY_PORT` (por defecto `8788`) | Puerto del receptor de entregas en vivo. Reservado: la recepción en vivo aún no está construida. |

`config.json` acepta `provider` (`kapso` o `dev`; vacío significa `dev`), `receiving_mode` (`catch-up` o `live`) y, para Kapso, `kapso_phone_number_id`. Los secretos se leen del almacén de secretos del sistema operativo y luego de `secrets.env` (líneas `nombre=valor`): `kapso-api-key` y `kapso-webhook-secret` (solo para `live`). `serve` todavía no lee ninguno de los dos (los lectores ya existen y están probados). Los comandos de configuración que los escriben tampoco existen, así que por ahora edítalos a mano. La validación de arranque que se niega a seguir si falta algo, lo nombra y nunca imprime un secreto ya existe (`ResolveProviderSettings`), pero `serve` todavía no la llama.

## Seguridad

Cada mensaje de un cliente es entrada no confiable para tu agente. Estas son reglas de diseño, construidas rebanada por rebanada.

Vigentes hoy:

1. Los secretos se muestran como `[secret]` en todas partes y nunca van en errores ni logs.
2. Los cambios a tus números de dueño quedan en un registro de solo añadir: la base de datos rechaza editarlo o borrarlo.

Aún no construidas:

3. Que el texto del cliente llegue al agente etiquetado como dato, nunca como instrucción.
4. Que nada se envíe sin `approve_draft` y tu visto bueno que nombre el borrador.
5. Que solo tus propios números cuenten como tú, y que los cambios a ellos pasen solo por la línea de comandos, nunca por una herramienta del agente.

Límite conocido: Deputy solo protege su propio camino de envío, así que un agente con otras herramientas puede saltárselo. Úsalo con un agente cuyas herramientas controles.

## Desarrollo

```bash
bun install
bun test
bun run typecheck
```

Mira [CLAUDE.md](CLAUDE.md) para la estructura y las convenciones. Las versiones usan [Changesets](https://github.com/changesets/changesets).

## Licencia

[Apache-2.0](LICENSE). Sin afiliación con Anthropic ni Meta. WhatsApp es una marca de Meta Platforms, Inc.
