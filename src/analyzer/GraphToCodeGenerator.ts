export class GraphToCodeGenerator {
  public static generate(nodes: any[], edges: any[]): { code: string; lineToNodeMap: Record<number, string> } {
    let code = '';
    const lineToNodeMap: Record<number, string> = {};
    
    const hasInputNodes = nodes.some(n => n.type === 'input');
    let currentLine = 1;
    
    if (hasInputNodes) {
      code += `const prompt = require("prompt-sync")();\n`;
      currentLine = 2;
    }

    const startNode = nodes.find(n => n.type === 'startEnd' && n.data.label.toLowerCase() === 'inicio');
    if (!startNode) return { code: '', lineToNodeMap: {} };

    const getTargets = (sourceId: string) => edges.filter(e => e.source === sourceId);

    const traverse = (nodeId: string, stopNodeId?: string, visited: Set<string> = new Set()) => {
      if (nodeId === stopNodeId) return;
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      
      const labelStr = (node.data.label || '').trim();
      
      if (node.type === 'startEnd' && labelStr.toLowerCase() === 'fin') {
        return;
      }

      if (node.type === 'startEnd' && labelStr.toLowerCase() === 'inicio') {
        const next = getTargets(nodeId)[0];
        if (next) traverse(next.target, stopNodeId, visited);
        return;
      }

      if (node.type === 'process') {
        lineToNodeMap[currentLine] = node.id;
        code += `${labelStr};\n`;
        currentLine++;
        const next = getTargets(nodeId)[0];
        if (next) traverse(next.target, stopNodeId, visited);
      }
      else if (node.type === 'input') {
        lineToNodeMap[currentLine] = node.id;
        
        let varName = labelStr.trim();
        if (varName.toLowerCase().startsWith('leer ')) {
          varName = varName.substring(5).trim();
        } else if (varName.toLowerCase().startsWith('prompt ')) {
          varName = varName.substring(7).trim();
        }
        
        code += `${varName} = prompt("Ingrese ${varName}: ");\n`;
        currentLine++;
        
        const next = getTargets(nodeId)[0];
        if (next) traverse(next.target, stopNodeId, visited);
      }
      else if (node.type === 'variable') {
        lineToNodeMap[currentLine] = node.id;
        let statement = labelStr.trim();
        if (!statement.startsWith('let ') && !statement.startsWith('var ')) {
           statement = `let ${statement}`;
        }
        if (!statement.endsWith(';')) statement += ';';
        
        code += `${statement}\n`;
        currentLine++;
        
        const next = getTargets(nodeId)[0];
        if (next) traverse(next.target, stopNodeId, visited);
      }
      else if (node.type === 'constant') {
        lineToNodeMap[currentLine] = node.id;
        let statement = labelStr.trim();
        if (!statement.startsWith('const ')) {
           statement = `const ${statement}`;
        }
        if (!statement.endsWith(';')) statement += ';';
        
        code += `${statement}\n`;
        currentLine++;
        
        const next = getTargets(nodeId)[0];
        if (next) traverse(next.target, stopNodeId, visited);
      }
      else if (node.type === 'output') {
        lineToNodeMap[currentLine] = node.id;
        
        let printVal = labelStr.trim();
        if (printVal.toLowerCase().startsWith('escribir ')) {
          printVal = printVal.substring(9).trim();
        } else if (printVal.toLowerCase().startsWith('console.log(')) {
          // If they literally wrote console.log(...), just use it
          printVal = printVal; 
        }
        
        if (printVal.toLowerCase().startsWith('console.log(')) {
           code += `${printVal};\n`;
        } else {
           code += `console.log(${printVal});\n`;
        }
        
        currentLine++;
        const next = getTargets(nodeId)[0];
        if (next) traverse(next.target, stopNodeId, visited);
      }
      else if (node.type === 'decision') {
        const outEdges = getTargets(nodeId);
        const yesEdge = outEdges.find(e => e.label === 'Sí');
        const noEdge = outEdges.find(e => e.label === 'No');
        
        lineToNodeMap[currentLine] = node.id;
        code += `if (${labelStr}) {\n`;
        currentLine++;
        
        if (yesEdge) traverse(yesEdge.target, stopNodeId, new Set(visited));
        
        lineToNodeMap[currentLine] = node.id;
        code += `} else {\n`;
        currentLine++;
        
        if (noEdge) traverse(noEdge.target, stopNodeId, new Set(visited));
        
        lineToNodeMap[currentLine] = node.id;
        code += `}\n`;
        currentLine++;
      } 
      else if (node.type === 'loop') {
        const outEdges = getTargets(nodeId);
        const yesEdge = outEdges.find(e => e.label === 'Sí');
        const noEdge = outEdges.find(e => e.label === 'No');
        
        lineToNodeMap[currentLine] = node.id;
        code += `while (${labelStr}) {\n`;
        currentLine++;
        
        if (yesEdge) {
          // Traverse loop body, stopping when it loops back
          traverse(yesEdge.target, nodeId, new Set(visited));
        }
        
        lineToNodeMap[currentLine] = node.id;
        code += `}\n`;
        currentLine++;
        
        // After loop
        if (noEdge) traverse(noEdge.target, stopNodeId, new Set(visited));
      }
    };

    traverse(startNode.id);

    return { code, lineToNodeMap };
  }
}
