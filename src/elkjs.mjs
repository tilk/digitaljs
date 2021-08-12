
import elkjs from 'elkjs/lib/elk.bundled.js';
import { Clock, Input, Output } from "./cells/io.mjs";

function to_elkjs(graph) {
    const elkGraph = {
        id: "root",
        properties: {
            algorithm: 'sporeOverlap',
            underlyingLayoutAlgorithm: 'layered',
            'elk.layered.spacing.nodeNodeBetweenLayers': 40.0,
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
                sources: [ source.id + '.' + source.port ],
                targets: [ target.id + '.' + target.port ]
            });
        } else {
            const size = cell.getLayoutSize();

            const ppos = {};

            const ports = cell.getPorts().map((p, i) => {
                if (!ppos[p.group])
                    ppos[p.group] = cell.getPortsPositions(p.group);
                return {
                    id: cell.id + "." + p.id,
                    x: ppos[p.group][p.id].x,
                    y: ppos[p.group][p.id].y,
                    properties: {
                        'port.side': p.group == "in" ? "WEST" : p.group == "in2" ? "NORTH" : "EAST",
                        'port.borderOffset': 30,
                        'port.index': -i
                    }
                };
            });

            elkGraph.children.push({
                id: cell.id,
                width: size.width,
                height: size.height,
                ports: ports,
                properties: {
                    portConstraints: 'FIXED_POS',
                    layerConstraint: (cell instanceof Input || cell instanceof Clock) ? "FIRST" 
                                                             : cell instanceof Output ? "LAST" : "NONE"
                }
            });
        }
    }
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
        from_elkjs(graph, g);
    });
}

