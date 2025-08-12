import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

export class Graph {
    constructor(nodes, edges, width, height, node_sep, tick) {
        this.nodes = nodes;
        this.edges = edges;
        this.max_node_id = Math.max(...nodes.map(d => d.id));
        this.max_edge_id = Math.max(...edges.map(d => d.id));
        this.nodes_by_id = new Map(nodes.map(d => [d.id, d]));
        this.edges_by_id = new Map(edges.map(d => [d.id, d]));
        this.node_sep = node_sep;
        this.tick = tick;

        this._recompute();

        this.simulation =
            d3.forceSimulation(this.nodes)
                .alphaTarget(0.3)
                .force("center", d3.forceCenter(width / 2, height / 2))
                .force("collide", d3.forceCollide(d => d.r))
                .force("links", d3.forceLink(this.edges).distance(node_sep))
                .force("repulse", d3.forceManyBody().strength(-200).distanceMax(1.1 * node_sep))
                .on("tick", tick);
    }

    _recompute() {
        // Make edges references rather than ids
        this.edges.forEach(link => {
            if (typeof link.source !== "object") link.source = this.getNodeById(link.source);
            if (typeof link.target !== "object") link.target = this.getNodeById(link.target);
        });
    }

    refreshSim(width, height) {
        this.simulation
            .nodes(this.nodes)
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("links", d3.forceLink(this.edges).distance(this.node_sep))
            .alphaTarget(0.3);
    }

    restartSim() {
        this.simulation.alphaTarget(0.3).restart();
    }

    getNodeById(id) {
        return this.nodes_by_id.get(id);
    }

    getEdgeById(id) {
        return this.edges_by_id.get(id);
    }

    addNode(x, y, r, color, shape, label = null) {
        const node = {id: this.max_node_id + 1, x: x, y: y, r: r, label: label ? label : String(this.max_node_id + 1), color: color, shape: shape, selected: false};
        this.nodes.push(node);
        this.max_node_id++;
        this.nodes_by_id.set(node.id, node);
        this._recompute();
        return node;
    }

    deleteNode(id) {
        const node = this.nodes_by_id.get(id);
        this.nodes = this.nodes.filter(d => d.id !== id);
        this.edges = this.edges.filter(d => d.source.id !== id && d.target.id !== id);
        this.nodes_by_id.delete(id);
        this.edges_by_id = new Map(this.edges.map((d, i) => [d.id, d]));
        this._recompute();
        return node;
    }

    addEdge(source_id, target_id, label) {
        const edge = {id: this.max_edge_id + 1, source: source_id, target: target_id, label: label, selected: false};
        const source = this.getNodeById(source_id);
        const target = this.getNodeById(target_id);

        this.max_edge_id++;
        this.edges_by_id.set(edge.id, edge);
        this.edges.push(edge);

        this._recompute();
        
        return edge;
    }

    deleteEdge(id) {
        const edge = this.edges_by_id.get(id);
        this.edges = this.edges.filter(d => d.id !== id);
        this.edges_by_id.delete(id);

        this._recompute();

        return edge;
    }

    clearAll() {
        this.nodes = [];
        this.edges = [];
        this._recompute();
    }

    stringify() {
        const nodes_dict = this.nodes.map(d => { return {id: d.id, x: d.x, y: d.y, r: d.r, label: d.label, color: d.color, selected: false, shape: d.shape}  });
        const edges_dict = this.edges.map(d => { return {id: d.id, source: d.source.id, target: d.target.id, label: d.label, selected: false} });
        return JSON.stringify({
            nodes: nodes_dict,
            edges: edges_dict,
            node_sep: this.node_sep
        });
    }

    static fromString(jsonString, width, height, tick) {
        const json = JSON.parse(jsonString);
        return new Graph(json.nodes, json.edges, width, height, json.node_sep, tick);
     }
}