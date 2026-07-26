# Soporte de Funciones como Mini-Diagramas Independientes

## Descripción

Agregar soporte para que las declaraciones de funciones (`function nombre() {}`) se rendericen como **mini-diagramas independientes** del flujo principal, cada uno encerrado en una caja de color aleatorio semitransparente con el nombre de la función como título. Las llamadas a funciones se representan en el flujo principal como nodos tipo "subrutina".

## Proposed Changes

### Tipos (`types.ts`)

#### [MODIFY] [types.ts](file:///c:/programacion/node.js/CodigoVivoJS/src/shared/types.ts)

- Añadir tipo de nodo `'functionGroup'` a `FlowchartNodeType`
- Añadir campos opcionales al `FlowchartNode`:
  - `parentId?: string` — para nodos hijos dentro de un grupo de función
  - `extent?: 'parent'` — para confinar nodos dentro del grupo padre
  - `style?: Record<string, string>` — para colores dinámicos del grupo
- Añadir `functionGroups?: FunctionGroupData[]` a `FlowchartData` para metadata de cada función

```typescript
export interface FunctionGroupData {
  groupId: string;       // ID del nodo grupo (ej: "func_group_calcular")
  functionName: string;  // Nombre de la función
  color: string;         // Color aleatorio semitransparente (ej: "rgba(168, 85, 247, 0.15)")
}
```

---

### Transformer (`transformer.ts`)

#### [MODIFY] [transformer.ts](file:///c:/programacion/node.js/CodigoVivoJS/src/analyzer/transformer.ts)

**Cambio principal:** Separar la generación de funciones del flujo principal.

1. **Primera pasada:** Recorrer `ast.body` e identificar todas las `FunctionDeclaration`. Para cada una:
   - Generar un **nodo grupo** (`type: 'functionGroup'`) con un color aleatorio semitransparente
   - Dentro del grupo, generar el mini-diagrama (Inicio Función → nodos internos → Retorno/Fin Función)
   - Todos los nodos hijos tendrán `parentId: groupId` y `extent: 'parent'`

2. **Segunda pasada:** Procesar las sentencias del flujo principal (todo lo que NO es `FunctionDeclaration`):
   - Las llamadas a funciones (`CallExpression` donde el nombre coincide con una función definida) generan un nodo tipo `subroutine` con label `"Llamada: nombre()"`
   - Si la llamada está en una asignación (`let x = func()`), el label será `"Asignar retorno de: nombre()"`

3. **Paleta de colores aleatorios:**
```typescript
const FUNCTION_COLORS = [
  'rgba(168, 85, 247, 0.15)',   // Púrpura
  'rgba(59, 130, 246, 0.15)',   // Azul
  'rgba(16, 185, 129, 0.15)',   // Verde
  'rgba(245, 158, 11, 0.15)',   // Ámbar
  'rgba(239, 68, 68, 0.15)',    // Rojo
  'rgba(236, 72, 153, 0.15)',   // Rosa
  'rgba(6, 182, 212, 0.15)',    // Cian
  'rgba(132, 204, 22, 0.15)',   // Lima
];
```

**Ejemplo de salida para:**
```javascript
function calcularDescuento(precio) {
  if (precio > 100) {
    return precio * 0.9;
  }
  return precio;
}

let total = calcularDescuento(150);
console.log(total);
```

**Flujo Principal:**
```
[Inicio] → [Llamada: calcularDescuento(150)] → [Asignar retorno → total] → [Escribir: total] → [Fin]
```

**Mini-Diagrama Independiente (en caja púrpura):**
```
┌──────────── calcularDescuento() ────────────┐
│  [Inicio Función] → [¿precio > 100?]         │
│      ↓ Sí              ↓ No                   │
│  [Retornar: precio*0.9] [Retornar: precio]    │
│      └──────────┬──────────┘                  │
│          [Fin Función]                        │
└───────────────────────────────────────────────┘
```

---

### Layout (`layout.ts`)

#### [MODIFY] [layout.ts](file:///c:/programacion/node.js/CodigoVivoJS/webview-ui/src/utils/layout.ts)

- **Separar el layout en dos fases:**
  1. Calcular posiciones del flujo principal (nodos sin `parentId`) con Dagre
  2. Para cada grupo de función, calcular el layout de sus nodos internos por separado, luego posicionar el grupo completo debajo o al lado del diagrama principal

- El nodo grupo se dimensiona dinámicamente según el bounding box de sus nodos hijos + padding

---

### Canvas (`FlowchartCanvas.vue`)

#### [MODIFY] [FlowchartCanvas.vue](file:///c:/programacion/node.js/CodigoVivoJS/webview-ui/src/components/FlowchartCanvas.vue)

- Registrar nuevo tipo de nodo `functionGroup` en `nodeTypes`
- Crear componente `FunctionGroupNode` que renderiza:
  - Caja con borde y fondo de color semitransparente
  - Título con el nombre de la función en la parte superior

---

### Nodo Custom (`FunctionGroupNode`)

#### [NEW] FunctionGroupNode.vue

Componente Vue para renderizar el nodo grupo:
- Caja con `border: 2px dashed {color}`, `background: {color}`, `border-radius: 12px`
- Título con icono `📦` + nombre de la función
- Los nodos hijos se renderizan automáticamente dentro por VueFlow cuando tienen `parentId`

---

### CSS (`flowchart.css`)

#### [MODIFY] [flowchart.css](file:///c:/programacion/node.js/CodigoVivoJS/webview-ui/src/styles/flowchart.css)

- Añadir estilos para `.function-group-node`:
  - Borde punteado con color dinámico
  - Fondo semitransparente con color dinámico
  - Título con tipografía destacada
  - Padding interno para los nodos hijos

---

### Simulación (`simulationEngine.ts`)

#### [MODIFY] [simulationEngine.ts](file:///c:/programacion/node.js/CodigoVivoJS/src/analyzer/simulationEngine.ts)

- Al encontrar una `FunctionDeclaration`, registrarla en un mapa de funciones (`_functions`)
- Al encontrar una llamada a función conocida:
  1. Generar paso: `"CPU Llamada a Subrutina: nombre()"`
  2. Evaluar el cuerpo de la función con los argumentos pasados
  3. Generar paso: `"Retorno de nombre() ➔ valor"`
  4. Si hay asignación, guardar el valor retornado en la RAM

---

## Verification Plan

### Manual Verification
- Crear un archivo JS de prueba con funciones y verificar:
  1. Las funciones aparecen como mini-diagramas separados con cajas de colores
  2. Las llamadas en el flujo principal muestran nodos "Llamada:" correctos
  3. La simulación entra a la función, la ejecuta y regresa con el valor de retorno
  4. Los colores son diferentes para cada función
