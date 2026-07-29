const fs = require('fs');

// Load the compiled extension bundle
const code = fs.readFileSync('c:\\programacion\\ContenidoProgramaticoUptt\\Algorítmica y Programación\\ejercicios\\I-II\\evaluacion-1\\ejercicio1.js', 'utf-8');

// Use esprima-next to parse
let esprima;
try {
  esprima = require('esprima-next');
} catch(e) {
  esprima = require('./node_modules/esprima-next');
}

const ast = esprima.parseScript(code, { loc: true, range: true });
console.log("AST parsed successfully.");
console.log("AST body types:", ast.body.map(s => s.type));

// Now try to load transformer
// Since transformer is TS, we need the compiled version
// Let's just check if the dist has it
try {
  // The extension.js is bundled, let's check if transformAstToFlowchart is accessible
  const distCode = fs.readFileSync('./dist/extension.js', 'utf-8');
  console.log("dist/extension.js loaded, size:", distCode.length);
  console.log("Contains transformAstToFlowchart:", distCode.includes('transformAstToFlowchart'));
} catch(e) {
  console.log("Could not read dist:", e.message);
}

// Let's manually check what would happen
console.log("\n--- Checking AST structure ---");
ast.body.forEach((stmt, i) => {
  console.log(`Statement ${i}: ${stmt.type}`);
  if (stmt.type === 'FunctionDeclaration') {
    console.log(`  Function name: ${stmt.id?.name}`);
    console.log(`  Params: ${stmt.params.map(p => p.name).join(', ')}`);
    console.log(`  Body statements: ${stmt.body.body.length}`);
    stmt.body.body.forEach((s, j) => {
      console.log(`    ${j}: ${s.type}`);
      if (s.type === 'IfStatement') {
        console.log(`      test: ${s.test.type}`);
        console.log(`      consequent: ${s.consequent.type}`);
        console.log(`      alternate: ${s.alternate ? s.alternate.type : 'null'}`);
        if (s.alternate && s.alternate.type === 'IfStatement') {
          console.log(`      alternate.test: ${s.alternate.test.type}`);
          console.log(`      alternate.consequent: ${s.alternate.consequent.type}`);
          console.log(`      alternate.alternate: ${s.alternate.alternate ? s.alternate.alternate.type : 'null'}`);
        }
      }
    });
  }
});
