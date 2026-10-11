# Capítulo 05: Editor Gráfico de Diagramas (.rdb) y Transpilación Inversa

Además de transformar código JavaScript en diagramas de flujo, **RueditasDeBici.js** incluye una funcionalidad bidireccional única: permite **diseñar algoritmos visualmente desde cero** mediante un editor de diagramas (*Drag & Drop*) y **transpilar el diagrama resultante a código JavaScript ejecutable**.

---

## 1. ¿Qué es un Archivo `.rdb`?

Un archivo con extensión `.rdb` (*Rueditas de Bici Diagram*) es un documento estructurado en formato JSON que almacena la información topológica del algoritmo:
* Lista de nodos (identificadores, tipos, etiquetas de texto, posiciones `(x, y)`).
* Lista de aristas o conexiones (nodo origen, nodo destino, etiquetas de bifurcación "Sí" o "No").

VS Code asocia automáticamente la extensión `.rdb` con el editor personalizado de RueditasDeBici ([`DiagramEditorProvider`](file:///c:/programacion/RueditasDeBiciJs/src/providers/DiagramEditorProvider.ts)).

---

## 2. Creando tu Primer Diagrama `.rdb`

1. En el explorador de archivos de VS Code, crea un nuevo archivo con el nombre que prefieras y la extensión `.rdb`, por ejemplo: `calculadora.rdb`.
2. Haz clic sobre el archivo para abrirlo.
3. Si el archivo está vacío, la extensión generará automáticamente una **plantilla inicial canónica**:
   * Un nodo de **Inicio** en la parte superior.
   * Un nodo de **Fin** en la parte inferior.

```
          ┌─────────────────────────┐
          │         Inicio          │
          └─────────────────────────┘
                       │
                       │ (Espacio de trabajo listo para arrastrar nodos)
                       │
          ┌─────────────────────────┐
          │           Fin           │
          └─────────────────────────┘
```

---

## 3. La Paleta Lateral de Nodos (*Drag and Drop*)

En la barra lateral izquierda del editor encontrarás la paleta con las 8 categorías estándar de nodos. Puedes arrastrar cualquiera de ellos directamente sobre el lienzo:

```
┌─────────────────────────────────┐
│ NODOS                           │
├─────────────────────────────────┤
│ [ Inicio / Fin ] (Óvalo)        │  startEnd
│ [ Proceso      ] (Rectángulo)   │  process
│ [ Decisión     ] (Rombo)        │  decision
│ [ Mientras     ] (Hexágono)     │  loop
│ [ Entrada      ] (Paralelogramo)│  input
│ [ Salida       ] (Documento)    │  output
│ [ Variable     ] (Rectángulo)   │  variable
│ [ Constante    ] (Rectángulo)   │  constant
└─────────────────────────────────┘
```

### Comportamiento Automático de cada Tipo de Nodo:
* **Entrada (`input`):**  
  Al escribir texto como `edad`, el transpilador generará: `edad = prompt("Ingrese edad: ");`.  
  También puedes escribir explícitamente: `leer edad`.
* **Salida (`output`):**  
  Al escribir texto como `resultado` o `escribir "Hola"`, el transpilador generará: `console.log(resultado);`.
* **Variable (`variable`):**  
  Si escribes `total = 0`, el transpilador antepone automáticamente `let` y punto y coma: `let total = 0;`.
* **Constante (`constant`):**  
  Si escribes `TASA = 0.16`, el transpilador antepone `const`: `const TASA = 0.16;`.
* **Proceso (`process`):**  
  Para instrucciones de asignación o cálculo aritmético: `contador = contador + 1`.
* **Decisión (`decision`):**  
  Para condiciones booleanas: `edad >= 18` o `precio > 100`.

---

## 4. Cómo Conectar Nodos y Definir Bifurcaciones

Para conectar dos nodos:
1. Pasa el cursor sobre el conector circular (*handle*) en la parte inferior o lateral del nodo de origen.
2. Haz clic y arrastra la línea hasta el conector del nodo de destino.

### Selector de "Próxima Conexión":
En la barra lateral izquierda dispones de tres botones de configuración para tus conexiones:

```
┌──────────────────────────────────────────────┐
│ PRÓXIMA CONEXIÓN                             │
│ ┌──────────────┬──────────────┬────────────┐ │
│ │  [ Sí ]      │   [ No ]     │ [ Normal ] │ │
│ └──────────────┴──────────────┴────────────┘ │
└──────────────────────────────────────────────┘
```

* **`Sí` (Verde):** Selecciona esta opción antes de trazar la línea que saldrá de un rombo de decisión hacia el bloque que se ejecutará si la condición es verdadera.
* **`No` (Rojo):** Selecciona esta opción para la línea que saldrá hacia el bloque alternativo (falso).
* **`Normal` (Azul):** Para el flujo secuencial estándar entre procesos.

> [!TIP]
> **Crear Ciclos y Bucles:**  
> Puedes conectar el conector inferior de cualquier nodo de regreso a la parte superior de un nodo de **Decisión** o **Mientras** para modelar iteraciones.

---

## 5. Edición y Eliminación de Elementos

* **Editar el Texto de un Nodo:** Haz **doble clic** sobre cualquier nodo del lienzo. Se abrirá una ventana emergente donde podrás modificar el texto, variable o condición.
* **Eliminar un Nodo o Conexión:** Haz clic sobre el elemento para seleccionarlo y presiona la tecla `Supr` (`Delete`) o `Backspace`.

---

## 6. Transpilación a Código JavaScript (*GraphToCodeGenerator*)

En cualquier momento durante la construcción de tu diagrama, puedes comprobar cómo se traduce a código JavaScript real:

1. En la barra superior de herramientas, haz clic en el botón **`Ver Código`** (`Show Code`).
2. Se abrirá un modal con el código generado limpiamente:

```javascript
const prompt = require("prompt-sync")();

let precio = prompt("Ingrese precio: ");
let descuento = 0;
if (precio > 100) {
    descuento = precio * 0.10;
}
console.log("Total con descuento: ", precio - descuento);
```

Este código es 100% válido y compatible con Node.js, permitiendo a los docentes exportar las soluciones de los alumnos o a los estudiantes verificar si su lógica visual tiene correspondencia textual.

---

## 7. Simulación Directa en el Archivo `.rdb`

No es obligatorio compilar el diagrama a un archivo `.js` para probarlo:  
¡Puedes pulsar **`▶️ Simular en Vivo`** directamente sobre la pestaña del archivo `.rdb`!

El motor emulado recorrerá los nodos dibujados, solicitará los datos mediante la Consola Virtual y alimentará el visor de Memoria RAM exactamente igual que si estuviera ejecutando un archivo de código fuente.

---

[⬅️ Capítulo 04: Sintaxis JavaScript Soportada](04-sintaxis-javascript-soportada.md) | [Siguiente: Capítulo 06 - Ejemplos Prácticos Paso a Paso ➡️](06-ejemplos-practicos-paso-a-paso.md)
