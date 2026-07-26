# ⚡ RueditasDeBici.js

**RueditasDeBici.js** es una extensión educativa para Visual Studio Code que transforma código JavaScript síncrono en diagramas de flujo interactivos en tiempo real. 

Diseñada con un enfoque fuertemente académico, esta herramienta permite a los estudiantes de programación visualizar la lógica de ejecución, el manejo de memoria y el flujo de control de sus algoritmos de forma dinámica e intuitiva.

## 📸 Capturas de Pantalla

<!-- Reemplaza las rutas de las imágenes con las tuyas una vez subidas al repositorio -->
![Generación de condicionales y ciclos anidados](./image.png)
*Generación en tiempo real de diagramas con condicionales y bucles.*

![Soporte para funciones y simulador en vivo](./image1.png)
*Aislamiento visual de funciones (subprogramas) y el inspector de Memoria RAM interactivo.*

## 🎯 Propósito

Aprender a programar requiere un alto nivel de abstracción mental. CódigoVivo cierra la brecha entre la sintaxis del código y la lógica subyacente. En lugar de imaginar cómo el intérprete lee un ciclo `for` o cómo las variables cambian en cada iteración, los usuarios pueden verlo suceder paso a paso directamente en su editor.

## ✨ Características Principales

- **🔄 Generación en Tiempo Real:** Convierte tu código JavaScript a diagramas visuales al instante mientras escribes, sin necesidad de configuraciones extra.
- **🧩 Tipología de Nodos Inteligente:** Representación gráfica clara para declaraciones, entradas/salidas, condicionales (`if/else`) y ciclos, con rutas de ejecución coloreadas (verdadero/falso).
- **▶️ Simulación en Vivo:** Ejecuta el diagrama paso a paso controlando la velocidad de la simulación.
- **🧠 Inspector de Memoria RAM:** Panel interactivo que muestra el estado y el valor actual de las variables en cada paso de la ejecución.
- **💻 Consola Virtual Integrada:** Captura y muestra las salidas de `console.log` y las entradas del usuario sincronizadas con el flujo visual del diagrama.

### 📦 Soporte Avanzado para Funciones (Subprogramas)
CódigoVivo fomenta las buenas prácticas de programación modular al representar las funciones de manera pedagógica:
- **Aislamiento Visual:** Las funciones declaradas no saturan el diagrama principal; se renderizan en sus propios contenedores visuales aislados (sub-diagramas).
- **Nodos de Invocación:** El flujo principal utiliza bloques especiales de "Llamada a Función" que delegan la ejecución y esperan el valor de retorno, enseñando claramente cómo un programa principal interactúa con sus subrutinas.
- **Contexto y Scope de Variables:** Durante la simulación, el panel de *Memoria RAM* diferencia perfectamente los parámetros locales de la función y las variables del flujo principal, permitiendo a los estudiantes comprender el alcance (scope) de manera gráfica.

## 🛠️ Arquitectura y Tecnologías

CódigoVivo está construido sobre un stack moderno y eficiente que separa el motor de análisis de la interfaz gráfica:

* **VS Code Extension API:** Manejo del entorno y detección de cambios en el editor.
* **Procesador AST (Acorn):** Análisis léxico robusto. No usamos expresiones regulares; la extensión genera un Árbol de Sintaxis Abstracta (AST) para garantizar una precisión algorítmica total.
* **Webview con Vue.js:** El panel visual está construido sobre Vue, permitiendo un entorno reactivo y de alto rendimiento.
* **Vue Flow:** Motor de renderizado gráfico para la creación, enrutamiento y animación de los nodos y aristas del diagrama.

## 🚀 Instalación (En Desarrollo)

1. Clona este repositorio: `git clone https://github.com/tu-usuario/codigovivo.git`
2. Abre la carpeta en VS Code.
3. Instala las dependencias principales ejecutando `npm install`.
4. Ve al directorio del webview (`/webview` o `/src/webview`) y compila la vista de Vue.
5. Presiona `F5` en VS Code para lanzar una ventana de desarrollo de la extensión.

## 💡 Uso Básico

1. Crea o abre un archivo `.js`.
2. Escribe lógica síncrona básica (variables, ciclos, condicionales, funciones).
3. Abre la paleta de comandos (`Ctrl+Shift+P` o `Cmd+Shift+P`) y ejecuta: **`CódigoVivo: Iniciar Diagrama`**.
4. ¡Visualiza tu código, interactúa con la simulación y observa cómo cambian tus variables en tiempo real!

## 🤝 Contribuciones

Este proyecto es de código abierto. Cualquier sugerencia, reporte de errores o *pull request* para añadir soporte a nuevas estructuras sintácticas es más que bienvenida. 

## 📝 Licencia

Este proyecto está bajo la Licencia MIT - mira el archivo [LICENSE.md](LICENSE.md) para más detalles.