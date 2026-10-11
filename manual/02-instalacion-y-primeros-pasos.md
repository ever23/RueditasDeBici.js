# Capítulo 02: Instalación y Primeros Pasos

En este capítulo aprenderás a instalar **RueditasDeBici.js** en tu entorno de Visual Studio Code y a ejecutar tu primer algoritmo interactivo.

---

## 1. Requisitos del Sistema

Para utilizar RueditasDeBici.js necesitas:
* **Visual Studio Code:** Versión **1.85.0** o superior (Windows, macOS o Linux).
* **Node.js (Opcional para ejecutar código en terminal externa):** Versión 18 LTS o 20 LTS. Dentro de la extensión, la simulación corre en su propio motor emulado sin requerir Node.js en el sistema anfitrión.

---

## 2. Métodos de Instalación

### Método A: Instalación desde Paquete Compilado (`.vsix`) — Recomendado para Estudiantes y Docentes

Si descargaste el archivo empaquetado de la extensión (`rueditasdebiciJs-x.x.x.vsix`) desde la sección de **Releases** de GitHub:

1. Abre **Visual Studio Code**.
2. Ve al panel de extensiones presionando `Ctrl + Shift + X` (en Windows/Linux) o `Cmd + Shift + X` (en macOS).
3. En la esquina superior derecha del panel de extensiones, haz clic en el menú de **tres puntos (...)**.
4. Selecciona la opción **"Instalar desde VSIX..."** (*Install from VSIX...*).
5. En el explorador de archivos, localiza el archivo `.vsix` descargado y confirma la instalación.
6. Espera un par de segundos hasta ver la notificación de éxito:  
   *"La extensión 'Protocolo Rueditas de Bici JS' se ha instalado correctamente."*

```
┌──────────────────────────────────────────────┐
│ Extensiones                          [...]   │ <--- Clic en los tres puntos
├──────────────────────────────────────────────┤
│  Buscar extensiones en Marketplace...        │
├──────────────────────────────────────────────┤
│  > Instalar desde VSIX...                    │ <--- Seleccionar esta opción
└──────────────────────────────────────────────┘
```

---

### Método B: Modo Desarrollo — Para Desarrolladores y Contribuyentes

Si deseas inspeccionar el código fuente de la extensión o colaborar en su desarrollo:

1. Clona el repositorio oficial con Git:
   ```bash
   git clone https://github.com/ever23/RueditasDeBici.js.git
   cd RueditasDeBici.js
   ```
2. Instala las dependencias tanto de la extensión como del Webview:
   ```bash
   npm install
   cd webview-ui
   npm install
   cd ..
   ```
3. Compila ambos proyectos de un solo comando:
   ```bash
   npm run build
   ```
4. Abre la carpeta del proyecto en VS Code y presiona la tecla **`F5`** (o ve a *Ejecutar y depurar* ➔ *Launch Extension*). Se abrirá una nueva ventana de VS Code (*Extension Development Host*) con la extensión lista para depuración.

---

## 3. Cómo Abrir el Panel del Diagrama de Flujo

Una vez instalada la extensión, tienes **tres formas sencillas** de abrir la interfaz gráfica:

### Opción 1: Desde el Icono en la Barra del Editor (La más rápida)
Abre cualquier archivo con extensión `.js` en tu editor. Verás que en la esquina superior derecha (junto al botón de dividir editor) aparece el **icono de Rueditas de Bici**:

![Boton de Rueditas de Bici en la barra del editor](file:///c:/programacion/RueditasDeBiciJs/resources/icon.svg)

Haz clic sobre este icono para desplegar el panel al lado derecho de tu código.

### Opción 2: Desde la Paleta de Comandos
1. Presiona `Ctrl + Shift + P` (o `Cmd + Shift + P` en macOS).
2. Escribe: `Rueditas de Bici: Abrir Diagrama de Flujo`.
3. Presiona `Enter`.

### Opción 3: Clic Derecho en el Editor
Haz clic con el botón derecho sobre el área de código de un archivo `.js` y selecciona la opción del menú contextual correspondiente.

---

## 4. Distribución de Pantalla Óptima (*Split Layout*)

Para disfrutar plenamente de la experiencia pedagógica, la extensión utiliza automáticamente el modo `ViewColumn.Beside`. Esto divide tu espacio de trabajo en dos columnas:

```
┌───────────────────────────────────────┬───────────────────────────────────────┐
│              EDITOR DE CÓDIGO         │            RUEDITAS DE BICI           │
│              (Tu archivo .js)         │          (Diagrama + Simulador)       │
├───────────────────────────────────────┼───────────────────────────────────────┤
│ 1: const prompt = require(...)();    │  [ ▶️ Simular ] [ ⏭️ Paso ] [ Velocidad ] │
│ 2:                                    │                                       │
│ 3: let precio = Number(prompt(...)); │       ┌───────────────┐               │
│ 4: let descuento = 0;                 │       │    Inicio     │               │
│ 5:                                    │       └───────┬───────┘               │
│ 6: if (precio > 100) {                │               ▼                       │
│ 7:     descuento = precio * 0.10;     │       ┌───────────────┐  RAM:         │
│ 8: }                                  │       │ precio > 100? │  precio: 120  │
│ 9:                                    │       └───┬───────┬───┘  desc: 12     │
│ 10: console.log("Final: ", precio);   │        Sí │       │ No                │
│                                       │           ▼       ▼                   │
└───────────────────────────────────────┴───────────────────────────────────────┘
```

> [!TIP]
> Si tienes un monitor con buena resolución, te recomendamos ajustar el ancho de la división arrastrando la línea central para que tengas suficiente espacio para ver tanto el código como el inspector de memoria RAM.

---

## 5. Tu Primer Algoritmo: ¡Hola Rueditas!

Crea un archivo llamado `prueba.js` en tu carpeta y escribe el siguiente bloque de código:

```javascript
const prompt = require("prompt-sync")();

let nombre = prompt("Ingresa tu nombre: ");
let edad = Number(prompt("Ingresa tu edad: "));

console.log("¡Hola, " + nombre + "!");

if (edad >= 18) {
    console.log("Eres mayor de edad.");
} else {
    console.log("Eres menor de edad.");
}
```

Al terminar de escribir:
1. El diagrama de flujo se dibujará automáticamente en el panel derecho.
2. Haz clic en el botón verde **`▶️ Simular en Vivo`**.
3. Observa cómo el simulador solicita tu nombre y tu edad en la **Consola Virtual**, cómo se registran en la **Memoria RAM** y cómo el rombo de decisión se ilumina en tiempo real.

---

[⬅️ Capítulo 01: Introducción y Filosofía](01-introduccion-y-filosofia.md) | [Siguiente: Capítulo 03 - Guía de la Interfaz de Usuario ➡️](03-guia-de-la-interfaz-de-usuario.md)
