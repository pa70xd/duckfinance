# DuckFinance

App personal para registrar gastos e ingresos desde el teléfono y ver siempre cuánto queda de cada límite del presupuesto. El nombre es un guiño a un proyecto viejo; el pato pixel es el ícono.

- **Hosting:** GitHub Pages, sin servidor y sin build. HTML, CSS y JS planos.
- **Datos:** no viven aquí. Viven como JSON en un repo **privado** aparte; la app los lee y escribe con la API de contenidos de GitHub usando un token *fine-grained* que se guarda solo en el teléfono. Este repo no contiene datos personales.
- **Sin señal:** cada cambio se guarda primero en el teléfono (cola en `localStorage`) y se sube al volver la conexión. Si dos dispositivos escriben el mismo mes, se reaplican los cambios sobre la versión nueva (el `sha` de GitHub evita pisar datos).
- **Diseño:** calcado de Emerald.dev (Figma `P3kw7pfjeApvHESiqYbgVk`, frames Mobile): canvas `#F8F9FA` con la trama de 26px al 66 % (100 % sobre negro), líneas de registro `#ACACAC` con cruces, radio 0, botones planos Button/Web v1 (sm 40 · xl 56) sin sombra, Overused Grotesk Bold para títulos, Space Grotesk para texto, Minecraft para kickers y métricas (métrica enfrentada: cifra pixel + etiqueta verde en negrita), iconos pixel en los dos lenguajes del sitio (bits de 4px sobre 5px para navegación; puntos de 1.3px para la flecha de los botones) y la tecla 3D del sitio (PNG exportado de Figma) como objeto de acción. Animaciones CSS con `prefers-reduced-motion` respetado.

## Límites

Abre en la **semana** actual (lunes a domingo). Tocar el periodo lo voltea a **mes** y viceversa; las flechas avanzan de semana en semana o de mes en mes. Lo variable se reparte por día; los cargos fijos (`dias` en la categoría: días del mes en que se cobran) cuentan completos en su semana. Las categorías van ordenadas de la más cerca de su límite a la más lejana; los fijos ya cobrados, al final. Los fondos acumulables van aparte.

El **pato** (`js/duck.js`, sprites 16×16 con paleta de NES) cuenta cómo va el mes: feliz, nervioso (va más rápido que el mes o con varias categorías pasadas), mal (se pasó del total) o dormido (sin gastos). Al tocarlo dice por qué.

## Captura rápida

Tecla **Gasto** → monto y "qué fue". La app propone categoría y cuenta a partir del historial (`js/classify.js`); si no reconoce el texto, el gasto se guarda **por clasificar** (sin `categoria`), descuenta del presupuesto del mes y aparece arriba en Límites para resolverlo de un toque. Cada corrección alimenta el historial, así que la app aprende.

## Estructura

```
index.html            shell (CSP: solo se conecta a api.github.com)
css/app.css           tokens y componentes
js/icons.js           iconos pixel (bitmaps → SVG con bordes duros)
js/classify.js        propone categoría y cuenta por historial (concepto exacto, palabras y vocabulario semilla)
js/logic.js           cálculos: saldos, límites, fondos, deudas a meses, metas (sin DOM)
js/store.js           base de datos en GitHub + copia local + cola de cambios
js/app.js             pantallas: Límites (inicio), Movimientos, Cuentas, Metas, captura y ajustes
sw.js                 funciona sin conexión
fonts/  icons/  img/  fuentes de la marca (con sus licencias), íconos de la app, trama y teclas 3D de Emerald.dev
```

## Formato de la base (repo privado)

```
db/config.json                 config, cuentas, categorias (límites), deudas, metas
db/movimientos/AAAA-MM.json    un archivo por mes, un movimiento por línea
```

Movimiento: `{ id, fecha, concepto, monto, tipo, cuenta, destino?, categoria?, plan?, nota?, origen, creado?, editado? }`.
`tipo` ∈ Gasto · Ingreso · Reembolso · Pago de tarjeta · Transferencia · Compra a meses · Cuota a meses · Ajuste de saldo.

Cada guardado es un commit con mensaje legible (`Gasto: $350 Restaurantes y antojos (2026-09-14)`), así el historial del repo de datos es la bitácora.

## Conectar un teléfono

1. GitHub → Settings → Developer settings → [Fine-grained token](https://github.com/settings/personal-access-tokens/new).
2. Repository access: *Only select repositories* → el repo de datos. Permissions: *Contents → Read and write*. Nada más.
3. Abre la app, pega el token y en el menú del navegador elige *Agregar a pantalla de inicio*.

## Desarrollo local

```bash
python -m http.server 8765
```

`dev/` (ignorado por git) tiene un GitHub simulado en memoria para probar sin token.
