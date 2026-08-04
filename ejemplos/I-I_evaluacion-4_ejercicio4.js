const prompt = require('prompt-sync')();

let sumaNotas = 0;
let totalAlumnos = 0;
let aprobados = 0;
let reprobados = 0;

console.log("Ingrese las notas (ingrese un número negativo para terminar):");

let nota = 0;
do {
    nota = parseFloat(prompt("Nota del alumno: "));

    // if (nota < 0) break; // Centinela

    sumaNotas += nota;
    totalAlumnos++;

    if (nota >= 50) {
        aprobados++;
    } else {
        reprobados++;
    }
} while (nota != -1);

if (totalAlumnos > 0) {
    const promedioGeneral = sumaNotas / totalAlumnos;
    console.log("\n--- RESULTADOS DEL CURSO ---");
    console.log("Alumnos procesados: " + totalAlumnos);
    console.log("Promedio General: " + promedioGeneral.toFixed(2));
    console.log("Aprobados: " + aprobados);
    console.log("Reprobados: " + reprobados);
} else {
    console.log("No se ingresaron notas.");
}
