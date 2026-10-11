# Capítulo 07: Diagnóstico de Errores y Preguntas Frecuentes (FAQ)

Este capítulo reúne los problemas más comunes a los que se enfrentan los estudiantes y las respuestas a las dudas frecuentes al utilizar **RueditasDeBici.js**.

---

## 1. Diagnóstico de Errores Comunes de Programación

### A. Concatenación Involuntaria de Cadenas en lugar de Suma Aritmética
* **Síntoma:** Al ingresar `10` y sumar `5`, el resultado es `105` en lugar de `15`.
* **Causa:** Toda entrada capturada por `prompt(...)` es por defecto una cadena de texto (`String`). En JavaScript, el operador `+` entre cadenas realiza concatenación.
* **Solución:** Envuelve siempre la lectura en la función de conversión numérica `Number(...)` o `parseInt(...)`:
  ```javascript
  // ❌ Incorrecto
  let edad = prompt("Ingrese edad: ");
  let proximoAno = edad + 1; // "20" + 1 = "201"

  // ✅ Correcto
  let edad = Number(prompt("Ingrese edad: "));
  let proximoAno = edad + 1; // 20 + 1 = 21
  ```

---

### B. Error de Sintaxis Inesperado (*Unexpected token*)
* **Síntoma:** Aparece un banner rojo en la parte superior del canvas:  
  `⚠️ Error de sintaxis: Unexpected token (Línea X)`
* **Causa Común:** Olvido de cerrar un paréntesis en una condición `if (...)`, olvidar una llave de cierre `}` o escribir un operador incompleto.
* **Solución Rápida:**  
  **Haz clic directamente sobre el banner rojo.** El editor de VS Code colocará automáticamente el cursor en la línea y columna del fallo para que puedas añadir el carácter faltante.

---

### C. Variable no Declarada o Mal Escrita (*ReferenceError*)
* **Síntoma:** La simulación muestra `undefined` o `0` en una operación aritmética.
* **Causa:** JavaScript distingue mayúsculas de minúsculas (*case-sensitive*). Si declaras `let totalPagar = 0;` y más adelante escribes `totalpagar = 10;`, estás haciendo referencia a dos identificadores distintos.

---

### D. El Bucle se Detiene Misteriosamente al llegar a 100
* **Síntoma:** En un algoritmo con un ciclo largo, la simulación se detiene sola.
* **Causa:** RueditasDeBici.js implementa un mecanismo de protección contra **bucles infinitos** configurado por defecto en **100 iteraciones** (`maxLoopIterations`).
* **Diagnóstico:** Si tu algoritmo tenía la intención de contar hasta 200, la protección se activará. Si por el contrario olvidaste incrementar la variable de control (`i++`), esta protección ha evitado que tu editor de VS Code colapse.

---

## 2. Preguntas Frecuentes (FAQ)

### ¿Por qué la extensión no soporta `fetch()`, `async/await` ni `setTimeout`?
RueditasDeBici.js fue diseñada estrictamente con un enfoque didáctico para los primeros cursos de programación algorítmica universitaria o secundaria. Introducir conceptos asíncronos y concurrencia antes de que el estudiante domine las estructuras secuenciales, condicionales y de repetición genera una carga cognitiva excesiva.

---

### ¿Es obligatorio instalar Node.js para usar la extensión?
**No.** La extensión emula internamente el análisis de código y la ejecución paso a paso dentro del propio motor de VS Code. Solo necesitas Node.js si deseas ejecutar tu archivo `.js` fuera de VS Code en una terminal independiente del sistema operativo.

---

### ¿Cómo puedo compartir un diagrama con mi profesor o mis compañeros?
Tienes dos alternativas:
1. **Compartir el archivo de código (`.js`):** Cualquier persona con la extensión instalada abrirá el archivo `.js` y verá exactamente el mismo diagrama y simulación.
2. **Compartir el archivo de diagrama (`.rdb`):** Si creaste el algoritmo en el editor visual, puedes enviar el archivo `.rdb`. Tu profesor podrá abrirlo directamente como un lienzo interactivo y exportar el código en un clic.

---

### Cambié de pestaña en VS Code y el diagrama no se actualizó, ¿qué debo hacer?
La extensión observa el cambio de pestaña y actualiza el diagrama siempre que el archivo activo tenga el identificador de lenguaje `javascript` (extensión `.js`). Si abriste un archivo sin extensión o con otra extensión (como `.txt`), el panel no cambiará. Basta con hacer clic sobre un archivo `.js` para que el panel se sincronice de inmediato.

---

### ¿Puedo cambiar el tamaño de la letra o los colores del diagrama?
El diagrama se adapta automáticamente al tema de color de VS Code (Tema Oscuro o Tema Claro). Además, cada función o subprograma recibe automáticamente un color temático diferenciado de la paleta pedagógica para distinguir visualmente los diferentes módulos del software.

---

### ¿Puedo reiniciar la simulación si ingresé un dato erróneo en la Consola?
Sí. En la barra superior de herramientas, pulsa el botón **`🔄 Reiniciar`** (*Restart*). Esto restablecerá todas las variables a su estado inicial y podrás comenzar la ejecución nuevamente desde el primer paso.

---

[⬅️ Capítulo 06: Ejemplos Prácticos Paso a Paso](06-ejemplos-practicos-paso-a-paso.md) | [Volver al Índice General 📖](README.md)
