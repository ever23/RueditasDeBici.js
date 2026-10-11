# Capítulo 01: Introducción y Filosofía Pedagógica

## 1. La Brecha de la Abstracción al Aprender a Programar

Aprender a programar es una de las tareas cognitivas más demandantes para un estudiante novato. A diferencia de otras disciplinas donde el resultado o el proceso físico es directamente perceptible (como construir un circuito o dibujar una figura), en la programación el aprendiz se enfrenta a una **doble abstracción**:

1. **La barrera lingüística:** Aprender la sintaxis formal y estricta de un lenguaje como JavaScript (palabras reservadas, punto y coma, llaves, tipos de datos).
2. **El modelo mental de ejecución (La "Máquina Oculta"):** Imaginar cómo la computadora lee las líneas una a una, cómo se evalúa una condición dentro de un `if`, cómo una variable cambia de valor en la memoria RAM durante cada vuelta de un ciclo `for`, y cómo se crea un nuevo contexto cuando se invoca una función.

Los principiantes frecuentemente cometen errores no porque no entiendan el problema lógico, sino porque **no pueden ver lo que la máquina está haciendo internamente**.

---

## 2. La Metáfora de las "Rueditas de Bici"

Cuando un niño aprende a montar en bicicleta, no se le lanza a una autopista ni se le exige mantener el equilibrio perfecto desde el primer segundo: se le colocan **rueditas auxiliares**. Estas rueditas no impiden que pedalee ni que aprenda a girar el manubrio, pero evitan que caiga al suelo mientras su cerebro asimila la coordinación motriz.

**RueditasDeBici.js** es exactamente eso para los estudiantes de programación:
* **No altera el lenguaje:** Escribes JavaScript estándar y válido.
* **No requiere entornos complejos:** Se ejecuta directamente dentro de Visual Studio Code.
* **Hace visible lo invisible:** Muestra gráficamente el diagrama de flujo del algoritmo, el estado exacto de cada celda de memoria RAM y el pensamiento paso a paso de la CPU.
* **Desmontable:** Una vez que el alumno domina la lógica de control, retira las "rueditas" y continúa programando con confianza.

---

## 3. Los Cuatro Pilares del Ecosistema

RueditasDeBici.js sincroniza simultáneamente cuatro dimensiones del software:

```
┌───────────────────────────────────────────────────────────┐
│                      VS CODE EDITOR                       │
│  Línea resaltada en azul brillante con icono en gutter     │
└─────────────────────────────┬─────────────────────────────┘
                              │ Sincronización en tiempo real
┌─────────────────────────────┼─────────────────────────────┐
│                             ▼                             │
│   ┌───────────────────────────────────────────────────┐   │
│   │             LIENZO DEL DIAGRAMA DE FLUJO          │   │
│   │   Nodos coloreados, cajas de función aisladas     │   │
│   │   y nodo activo pulsando en la simulación         │   │
│   └─────────┬───────────────────────────────┬─────────┘   │
│             │                               │             │
│             ▼                               ▼             │
│   ┌───────────────────┐           ┌───────────────────┐   │
│   │  MEMORIA RAM      │           │  PROCESADOR (ALU) │   │
│   │  Variables locales│           │  Narración natural│   │
│   │  y globales con   │           │  de cálculos,     │   │
│   │  micro-destellos  │           │  saltos y retornos│   │
│   └─────────┬─────────┘           └─────────┬─────────┘   │
│             │                               │             │
│             └───────────────┬───────────────┘             │
│                             ▼                             │
│               ┌───────────────────────────┐               │
│               │   CONSOLA VIRTUAL TECLADO │               │
│               │   Captura console.log() e │               │
│               │   interactúa con inputs   │               │
│               └───────────────────────────┘               │
│                        PANEL WEBVIEW                      │
└───────────────────────────────────────────────────────────┘
```

1. **Diagrama de Flujo Vivo:**  
   A medida que el estudiante escribe o modifica su código, un Árbol de Sintaxis Abstracta (AST) analiza las sentencias y redibuja la topología del diagrama de flujo de forma reactiva (con un debounce óptimo de 300 ms).
2. **Simulador de CPU y ALU (Unidad Aritmético Lógica):**  
   Al pulsar `Simular en Vivo`, el sistema recorre paso a paso cada instrucción. En lugar de mostrar código crudo, la CPU explica en lenguaje natural qué está calculando:  
   *Ejemplo:* `Cálculo UAL: edad(17) >= 18 ➔ FALSE (Tomar camino falso)`.
3. **Inspector de Memoria RAM por Ámbitos:**  
   Muestra visualmente las "cajitas" de memoria. Cuando una variable cambia de valor (por ejemplo, en un contador `i++`), la fila correspondiente emite una **micro-animación de destello amarillo** para guiar la atención visual del aprendiz hacia el cambio de estado.
4. **Consola Virtual Interactiva:**  
   Permite al estudiante ingresar datos cuando el algoritmo lo solicita y visualizar las salidas de `console.log()` de manera ordenada.

---

## 4. Regla de Oro: Enfoque Estricto en Código Síncrono

> [!IMPORTANT]
> **RueditasDeBici.js está diseñado deliberadamente y con exclusividad para código síncrono.**

### ¿Por qué no admite Asincronía (`async/await`, `Promise`, `fetch`, `setTimeout`)?
En la pedagogía tradicional de ciencias de la computación e ingeniería de software, los cursos de **Algoritmos y Estructuras de Datos I** se enfocan en la lógica imperativa fundamental:
* Secuencia lineal.
* Selección condicional simple, doble y múltiple.
* Iteración definida e indefinida.
* Descomposición modular en funciones con paso de parámetros por valor y por referencia.

Introducir el *Event Loop*, promesas o callbacks asíncronos en las primeras semanas de clase genera una sobrecarga conceptual que confunde a los estudiantes. Por esta razón, RueditasDeBici.js emula el modelo de ejecución de lenguajes como C, Pascal o Python en su modo secuencial estricto.

### El Estándar de Entrada: `prompt-sync`
Para capturar información del usuario por teclado sin recurrir a llamadas asíncronas ni navegadores web, el estándar del proyecto es la librería de Node.js `prompt-sync`:

```javascript
// Declaración estándar requerida
const prompt = require("prompt-sync")();

let nombre = prompt("¿Cuál es tu nombre? ");
let edad = Number(prompt("¿Cuál es tu edad? "));

console.log("Bienvenido " + nombre);
```

La extensión detecta automáticamente esta inicialización y la omite en el diagrama visual para no ensuciar el flujo algorítmico, convirtiendo las lecturas en bloques claros de **Entrada de Datos**.

---

[⬅️ Volver al Índice](README.md) | [Siguiente: Capítulo 02 - Instalación y Primeros Pasos ➡️](02-instalacion-y-primeros-pasos.md)
