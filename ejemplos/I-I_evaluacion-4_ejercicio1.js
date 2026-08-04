const prompt = require('prompt-sync')();

let totalVentas = 0;
let ventasAltas = 0;

for (let i = 1; i <= 7; i++) {
    const monto = parseFloat(prompt(`Día ${i} - Ingrese el monto de venta: `));
    totalVentas += monto;
    
    if (monto > 100) {
        ventasAltas++;
    }
}

const promedio = totalVentas / 7;

console.log("\n--- REPORTE SEMANAL ---");
console.log("Total Ventas: $" + totalVentas);
console.log("Promedio Diario: $" + promedio.toFixed(2));
console.log("Días con Ventas Altas (>100): " + ventasAltas);