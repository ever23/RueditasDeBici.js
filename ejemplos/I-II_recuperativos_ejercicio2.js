// 1. Matriz 3x3 que representa un tablero empezado estáticamente
let tableroJuego = [
    ["X", "O", "X"],
    ["", "X", "O"],
    ["O", "", ""]
];

let cantidadX = 0;
let cantidadO = 0;
let vacias = 0;

// 2. Analizamos todo su contenido
for (let fila = 0; fila < 3; fila++) {
    for (let col = 0; col < 3; col++) {
        if (tableroJuego[fila][col] === "X") {
            cantidadX++;
        } else if (tableroJuego[fila][col] === "O") {
            cantidadO++;
        } else if (tableroJuego[fila][col] === "") {
            vacias++;
        }
    }
}

// 3. Imprimimos en consola de forma clara el conteo final
console.log("--- Análisis de Tablero de Tic-Tac-Toe ---");
console.log(`Cantidad de "X" colocadas: ${cantidadX}`);
console.log(`Cantidad de "O" colocadas: ${cantidadO}`);
console.log(`Casillas en blanco disponibles para jugar: ${vacias}`);
