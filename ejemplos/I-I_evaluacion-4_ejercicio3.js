const prompt = require('prompt-sync')();

const PIN_SECRETO = "9876";
let intentos = 0;
let accesoConcedido = false;

while (intentos < 3 && !accesoConcedido) {
    const clave = prompt(`Intento ${intentos + 1}/3 - Ingrese su PIN: `);
    
    if (clave === PIN_SECRETO) {
        accesoConcedido = true;
    } else {
        intentos++;
        if (intentos < 3) {
            console.log("PIN incorrecto. Intente de nuevo.");
        }
    }
}

if (accesoConcedido) {
    console.log("--- ACCESO CONCEDIDO ---");
} else {
    console.log("--- TARJETA BLOQUEADA: Superó el límite de intentos ---");
}
