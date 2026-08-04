export function procesarTemperaturas(temperaturas) {
    let sumaTotal = 0;
    let diasCalurosos = 0;
    
    for (let i = 0; i < temperaturas.length; i++) {
        sumaTotal = sumaTotal + temperaturas[i];
        
        if (temperaturas[i] > 25) {
            diasCalurosos++;
        }
    }
    
    let promedio = sumaTotal / temperaturas.length;
    
    return {
        promedio: promedio,
        diasCalurosos: diasCalurosos
    };
}
