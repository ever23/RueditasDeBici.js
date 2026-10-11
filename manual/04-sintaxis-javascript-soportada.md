# Capítulo 04: Sintaxis JavaScript Soportada y Modelado Algorítmico

**RueditasDeBici.js** analiza tu código JavaScript mediante un Árbol de Sintaxis Abstracta (AST) generado por la biblioteca `acorn`. Esto significa que **no utiliza expresiones regulares simplistas ni trucos de texto**: comprende la estructura gramatical real del lenguaje.

A continuación se detalla todo el repertorio de sintaxis soportado por el analizador y el motor de simulación.

---

## 1. Declaración de Variables y Constantes

Puedes utilizar las palabras clave estándar de JavaScript: `let`, `const` y `var`.

```javascript
let contador = 0;
const PI = 3.14159;
let precio = 25.50;
let mensaje = "Bienvenido";
let esValido = true;
```

### Agrupación Visual Inteligente
Para evitar que un diagrama se llene de decenas de pequeños rectángulos verticales cuando declaras variables consecutivas, la extensión **agrupa automáticamente las declaraciones continuas** en un único nodo de proceso:

```
┌─────────────────────────────────┐
│ Declaraciones:                  │
│ • let contador = 0;             │
│ • const PI = 3.14159;           │
│ • let precio = 25.50;           │
└─────────────────────────────────┘
```

### Desestructuración de Objetos y Arreglos
La extensión soporta sintaxis moderna de desestructuración:

```javascript
// Desestructuración de objeto
const usuario = { nombre: "Carlos", edad: 22 };
const { nombre, edad } = usuario;

// Desestructuración de arreglo
const coordenadas = [10, 20, 30];
const [x, y, ...resto] = coordenadas;
```

---

## 2. Entrada de Datos por Teclado (`prompt-sync`)

Para emular la entrada clásica de consola en algoritmos síncronos, la extensión detecta el patrón canónico de `prompt-sync`:

```javascript
const prompt = require("prompt-sync")();

// 1. Lectura de cadenas de texto (String)
let ciudad = prompt("Ingrese su ciudad: ");

// 2. Lectura de números enteros o decimales (Number)
let cantidad = Number(prompt("Ingrese la cantidad de productos: "));
let sueldo = parseFloat(prompt("Ingrese su sueldo base: "));
let edad = parseInt(prompt("Ingrese su edad: "));
```

### ¿Cómo lo representa el Diagrama?
El analizador reconoce que la instrucción es una **Entrada de Datos** y la dibuja como un paralelogramo (estándar ANSI/ISO de E/S):

```
     ╱───────────────────────────────╱
    ╱  LEER [cantidad]              ╱  (Paralelogramo de Entrada)
   ╱   "Ingrese la cantidad:"      ╱
  ╱───────────────────────────────╱
```

---

## 3. Salida de Datos (`console.log`)

Cualquier invocación a `console.log(...)` es modelada como un nodo de salida y proyectada en la Consola Virtual:

```javascript
console.log("El cálculo ha finalizado.");
console.log("Total a pagar: " + total);

// Soporte completo para Template Literals (Plantillas de cadena)
console.log(`Cliente: ${nombre}, Descuento: ${descuento}%`);
```

---

## 4. Expresiones y Operaciones Evaluadas

