# 📖 Manual de Usuario — RueditasDeBici.js

Bienvenido al **Manual Oficial de Usuario de RueditasDeBici.js** (Protocolo Rueditas de Bici JS).  
Esta guía exhaustiva ha sido diseñada para estudiantes, docentes y desarrolladores que desean dominar el uso de la extensión en Visual Studio Code para aprender o enseñar los fundamentos de la programación algorítmica.

---

## 🎯 ¿Qué es RueditasDeBici.js?

**RueditasDeBici.js** es una herramienta pedagógica interactiva que transforma tu código JavaScript imperativo y síncrono en **diagramas de flujo dinámicos**, acompañados de un **simulador de ejecución paso a paso**, un **inspector reactivo de Memoria RAM** y un **narrador de operaciones de Procesador (CPU / ALU)** en tiempo real.

```
       [ Código JavaScript ]
                 │
                 ▼
       ┌──────────────────┐
       │   Parser Acorn   │ (Análisis Sintáctico AST)
       └─────────┬────────┘
                 │
       ┌─────────┴────────┐
       ▼                  ▼
┌──────────────┐   ┌──────────────┐
│  Diagrama de │   │  Simulador   │ ──► [ Inspector de Memoria RAM ]
│  Flujo Vivo  │   │  de CPU/ALU  │ ──► [ Consola Virtual Teclado ]
└──────────────┘   └──────────────┘
```

---

## 📚 Índice General del Manual

Explora los capítulos en orden progresivo o consulta el tema específico que necesites:

| Capítulo | Título | Descripción |
| :--- | :--- | :--- |
| **01** | [Introducción y Filosofía](01-introduccion-y-filosofia.md) | La brecha de abstracción en la enseñanza, pilares pedagógicos y restricciones síncronas. |
| **02** | [Instalación y Primeros Pasos](02-instalacion-y-primeros-pasos.md) | Requisitos, instalación de archivos `.vsix`, modo desarrollo y apertura del primer diagrama. |
| **03** | [Guía de la Interfaz de Usuario](03-guia-de-la-interfaz-de-usuario.md) | Anatomía del lienzo, controles de simulación, panel de RAM, panel de CPU, consola virtual y navegación de errores. |
| **04** | [Sintaxis JavaScript Soportada](04-sintaxis-javascript-soportada.md) | Variables, entradas con `prompt-sync`, condicionales (`if`, `switch`), ciclos (`for`, `while`, `do-while`), arreglos y funciones. |
| **05** | [Editor Gráfico de Diagramas (.rdb)](05-editor-grafico-rdb.md) | Creación visual mediante drag-and-drop, tipos de nodos, conexiones condicionales y transpilación automática a código JS. |
| **06** | [Ejemplos Prácticos Paso a Paso](06-ejemplos-practicos-paso-a-paso.md) | Casos de estudio guiados: cálculo de promedios, control de inventario, cajero automático y modularización. |
| **07** | [Diagnóstico de Errores y Preguntas Frecuentes](07-diagnostico-errores-y-faq.md) | Solución a errores de sintaxis, navegación interactiva de fallos, límites de iteración y FAQ. |

---

## 💡 Convenciones Utilizadas en Este Manual

* ⚠️ **Nota Importante:** Destaca restricciones técnicas indispensables (como el uso estricto de código síncrono).
* 💡 **Consejo Pedagógico:** Sugerencias para docentes y estudiantes sobre cómo aprovechar la visualización para consolidar conceptos.
* ▶️ **Acción en la Interfaz:** Pasos prácticos que debes realizar en los botones o paneles de VS Code.

¡Comienza tu recorrido en el [Capítulo 01: Introducción y Filosofía](01-introduccion-y-filosofia.md)!
