
const prompt = require('prompt-sync')();

// Función que recibe el arreglo de temperaturas y realiza los cálculos
function procesarTemperaturas(temperaturas) {
    let sumaTotal = 0;
    let diasCalurosos = 0;

    for (let i = 0; i < temperaturas.length; i++) {
        sumaTotal = sumaTotal + temperaturas[i];

        if (temperaturas[i] > 25) {
            diasCalurosos++;
        }
    }

    let promedio = sumaTotal / temperaturas.length;

    // Retornamos un objeto (Registro) con ambos resultados
    return {
        promedio: promedio,
        diasCalurosos: diasCalurosos
    };
}

// Programa principal
console.log("--- Ingreso de Temperaturas Semanales ---");
let temperaturasSemana = [];

for (let i = 0; i < 7; i++) {
    let temp = parseFloat(prompt(`Ingrese la temperatura del día ${i + 1}: `));
    temperaturasSemana[i] = temp;
}

let resultados = procesarTemperaturas(temperaturasSemana);

console.log("\n--- Resultados ---");
console.log(`Temperatura promedio de la semana: ${resultados.promedio}`);
console.log(`Días con temperatura superior a 25 grados: ${resultados.diasCalurosos}`);