El evaluador de expresiones ([`expressionEvaluator.ts`](file:///c:/programacion/RueditasDeBiciJs/src/analyzer/expressionEvaluator.ts)) resuelve matemáticamente y lógicamente las siguientes operaciones:

| Categoría | Operadores Soportados | Ejemplo en Código |
| :--- | :--- | :--- |
| **Aritméticos** | `+`, `-`, `*`, `/`, `%` | `let total = (precio * cant) - desc;` |
| **Relacionales** | `>`, `<`, `>=`, `<=`, `===`, `!==`, `==`, `!=` | `if (promedio >= 9.5) { ... }` |
| **Lógicos** | `&&` (Y), `||` (O), `!` (NO) | `if (edad >= 18 && tieneLicencia) { ... }` |
| **Unarios y Actualización** | `++`, `--`, `typeof`, `-` (negación) | `contador++; indice--;` |
| **Operador Ternario** | `condicion ? valorTrue : valorFalse` | `let estado = nota >= 10 ? "Aprobado" : "Reprobado";` |
| **Librería Math Nativa** | `Math.floor()`, `Math.ceil()`, `Math.round()`, `Math.max()`, `Math.min()`, `Math.abs()`, `Math.pow()`, `Math.sqrt()` | `let hipotenusa = Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2));` |

---

## 5. Estructuras Condicionales (Toma de Decisiones)

### A. Condicional Simple y Doble (`if / else`)

```javascript
let calificacion = Number(prompt("Nota: "));

if (calificacion >= 10) {
    console.log("Materia Aprobada");
} else {
    console.log("Materia Reprobada");
}
```

* Se representa como un **rombo de decisión**.
* La rama derecha o inferior corresponde al camino **Sí (Verdadero)**.
* La rama lateral corresponde al camino **No (Falso)**.
* Ambas ramas convergen limpiamente en el flujo principal tras finalizar el bloque.

### B. Condicional Anidado (`if / else if / else`)

```javascript
if (temperatura > 30) {
    console.log("Clima Caluroso");
} else if (temperatura >= 18) {
    console.log("Clima Agradable");
} else {
    console.log("Clima Frío");
}
```

### C. Selección Múltiple (`switch / case / default`)

```javascript
let opcion = Number(prompt("Seleccione opción (1-3): "));

switch (opcion) {
    case 1:
        console.log("Consultar Saldo");
        break;
    case 2:
        console.log("Realizar Depósito");
        break;
    case 3:
        console.log("Realizar Retiro");
        break;
    default:
        console.log("Opción no válida");
        break;
}
```

---

## 6. Estructuras de Repetición (Bucles / Ciclos)

RueditasDeBici.js modela fielmente todos los bucles fundamentales de JavaScript, conectando las aristas de retroalimentación hacia la condición de prueba:

### A. Bucle `while` (Condición Previa)
La condición se evalúa antes de entrar al cuerpo. Si es falsa desde el inicio, nunca se ejecuta.

```javascript
let contador = 1;
while (contador <= 5) {
    console.log("Iteración número: " + contador);
    contador++;
}
```

### B. Bucle `do ... while` (Condición Posterior)
El cuerpo se ejecuta al menos una vez antes de verificar la condición.

```javascript
let respuesta = "";
do {
    respuesta = prompt("¿Desea continuar? (s/n): ");
} while (respuesta !== "n");
```

### C. Bucle `for` Clásico
El ciclo predilecto para iteraciones con rango determinado.

```javascript
let suma = 0;
for (let i = 1; i <= 10; i++) {
    suma = suma + i;
}
console.log("La suma de los primeros 10 números es: " + suma);
```

### D. Bucles de Colección: `for ... of` y `for ... in`
Ideales para enseñar recorrido de listas y propiedades:

```javascript
// for...of sobre arreglos
const frutas = ["Manzana", "Pera", "Naranja"];
for (const fruta of frutas) {
    console.log("Fruta: " + fruta);
}

// for...in sobre objetos
const auto = { marca: "Toyota", modelo: "Corolla", ano: 2024 };
for (const propiedad in auto) {
    console.log(propiedad + ": " + auto[propiedad]);
}
```

### E. Saltos de Control: `break` y `continue`
* `break`: Interrumpe de inmediato la ejecución del ciclo y salta fuera de él.
* `continue`: Salta el resto del cuerpo actual y avanza a la siguiente iteración.

> [!WARNING]
> **Protección contra Bucles Infinitos:**  
> Si un estudiante comete un error lógico en la condición de parada (por ejemplo, olvidar incrementar `i++`), el motor de simulación detiene automáticamente el ciclo al alcanzar las **100 iteraciones** (`maxLoopIterations`), evitando que el editor de VS Code se congele.

---

## 7. Modularidad y Funciones (Subprogramas)

Uno de los mayores logros didácticos de RueditasDeBici.js es su tratamiento de las funciones.

### El Desafío del Diseño Gráfico Tradicional
En los diagramas de flujo convencionales, dibujar una función en medio del algoritmo principal genera confusión visual: las líneas se cruzan y el estudiante no distingue qué código se ejecuta secuencialmente y qué código es una definición a la espera de ser llamada.

### La Solución: Aislamiento Visual en Sub-Diagramas (`functionGroup`)

```
Flujo Principal:
  ┌───────────────┐
  │  Inicio       │
  └───────┬───────┘
          ▼
  ┌───────────────┐
  │ Invocar func: │ ───────┐ (Llamada)
  │ calcularIva() │        │
  └───────┬───────┘        │
          ▲                │
          └────────────────┼───────┐ (Retorno)
                           │       │
Sub-Diagrama Aislado:      │       │
┌──────────────────────────┼───────┴────────────────────────┐
│ FUNCIÓN: calcularIva(monto)                              │
│                                                          │
│   (Inicio calcularIva)                                   │
│            ▼                                             │
│   let iva = monto * 0.16;                                │
│            ▼                                             │
│   Retornar iva                                           │
│            ▼                                             │
│   (Fin calcularIva)                                      │
└──────────────────────────────────────────────────────────┘
```

1. **Aislamiento Contenedor:** Cada función declarada se ubica en su propia caja visual coloreada al margen del flujo principal.
2. **Nodo de Subrutina en el Flujo Principal:** En el lugar donde se invoca la función, aparece un bloque de subrutina con borde doble.
3. **Pila de Llamadas (*Call Stack*):** Durante la simulación, el panel de RAM apila el nuevo contexto y muestra las variables locales de la función. Al llegar a `return`, la CPU anuncia el valor devuelto y el flujo regresa al punto exacto de invocación.

```javascript
// Ejemplo pedagógico completo de modularidad
const prompt = require("prompt-sync")();

function calcularDescuento(monto, porcentaje) {
    let rebaja = (monto * porcentaje) / 100;
    return rebaja;
}

let subtotal = Number(prompt("Subtotal: "));
let tasa = Number(prompt("Porcentaje de descuento: "));

// Invocación de la subrutina
let ahorro = calcularDescuento(subtotal, tasa);
let totalFinal = subtotal - ahorro;

console.log("Total a pagar: " + totalFinal);
```

---

[⬅️ Capítulo 03: Guía de la Interfaz de Usuario](03-guia-de-la-interfaz-de-usuario.md) | [Siguiente: Capítulo 05 - Editor Gráfico de Diagramas (.rdb) ➡️](05-editor-grafico-rdb.md)
