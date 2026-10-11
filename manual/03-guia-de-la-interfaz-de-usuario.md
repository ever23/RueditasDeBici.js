# Capítulo 03: Guía Detallada de la Interfaz de Usuario

La interfaz de usuario de **RueditasDeBici.js** está diseñada bajo principios de ergonomía visual moderna: combina un tema oscuro de alto contraste, paneles flotantes organizados y micro-animaciones dinámicas para dirigir la atención cognitiva hacia los cambios de estado.

A continuación se detalla cada componente de la interfaz.

---

## 1. El Lienzo del Diagrama de Flujo (*Canvas*)

El área principal está impulsada por el motor gráfico **Vue Flow** y organizada automáticamente con el algoritmo de jerarquías de **Dagre**:

```
┌─────────────────────────────────────────────────────────────────┐
│ [ Minimapa ]                         [ Controles de Zoom +/- ]  │
│                                                                 │
│                   ┌───────────────────────┐                     │
│                   │      ( Inicio )       │ (Óvalo verde)       │
│                   └───────────┬───────────┘                     │
│                               │                                 │
│                               ▼                                 │
│                   ┌───────────────────────┐                     │
│                   │   let total = 0;      │ (Rectángulo azul)   │
│                   └───────────┬───────────┘                     │
│                               │                                 │
│                               ▼                                 │
│                             ╱   ╲                               │
│                           ╱  i < 5 ╲        (Rombo amarillo)    │
│                           ╲   ?    ╱                            │
│                             ╲   ╱                               │
│                               │                                 │
└───────────────────────────────┴─────────────────────────────────┘
```

### Funcionalidades del Lienzo:
* **Desplazamiento (Pan):** Haz clic con el botón izquierdo sobre el fondo y arrastra para moverte libremente por el diagrama.
* **Zoom Interactivo:** Usa la rueda del ratón (`Scroll`) para acercarte o alejarte, con un rango que va desde un 5% hasta un 400% de escala.
* **Minimapa:** Ubicado en una esquina, te permite ver una vista panorámica global del algoritmo cuando el código es extenso.
* **Controles de Vue Flow:** Botones rápidos para centrar la vista (`Fit View`), bloquear el lienzo o alternar pantalla completa.

---

## 2. La Barra de Control de Simulación (*SimToolbar*)

Ubicada en la parte superior del panel, te permite controlar la ejecución del código con la precisión de un reproductor multimedia:

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [ ▶️ Simular ]  [ ⏭️ Paso ]  [ ⏸️ Pausar ]  [ ⏹️ Detener ]  [ 🔄 Reiniciar ] | ⚡ [ 1000ms ▼ ] │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

| Control | Acción | Descripción |
| :--- | :--- | :--- |
| **`▶️ Simular en Vivo`** | Iniciar / Reproducir | Ejecuta el algoritmo de manera automática a la velocidad seleccionada. |
| **`⏭️ Paso`** | Avanzar un paso | Ideal para depuración. Ejecuta únicamente la siguiente instrucción y se detiene. |
| **`⏸️ Pausar`** | Pausar | Detiene temporalmente la simulación automática en el paso actual sin perder la memoria RAM. |
| **`⏹️ Detener`** | Detener simulación | Cancela la ejecución y regresa el diagrama a su estado de reposo. |
| **`🔄 Reiniciar`** | Reiniciar | Limpia la memoria RAM, reinicia el call stack y vuelve al nodo de `Inicio`. |
| **`⚡ Selector de Velocidad`** | Ajustar temporizador | Permite elegir entre: `2000ms` (Muy lento), `1500ms`, `1000ms` (Normal), `500ms` (Rápido) o `200ms` (Ultra rápido). |

---

## 3. El Inspector de Memoria RAM (*ScopePanel*)

El panel de **Memoria RAM** es el corazón didáctico de la extensión. Representa cómo el motor de JavaScript almacena y modifica los valores de las variables en la memoria física:

```
┌──────────────────────────────────────────────┐
│ 🧠 MEMORIA RAM                               │
├──────────────────────────────────────────────┤
│ ▼ Ámbito Global                              │
│   ┌──────────────┬──────────────┬────────┐   │
│   │ Variable     │ Tipo         │ Valor  │   │
│   ├──────────────┼──────────────┼────────┤   │
│   │ totalVentas  │ Number       │ 125.50 │   │
│   │ nombre       │ String       │ "Ana"  │   │
│   │ activo       │ Boolean      │ true   │   │
│   │ notas        │ Array(3)     │ [▼]    │   │
│   │   [0]        │ Number       │ 15     │   │
│   │   [1]        │ Number       │ 18     │   │
│   │   [2]        │ Number       │ 12     │   │
│   └──────────────┴──────────────┴────────┘   │
└──────────────────────────────────────────────┘
```

### Características Destacadas:
1. **Diferenciación de Ámbitos (Scope Hierarchy):**  
   Muestra claramente cuándo una variable pertenece al **Ámbito Global** y cuándo está confinada dentro del **Ámbito Local** de una función o bloque de iteración.
