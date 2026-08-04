const prompt = require('prompt-sync')();

const sueldoBase = parseFloat(prompt("Sueldo base ($): "));
const antiguedad = parseInt(prompt("Años de antigüedad: "));

let bono = 0;
if (antiguedad > 5) {
    bono = sueldoBase * 0.10;
}

const sueldoConBono = sueldoBase + bono;

let retencion = 0;
if (sueldoConBono > 500) {
    retencion = sueldoConBono * 0.04;
}

const sueldoNeto = sueldoConBono - retencion;

console.log("\n--- RECIBO DE PAGO ---");
console.log(`Sueldo Base: $${sueldoBase}`);
console.log(`Bono Antigüedad: $${bono}`);
console.log(`Retención (4%): $${retencion}`);
console.log(`TOTAL NETO: $${sueldoNeto}`);