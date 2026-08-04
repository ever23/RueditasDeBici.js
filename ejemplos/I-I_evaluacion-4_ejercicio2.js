const prompt = require('prompt-sync')();

let stock = parseInt(prompt("Ingrese el stock inicial: "));

while (stock > 0) {
    console.log(`\nStock actual: ${stock} unidades.`);
    if (stock < 5) {
        console.log("¡ADVERTENCIA: STOCK CRÍTICO!");
    }

    const retiro = parseInt(prompt("Cantidad a retirar (0 para salir): "));
    
    if (retiro === 0) break;

    if (retiro <= stock) {
        stock -= retiro;
        console.log("Retiro exitoso.");
    } else {
        console.log("Error: No hay suficientes unidades en existencia.");
    }
}

console.log("\nProceso finalizado. Stock final: " + stock);
