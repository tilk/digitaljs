
import elkjs from 'elkjs/lib/elk.bundled.js';

function to_elkjs(graph) {
    const elkGraph = {
        id: "root",
        properties: {
            "elk.algorithm": 'layered',
//            maxIterations: 5,
            'elk.layered.spacing.nodeNodeBetweenLayers': 110.0
        },
        children: [],
        edges: []
    };
    for (const cell of graph.getCells()) {
        if (cell.isLink()) {
            var source = cell.get('source');
            var target = cell.get('target');
            if (!source.id || !target.id) break;

            elkGraph.edges.push({
                id: cell.id,
                source: source.id,
                sourcePort: source.id + '.' + source.port,
                target: target.id,
                targetPort: target.id + '.' + target.port
            });
        } else {
            const size = cell.getLayoutSize();

            const ppos = {};

            const ports = cell.getPorts().map((p, i) => {
                if (!ppos[p.group])
                    ppos[p.group] = cell.getPortsPositions(p.group);
                return {
                    id: p.id,
                    x: ppos[p.group][p.id].x,
                    y: ppos[p.group][p.id].y,
                    properties: {
                        'port.side': p.group == "in" ? "WEST" : "EAST",
                        'port.borderOffset': 30,
                        'port.index': i
                    }
                };
            });

            elkGraph.children.push({
                id: cell.id,
                width: size.width,
                height: size.height,
                ports: ports,
                properties: {
                    portConstraints: 'FIXED_ORDER'
                }
            });
        }
    }
    console.log(elkGraph);
    return elkGraph;
}

function from_elkjs(graph, elkGraph) {
    for (const child of elkGraph.children) {
        const cell = graph.getCell(child.id);
        cell.setLayoutPosition({
            x: child.x,
            y: child.y,
            width: child.width,
            height: child.height
        });
    }
    /* TODO would be cool but...
    for (const edge of elkGraph.edges) {
        const bp = edge.sections[0].bendPoints;
        graph.getCell(edge.id).vertices(bp);
    }*/
}

export function elk_layout(graph) {
    const elkGraph = to_elkjs(graph);

    const elk = new elkjs();

    elk.layout(elkGraph).then(g => {
        console.log(elkGraph);
        console.log(g);
        from_elkjs(graph, g);
    });
}

