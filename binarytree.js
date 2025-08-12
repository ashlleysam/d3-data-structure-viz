import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

export class BinaryTree {
    constructor(nodes, edges, width, height, force_strength, node_sep_x, node_sep_y, tick) {
        this.nodes = nodes;
        this.edges = edges;
        this.max_node_id = Math.max(...nodes.map(d => d.id));
        this.max_edge_id = Math.max(...edges.map(d => d.id));
        this.nodes_by_id = new Map(nodes.map(d => [d.id, d]));
        this.edges_by_id = new Map(edges.map(d => [d.id, d]));
        this.node_sep_x = node_sep_x;
        this.node_sep_y = node_sep_y;
        this.force_strength = force_strength;
        this.tick = tick;
        this.descendants;
        this.leftChild;
        this.rightChild;
        this.parent;
        this.roots;

        this._recompute();

        this.simulation =
            d3.forceSimulation(this.nodes)
                .alphaTarget(0.3)
                .force("center", d3.forceCenter(width / 2, height / 2))
                .force("collide", d3.forceCollide(d => d.r))
                .force("BST", BinaryTree.forceBinaryTree(this.edges, this.force_strength, this.node_sep_x, this.node_sep_y))
                .on("tick", tick);
    }

    _compute_descendants(node_id, path) {
        // Recursively compute descendant set and check for cycles
        if (path.includes(node_id)) {
            throw new Error(`Cycle present including node "${link.parent.label}"`);
        }
        const left_id = this.leftChild.has(node_id) ? this.leftChild.get(node_id) : null;
        const right_id = this.rightChild.has(node_id) ? this.rightChild.get(node_id) : null;
        const left_desc = left_id === null ? new Set() : this._compute_descendants(left_id, path.concat(node_id));
        const right_desc = right_id === null ? new Set() : this._compute_descendants(right_id, path.concat(node_id));
        const desc = left_desc.union(right_desc);
        if (left_id !== null) desc.add(left_id);
        if (right_id !== null) desc.add(right_id);
        this.descendants.set(node_id, desc);
        return desc;
    }

    _recompute() {
        // Make edges references rather than ids
        this.edges.forEach(link => {
            if (typeof link.parent !== "object") link.parent = this.getNodeById(link.parent);
            if (typeof link.child !== "object") link.child = this.getNodeById(link.child);
        });

        // Set edge lists and check for duplicate parents and children
        this.leftChild = new Map();
        this.rightChild = new Map();
        this.parent = new Map();
        this.roots = new Set(this.nodes.map((d, i) => d.id));

        this.edges.forEach(link => {
            const child_map = link.label == "left" ? this.leftChild : this.rightChild;
            if (child_map.has(link.parent.id)) throw new Error(`Node "${link.parent.label}" already has two ${link.label} children`);
            child_map.set(link.parent.id, link.child.id);

            if (this.parent.has(link.child.id)) throw new Error(`Node "${link.child.label}" already has a parent`);
            this.parent.set(link.child.id, link.parent.id);

            this.roots.delete(link.child.id);
        });

        this.descendants = new Map();
        this.roots.forEach(id => this._compute_descendants(id, []));

        // Recursively compute the width needed to ensure
        // that the subtrees don't overlap
        this.roots.forEach(id => this._get_widths(id));
    }

    static forceBinaryTree(edges, strength, node_sep_x, node_sep_y) {
        // Apply a force to align the nodes into a binary tree
        function force(alpha) {
            edges.forEach(link => {
                let par = link.parent;
                let child = link.child;
                // The position we want to move the child to
                let expect_x = par.x;
                if (link.label == "left") {
                    expect_x -= child.bst_width_right + node_sep_x;
                } else {
                    expect_x += child.bst_width_left + node_sep_x;
                }
                let expect_y = par.y + node_sep_y;
                // Modify the velocity to move it towards the desired location
                // x alignment is slightly more important, so make the force stronger
                const dx = expect_x - child.x;
                const dpos = dx >= 0 ? 1 : -1;
                // child.vx += (expect_x - child.x) * strength * 1.05 * alpha;
                child.vx += dpos * Math.pow(Math.abs(dx), 1.2) * strength * 1.05 * alpha;
                child.vy += (expect_y - child.y) * strength * alpha;
            });
        }

        return force;
    }

    refreshSim(width, height) {
        this.simulation
            .nodes(this.nodes)
            .force("BST", BinaryTree.forceBinaryTree(this.edges, this.force_strength, this.node_sep_x, this.node_sep_y))
            .force("center", d3.forceCenter(width / 2, height / 2))
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
        this.edges = this.edges.filter(d => d.parent.id !== id && d.child.id !== id);
        this.nodes_by_id.delete(id);
        this.edges_by_id = new Map(this.edges.map((d, i) => [d.id, d]));
        this._recompute();
        return node;
    }

    canAddEdge(parent_id, child_id, label) {
        if (label === "left") {
            if (this.leftChild.has(parent_id)) return false;
        } else {
            if (this.rightChild.has(parent_id)) return false;
        }
        if (this.parent.has(child_id)) return false;
        if (this.descendants.get(child_id).has(parent_id)) return false;

        return true;
    }

    addEdge(parent_id, child_id, label) {
        const edge = {id: this.max_edge_id + 1, parent: parent_id, child: child_id, label: label, selected: false};
        const parent = this.getNodeById(parent_id);
        const child = this.getNodeById(child_id);

        if (label === "left") {
            if (this.leftChild.has(parent_id)) throw new Error(`Node ${parent.label} already has a left child`);
        } else {
            if (this.rightChild.has(parent_id)) throw new Error(`Node ${parent.label} already has a right child`);
        }
        if (this.parent.has(child_id)) throw new Error(`Node ${child.label} already has a parent`);
        if (this.descendants.get(child_id).has(parent_id)) throw new Error("Adding this edge would create a loop");

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

    _get_widths(id) {
        const par_node = this.getNodeById(id);
        if (this.leftChild.has(id)) {
            this._get_widths(this.leftChild.get(id));
        }
        if (this.rightChild.has(id)) {
            this._get_widths(this.rightChild.get(id));
        }
        const left = this.leftChild.has(id) ? this.getNodeById(this.leftChild.get(id)) : null;
        const right = this.rightChild.has(id) ? this.getNodeById(this.rightChild.get(id)) : null;
        par_node.bst_width_left = 0;
        par_node.bst_width_right = 0;
        // If there is a left or right child, the parent needs
        // enough space to hold that child's subtree plus some padding
        if (left != null) {
            par_node.bst_width_left = Math.max(this.node_sep_x + left.bst_width, par_node.r);
        }
        if (right != null) {
            par_node.bst_width_right = Math.max(this.node_sep_x + right.bst_width, par_node.r);
        }
        par_node.bst_width = par_node.bst_width_left + par_node.bst_width_right;
    }

    stringify() {
        const nodes_dict = this.nodes.map(d => { return {id: d.id, x: d.x, y: d.y, r: d.r, label: d.label, color: d.color, selected: false, shape: d.shape}  });
        const edges_dict = this.edges.map(d => { return {id: d.id, parent: d.parent.id, child: d.child.id, label: d.label, selected: false} });
        return JSON.stringify({
            nodes: nodes_dict,
            bst_edges: edges_dict,
            node_sep_x: this.node_sep_x,
            node_sep_y: this.node_sep_y,
            force_strength: this.force_strength
        });
    }

    static fromString(jsonString, width, height, tick) {
        const json = JSON.parse(jsonString);
        return new BinaryTree(json.nodes, json.bst_edges, width, height, json.force_strength, json.node_sep_x,  json.node_sep_y, tick);
     }
}