2. **Soporte para Arreglos y Objetos:**  
   Los arreglos pueden desplegarse haciendo clic para ver cada índice (`[0]`, `[1]`, etc.) y su longitud total.
3. **Micro-Animaciones de Alerta Visual:**  
   Cuando una variable cambia de valor (por ejemplo, `contador` pasa de `0` a `1`), la fila correspondiente en la tabla parpadea con un **destello amarillo brillante** durante 700 milisegundos. Esto asegura que el estudiante no pierda de vista la modificación de estado.

---

## 4. El Panel de Procesador / ALU (*CpuPanel*)

La **Unidad Aritmético Lógica (ALU)** es el componente de la CPU encargado de realizar cálculos matemáticos y comparaciones booleanas. Este panel traduce cada instrucción del paso actual a **lenguaje natural**:

```
┌────────────────────────────────────────────────────────┐
│ ⚙️ PROCESADOR (CPU / ALU)                              │
├────────────────────────────────────────────────────────┤
│ [Paso 6 / 14]                                          │
│ Cálculo UAL: precio(150) > 100 ➔ TRUE                  │
│ Bifurcación: Tomar camino VERDADERO (Sí)               │
└────────────────────────────────────────────────────────┘
```

### Ejemplos de mensajes de la CPU:
* **Asignaciones literales:** `CPU Cargar valor literal 10 ➔ Asignar a RAM [limite]`.
* **Operaciones matemáticas:** `Suma: total(45) + precio(15) ➔ 60`.
* **Desestructuración:** `CPU Desestructuración {} ➔ RAM [nombre: "Luis", edad: 20]`.
* **Saltos de control:** `SALTO DE CONTROL ➜ BREAK: Salir del Bucle`.
* **Subrutinas:** `CPU Retorno de Subrutina calcularIva() ➔ Valor devuelto: 24.8`.

---

## 5. La Consola Virtual Integrada (*ConsolePanel*)

Emula la terminal estándar de entrada y salida directamente en el lienzo:

```
┌────────────────────────────────────────────────────────┐
│ 💻 CONSOLA VIRTUAL                          [_] [X]    │
├────────────────────────────────────────────────────────┤
│ > Ingrese el precio del producto:                      │
│ ┌──────────────────────────────────────────┬─────────┐ │
│ │ 150                                      │ [Enviar]│ │
│ └──────────────────────────────────────────┴─────────┘ │
│ > Subtotal: 150                                        │
│ > Descuento aplicado: 15                               │
│ > Total a pagar: 135                                   │
└────────────────────────────────────────────────────────┘
```

* **Salida de Datos:** Captura automáticamente cualquier llamada a `console.log(...)`.
* **Entrada de Datos Interactiva:** Cuando el paso actual corresponde a una lectura por teclado (`prompt(...)`), la simulación se pausa automáticamente y muestra una caja de texto activa. Puedes ingresar el valor y pulsar **`Enter`** o hacer clic en **`Enviar`** para reanudar el flujo.
* **Ventana Flotante:** Puedes minimizarla, cerrarla o arrastrarla por el lienzo según tu comodidad.

---

## 6. Sincronización Bidireccional: Código ⇄ Diagrama

La extensión mantiene un enlace permanente entre el editor de texto de VS Code y la interfaz gráfica:

1. **Del Diagrama al Código:**  
   Haz clic sobre cualquier nodo del diagrama de flujo. El cursor del editor de VS Code saltará inmediatamente a la línea exacta de código que dio origen a ese nodo, decorándola con una línea de fondo azul y el icono de la bicicleta en el margen (*gutter*).
2. **Durante la Simulación:**  
   El nodo activo se resalta en el diagrama con una sombra brillante pulsante, y simultáneamente la línea de código correspondiente en el archivo `.js` se ilumina en el editor.
3. **Del Código al Diagrama:**  
   Cualquier modificación que guardes o escribas en el código se reflejará a los 300 ms en el diagrama sin necesidad de recargar la ventana.

---

## 7. Navegación Inteligente de Errores

Si cometes un error de sintaxis mientras programas (por ejemplo, olvidar cerrar un paréntesis o escribir una palabra clave incorrecta):

```
┌────────────────────────────────────────────────────────┐
│ ⚠️ Error de sintaxis: Unexpected token (Línea 8)       │
│    Haz clic aquí para ir a la línea del error          │
└────────────────────────────────────────────────────────┘
```

1. La interfaz muestra un **banner rojo destacado** en la parte superior del canvas.
2. Al hacer **clic sobre el banner**, el editor de VS Code salta automáticamente a la línea exacta y columna del error, posicionando el cursor para que puedas corregirlo al instante.

---

[⬅️ Capítulo 02: Instalación y Primeros Pasos](02-instalacion-y-primeros-pasos.md) | [Siguiente: Capítulo 04 - Sintaxis JavaScript Soportada ➡️](04-sintaxis-javascript-soportada.md)
