export class BinaryTree {
    constructor(nodes, bst_edges, node_sep_x) {
        this.nodes = nodes;
        this.bst_edges = bst_edges;
        this.max_node_id = Math.max(...nodes.map(d => d.id));
        this.max_edge_id = Math.max(...bst_edges.map(d => d.id));
        this.nodes_by_id = new Map(nodes.map((d, i) => [d.id, d]));
        this.edges_by_id = new Map(bst_edges.map((d, i) => [d.id, d]));
        this.node_sep_x = node_sep_x;
        this.descendants;
        this.leftChild;
        this.rightChild;
        this.parent;
        this.roots;

        this._recompute();
    }

    _compute_descendants(node_id, path) {
        // Recursively compute descendant set and check for cycles
        if (path.includes(node_id)) {
            throw new Error(`Cycle present including node "${link.parent.label}"`);
        }
        const left_id = this.leftChild.has(node_id) ? this.leftChild.get(node_id) : null;
        const right_id = this.rightChild.has(node_id) ? this.rightChild.get(node_id) : null;
        const left_desc = left_id === null ? new Set() : this._compute_descendants(left_id, path.concat(node_id))
        const right_desc = right_id === null ? new Set() : this._compute_descendants(right_id, path.concat(node_id))
        const desc = left_desc.union(right_desc);
        if (left_id !== null) desc.add(left_id);
        if (right_id !== null) desc.add(right_id);
        this.descendants.set(node_id, desc);
        return desc;
    }

    _recompute() {
        // Make edges references rather than ids
        this.bst_edges.forEach(link => {
            if (typeof link.parent !== "object") link.parent = this.getNodeById(link.parent);
            if (typeof link.child !== "object") link.child = this.getNodeById(link.child);
        });

        // Set edge lists and check for duplicate parents and children
        this.leftChild = new Map();
        this.rightChild = new Map();
        this.parent = new Map();
        this.roots = new Set(this.nodes.map((d, i) => d.id));

        this.bst_edges.forEach(link => {
            const child_map = link.type == "left" ? this.leftChild : this.rightChild;
            if (child_map.has(link.parent.id)) throw new Error(`Node "${link.parent.label}" already has two ${link.type} children`);
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
        this.bst_edges = this.bst_edges.filter(d => d.parent.id !== id && d.child.id !== id);
        this.nodes_by_id.delete(id);
        this.edges_by_id = new Map(this.bst_edges.map((d, i) => [d.id, d]));
        this._recompute();
        return node;
    }

    canAddEdge(parent_id, child_id, type) {
        if (type === "left") {
            if (this.leftChild.has(parent_id)) return false;
        } else {
            if (this.rightChild.has(parent_id)) return false;
        }
        if (this.parent.has(child_id)) return false;
        if (this.descendants.get(child_id).has(parent_id)) return false;

        return true;
    }

    addEdge(parent_id, child_id, type) {
        const edge = {id: this.max_edge_id + 1, parent: parent_id, child: child_id, type: type, selected: false};
        const parent = this.getNodeById(parent_id);
        const child = this.getNodeById(child_id);

        if (type === "left") {
            if (this.leftChild.has(parent_id)) throw new Error(`Node ${parent.label} already has a left child`);
        } else {
            if (this.rightChild.has(parent_id)) throw new Error(`Node ${parent.label} already has a right child`);
        }
        if (this.parent.has(child_id)) throw new Error(`Node ${child.label} already has a parent`);
        if (this.descendants.get(child_id).has(parent_id)) throw new Error("Adding this edge would create a loop");

        this.max_edge_id++;
        this.edges_by_id.set(edge.id, edge);
        this.bst_edges.push(edge);

        this._recompute();
        
        return edge;
    }

    deleteEdge(id) {
        const edge = this.edges_by_id.get(id);
        this.bst_edges = this.bst_edges.filter(d => d.id !== id);
        this.edges_by_id.delete(id);

        this._recompute();

        return edge;
    }

    clearAll() {
        this.nodes = [];
        this.bst_edges = [];
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
        const edges_dict = this.bst_edges.map(d => { return {id: d.id, parent: d.parent.id, child: d.child.id, type: d.type, selected: false} });
        return JSON.stringify({
            nodes: nodes_dict,
            bst_edges: edges_dict,
            node_sep_x: this.node_sep_x
        });
    }

    static fromString(jsonString) {
        const json = JSON.parse(jsonString);
        return new BinaryTree(json.nodes, json.bst_edges, json.node_sep_x);
     }
}