import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const RED = "rgba(220, 50, 32, 1)"
const RADIUS = 50;
const NODE_SEP_X = 130;
const NODE_SEP_Y = 220;

// Apply a force to align the nodes into a binary tree
function forceBinaryTree(links, strength = 0.1) {
  var nodes, random, nodeById;

  function initialize() {
    if (!nodes) return;

    nodeById = new Map(nodes.map((d, i) => [d.id, d]));

    links.forEach(link => {
      if (typeof link.parent !== "object") link.parent = nodeById.get(link.parent);
      if (typeof link.child !== "object") link.child = nodeById.get(link.child);
    });
  }

  function force(alpha) {
    links.forEach(link => {
      let par = link.parent;
      let child = link.child;
      // The position we want to move the child to
      let expect_x = par.x;
      if (link.type == "left") {
        expect_x -= child.bst_width_right + NODE_SEP_X;
      } else {
        expect_x += child.bst_width_left + NODE_SEP_X;
      }
      let expect_y = par.y + NODE_SEP_Y;
      // Modify the velocity to move it towards the desired location
      // x alignment is slightly more important, so make the force stronger
      child.vx += (expect_x - child.x) * strength * 1.05 * alpha;
      child.vy += (expect_y - child.y) * strength * alpha;
    });
  }

  force.initialize = function(_nodes, _random) {
    nodes = _nodes;
    random = _random;
    initialize();
  };

  return force;
}

// Compute the spacing needed to ensure tree nodes don't overlap
function recomputeSpacing(nodes, links) {
  let nodeById = new Map(nodes.map((d, i) => [d.id, d]));
  // Convert edge list to adjacency list
  let leftChild = new Map();
  let rightChild = new Map();
  // Find root node(s)
  let roots = new Set(nodes.map((d, i) => d.id));
  links.forEach(link => {
    roots.delete(link.child);
    (link.type == "left" ? leftChild : rightChild).set(link.parent, link.child);
  });

  // Recursively compute the width needed to ensure
  // that the subtrees don't overlap
  function get_widths(id) {
    let node = nodeById.get(id);
    if (leftChild.has(id)) {
      get_widths(leftChild.get(id));
    }
    if (rightChild.has(id)) {
      get_widths(rightChild.get(id));
    }
    let left = leftChild.has(id) ? nodeById.get(leftChild.get(id)) : null;
    let right = rightChild.has(id) ? nodeById.get(rightChild.get(id)) : null;
    node.bst_width_left = 0;
    node.bst_width_right = 0;
    // If there is a left or right child, the parent needs
    // enough space to hold that child's subtree plus some padding
    if (left != null) {
      node.bst_width_left = NODE_SEP_X + left.bst_width;
    }
    if (right != null) {
      node.bst_width_right = NODE_SEP_X + right.bst_width;
    }
    node.bst_width = node.bst_width_left + node.bst_width_right;
    console.log(node);
  }
  roots.forEach(get_widths);
}

var width = window.innerWidth,
    height = window.innerHeight;

let svg = d3.select("#container")
  .append("svg")
  .attr("width", width)
  .attr("height", height);

let defs = svg.append("defs");

defs.append("filter")
  .attr("id", "dropShadowLow")
  .append("feDropShadow")
  .attr("dx", 0)
  .attr("dy", 1)
  .attr("stdDeviation", 3)
  .attr("flood-opacity", 0.8);

defs.append("filter")
  .attr("id", "dropShadowHigh")
  .append("feDropShadow")
  .attr("dx", 0)
  .attr("dy", 3)
  .attr("stdDeviation", 5)
  .attr("flood-opacity", 0.9);

let nodes = [
    {id: 0, x: 80, y: 80, r: RADIUS, label: "0", color: RED}, 
    {id: 1, x: 200, y: 160, r: RADIUS, label: "1", color: RED}, 
    {id: 2, x: 380, y: 100, r: RADIUS, label: "2", color: RED},
    {id: 3, x: 380, y: 100, r: RADIUS, label: "3", color: "black"},
    {id: 4, x: 380, y: 100, r: RADIUS, label: "4", color: "black"},
    {id: 5, x: 380, y: 100, r: RADIUS, label: "5", color: RED},
    {id: 6, x: 380, y: 100, r: RADIUS, label: "6", color: "black"},
    {id: 7, x: 380, y: 100, r: RADIUS, label: "7", color: "black"},
];

let bst_edges = [
  {parent: 1, child: 0, type: "left"},
  {parent: 1, child: 3, type: "right"},
  {parent: 3, child: 4, type: "right"},
  {parent: 3, child: 2, type: "left"},
  {parent: 0, child: 5, type: "right"},
  {parent: 2, child: 6, type: "left"},
  {parent: 5, child: 7, type: "right"},
]

recomputeSpacing(nodes, bst_edges);

const simulation = d3
  .forceSimulation(nodes)
  .alphaTarget(0.3)
  .force("repulse", d3.forceManyBody().strength(-120))
  .force("x_central", d3.forceX(width / 2).strength(0.01))
  .force("y_central", d3.forceY(height / 2).strength(0.01))
  .force("center", d3.forceCenter(width/2,height/2))
  .force("collide", d3.forceCollide(d => d.r))
  .force("BST", forceBinaryTree(bst_edges))
  .on("tick", tick);

const link = svg.append("g")
  .selectAll(".link")
  .data(bst_edges)
  .join("path")
  .attr("stroke-width", "8px")
  .attr("fill", "none")
  .attr("stroke", "black");

const node = svg
  .append("g")
  .selectAll(".node")
  .data(nodes)
  .join("g")
  .attr("class", "node")
  .attr("stroke-width", "1px")
  .on("click", click)
  .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended))
  .on('mouseover', function(e, d) {
    d3.select(this).selectAll("circle").attr("stroke-width", "2px");
    d3.select(this).selectAll("circle").attr("filter", "url(#dropShadowHigh)");
    d3.select(this).raise();
    
  })
  .on('mouseout', function(e, d) {
    d3.select(this).selectAll("circle").attr("stroke-width", "1px");
    d3.select(this).selectAll("circle").attr("filter", "url(#dropShadowLow)");
  });

node
  .append("circle")
  .attr("r", d => d.r)
  .style("fill", d => d.color)
  .attr("filter", "url(#dropShadowLow)");

node
  .append("text")
  .text(d => d.label)
  .attr("text-anchor", "middle")
  .attr("dominant-baseline", "central")
  .attr("font-size", "2.5em")
  .attr("font-family", "sans-serif")
  .attr("fill", "white");

function drawChildLink(d) {
  return `M ${d.parent.x},${d.parent.y} Q${d.child.x},${d.parent.y} ${d.child.x},${d.child.y}`
}

function tick() {
  // link
  //   .attr("x1", d => d.parent.x)
  //   .attr("y1", d => d.parent.y)
  //   .attr("x2", d => d.child.x)
  //   .attr("y2", d => d.child.y);
  link.attr("d", d => drawChildLink(d))

  node.attr("transform", d => `translate(${d.x},${d.y})`);
}

function click(event, d) {
  console.log(d);
}

function dragstarted(event) {
  // if (!event.active) simulation.alphaTarget(0.3).restart();
  if (!event.active) simulation.alphaTarget(0.3).restart();
  event.subject.fx = event.subject.x;
  event.subject.fy = event.subject.y;
}

function dragged(event) {
  event.subject.fx = event.x;
  event.subject.fy = event.y;
}

function dragended(event) {
  // if (!event.active) simulation.alphaTarget(0);
  event.subject.fx = null;
  event.subject.fy = null;
}