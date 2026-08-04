export function analizarTablero(tablero) {
    let cantidadX = 0;
    let cantidadO = 0;
    let vacias = 0;
    
    for (let fila = 0; fila < 3; fila++) {
        for (let col = 0; col < 3; col++) {
            if (tablero[fila][col] === "X") {
                cantidadX++;
            } else if (tablero[fila][col] === "O") {
                cantidadO++;
            } else if (tablero[fila][col] === "") {
                vacias++;
            }
        }
    }
    
    return {
        cantidadX: cantidadX,
        cantidadO: cantidadO,
        vacias: vacias
    };
}
