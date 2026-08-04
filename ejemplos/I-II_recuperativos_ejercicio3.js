
const prompt = require('prompt-sync')();

console.log("--- Sistema de Inventario ---");

// 1. Pedimos al usuario que ingrese por consola el código del producto
let codigoProducto = prompt("Ingrese el código completo del producto (Ejemplo: PRD-2023-XYZ-99): ");

// 2. Procesamos el código para extraer únicamente el año de producción
// (del índice 4 al 8 en un formato como PRD-2023-XYZ-99)
let anoProduccion = codigoProducto.substring(4, 8);// codigoProducto[4] + codigoProducto[5] + codigoProducto[6] + codigoProducto[7]

// 3. Imprimimos el año extraído en pantalla
console.log(`El año de producción extraído es: ${anoProduccion}`);
