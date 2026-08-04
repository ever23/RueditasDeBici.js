const leer = require('prompt-sync')();
let edad, tieneEntrada;
edad = parseInt(leer("Ingrese su edad: "));
tieneEntrada = leer("¿Tiene entrada? (si/no): ");

if (edad < 18) {
    console.log("Acceso denegado: Menor de edad.");
} else {
    if (tieneEntrada === "si") {
        if (edad > 60) {
            console.log("¡Bienvenido! Tiene acceso a la zona VIP.");
        } else {
            console.log("¡Bienvenido! Disfrute el evento.");
        }
    } else {
        console.log("Acceso denegado: Debe comprar su entrada en taquilla.");
    }
}