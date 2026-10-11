# Capítulo 06: Ejemplos Prácticos Paso a Paso

En este capítulo analizaremos cuatro ejemplos pedagógicos representativos (adaptados del catálogo de ejercicios prácticos incluidos en la carpeta [`ejemplos/`](file:///c:/programacion/RueditasDeBiciJs/ejemplos)). Cada ejemplo ilustra cómo RueditasDeBici.js modela la lógica, el flujo visual y el estado de la memoria RAM.

---

## Ejemplo 1: Algoritmo Secuencial con Cálculo Aritmético

### Enunciado del Problema:
*Una tienda ofrece un descuento del 15% sobre el precio de lista de un producto si el comprador es un estudiante, pero se cobra un costo fijo de envío de $5. Diseñar un algoritmo que calcule el precio final.*

### Código JavaScript:
```javascript
const prompt = require("prompt-sync")();

let precioLista = Number(prompt("Ingrese el precio del producto: "));
let porcentajeDescuento = 0.15;
let costoEnvio = 5;

let montoDescuento = precioLista * porcentajeDescuento;
let precioConDescuento = precioLista - montoDescuento;
let precioFinal = precioConDescuento + costoEnvio;

console.log("Descuento ahorrado: $" + montoDescuento);
console.log("Total a pagar con envío: $" + precioFinal);
```

### Comportamiento en RueditasDeBici.js:
1. **Flujo Gráfico:**  
   Se genera un flujo estrictamente vertical (secuencial).
   * Nodo `Inicio`.
   * Nodo paralelogramo de Entrada: `LEER [precioLista]`.
   * Nodo de Proceso agrupado con las asignaciones iniciales (`porcentajeDescuento`, `costoEnvio`).
   * Nodos de Proceso para cada cálculo aritmético.
   * Dos nodos de Salida (`console.log`).
   * Nodo `Fin`.
2. **Seguimiento en la Simulación:**
   * Al llegar a la línea 3, la simulación se pausa y la **Consola Virtual** solicita el valor de `precioLista`. Si ingresas `100`, el valor se almacena como número en la RAM.
   * En el paso de la línea 7, el panel de la **CPU** anuncia:  
     `Multiplicación: precioLista(100) * porcentajeDescuento(0.15) ➔ 15`.
   * En la tabla de la **Memoria RAM**, la variable `montoDescuento` se ilumina con un destello amarillo mostrando el valor `15`.

---

## Ejemplo 2: Estructura de Decisión y Clasificación Académica (`if / else`)

### Enunciado del Problema:
*Un docente necesita un programa que solicite dos notas parciales, calcule el promedio y determine si el alumno está "Aprobado" (promedio >= 10), en "Recuperación" (promedio entre 7 y 9.9) o "Reprobado" (promedio < 7).*

### Código JavaScript:
```javascript
const prompt = require("prompt-sync")();

let nota1 = Number(prompt("Ingrese la nota 1 (0-20): "));
let nota2 = Number(prompt("Ingrese la nota 2 (0-20): "));

let promedio = (nota1 + nota2) / 2;
console.log("Promedio obtenido: " + promedio);

if (promedio >= 10) {
    console.log("Estado: APROBADO");
} else if (promedio >= 7) {
    console.log("Estado: EN RECUPERACIÓN");
} else {
    console.log("Estado: REPROBADO");
}
```

### Comportamiento en RueditasDeBici.js:
1. **Flujo Gráfico:**
   * Después de calcular `promedio`, el flujo llega a un **primer rombo de decisión**: `promedio >= 10`.
   * Si la condición es **Sí**, toma el camino hacia el mensaje de aprobado y desciende hacia el final.
   * Si es **No**, el camino conduce a un **segundo rombo anidado**: `promedio >= 7`.
   * Todas las ramas convergen limpiamente hacia el nodo `Fin`.
2. **Seguimiento en la Simulación:**
   * Si ingresas `nota1 = 8` y `nota2 = 8`, el promedio computado es `8`.
   * Al alcanzar el primer rombo, el visor de **CPU** muestra:  
     `Cálculo UAL: promedio(8) >= 10 ➔ FALSE`.  
     El halo brillante sigue la flecha roja hacia el segundo rombo.
   * En el segundo rombo, la CPU anuncia:  
     `Cálculo UAL: promedio(8) >= 7 ➔ TRUE`.  
     El simulador toma la flecha verde y muestra en la consola `"Estado: EN RECUPERACIÓN"`.

---

## Ejemplo 3: Bucle Acumulador con `while` (Control de Stock de Inventario)

### Enunciado del Problema:
*Un almacén cuenta con 10 unidades de un artículo en stock. Un cajero procesa pedidos de clientes restando la cantidad solicitada mientras queden unidades disponibles.*

### Código JavaScript:
```javascript
const prompt = require("prompt-sync")();

let stock = 10;
console.log("Stock inicial en bodega: " + stock);

while (stock > 0) {
    let pedido = Number(prompt("¿Cuántas unidades desea comprar? "));
    
    if (pedido <= stock) {
        stock = stock - pedido;
        console.log("Venta exitosa. Stock restante: " + stock);
    } else {
        console.log("No hay suficiente stock. Disponibles: " + stock);
    }
}

console.log("Inventario agotado. Fin de la jornada.");
```

### Comportamiento en RueditasDeBici.js:
1. **Flujo Gráfico:**  
   Se observa una flecha de retorno curvada que sube desde el final del bloque de venta hacia la parte superior del rombo `stock > 0`.
2. **Seguimiento en la Simulación:**
   * En cada iteración, el panel de **Memoria RAM** resalta en color amarillo el cambio en la variable `stock` (`10` ➔ `7` ➔ `3` ➔ `0`).
   * Cuando `stock` llega a `0`, la CPU evalúa: `stock(0) > 0 ➔ FALSE`, rompe el ciclo y salta a la última instrucción de consola.

---

## Ejemplo 4: Programación Modular y Funciones (Subprogramas)

### Enunciado del Problema:
*Implementar un sistema de nómina salarial donde el cálculo del sueldo neto y los descuentos de seguridad social se deleguen en una función independiente.*

### Código JavaScript:
```javascript
const prompt = require("prompt-sync")();

// Declaración de la subrutina (función modular)
function calcularSueldoNeto(sueldoBruto) {
    let deduccion = sueldoBruto * 0.08; // 8% seguridad social
    let neto = sueldoBruto - deduccion;
    return neto;
}

// Flujo Principal
let empleado = prompt("Nombre del empleado: ");
let sueldoBase = Number(prompt("Sueldo bruto pactado: "));

// Invocación a la subrutina
let pagoFinal = calcularSueldoNeto(sueldoBase);

console.log("Comprobante de Pago:");
console.log("Colaborador: " + empleado);
console.log("Monto a transferir: $" + pagoFinal);
```

### Comportamiento en RueditasDeBici.js:
1. **Aislamiento Visual:**  
   La función `calcularSueldoNeto` no interrumpe el flujo principal: se dibuja en un recuadro violeta titulado `Función: calcularSueldoNeto(sueldoBruto)` a un lado del lienzo.
2. **Salto de Subrutina:**
   * En el flujo principal, la línea `calcularSueldoNeto(sueldoBase)` se representa con un nodo de subrutina.
   * Durante la simulación, el halo de ejecución salta del flujo principal al sub-diagrama de la función.
   * El panel de **Memoria RAM** apila un nuevo ámbito local (`Ámbito: calcularSueldoNeto`) con su propia variable `deduccion` y `neto`.
   * Al alcanzar `return neto`, la CPU anuncia el retorno del valor, el ámbito local se destruye en la RAM y el cursor de simulación regresa al flujo principal asignando el resultado a `pagoFinal`.

---

[⬅️ Capítulo 05: Editor Gráfico de Diagramas (.rdb)](05-editor-grafico-rdb.md) | [Siguiente: Capítulo 07 - Diagnóstico de Errores y FAQ ➡️](07-diagnostico-errores-y-faq.md)
